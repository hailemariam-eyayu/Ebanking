/**
 * BO Customer Routes — proxy to CBS via SOAP
 * GET /api/bo/customers/search?by=phone|account|cif&value=...
 * GET /api/bo/customers/:custNo
 * GET /api/bo/customers/:custNo/accounts
 */
const router = require('express').Router();
const { verifyBO } = require('../../middleware/auth');
const cbs = require('../../lib/cbsSoap');

// Search customer
router.get('/search', verifyBO, async (req, res, next) => {
  try {
    const { by, value } = req.query;
    if (!by || !value)
      return res.status(400).json({ message: 'by and value params required' });

    let customer;
    if (by === 'cif') {
      customer = await cbs.queryCustomer(value);
    } else if (by === 'phone') {
      customer = await cbs.queryCustomerByPhone(value);
    } else if (by === 'account') {
      // Query account first, then fetch customer
      const acc = await cbs.queryCustAcc(value);
      const custNo = acc?.CUSTNO || acc?.custNo;
      if (!custNo) return res.status(404).json({ message: 'Account not found' });
      customer = await cbs.queryCustomer(custNo);
    } else {
      return res.status(400).json({ message: 'by must be phone|account|cif' });
    }

    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(mapCustomer(customer));
  } catch (err) { next(err); }
});

// Get customer by custNo
router.get('/:custNo', verifyBO, async (req, res, next) => {
  try {
    const customer = await cbs.queryCustomer(req.params.custNo);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(mapCustomer(customer));
  } catch (err) { next(err); }
});

// Get customer accounts
router.get('/:custNo/accounts', verifyBO, async (req, res, next) => {
  try {
    // NOTE: endpoint to list all accounts by customer will be provided later.
    // For now we return a placeholder — replace with actual CBS call when ready.
    res.json({ custNo: req.params.custNo, accounts: [] });
  } catch (err) { next(err); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function mapCustomer(c) {
  const personal = c?.Custpersonal || {};
  const udfs = Array.isArray(c?.UDFDETAILS) ? c.UDFDETAILS : [c?.UDFDETAILS].filter(Boolean);
  const udfMap = {};
  udfs.forEach(u => { if (u?.FLDNAM) udfMap[u.FLDNAM] = u.FLDVAL || null; });

  return {
    custNo:      c.CUSTNO,
    fullName:    c.FULLNAME || c.NAME,
    shortName:   c.SNAME,
    type:        c.CTYPE,         // I=Individual, C=Corporate
    category:    c.CCATEG,
    branch:      c.LBRN,
    country:     c.COUNTRY,
    frozen:      c.FROZEN === 'Y',
    dead:        c.DEAD === 'Y',
    status:      c.AUTHSTAT,
    cifCreatedAt:c.CIFCREATIONDT,
    personal: {
      firstName: personal.FSTNAME,
      midName:   personal.MIDNAME,
      lastName:  personal.LSTNAME,
      dob:       personal.DOB,
      gender:    personal.GENDR,
      nationalId:personal.NATIONID,
      mobile:    personal.MOBNUM,
      lang:      personal.LANG,
    },
    udf: udfMap,
    accounts: [],   // populated separately
  };
}

module.exports = router;
