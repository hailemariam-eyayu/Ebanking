/**
 * IB A2A (Account-to-Account) Transfer Routes
 *
 * Proxies validate and transfer calls to the CBS A2A service at
 * process.env.A2A_API_URL (default: http://10.1.12.35:4001)
 *
 * POST /api/ib/a2a/validate  — validate credit account before showing form
 * POST /api/ib/a2a/transfer  — execute transfer (Maker role required)
 * GET  /api/ib/a2a/transfers — list this customer's A2A transfer history
 */
const router = require('express').Router();
const axios  = require('axios');
const prisma = require('../lib/prismaIB');
const { verifyIB } = require('../middleware/auth');

const A2A_URL = (process.env.A2A_API_URL || 'http://10.1.12.35:4001').replace(/\/$/, '');

// ── Menu-right guard — checks IB user has canAct on the given menuKey ─────────
// If the user has NO menu rights configured at all (BO "grant all" case),
// treat as full access rather than blocking them.
async function requireMenuRight(userId, menuKey) {
  const [right, total] = await Promise.all([
    prisma.iBUserMenuRight.findUnique({
      where: { userId_menuKey: { userId, menuKey } },
    }),
    prisma.iBUserMenuRight.count({ where: { userId } }),
  ]);
  if (total === 0) return { canView: true, canAct: true }; // no rights configured → grant all
  return right; // null if specific key not present
}

