/**
 * IB Users — self-service & sub-user management
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prismaIB');
const { verifyIB } = require('../middleware/auth');

// GET /api/ib/users — list sub-users (owner only)
router.get('/', verifyIB, async (req, res, next) => {
  try {
    if (req.user.userRole !== 'OWNER')
      return res.status(403).json({ message: 'Only the owner can manage sub-users' });

    const users = await prisma.iBUser.findMany({
      where: { customerId: req.user.customerId },
      include: { menuRights: true },
    });
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  } catch (err) { next(err); }
});

// PUT /api/ib/users/change-password
router.put('/change-password', verifyIB, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.iBUser.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Current password incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.iBUser.update({ where: { id: req.user.id }, data: { passwordHash } });
    res.json({ message: 'Password changed' });
  } catch (err) { next(err); }
});

module.exports = router;
