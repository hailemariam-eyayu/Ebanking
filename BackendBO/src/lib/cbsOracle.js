'use strict'
/**
 * CBS Oracle DB client
 * Direct read-only queries against FLEXCUBE reporting views.
 * Uses the thin driver (no Oracle client install required).
 */
require('dotenv').config()
const oracledb = require('oracledb')

// Thin mode is the default in oracledb v6+ — no Oracle Instant Client needed.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

// Parse CBS_DB_URL  "10.1.10.218:1521/EBPROD1"
const [hostPort, serviceName] = (process.env.CBS_DB_URL || '').split('/')
const [host, port = '1521']   = (hostPort || '').split(':')

const POOL_ALIAS = 'CBS_POOL'

let _poolCreated = false

async function getPool() {
  if (_poolCreated) return oracledb.getPool(POOL_ALIAS)
  _poolCreated = true
  return oracledb.createPool({
    alias:       POOL_ALIAS,
    user:        process.env.CBS_DB_Username?.trim(),
    password:    process.env.CBS_DB_Password?.trim(),
    connectString: `${host}:${port}/${serviceName}`,
    poolMin:     1,
    poolMax:     5,
    poolIncrement: 1,
  })
}

/**
 * Query all accounts + balances for a given mobile number.
 * Returns array of account rows.
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
    // The view doesn't have CUSTNO — join via account number prefix or use a different view.
    // FLEXCUBE account numbers contain the CIF: positions 3-9 for 16-digit accounts.
    // Safer: query by FULL_NAME match is unreliable — use the STTM_CUST_ACCOUNT table directly.
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
         ON ca.CUST_AC_NO = a.ACCOUNT_NUMBER
       WHERE ca.CUSTOMER_NO = :custNo`,
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
    recordStat:     row.RECORD_STAT,   // O=Open, C=Closed
    authStat:       row.AUTH_STAT,     // A=Authorised
    status:         deriveStatus(row),
  }
}

function deriveStatus(row) {
  if (row.RECORD_STAT === 'C')      return 'CLOSED'
  if (row.AC_STAT_FROZEN === 'Y')   return 'FROZEN'
  if (row.AC_STAT_BLOCK  === 'Y')   return 'BLOCKED'
  if (row.AC_STAT_NO_DR  === 'Y' && row.AC_STAT_NO_CR === 'Y') return 'SUSPENDED'
  if (row.AC_STAT_DORMANT === 'Y')  return 'DORMANT'
  return 'ACTIVE'
}

module.exports = { getAccountsByPhone, getAccountsByCif }
