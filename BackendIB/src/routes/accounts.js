/**
 * IB Accounts — proxy to CBS
 */
const router = require('express').Router();
const { verifyIB } = require('../middleware/auth');
const cbs = require('../lib/cbsSoap');

// GET /api/ib/accounts/:accountNo
router.get('/:accountNo', verifyIB, async (req, res, next) => {
  try {
    const acc = await cbs.queryCustAcc(req.params.accountNo);
    if (!acc) return res.status(404).json({ message: 'Account not found' });
    res.json(acc);
  } catch (err) { next(err); }
});

// GET /api/ib/accounts
router.get('/', verifyIB, async (req, res, next) => {
  try {
    res.json({ accounts: [], note: 'CBS list-accounts endpoint pending' });
  } catch (err) { next(err); }
});

module.exports = router;