// ── POST /api/ib/a2a/validate ─────────────────────────────────────────────────
router.post('/validate', verifyIB, async (req, res, next) => {
  try {
    // Any active (non-viewOnly) user may validate — it's a read operation
    if (req.user.viewOnly)
      return res.status(403).json({ message: 'View-only account cannot initiate transfers' });

    const { drAcNo, crAcNo } = req.body;
    if (!drAcNo || !crAcNo)
      return res.status(400).json({ message: 'drAcNo and crAcNo are required' });

    // Verify drAcNo belongs to this customer
    const ownedAccount = await prisma.iBAccount.findFirst({
      where: { customerId: req.user.customerId, accountNumber: String(drAcNo), isActive: true },
    });
    if (!ownedAccount)
      return res.status(403).json({ message: `Account ${drAcNo} does not belong to your customer profile` });

    // Forward to CBS A2A service
    const upstream = await axios.post(`${A2A_URL}/a2a/validate`, { drAcNo, crAcNo }, {
      timeout: 15000,
      validateStatus: () => true,
    });

    return res.status(upstream.status).json(upstream.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT')
      return res.status(502).json({ message: `CBS transfer service unreachable at ${A2A_URL}` });
    next(err);
  }
});

// ── POST /api/ib/a2a/transfer ─────────────────────────────────────────────────
router.post('/transfer', verifyIB, async (req, res, next) => {
  try {
    const { userRole, viewOnly, id: userId, customerId } = req.user;

    // 1. viewOnly users cannot transact
    if (viewOnly)
      return res.status(403).json({ message: 'View-only account cannot initiate transfers' });

    // 2. Only MAKER, OWNER roles can initiate
    if (!['OWNER', 'MAKER'].includes(userRole))
      return res.status(403).json({ message: 'Only Maker or Owner users can initiate transfers' });

    // 3. Check menu right for 'a2a_transfer' if user is not OWNER
    if (userRole !== 'OWNER') {
      const right = await requireMenuRight(userId, 'a2a_transfer');
      if (!right || !right.canAct)
        return res.status(403).json({ message: 'You do not have permission to perform transfers (menu right: a2a_transfer)' });
    }

    const { drAcNo, crAcNo, amount, narrative, currency = 'ETB' } = req.body;

    const missing = [];
    if (!drAcNo)  missing.push('drAcNo');
    if (!crAcNo)  missing.push('crAcNo');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) missing.push('amount (must be > 0)');
    if (missing.length)
      return res.status(400).json({ message: `Missing or invalid: ${missing.join(', ')}` });

    // 4. Verify drAcNo belongs to this customer
    const ownedAccount = await prisma.iBAccount.findFirst({
      where: { customerId, accountNumber: String(drAcNo), isActive: true },
    });
    if (!ownedAccount)
      return res.status(403).json({ message: `Account ${drAcNo} does not belong to your customer profile` });

    // 5. Check customer activation level — create IB workflow record
    const customer = await prisma.iBCustomer.findUnique({ where: { id: customerId } });
    if (!customer || customer.status !== 'ACTIVE')
      return res.status(403).json({ message: 'Customer account is not active' });

    // Determine workflow: level 1 or within approvalLimit → auto-approve & go to CBS
    // level 2 → needs CHECKER; level 3 → needs CHECKER + APPROVER
    const txnAmount = Number(amount);
    const withinLimit = customer.approvalLimit && txnAmount <= Number(customer.approvalLimit);
    const needsWorkflow = customer.activationLevel >= 2 && !withinLimit;

    // 6. If workflow needed, create PENDING_CHECKER record and return — do NOT call CBS yet
    if (needsWorkflow) {
      const status = customer.activationLevel === 3 ? 'PENDING_CHECKER' : 'PENDING_CHECKER';
      const txn = await prisma.iBTransaction.create({
        data: {
          customerId,
          type:          'INTERNAL_TRANSFER',
          fromAccount:   String(drAcNo),
          toAccount:     String(crAcNo),
          amount:        txnAmount,
          currency:      String(currency).toUpperCase(),
          description:   narrative || `Transfer ${drAcNo} → ${crAcNo}`,
          status,
          workflowLevel: customer.activationLevel,
          makerId:       userId,
          makerAt:       new Date(),
        },
      });
      return res.status(202).json({
        status:  'Pending',
        message: `Transaction created — awaiting ${customer.activationLevel === 3 ? 'checker then approver' : 'checker'} approval`,
        transaction: txn,
      });
    }

    // 7. Auto-approve path — forward directly to CBS A2A service
    const upstream = await axios.post(`${A2A_URL}/a2a/transfer`, {
      drAcNo, crAcNo, amount: txnAmount, narrative, currency, channel: 'IB',
    }, {
      timeout: 30000,
      validateStatus: () => true,
    });

    const cbsResult = upstream.data;

    // 8. Record in IB workflow table regardless of CBS outcome
    const txnStatus = upstream.status === 200 && cbsResult.status === 'Success'
      ? 'PROCESSED'
      : 'FAILED';

    const txn = await prisma.iBTransaction.create({
      data: {
        customerId,
        type:          'INTERNAL_TRANSFER',
        fromAccount:   String(drAcNo),
        toAccount:     String(crAcNo),
        amount:        txnAmount,
        currency:      String(currency).toUpperCase(),
        description:   narrative || `Transfer ${drAcNo} → ${crAcNo}`,
        status:        txnStatus,
        workflowLevel: customer.activationLevel,
        makerId:       userId,
        makerAt:       new Date(),
        cbsReference:  cbsResult?.cbsRefNo || null,
      },
    });

    return res.status(upstream.status).json({
      ...cbsResult,
      ibTransactionId: txn.id,
    });

  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT')
      return res.status(502).json({ message: `CBS transfer service unreachable at ${A2A_URL}` });
    next(err);
  }
});

// ── GET /api/ib/a2a/transfers ─────────────────────────────────────────────────
router.get('/transfers', verifyIB, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    // Check menu right for viewing transfers (skip for OWNER)
    if (req.user.userRole !== 'OWNER') {
      const right = await requireMenuRight(req.user.id, 'a2a_transfer');
      if (!right || !right.canView)
        return res.status(403).json({ message: 'You do not have permission to view transfers' });
    }

    const where = { customerId: req.user.customerId, type: 'INTERNAL_TRANSFER' };
    if (status) where.status = status;

    const [txns, total] = await Promise.all([
      prisma.iBTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:  (Number(page) - 1) * Number(limit),
        take:  Number(limit),
      }),
      prisma.iBTransaction.count({ where }),
    ]);

    res.json({ transactions: txns, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

module.exports = router;
