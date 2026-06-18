'use strict'
/**
 * CBS Oracle DB client — direct balance queries against FLEXCUBE reporting views.
 * Uses SSH tunnel + Oracle Thick Mode (same setup as BackendBO).
 */
require('dotenv').config()
const net      = require('net')
const { Client } = require('ssh2')
const oracledb = require('oracledb')

// Thick Mode for legacy Oracle protocol support
try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_31' })
} catch (err) {
  // Already initialized or running in thin mode — non-fatal
  if (!err.message.includes('already')) {
    console.warn('[cbsOracle] Oracle Thick mode init warning:', err.message)
  }
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const [hostPort, serviceName] = (process.env.CBS_DB_URL || '').split('/')
const [localHost, localPort = '1522'] = (hostPort || '').split(':')

const POOL_ALIAS = 'CBS_IB_POOL'
let poolPromise      = null
let sshTunnelStarted = false

function createSshTunnel() {
  return new Promise((resolve, reject) => {
    if (sshTunnelStarted) return resolve()

    const sshClient    = new Client()
    const tunnelServer = net.createServer((localSocket) => {
      sshClient.forwardOut(
        localHost, parseInt(localPort),
        process.env.REMOTE_DB_HOST,
        parseInt(process.env.REMOTE_DB_PORT || '1521'),
        (err, remoteStream) => {
          if (err) { localSocket.end(); return }
          localSocket.pipe(remoteStream).pipe(localSocket)
        }
      )
    })

    tunnelServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        sshTunnelStarted = true
        resolve()
      } else {
        reject(err)
      }
    })

    sshClient.on('ready', () => {
      tunnelServer.listen(parseInt(localPort), localHost, () => {
        sshTunnelStarted = true
        resolve()
      })
    })

    sshClient.on('error', reject)

    sshClient.connect({
      host:     process.env.SSH_HOST,
      port:     parseInt(process.env.SSH_PORT || '22'),
      username: process.env.SSH_USER,
      password: process.env.SSH_PASSWORD,
    })
  })
}

async function getPool() {
  await createSshTunnel()
  if (poolPromise) return poolPromise

  poolPromise = (async () => {
    try {
      try { return oracledb.getPool(POOL_ALIAS) } catch (_) { /* not yet created */ }
      return await oracledb.createPool({
        alias:         POOL_ALIAS,
        user:          process.env.CBS_DB_Username?.trim(),
        password:      process.env.CBS_DB_Password?.trim(),
        connectString: `${localHost}:${localPort}/${serviceName}`,
        poolMin:       1,
        poolMax:       5,
        poolIncrement: 1,
      })
    } catch (err) {
      poolPromise = null
      throw err
    }
  })()

  return poolPromise
}

/**
 * Get balance and status for a single account number.
 * Returns null if account not found.
 */
async function getAccountBalance(accountNumber) {
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    const result = await conn.execute(
      `SELECT
         ACCOUNT_NUMBER,
         ACCOUNT_CLASS,
         CCY,
         FULL_NAME,
         CURRENT_BALANCE,
         AC_STAT_DORMANT,
         AC_STAT_NO_DR,
         AC_STAT_NO_CR,
         AC_STAT_BLOCK,
         AC_STAT_FROZEN,
         RECORD_STAT,
         AUTH_STAT
       FROM EBFCPROD.EBVW_CUST_BAL_ACCOUNT_INFO
       WHERE ACCOUNT_NUMBER = :accountNumber`,
      { accountNumber }
    )
    if (!result.rows.length) return null
    return mapAccount(result.rows[0])
  } finally {
    await conn.close()
  }
}

/**
 * Get balances for multiple account numbers in one query.
 * Returns a Map<accountNumber, accountData>.
 */
async function getAccountBalances(accountNumbers) {
  if (!accountNumbers.length) return new Map()
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    // Build bind variables for IN clause
    const binds   = {}
    const inClause = accountNumbers.map((acc, i) => {
      binds[`a${i}`] = acc
      return `:a${i}`
    }).join(',')

    const result = await conn.execute(
      `SELECT
         ACCOUNT_NUMBER,
         ACCOUNT_CLASS,
         CCY,
         FULL_NAME,
         CURRENT_BALANCE,
         AC_STAT_DORMANT,
         AC_STAT_NO_DR,
         AC_STAT_NO_CR,
         AC_STAT_BLOCK,
         AC_STAT_FROZEN,
         RECORD_STAT,
         AUTH_STAT
       FROM EBFCPROD.EBVW_CUST_BAL_ACCOUNT_INFO
       WHERE ACCOUNT_NUMBER IN (${inClause})`,
      binds
    )

    const map = new Map()
    for (const row of result.rows) {
      map.set(row.ACCOUNT_NUMBER, mapAccount(row))
    }
    return map
  } finally {
    await conn.close()
  }
}

function mapAccount(row) {
  return {
    accountNumber:  row.ACCOUNT_NUMBER,
    accountClass:   row.ACCOUNT_CLASS,
    currency:       row.CCY,
    fullName:       row.FULL_NAME,
    currentBalance: Number(row.CURRENT_BALANCE || 0),
    isDormant:      row.AC_STAT_DORMANT === 'Y',
    noDebit:        row.AC_STAT_NO_DR   === 'Y',
    noCredit:       row.AC_STAT_NO_CR   === 'Y',
    isBlocked:      row.AC_STAT_BLOCK   === 'Y',
    isFrozen:       row.AC_STAT_FROZEN  === 'Y',
    recordStat:     row.RECORD_STAT,
    authStat:       row.AUTH_STAT,
    status:         deriveStatus(row),
  }
}

function deriveStatus(row) {
  if (row.RECORD_STAT   === 'C') return 'CLOSED'
  if (row.AC_STAT_FROZEN === 'Y') return 'FROZEN'
  if (row.AC_STAT_BLOCK  === 'Y') return 'BLOCKED'
  if (row.AC_STAT_NO_DR  === 'Y' && row.AC_STAT_NO_CR === 'Y') return 'SUSPENDED'
  if (row.AC_STAT_DORMANT === 'Y') return 'DORMANT'
  return 'ACTIVE'
}

module.exports = { getAccountBalance, getAccountBalances }
