const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const prisma  = require('../../lib/prismaBO');
const { signToken, verifyBO } = require('../../middleware/auth');

// POST /api/bo/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    const user = await prisma.bOUser.findUnique({
      where: { username },
      include: { role: { include: { menus: { include: { menu: true } } } } },
    });
    if (!user || !user.isActive)
      return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({
      id: user.id, type: 'BO', role: user.role.name, branch: user.branch,
    });

    // Build menu rights
    const menus = user.role.menus.map(m => ({
      key:     m.menu.key,
      label:   m.menu.label,
      icon:    m.menu.icon,
      parent:  m.menu.parent,
      order:   m.menu.order,
      canView: m.canView,
      canEdit: m.canEdit,
    }));

    res.json({
      token,
      user: {
        id: user.id, username: user.username, fullName: user.fullName,
        email: user.email, role: user.role.name, branch: user.branch,
      },
      menus,
    });
  } catch (err) { next(err); }
});

// GET /api/bo/auth/me
router.get('/me', verifyBO, async (req, res, next) => {
  try {
    const user = await prisma.bOUser.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (err) { next(err); }
});

// POST /api/bo/auth/logout  (stateless — client drops token)
router.post('/logout', (_req, res) => res.json({ message: 'Logged out' }));

module.exports = router;
