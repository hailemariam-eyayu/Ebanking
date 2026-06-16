'use strict'
/**
 * CBS Oracle DB client (Thick Mode via local SSH Tunnel)
 * Direct read-only queries against FLEXCUBE reporting views.
 */
require('dotenv').config()
const net = require('net')
const { Client } = require('ssh2')
const oracledb = require('oracledb')

// Initialize Thick Mode to support legacy database protocol versions
try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_31' })
  console.log('Oracle Thick mode initialized successfully.')
} catch (err) {
  console.error('Failed to initialize Oracle Client binaries:', err.message)
  process.exit(1)
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const [hostPort, serviceName] = (process.env.CBS_DB_URL || '').split('/')
const [localHost, localPort = '1522'] = (hostPort || '').split(':')

const POOL_ALIAS = 'CBS_POOL'
let poolPromise = null // Safely tracks the pool creation promise across parallel requests
let sshTunnelStarted = false

/**
 * Creates and maintains the SSH tunnel programmatically
 */
function createSshTunnel() {
  return new Promise((resolve, reject) => {
    if (sshTunnelStarted) return resolve()

    const sshClient = new Client()

    const tunnelServer = net.createServer((localSocket) => {
      sshClient.forwardOut(
        localHost,
        localPort,
        process.env.REMOTE_DB_HOST,
        parseInt(process.env.REMOTE_DB_PORT || '1521'),
        (err, remoteStream) => {
          if (err) {
            console.error('SSH forwarding failed:', err)
            localSocket.end()
            return
          }
          localSocket.pipe(remoteStream).pipe(localSocket)
        }
      )
    })

    // Avoid crashing if backend restarts quickly while port 1522 is finishing teardown
    tunnelServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${localPort} is already bound. Reusing existing channel context.`)
        sshTunnelStarted = true
        resolve()
      } else {
        reject(err)
      }
    })

    sshClient.on('ready', () => {
      tunnelServer.listen(parseInt(localPort), localHost, () => {
        console.log(`SSH Tunnel established locally on ${localHost}:${localPort}`)
        sshTunnelStarted = true
        resolve()
      })
    })

    sshClient.on('error', (err) => {
      console.error('SSH Client Error:', err)
      reject(err)
    })

    sshClient.connect({
      host: process.env.SSH_HOST,
      port: parseInt(process.env.SSH_PORT || '22'),
      username: process.env.SSH_USER,
      password: process.env.SSH_PASSWORD,
    })
  })
}

/**
 * Thread-safe pool manager resolving race conditions via cached promises
 */
async function getPool() {
  await createSshTunnel()

  // If a pool creation request is already flying or complete, return it directly
  if (poolPromise) return poolPromise

  poolPromise = (async () => {
    try {
      // Pre-check memory allocation in the underlying client
      try {
        return oracledb.getPool(POOL_ALIAS)
      } catch (e) {
        // Pool is unallocated, proceed to initialization sequence safely
      }

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
      poolPromise = null // Clear tracker on failure so subsequent attempts can re-try
      throw err
    }
  })()

  return poolPromise
}

/**
 * Query all accounts + balances for a given mobile number.
 */
async function getAccountsByPhone(phone) {
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    const result = await conn.execute(
      `SELECT
          ACCOUNT_NUMBER,
          MOBILE_NUMBER,
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
       WHERE MOBILE_NUMBER = :phone`,
      { phone }
    )
    return result.rows.map(mapAccount)
  } finally {
    await conn.close()
  }
}

/**
 * Query all accounts for a given CIF number.
 */
async function getAccountsByCif(custNo) {
  const pool = await getPool()
  const conn = await pool.getConnection()
  try {
    const result = await conn.execute(
      `SELECT
          a.ACCOUNT_NUMBER,
          a.MOBILE_NUMBER,
          a.ACCOUNT_CLASS,
          a.CCY,
          a.FULL_NAME,
          a.CURRENT_BALANCE,
          a.AC_STAT_DORMANT,
          a.AC_STAT_NO_DR,
          a.AC_STAT_NO_CR,
          a.AC_STAT_BLOCK,
          a.AC_STAT_FROZEN,
          a.RECORD_STAT,
          a.AUTH_STAT
       FROM EBFCPROD.EBVW_CUST_BAL_ACCOUNT_INFO a
       INNER JOIN EBFCPROD.STTM_CUST_ACCOUNT ca
         ON ca.CUST_NO  = LTRIM(SUBSTR(ACCOUNT_NUMBER, 5, 7), '0')
       WHERE ca.CUST_NO = :custNo`,
      { custNo }
    )
    return result.rows.map(mapAccount)
  } finally {
    await conn.close()
  }
}

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
  if (row.RECORD_STAT === 'C')       return 'CLOSED'
  if (row.AC_STAT_FROZEN === 'Y')   return 'FROZEN'
  if (row.AC_STAT_BLOCK  === 'Y')   return 'BLOCKED'
  if (row.AC_STAT_NO_DR  === 'Y' && row.AC_STAT_NO_CR === 'Y') return 'SUSPENDED'
  if (row.AC_STAT_DORMANT === 'Y')  return 'DORMANT'
  return 'ACTIVE'
}

module.exports = { getAccountsByPhone, getAccountsByCif }

// --- STANDALONE TEST SECTION ---
if (require.main === module) {
  (async () => {
    try {
      console.log('Testing connection configurations...')
      const data = await getAccountsByPhone('251911223344') 
      console.log('Query executed successfully!')
      console.log('Results:', JSON.stringify(data, null, 2))
    } catch (err) {
      console.error('Execution Failed:', err)
    } finally {
      process.exit()
    }
  })()
}