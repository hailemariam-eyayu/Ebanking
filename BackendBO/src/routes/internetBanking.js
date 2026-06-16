/**
 * BO → Internet Banking management
 * Activate / block / manage IB customers and their sub-users
 */
const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const prismaIB = require('../lib/prismaIB');
const { verifyBO } = require('../middleware/auth');

// ── IB Customer list ──────────────────────────────────────────────────────────
router.get('/customers', verifyBO, async (req, res, next) => {
  try {
    const customers = await prismaIB.iBCustomer.findMany({
      include: { ibUsers: true, accounts: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(customers);
  } catch (err) { next(err); }
});

// ── Fetch CBS accounts for a CIF (used in activation form) ───────────────────
// GET /api/bo/ib/cbs-accounts/:custNo
router.get('/cbs-accounts/:custNo', verifyBO, async (req, res, next) => {
  try {
    const oracle = require('../lib/cbsOracle');
    const accounts = await oracle.getAccountsByCif(req.params.custNo);
    res.json(accounts);
  } catch (err) { next(err); }
});

// ── Activate IB for a CBS customer ────────────────────────────────────────────
// POST /api/bo/ib/activate
router.post('/activate', verifyBO, async (req, res, next) => {
  try {
    const {
      custNo, fullName, email, phone, branch,
      accountType, activationLevel, approvalLimit,
      username, userPassword,
      selectedAccounts = [],   // [{ accountNumber, accountClass, currency, fullName }]
    } = req.body;

    if (!custNo || !fullName || !email || !username || !userPassword)
      return res.status(400).json({ message: 'Required fields missing' });
    if (!selectedAccounts.length)
      return res.status(400).json({ message: 'At least one account must be selected' });

    const level = activationLevel || (accountType === 'INDIVIDUAL' ? 1 : 2);

    const customer = await prismaIB.iBCustomer.upsert({
      where:  { custNo },
      update: { status: 'ACTIVE', activationLevel: level, approvalLimit, email, phone },
      create: {
        custNo, fullName, email, phone, branch: branch || '001',
        accountType: accountType || 'INDIVIDUAL',
        activationLevel: level, approvalLimit, status: 'ACTIVE',
      },
    });

    // Save selected accounts
    for (const acc of selectedAccounts) {
      await prismaIB.iBAccount.upsert({
        where:  { customerId_accountNumber: { customerId: customer.id, accountNumber: acc.accountNumber } },
        update: { isActive: true, accountClass: acc.accountClass, currency: acc.currency, fullName: acc.fullName },
        create: {
          customerId:    customer.id,
          accountNumber: acc.accountNumber,
          accountClass:  acc.accountClass || null,
          currency:      acc.currency     || 'ETB',
          fullName:      acc.fullName     || null,
          isActive:      true,
        },
      });
    }

    const passwordHash = await bcrypt.hash(userPassword, 12);
    const ibUser = await prismaIB.iBUser.upsert({
      where:  { email },
      update: { customerId: customer.id, username, passwordHash, fullName, userRole: 'OWNER', isActive: true },
      create: { customerId: customer.id, username, email, passwordHash, fullName, userRole: 'OWNER' },
    });

    res.status(201).json({ customer, ibUser: { ...ibUser, passwordHash: undefined } });
  } catch (err) { next(err); }
});

// ── Block / unblock ───────────────────────────────────────────────────────────
router.post('/customers/:id/block', verifyBO, async (req, res, next) => {
  try {
    const c = await prismaIB.iBCustomer.update({
      where: { id: req.params.id },
      data: { status: 'BLOCKED' },
    });
    res.json(c);
  } catch (err) { next(err); }
});

router.post('/customers/:id/unblock', verifyBO, async (req, res, next) => {
  try {
    const c = await prismaIB.iBCustomer.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
    });
    res.json(c);
  } catch (err) { next(err); }
});

// ── Set activation level / approval limit ─────────────────────────────────────
router.put('/customers/:id/settings', verifyBO, async (req, res, next) => {
  try {
    const { activationLevel, approvalLimit } = req.body;
    const c = await prismaIB.iBCustomer.update({
      where: { id: req.params.id },
      data: { activationLevel, approvalLimit },
    });
    res.json(c);
  } catch (err) { next(err); }
});

// ── IB Sub-users of a customer ────────────────────────────────────────────────
router.get('/customers/:id/users', verifyBO, async (req, res, next) => {
  try {
    const users = await prismaIB.iBUser.findMany({
      where: { customerId: req.params.id },
      include: { menuRights: true },
    });
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  } catch (err) { next(err); }
});

router.post('/customers/:id/users', verifyBO, async (req, res, next) => {
  try {
    const { username, email, password, fullName, userRole, viewOnly, menuRights } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prismaIB.iBUser.create({
      data: {
        customerId: req.params.id,
        username, email, passwordHash, fullName,
        userRole: userRole || 'MAKER',
        viewOnly: viewOnly || false,
        menuRights: {
          create: (menuRights || []).map(m => ({
            menuKey: m.menuKey, canView: m.canView ?? true, canAct: m.canAct ?? false,
          })),
        },
      },
      include: { menuRights: true },
    });
    res.status(201).json({ ...user, passwordHash: undefined });
  } catch (err) { next(err); }
});

router.put('/customers/:custId/users/:userId/menus', verifyBO, async (req, res, next) => {
  try {
    const { menuRights } = req.body;
    await prismaIB.iBUserMenuRight.deleteMany({ where: { userId: req.params.userId } });
    await prismaIB.iBUserMenuRight.createMany({
      data: menuRights.map(m => ({
        userId: req.params.userId,
        menuKey: m.menuKey, canView: m.canView ?? true, canAct: m.canAct ?? false,
      })),
    });
    res.json({ message: 'Menu rights updated' });
  } catch (err) { next(err); }
});

router.post('/users/:id/reset-pin', verifyBO, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'newPassword required' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prismaIB.iBUser.update({ where: { id: req.params.id }, data: { passwordHash } });
    res.json({ message: 'PIN reset' });
  } catch (err) { next(err); }
});

