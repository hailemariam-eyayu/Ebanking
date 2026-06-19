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
// Returns the right record, or null if none exists.
// If NO menu rights are configured at all for this user, we treat it as "grant all"
// (this covers the BO "grant all" activation case).
async function getMenuRight(userId, menuKey) {
  const [right, total] = await Promise.all([
    prisma.iBUserMenuRight.findUnique({
      where: { userId_menuKey: { userId, menuKey } },
    }),
    prisma.iBUserMenuRight.count({ where: { userId } }),
  ]);
  // No rights at all configured → grant all
  if (total === 0) return { canView: true, canAct: true };
  return right; // may be null if specific key not present
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
    else if (userRole === 'OWNER') {
      // OWNER can see all pending at any stage
      const txns = await prisma.iBTransaction.findMany({
        where: { customerId, status: { in: ['PENDING_CHECKER', 'PENDING_APPROVAL'] } },
        orderBy: { createdAt: 'asc' },
      });
      return res.json({ transactions: txns });
    }
    else return res.json({ transactions: [] });

    // CHECKER and APPROVER: check menu right but treat "no rights configured" as grant-all
    const right = await getMenuRight(userId, 'transactions');
    if (right !== null && !right.canView) {
      // rights exist but this specific key denies view
      return res.status(403).json({ message: 'You do not have permission to view pending transactions' });
    }

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

    // Menu right check — only block if rights exist AND explicitly deny
    const right = await getMenuRight(userId, 'transactions');
    if (right !== null && !right.canAct)
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
      // Tell the user exactly which role is needed at this stage
      const requiredRole = txn.status === 'PENDING_CHECKER' ? 'CHECKER' : 'APPROVER';
      return res.status(403).json({
        message: `This transaction is at the ${txn.status.replace('PENDING_', '')} stage. It must be approved by a ${requiredRole}.`,
        requiredRole,
        currentStatus: txn.status,
      });
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
