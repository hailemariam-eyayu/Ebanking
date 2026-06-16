/**
 * IB Accounts
 * GET /api/ib/accounts         — list attached accounts for the logged-in customer
 * GET /api/ib/accounts/:accNo  — single account detail via CBS SOAP
 */
const router = require('express').Router();
const { verifyIB } = require('../middleware/auth');
const prisma = require('../lib/prismaIB');
const cbs    = require('../lib/cbsSoap');

// List accounts attached to this customer (from DB, with CBS balance overlay)
router.get('/', verifyIB, async (req, res, next) => {
  try {
    const accounts = await prisma.iBAccount.findMany({
      where: { customerId: req.user.customerId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ accounts });
  } catch (err) { next(err); }
});

// Single account full detail via CBS SOAP
router.get('/:accountNo', verifyIB, async (req, res, next) => {
  try {
    // Verify account belongs to this customer
    const attached = await prisma.iBAccount.findFirst({
      where: { customerId: req.user.customerId, accountNumber: req.params.accountNo },
    });
    if (!attached) return res.status(404).json({ message: 'Account not found or not attached' });

    const detail = await cbs.queryCustAcc(req.params.accountNo);
    if (!detail) return res.status(404).json({ message: 'Account not found in CBS' });

    const amt = detail['Amount-Dates'] || {};
    res.json({
      accountNumber:    detail.ACC,
      accountClass:     detail.ACCLS,
      accountClassDesc: detail.ACCLASSDESC,
      currency:         detail.CCY,
      custName:         detail.CUSTNAME,
      openDate:         detail.ACCOPENDT,
      frozen:           detail.FROZEN    === 'Y',
      noDebit:          detail.ACSTATNODR === 'Y',
      noCredit:         detail.ACSTATNOCR === 'Y',
      dormant:          detail.DORM      === 'Y',
      accountStatus:    detail.ACCSTAT,
      balances: {
        currentBalance:   parseFloat(amt.ACY_CURR_BALANCE   || 0),
        availableBalance: parseFloat(amt.ACY_AVL_BAL        || 0),
        openingBalance:   parseFloat(amt.ACY_OPENING_BAL    || 0),
        blockedAmount:    parseFloat(amt.ACY_BLOCKED_AMOUNT  || 0),
        lastCrDate:       amt.DATE_LAST_CR,
        lastDrDate:       amt.DATE_LAST_DR,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
