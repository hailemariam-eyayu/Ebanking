'use strict'
/**
 * CBS Oracle DB client (Thick Mode via local SSH Tunnel)
 * Direct read-only queries against FLEXCUBE reporting views.
 *
 * Resilient SSH tunnel: auto-reconnects when the SSH session drops.
 */
require('dotenv').config()
const net      = require('net')
const { Client } = require('ssh2')
const oracledb = require('oracledb')

// Initialize Thick Mode to support legacy database protocol versions
try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_31' })
  console.log('[cbsOracle] Oracle Thick mode initialized.')
} catch (err) {
  console.error('[cbsOracle] Failed to initialize Oracle Client binaries:', err.message)
  process.exit(1)
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const [hostPort, serviceName] = (process.env.CBS_DB_URL || '').split('/')
const [localHost, localPort = '1522'] = (hostPort || '').split(':')
const LOCAL_PORT = parseInt(localPort)

const POOL_ALIAS = 'CBS_POOL'

// ── Tunnel state ──────────────────────────────────────────────────────────────
let sshClient      = null   // active ssh2 Client instance
let sshReady       = false  // true only while client.on('ready') and not yet closed
let tunnelServer   = null   // net.Server instance
let tunnelPromise  = null   // in-flight connect promise (prevents parallel reconnects)
let poolPromise    = null   // OracleDB pool promise

// ── SSH tunnel ────────────────────────────────────────────────────────────────
function connectSsh() {
  return new Promise((resolve, reject) => {
    const client = new Client()

    client.on('ready', () => {
      console.log('[cbsOracle] SSH connected.')
      sshClient = client
      sshReady  = true
      resolve(client)
    })

    client.on('error', (err) => {
      console.error('[cbsOracle] SSH error:', err.message)
      sshReady = false
      // Only reject if we're still waiting for the initial connect
      reject(err)
    })

    client.on('close', () => {
      console.warn('[cbsOracle] SSH connection closed — will reconnect on next query.')
      sshReady     = false
      sshClient    = null
      tunnelPromise = null  // allow re-connect next time
      // Close and re-create the tunnel server so stale port handles are cleaned up
      if (tunnelServer) {
        tunnelServer.close(() => { tunnelServer = null })
      }
      // Oracle pool connections will fail naturally; clear the pool so it is recreated
      poolPromise = null
      if (oracledb.getPool) {
        try { oracledb.getPool(POOL_ALIAS).close(0).catch(() => {}) } catch (_) {}
      }
    })

    client.connect({
      host:           process.env.SSH_HOST,
      port:           parseInt(process.env.SSH_PORT || '22'),
      username:       process.env.SSH_USER,
      password:       process.env.SSH_PASSWORD,
      keepaliveInterval: 30000,   // send keepalive every 30 s
      keepaliveCountMax: 3,       // drop after 3 missed keepalives (~90 s)
      readyTimeout:   20000,
    })
  })
}

function startTunnelServer(client) {
  return new Promise((resolve, reject) => {
    const server = net.createServer((localSocket) => {
      if (!sshReady || !sshClient) {
        // SSH is down — close the socket so the caller gets an ECONNRESET instead of hanging
        localSocket.destroy(new Error('SSH tunnel not connected'))
        return
      }
      sshClient.forwardOut(
        localHost, LOCAL_PORT,
        process.env.REMOTE_DB_HOST,
        parseInt(process.env.REMOTE_DB_PORT || '1521'),
        (err, remoteStream) => {
          if (err) {
            console.error('[cbsOracle] forwardOut error:', err.message)
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
        // Port already in use — another process (or previous run) has it; reuse it
        console.log(`[cbsOracle] Port ${LOCAL_PORT} already bound — reusing.`)
        tunnelServer = server
        resolve()
      } else {
        reject(err)
      }
    })

    server.listen(LOCAL_PORT, localHost, () => {
      console.log(`[cbsOracle] Tunnel listening on ${localHost}:${LOCAL_PORT}`)
      tunnelServer = server
      resolve()
    })
  })
}

async function ensureTunnel() {
  // Already up
  if (sshReady && sshClient && tunnelServer) return

  // Already connecting — wait for that promise
  if (tunnelPromise) return tunnelPromise

  tunnelPromise = (async () => {
    try {
      const client = await connectSsh()
      if (!tunnelServer) {
        await startTunnelServer(client)
      }
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
      try { return oracledb.getPool(POOL_ALIAS) } catch (_) { /* not created yet */ }

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

async function getAccountsByPhone(phone) {
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    const result = await conn.execute(
      `SELECT ACCOUNT_NUMBER, MOBILE_NUMBER, ACCOUNT_CLASS, CCY, FULL_NAME,
              CURRENT_BALANCE, AC_STAT_DORMANT, AC_STAT_NO_DR, AC_STAT_NO_CR,
              AC_STAT_BLOCK, AC_STAT_FROZEN, RECORD_STAT, AUTH_STAT
         FROM EBFCPROD.EBVW_CUST_BAL_ACCOUNT_INFO
        WHERE MOBILE_NUMBER = :phone`,
      { phone }
    )
    return result.rows.map(mapAccount)
  } finally {
    await conn.close()
  }
}

async function getAccountsByCif(custNo) {
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    const result = await conn.execute(
      `SELECT a.ACCOUNT_NUMBER, a.MOBILE_NUMBER, a.ACCOUNT_CLASS, a.CCY, a.FULL_NAME,
              a.CURRENT_BALANCE, a.AC_STAT_DORMANT, a.AC_STAT_NO_DR, a.AC_STAT_NO_CR,
              a.AC_STAT_BLOCK, a.AC_STAT_FROZEN, a.RECORD_STAT, a.AUTH_STAT
         FROM EBFCPROD.EBVW_CUST_BAL_ACCOUNT_INFO a
         JOIN EBFCPROD.STTM_CUST_ACCOUNT ca
           ON ca.CUST_NO = LTRIM(SUBSTR(a.ACCOUNT_NUMBER, 5, 7), '0')
        WHERE ca.CUST_NO = :custNo`,
      { custNo }
    )
    return result.rows.map(mapAccount)
  } finally {
    await conn.close()
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapAccount(row) {
  return {
    accountNumber:  row.ACCOUNT_NUMBER,
    mobileNumber:   row.MOBILE_NUMBER,
    accountClass:   row.ACCOUNT_CLASS,
    currency:       row.CCY,
    fullName:       row.FULL_NAME,
    currentBalance: row.CURRENT_BALANCE,
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

module.exports = { getAccountsByPhone, getAccountsByCif }

// ── Standalone test ───────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    try {
      console.log('Testing Oracle connection...')
      const data = await getAccountsByPhone('251911223344')
      console.log('Results:', JSON.stringify(data, null, 2))
    } catch (err) {
      console.error('Test failed:', err)
    } finally {
      process.exit()
    }
  })()
}
