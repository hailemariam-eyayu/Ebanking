/**
 * IB Transactions — Maker-Checker-Approval workflow
 *
 * Level 1 (INDIVIDUAL): Maker submits → auto approved → CBS A2A transfer
 * Level 2 (CORPORATE type 1): Maker submits → Checker approves → CBS A2A transfer
 * Level 3 (CORPORATE type 2): Maker → Checker → Approver → CBS A2A transfer
 *
 * If amount <= approvalLimit the transaction bypasses workflow.
 *
 * A2A endpoints (internal transfer):
 *   POST http://10.1.12.35/a2a/validate  { debitAccount, creditAccount, amount, currency, description }
 *   POST http://10.1.12.35/a2a/transfer  { debitAccount, creditAccount, amount, currency, description }
 */
const router  = require('express').Router();
const axios   = require('axios');
const prisma  = require('../../lib/prismaIB');
const { verifyIB } = require('../../middleware/auth');

const A2A_BASE = process.env.A2A_BASE_URL || 'http://10.1.12.35';

// ── A2A helpers ───────────────────────────────────────────────────────────────

async function a2aValidate(debitAccount, creditAccount, amount, currency, description) {
  const { data } = await axios.post(`${A2A_BASE}/a2a/validate`, {
    debitAccount, creditAccount,
    amount: String(amount), currency: currency || 'ETB',
    description: description || '',
  }, { timeout: 15000 });
  return data;
}

async function a2aTransfer(debitAccount, creditAccount, amount, currency, description) {
  const { data } = await axios.post(`${A2A_BASE}/a2a/transfer`, {
    debitAccount, creditAccount,
    amount: String(amount), currency: currency || 'ETB',
    description: description || '',
  }, { timeout: 30000 });
  return data;
}

/**
 * Submit an approved transaction to CBS via A2A.
 * Updates the DB record with CBS reference or error.
 */
async function submitToA2A(txn) {
  try {
    // Validate first
    await a2aValidate(txn.fromAccount, txn.toAccount, txn.amount, txn.currency, txn.description);

    // Execute transfer
    const result = await a2aTransfer(txn.fromAccount, txn.toAccount, txn.amount, txn.currency, txn.description);

    const cbsRef = result?.referenceNo || result?.refNo || result?.transactionRef || result?.txnRef || null;

    await prisma.iBTransaction.update({
      where: { id: txn.id },
      data: { status: 'PROCESSED', cbsReference: cbsRef || undefined, processedAt: new Date() },
    });
  } catch (err) {
    console.error('[A2A Transfer Error]', txn.id, err?.response?.data || err.message);
    await prisma.iBTransaction.update({
      where: { id: txn.id },
      data: { status: 'CBS_FAILED', cbsError: err?.response?.data?.message || err.message },
    });
  }
}

// ── Helper: resolve next status based on workflow ─────────────────────────────
function nextStatus(level, amount, approvalLimit) {
  if (approvalLimit && parseFloat(amount) <= parseFloat(approvalLimit)) {
    return 'APPROVED'; // within limit — skip workflow
  }
  if (level === 1) return 'APPROVED';
  if (level === 2) return 'PENDING_CHECKER';
  return 'PENDING_CHECKER'; // level 3 also starts at checker
}

// ── POST /api/ib/transactions  (Maker initiates) ──────────────────────────────
router.post('/', verifyIB, async (req, res, next) => {
  try {
    if (req.user.viewOnly) return res.status(403).json({ message: 'View-only account' });

    const { type, fromAccount, toAccount, amount, currency, description } = req.body;
    if (!type || !fromAccount || !amount)
      return res.status(400).json({ message: 'type, fromAccount and amount required' });
    if (!toAccount)
      return res.status(400).json({ message: 'toAccount is required for transfers' });

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

    // If auto-approved, fire A2A transfer asynchronously
    if (status === 'APPROVED') {
      setImmediate(() => submitToA2A(txn));
    }

    res.status(201).json(txn);
  } catch (err) { next(err); }
});

// ── GET /api/ib/transactions — list transactions ──────────────────────────────
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

// ── GET /api/ib/transactions/pending  — checker/approver queue ────────────────
router.get('/pending', verifyIB, async (req, res, next) => {
  try {
    const { userRole } = req.user;
    let statusFilter;
    if (userRole === 'CHECKER')  statusFilter = 'PENDING_CHECKER';
    else if (userRole === 'APPROVER') statusFilter = 'PENDING_APPROVAL';
    else return res.json({ transactions: [] });

    const txns = await prisma.iBTransaction.findMany({
      where: { customerId: req.user.customerId, status: statusFilter },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ transactions: txns });
  } catch (err) { next(err); }
});

// ── POST /api/ib/transactions/:id/approve  (Checker or Approver acts) ─────────
router.post('/:id/approve', verifyIB, async (req, res, next) => {
  try {
    const txn = await prisma.iBTransaction.findUnique({ where: { id: req.params.id } });
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });
    if (txn.customerId !== req.user.customerId)
      return res.status(403).json({ message: 'Forbidden' });

    const { userRole } = req.user;
    let updateData = {};
    let nowApproved = false;

    if (txn.status === 'PENDING_CHECKER' && userRole === 'CHECKER') {
      // Level 2 → APPROVED,  Level 3 → PENDING_APPROVAL
      const nextStat = txn.workflowLevel === 3 ? 'PENDING_APPROVAL' : 'APPROVED';
      nowApproved = nextStat === 'APPROVED';
      updateData = { status: nextStat, checkerId: req.user.id, checkerAt: new Date() };
    } else if (txn.status === 'PENDING_APPROVAL' && userRole === 'APPROVER') {
      nowApproved = true;
      updateData = { status: 'APPROVED', approverId: req.user.id, approverAt: new Date() };
    } else {
      return res.status(403).json({ message: 'You cannot approve this transaction at this stage' });
    }

    const updated = await prisma.iBTransaction.update({
      where: { id: req.params.id }, data: updateData,
    });

    // Fire A2A transfer if this step results in APPROVED
    if (nowApproved) {
      setImmediate(() => submitToA2A(updated));
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST /api/ib/transactions/:id/reject ─────────────────────────────────────
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
