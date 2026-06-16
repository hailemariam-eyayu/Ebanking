/**
 * IB Accounts
 * GET /  — attached accounts from IB DB (fast, no CBS round-trip for listing)
 * GET /:accountNo — single account detail via CBS SOAP (balance etc.)
 */
const router = require('express').Router();
const { verifyIB } = require('../../middleware/auth');
const cbs    = require('../../lib/cbsSoap');
const prisma = require('../../lib/prismaIB');

// GET /api/ib/accounts  — all accounts attached to the logged-in customer
router.get('/', verifyIB, async (req, res, next) => {
  try {
    const accounts = await prisma.iBAccount.findMany({
      where: { customerId: req.user.customerId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ accounts });
  } catch (err) { next(err); }
});

// GET /api/ib/accounts/:accountNo — single account detail via CBS SOAP
router.get('/:accountNo', verifyIB, async (req, res, next) => {
  try {
    const acc = await cbs.queryCustAcc(req.params.accountNo);
    if (!acc) return res.status(404).json({ message: 'Account not found' });

    const amt = acc['Amount-Dates'] || {};
    res.json({
      branch:           acc.BRN,
      accountNumber:    acc.ACC,
      custNo:           acc.CUSTNO,
      accountClass:     acc.ACCLS,
      accountClassDesc: acc.ACCLASSDESC,
      currency:         acc.CCY,
      custName:         acc.CUSTNAME,
      accountType:      acc.ACCLSTYP,
      openDate:         acc.ACCOPENDT,
      frozen:           acc.FROZEN    === 'Y',
      noDebit:          acc.ACSTATNODR === 'Y',
      noCredit:         acc.ACSTATNOCR === 'Y',
      dormant:          acc.DORM      === 'Y',
      accountStatus:    acc.ACCSTAT,
      authStatus:       acc.AUTHSTAT,
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
