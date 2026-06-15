/**
 * BO Customer Routes
 *
 * Search flow (by phone):
 *   1. Query Oracle view EBVW_CUST_BAL_ACCOUNT_INFO → all accounts + balances
 *   2. Extract CIF from first account number (chars 3-9) → SOAP QueryCustomer
 *   3. Return merged customer + accounts
 *
 * Search flow (by CIF):
 *   1. SOAP QueryCustomer → customer detail
 *   2. Oracle view query by CIF → accounts
 *
 * Search flow (by account):
 *   1. SOAP QueryCustAcc → single account detail (includes CUSTNO)
 *   2. SOAP QueryCustomer by CUSTNO → customer detail
 *   3. Oracle view query by CIF → all accounts
 *
 * GET /api/bo/customers/search?by=phone|account|cif&value=...
 * GET /api/bo/customers/:custNo
 * GET /api/bo/customers/:custNo/accounts
 * GET /api/bo/customers/:custNo/account/:accountNo  — single account detail via SOAP
 */
const router = require('express').Router()
const { verifyBO } = require('../middleware/auth')
const cbs    = require('../lib/cbsSoap')
const oracle = require('../lib/cbsOracle')

// ── Search ────────────────────────────────────────────────────────────────────
router.get('/search', verifyBO, async (req, res, next) => {
  try {
    const { by, value } = req.query
    if (!by || !value)
      return res.status(400).json({ message: 'by and value params required' })

    let customer, accounts = []

    if (by === 'phone') {
      // Step 1 — get accounts from Oracle view (fastest, one query)
      accounts = await oracle.getAccountsByPhone(value.trim())
      if (!accounts.length)
        return res.status(404).json({ message: 'No accounts found for this phone number' })

      // Step 2 — derive CIF from first account number (FLEXCUBE format: BBBCCCCCCC + suffix)
      // positions 3–9 (0-indexed) = 7-digit CIF, strip leading zeros
      const custNo = extractCifFromAccount(accounts[0].accountNumber)
      customer = await cbs.queryCustomer(custNo)

    } else if (by === 'cif') {
      customer = await cbs.queryCustomer(value.trim())
      if (!customer)
        return res.status(404).json({ message: 'Customer not found' })
      accounts = await oracle.getAccountsByCif(value.trim()).catch(() => [])

    } else if (by === 'account') {
      const acc = await cbs.queryCustAcc(value.trim())
      if (!acc) return res.status(404).json({ message: 'Account not found' })
      const custNo = acc.CUSTNO
      if (!custNo) return res.status(404).json({ message: 'Account has no linked customer' })
      [customer, accounts] = await Promise.all([
        cbs.queryCustomer(custNo),
        oracle.getAccountsByCif(custNo).catch(() => []),
      ])

    } else {
      return res.status(400).json({ message: 'by must be phone|account|cif' })
    }

    if (!customer) return res.status(404).json({ message: 'Customer not found' })
    res.json(mapCustomer(customer, accounts))
  } catch (err) { next(err) }
})

// ── Customer by CIF ───────────────────────────────────────────────────────────
router.get('/:custNo', verifyBO, async (req, res, next) => {
  try {
    const [customer, accounts] = await Promise.all([
      cbs.queryCustomer(req.params.custNo),
      oracle.getAccountsByCif(req.params.custNo).catch(() => []),
    ])
    if (!customer) return res.status(404).json({ message: 'Customer not found' })
    res.json(mapCustomer(customer, accounts))
  } catch (err) { next(err) }
})

// ── Accounts list for CIF ─────────────────────────────────────────────────────
router.get('/:custNo/accounts', verifyBO, async (req, res, next) => {
  try {
    const accounts = await oracle.getAccountsByCif(req.params.custNo)
    res.json({ custNo: req.params.custNo, accounts })
  } catch (err) { next(err) }
})

// ── Single account detail via SOAP ────────────────────────────────────────────
router.get('/:custNo/account/:accountNo', verifyBO, async (req, res, next) => {
  try {
    const detail = await cbs.queryCustAcc(req.params.accountNo)
    if (!detail) return res.status(404).json({ message: 'Account not found' })
    res.json(mapAccountDetail(detail))
  } catch (err) { next(err) }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * FLEXCUBE account number format: BBBCCCCCCCSSSSSS
 *   BBB       = 3-digit branch
 *   CCCCCCC   = 7-digit CIF
 *   SSSSSS    = sequence + suffix
 * So chars [3..9] are the CIF.
 */
function extractCifFromAccount(accountNo) {
  const raw = String(accountNo).replace(/\s/g, '')
  return String(parseInt(raw.substring(3, 10), 10))  // strip leading zeros
}

function mapCustomer(c, accounts = []) {
  const personal = c?.Custpersonal || {}
  const udfs = Array.isArray(c?.UDFDETAILS) ? c.UDFDETAILS : [c?.UDFDETAILS].filter(Boolean)
  const udfMap = {}
  udfs.forEach(u => { if (u?.FLDNAM) udfMap[u.FLDNAM] = u.FLDVAL || null })

  // Parse multiple phones (CBS stores them as "07150++0977++0939")
  const rawMobile = personal.MOBNUM || ''
  const phones = rawMobile.split('++').map(p => p.trim()).filter(Boolean)

  return {
    custNo:      c.CUSTNO,
    fullName:    c.FULLNAME || c.NAME,
    shortName:   c.SNAME,
    type:        c.CTYPE,          // I=Individual, C=Corporate
    category:    c.CCATEG,
    branch:      c.LBRN,
    country:     c.COUNTRY,
    frozen:      c.FROZEN === 'Y',
    dead:        c.DEAD   === 'Y',
    authStatus:  c.AUTHSTAT,
    cifCreatedAt:c.CIFCREATIONDT,
    personal: {
      firstName:  personal.FSTNAME,
      midName:    personal.MIDNAME,
      lastName:   personal.LSTNAME,
      dob:        personal.DOB,
      gender:     personal.GENDR,
      nationalId: personal.NATIONID,
      mobile:     rawMobile,
      phones,                        // array — let UI pick one
      lang:       personal.LANG,
    },
    udf: udfMap,
    accounts,
  }
}

function mapAccountDetail(a) {
  const amt = a['Amount-Dates'] || {}
  return {
    branch:         a.BRN,
    accountNumber:  a.ACC,
    custNo:         a.CUSTNO,
    accountClass:   a.ACCLS,
    accountClassDesc: a.ACCLASSDESC,
    currency:       a.CCY,
    custName:       a.CUSTNAME,
    accountType:    a.ACCLSTYP,   // S=Saving, C=Current, T=TD
    openDate:       a.ACCOPENDT,
    frozen:         a.FROZEN   === 'Y',
    noDebit:        a.ACSTATNODR === 'Y',
    noCredit:       a.ACSTATNOCR === 'Y',
    dormant:        a.DORM      === 'Y',
    accountStatus:  a.ACCSTAT,
    authStatus:     a.AUTHSTAT,
    balances: {
      currentBalance:   parseFloat(amt.ACY_CURR_BALANCE  || 0),
      availableBalance: parseFloat(amt.ACY_AVL_BAL       || 0),
      openingBalance:   parseFloat(amt.ACY_OPENING_BAL   || 0),
      blockedAmount:    parseFloat(amt.ACY_BLOCKED_AMOUNT || 0),
      lastCrDate:       amt.DATE_LAST_CR,
      lastDrDate:       amt.DATE_LAST_DR,
    },
  }
}

module.exports = router
