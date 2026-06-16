/**
 * IB Transactions — Maker-Checker-Approval workflow
 *
 * Menu rights enforced per action:
 *   menuKey 'transactions'  → required for listing / viewing
 *   menuKey 'a2a_transfer'  → required for initiating transfers
 *   OWNER role bypasses menu right checks
 */
const router  = require('express').Router();
const prisma  = require('../lib/prismaIB');
const { verifyIB } = require('../middleware/auth');

// ── Helper: resolve menu right for a non-OWNER user ──────────────────────────
async function getMenuRight(userId, menuKey) {
  return prisma.iBUserMenuRight.findUnique({
    where: { userId_menuKey: { userId, menuKey } },
  });
}

function nextStatus(level, amount, approvalLimit) {
  if (approvalLimit && parseFloat(amount) <= parseFloat(approvalLimit)) return 'APPROVED';
  if (level === 1) return 'APPROVED';
  return 'PENDING_CHECKER'; // levels 2+ start at checker
}

// ── POST /api/ib/transactions  (Maker initiates) ──────────────────────────────
router.post('/', verifyIB, async (req, res, next) => {
  try {
    const { userRole, viewOnly, id: userId, customerId } = req.user;

    if (viewOnly)
      return res.status(403).json({ message: 'View-only account cannot initiate transactions' });

    if (!['OWNER', 'MAKER'].includes(userRole))
      return res.status(403).json({ message: 'Only Maker or Owner users can initiate transactions' });

    // Menu right check for non-OWNER
    if (userRole !== 'OWNER') {
      const right = await getMenuRight(userId, 'transactions');
      if (!right || !right.canAct)
        return res.status(403).json({ message: 'You do not have the transactions menu right (canAct)' });
    }

    const { type, fromAccount, toAccount, amount, currency, description } = req.body;
    if (!type || !fromAccount || !amount)
      return res.status(400).json({ message: 'type, fromAccount and amount required' });

    const customer = await prisma.iBCustomer.findUnique({ where: { id: customerId } });
    if (!customer || customer.status !== 'ACTIVE')
      return res.status(403).json({ message: 'Customer account not active' });

    const status = nextStatus(customer.activationLevel, amount, customer.approvalLimit);

    const txn = await prisma.iBTransaction.create({
      data: {
        customerId,
        type, fromAccount, toAccount,
        amount, currency: currency || 'ETB',
        description, status,
        workflowLevel: customer.activationLevel,
        makerId:  userId,
        makerAt:  new Date(),
      },
    });

    res.status(201).json(txn);
  } catch (err) { next(err); }
});

// ── GET /api/ib/transactions ──────────────────────────────────────────────────
router.get('/', verifyIB, async (req, res, next) => {
  try {
    const { userRole, id: userId, customerId } = req.user;

    if (userRole !== 'OWNER') {
      const right = await getMenuRight(userId, 'transactions');
      if (!right || !right.canView)
        return res.status(403).json({ message: 'You do not have permission to view transactions' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const where = { customerId };
    if (status) where.status = status;

    const [txns, total] = await Promise.all([
      prisma.iBTransaction.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.iBTransaction.count({ where }),
    ]);

    res.json({ transactions: txns, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

// ── GET /api/ib/transactions/pending  (checker / approver queue) ──────────────
router.get('/pending', verifyIB, async (req, res, next) => {
  try {
    const { userRole, id: userId, customerId } = req.user;

    let statusFilter;
    if (userRole === 'CHECKER')       statusFilter = 'PENDING_CHECKER';
    else if (userRole === 'APPROVER') statusFilter = 'PENDING_APPROVAL';
    else return res.json({ transactions: [] });

    // Menu right check
    const right = await getMenuRight(userId, 'transactions');
    if (!right || !right.canView)
      return res.status(403).json({ message: 'You do not have permission to view pending transactions' });

    const txns = await prisma.iBTransaction.findMany({
      where: { customerId, status: statusFilter },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ transactions: txns });
  } catch (err) { next(err); }
});

// ── POST /api/ib/transactions/:id/approve ────────────────────────────────────
router.post('/:id/approve', verifyIB, async (req, res, next) => {
  try {
    const { userRole, id: userId } = req.user;

    if (!['CHECKER', 'APPROVER'].includes(userRole))
      return res.status(403).json({ message: 'Only Checker or Approver can approve transactions' });

    // Menu right check
    const right = await getMenuRight(userId, 'transactions');
    if (!right || !right.canAct)
      return res.status(403).json({ message: 'You do not have permission to approve transactions' });

    const txn = await prisma.iBTransaction.findUnique({ where: { id: req.params.id } });
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });
    if (txn.customerId !== req.user.customerId)
      return res.status(403).json({ message: 'Forbidden' });

    let updateData = {};

    if (txn.status === 'PENDING_CHECKER' && userRole === 'CHECKER') {
      const nextStat = txn.workflowLevel === 3 ? 'PENDING_APPROVAL' : 'APPROVED';
      updateData = { status: nextStat, checkerId: userId, checkerAt: new Date() };
    } else if (txn.status === 'PENDING_APPROVAL' && userRole === 'APPROVER') {
      updateData = { status: 'APPROVED', approverId: userId, approverAt: new Date() };
    } else {
      return res.status(403).json({ message: 'You cannot approve this transaction at this stage' });
    }

    const updated = await prisma.iBTransaction.update({
      where: { id: req.params.id }, data: updateData,
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /api/ib/transactions/:id/reject ─────────────────────────────────────
router.post('/:id/reject', verifyIB, async (req, res, next) => {
  try {
    const { userRole, id: userId } = req.user;

    if (!['CHECKER', 'APPROVER', 'OWNER'].includes(userRole))
      return res.status(403).json({ message: 'Insufficient role to reject' });

    const { reason } = req.body;
    const txn = await prisma.iBTransaction.findUnique({ where: { id: req.params.id } });
    if (!txn || txn.customerId !== req.user.customerId)
      return res.status(404).json({ message: 'Not found' });

    const updated = await prisma.iBTransaction.update({
      where: { id: req.params.id },
      data: {
        status:         'REJECTED',
        rejectedBy:     userId,
        rejectedAt:     new Date(),
        rejectedReason: reason,
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
