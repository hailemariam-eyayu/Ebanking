const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const prisma  = require('../lib/prismaIB');
const { signToken, verifyIB } = require('../middleware/auth');

// POST /api/ib/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    const user = await prisma.iBUser.findUnique({
      where: { username },
      include: { customer: true, menuRights: true },
    });

    if (!user || !user.isActive)
      return res.status(401).json({ message: 'Invalid credentials' });

    if (user.customer.status !== 'ACTIVE')
      return res.status(403).json({ message: `Account is ${user.customer.status.toLowerCase()}` });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({
      id:         user.id,
      type:       'IB',
      customerId: user.customerId,
      userRole:   user.userRole,
      viewOnly:   user.viewOnly,
    });

    const menuRights = user.menuRights.map(m => ({
      menuKey: m.menuKey, canView: m.canView, canAct: m.canAct,
    }));

    res.json({
      token,
      user: {
        id:         user.id,
        username:   user.username,
        fullName:   user.fullName,
        email:      user.email,
        userRole:   user.userRole,
        viewOnly:   user.viewOnly,
        customerId: user.customerId,
        customer: {
          custNo:          user.customer.custNo,
          fullName:        user.customer.fullName,
          accountType:     user.customer.accountType,
          activationLevel: user.customer.activationLevel,
          approvalLimit:   user.customer.approvalLimit,
          status:          user.customer.status,
        },
      },
      menuRights,
    });
  } catch (err) { next(err); }
});

// GET /api/ib/auth/me
router.get('/me', verifyIB, async (req, res, next) => {
  try {
    const user = await prisma.iBUser.findUnique({
      where: { id: req.user.id },
      include: { customer: true, menuRights: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (err) { next(err); }
});

router.post('/logout', (_req, res) => res.json({ message: 'Logged out' }));

module.exports = router;
