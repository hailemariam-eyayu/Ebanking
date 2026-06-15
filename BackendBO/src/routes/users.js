/**
 * BO User Management
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prismaBO');
const { verifyBO } = require('../middleware/auth');

// GET /api/bo/users
router.get('/', verifyBO, async (req, res, next) => {
  try {
    const users = await prisma.bOUser.findMany({
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users.map(strip));
  } catch (err) { next(err); }
});

// POST /api/bo/users
router.post('/', verifyBO, async (req, res, next) => {
  try {
    const { username, email, password, fullName, roleId, branch } = req.body;
    if (!username || !email || !password || !fullName || !roleId || !branch)
      return res.status(400).json({ message: 'All fields required' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.bOUser.create({
      data: { username, email, passwordHash, fullName, roleId, branch },
      include: { role: true },
    });
    res.status(201).json(strip(user));
  } catch (err) { next(err); }
});

// PUT /api/bo/users/:id
router.put('/:id', verifyBO, async (req, res, next) => {
  try {
    const { fullName, email, roleId, branch, isActive } = req.body;
    const user = await prisma.bOUser.update({
      where: { id: req.params.id },
      data: { fullName, email, roleId, branch, isActive },
      include: { role: true },
    });
    res.json(strip(user));
  } catch (err) { next(err); }
});

// DELETE /api/bo/users/:id
router.delete('/:id', verifyBO, async (req, res, next) => {
  try {
    await prisma.bOUser.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
});

// POST /api/bo/users/:id/reset-password
router.post('/:id/reset-password', verifyBO, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'newPassword required' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.bOUser.update({ where: { id: req.params.id }, data: { passwordHash } });
    res.json({ message: 'Password reset' });
  } catch (err) { next(err); }
});

function strip({ passwordHash, ...u }) { return u; }

module.exports = router;
