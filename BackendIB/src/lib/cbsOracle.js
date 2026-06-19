'use strict'
/**
 * CBS Oracle DB client — direct balance queries against FLEXCUBE reporting views.
 * Resilient SSH tunnel: auto-reconnects when the SSH session drops.
 */
require('dotenv').config()
const net      = require('net')
const { Client } = require('ssh2')
const oracledb = require('oracledb')

try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_31' })
} catch (err) {
  if (!err.message.includes('already')) {
    console.warn('[cbsOracle-IB] Oracle Thick mode init warning:', err.message)
  }
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const [hostPort, serviceName] = (process.env.CBS_DB_URL || '').split('/')
const [localHost, localPort = '1522'] = (hostPort || '').split(':')
const LOCAL_PORT = parseInt(localPort)

const POOL_ALIAS = 'CBS_IB_POOL'

// ── Tunnel state ──────────────────────────────────────────────────────────────
let sshClient     = null
let sshReady      = false
let tunnelServer  = null
let tunnelPromise = null
let poolPromise   = null

// ── SSH connect ───────────────────────────────────────────────────────────────
function connectSsh() {
  return new Promise((resolve, reject) => {
    const client = new Client()

    client.on('ready', () => {
      console.log('[cbsOracle-IB] SSH connected.')
      sshClient = client
      sshReady  = true
      resolve(client)
    })

    client.on('error', (err) => {
      console.error('[cbsOracle-IB] SSH error:', err.message)
      sshReady = false
      reject(err)
    })

    client.on('close', () => {
      console.warn('[cbsOracle-IB] SSH connection closed — will reconnect on next query.')
      sshReady      = false
      sshClient     = null
      tunnelPromise = null
      poolPromise   = null
      if (tunnelServer) {
        tunnelServer.close(() => { tunnelServer = null })
      }
      try { oracledb.getPool(POOL_ALIAS).close(0).catch(() => {}) } catch (_) {}
    })

    client.connect({
      host:              process.env.SSH_HOST,
      port:              parseInt(process.env.SSH_PORT || '22'),
      username:          process.env.SSH_USER,
      password:          process.env.SSH_PASSWORD,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
      readyTimeout:      20000,
    })
  })
}

// ── Tunnel server ─────────────────────────────────────────────────────────────
function startTunnelServer(client) {
  return new Promise((resolve, reject) => {
    const server = net.createServer((localSocket) => {
      if (!sshReady || !sshClient) {
        localSocket.destroy(new Error('SSH tunnel not connected'))
        return
      }
      sshClient.forwardOut(
        localHost, LOCAL_PORT,
        process.env.REMOTE_DB_HOST,
        parseInt(process.env.REMOTE_DB_PORT || '1521'),
        (err, remoteStream) => {
          if (err) {
            console.error('[cbsOracle-IB] forwardOut error:', err.message)
            localSocket.destroy()
            return
          }
          localSocket.pipe(remoteStream)
          remoteStream.pipe(localSocket)
          remoteStream.on('close', () => localSocket.destroy())
          localSocket.on('close',  () => remoteStream.destroy())
        }
      )
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[cbsOracle-IB] Port ${LOCAL_PORT} already bound — reusing.`)
        tunnelServer = server
        resolve()
      } else {
        reject(err)
      }
    })

    server.listen(LOCAL_PORT, localHost, () => {
      console.log(`[cbsOracle-IB] Tunnel listening on ${localHost}:${LOCAL_PORT}`)
      tunnelServer = server
      resolve()
    })
  })
}

// ── Ensure tunnel is up ───────────────────────────────────────────────────────
async function ensureTunnel() {
  if (sshReady && sshClient && tunnelServer) return
  if (tunnelPromise) return tunnelPromise

  tunnelPromise = (async () => {
    try {
      const client = await connectSsh()
      if (!tunnelServer) await startTunnelServer(client)
    } catch (err) {
      tunnelPromise = null
      throw err
    }
  })()

  return tunnelPromise
}

// ── Oracle pool ───────────────────────────────────────────────────────────────
async function getPool() {
  await ensureTunnel()
  if (poolPromise) return poolPromise

  poolPromise = (async () => {
    try {
      try { return oracledb.getPool(POOL_ALIAS) } catch (_) {}
      return await oracledb.createPool({
        alias:         POOL_ALIAS,
        user:          process.env.CBS_DB_Username?.trim(),
        password:      process.env.CBS_DB_Password?.trim(),
        connectString: `${localHost}:${LOCAL_PORT}/${serviceName}`,
        poolMin:       1,
        poolMax:       5,
        poolIncrement: 1,
        poolTimeout:   60,
      })
    } catch (err) {
      poolPromise = null
      throw err
    }
  })()

  return poolPromise
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Get balance and status for a single account number.
 */
async function getAccountBalance(accountNumber) {
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    const result = await conn.execute(
      `SELECT ACCOUNT_NUMBER, ACCOUNT_CLASS, CCY, FULL_NAME, CURRENT_BALANCE,
              AC_STAT_DORMANT, AC_STAT_NO_DR, AC_STAT_NO_CR,
              AC_STAT_BLOCK, AC_STAT_FROZEN, RECORD_STAT, AUTH_STAT
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
    const binds    = {}
    const inClause = accountNumbers.map((acc, i) => {
      binds[`a${i}`] = acc
      return `:a${i}`
    }).join(',')

    const result = await conn.execute(
      `SELECT ACCOUNT_NUMBER, ACCOUNT_CLASS, CCY, FULL_NAME, CURRENT_BALANCE,
              AC_STAT_DORMANT, AC_STAT_NO_DR, AC_STAT_NO_CR,
              AC_STAT_BLOCK, AC_STAT_FROZEN, RECORD_STAT, AUTH_STAT
         FROM EBFCPROD.EBVW_CUST_BAL_ACCOUNT_INFO
        WHERE ACCOUNT_NUMBER IN (${inClause})`,
      binds
    )
    const map = new Map()
    for (const row of result.rows) map.set(row.ACCOUNT_NUMBER, mapAccount(row))
    return map
  } finally {
    await conn.close()
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (row.RECORD_STAT    === 'C') return 'CLOSED'
  if (row.AC_STAT_FROZEN === 'Y') return 'FROZEN'
  if (row.AC_STAT_BLOCK  === 'Y') return 'BLOCKED'
  if (row.AC_STAT_NO_DR  === 'Y' && row.AC_STAT_NO_CR === 'Y') return 'SUSPENDED'
  if (row.AC_STAT_DORMANT === 'Y') return 'DORMANT'
  return 'ACTIVE'
}

module.exports = { getAccountBalance, getAccountBalances }
