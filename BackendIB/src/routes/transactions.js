/**
 * IB Transactions — Maker-Checker-Approval workflow
 */
const router  = require('express').Router();
const prisma  = require('../lib/prismaIB');
const { verifyIB } = require('../middleware/auth');

function nextStatus(level, amount, approvalLimit) {
  if (approvalLimit && parseFloat(amount) <= parseFloat(approvalLimit)) return 'APPROVED';
  if (level === 1) return 'APPROVED';
  return 'PENDING_CHECKER'; // levels 2 and 3 start at checker
}

// POST /api/ib/transactions  (Maker initiates)
router.post('/', verifyIB, async (req, res, next) => {
  try {
    if (req.user.viewOnly) return res.status(403).json({ message: 'View-only account' });

    const { type, fromAccount, toAccount, amount, currency, description } = req.body;
    if (!type || !fromAccount || !amount)
      return res.status(400).json({ message: 'type, fromAccount and amount required' });

    const customer = await prisma.iBCustomer.findUnique({ where: { id: req.user.customerId } });
    if (!customer || customer.status !== 'ACTIVE')
      return res.status(403).json({ message: 'Customer account not active' });

    const status = nextStatus(customer.activationLevel, amount, customer.approvalLimit);

    const txn = await prisma.iBTransaction.create({
      data: {
        customerId:   req.user.customerId,
        type, fromAccount, toAccount,
        amount, currency: currency || 'ETB',
        description, status,
        workflowLevel: customer.activationLevel,
        makerId:  req.user.id,
        makerAt:  new Date(),
      },
    });

    // If auto-approved, submit to CBS (endpoint TBD)

    res.status(201).json(txn);
  } catch (err) { next(err); }
});

// GET /api/ib/transactions
router.get('/', verifyIB, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = { customerId: req.user.customerId };
    if (status) where.status = status;

    const [txns, total] = await Promise.all([
      prisma.iBTransaction.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.iBTransaction.count({ where }),
    ]);

    res.json({ transactions: txns, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/ib/transactions/pending  — checker/approver queue
router.get('/pending', verifyIB, async (req, res, next) => {
  try {
    const { userRole } = req.user;
    let statusFilter;
    if (userRole === 'CHECKER')       statusFilter = 'PENDING_CHECKER';
    else if (userRole === 'APPROVER') statusFilter = 'PENDING_APPROVAL';
    else return res.json({ transactions: [] });

    const txns = await prisma.iBTransaction.findMany({
      where: { customerId: req.user.customerId, status: statusFilter },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ transactions: txns });
  } catch (err) { next(err); }
});

// POST /api/ib/transactions/:id/approve
router.post('/:id/approve', verifyIB, async (req, res, next) => {
  try {
    const txn = await prisma.iBTransaction.findUnique({ where: { id: req.params.id } });
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });
    if (txn.customerId !== req.user.customerId)
      return res.status(403).json({ message: 'Forbidden' });

    const { userRole } = req.user;
    let updateData = {};

    if (txn.status === 'PENDING_CHECKER' && userRole === 'CHECKER') {
      const nextStat = txn.workflowLevel === 3 ? 'PENDING_APPROVAL' : 'APPROVED';
      updateData = { status: nextStat, checkerId: req.user.id, checkerAt: new Date() };
    } else if (txn.status === 'PENDING_APPROVAL' && userRole === 'APPROVER') {
      updateData = { status: 'APPROVED', approverId: req.user.id, approverAt: new Date() };
    } else {
      return res.status(403).json({ message: 'You cannot approve this transaction at this stage' });
    }

    const updated = await prisma.iBTransaction.update({
      where: { id: req.params.id }, data: updateData,
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// POST /api/ib/transactions/:id/reject
router.post('/:id/reject', verifyIB, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const txn = await prisma.iBTransaction.findUnique({ where: { id: req.params.id } });
    if (!txn || txn.customerId !== req.user.customerId)
      return res.status(404).json({ message: 'Not found' });

    const updated = await prisma.iBTransaction.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        rejectedBy: req.user.id,
        rejectedAt: new Date(),
        rejectedReason: reason,
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