// ── Edit sub-user profile (fullName, email, userRole, viewOnly) ───────────────
router.put('/users/:id', verifyBO, async (req, res, next) => {
  try {
    const { fullName, email, userRole, viewOnly, isActive } = req.body;
    const user = await prismaIB.iBUser.update({
      where: { id: req.params.id },
      data: { fullName, email, userRole, viewOnly, isActive },
      include: { menuRights: true },
    });
    res.json({ ...user, passwordHash: undefined });
  } catch (err) { next(err); }
});

// ── Block / unblock sub-user ──────────────────────────────────────────────────
router.post('/users/:id/block', verifyBO, async (req, res, next) => {
  try {
    const user = await prismaIB.iBUser.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ ...user, passwordHash: undefined });
  } catch (err) { next(err); }
});

router.post('/users/:id/unblock', verifyBO, async (req, res, next) => {
  try {
    const user = await prismaIB.iBUser.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });
    res.json({ ...user, passwordHash: undefined });
  } catch (err) { next(err); }
});

router.put('/users/:id/email', verifyBO, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'email required' });
    const user = await prismaIB.iBUser.update({ where: { id: req.params.id }, data: { email } });
    res.json({ ...user, passwordHash: undefined });
  } catch (err) { next(err); }
});

// ── Customer accounts management ──────────────────────────────────────────────
// GET attached accounts for a customer
router.get('/customers/:id/accounts', verifyBO, async (req, res, next) => {
  try {
    const accounts = await prismaIB.iBAccount.findMany({
      where: { customerId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(accounts);
  } catch (err) { next(err); }
});

// Toggle account active/inactive
router.patch('/customers/:id/accounts/:accountNumber', verifyBO, async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const acc = await prismaIB.iBAccount.update({
      where: { customerId_accountNumber: { customerId: req.params.id, accountNumber: req.params.accountNumber } },
      data: { isActive },
    });
    res.json(acc);
  } catch (err) { next(err); }
});

module.exports = router;
