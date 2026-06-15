/**
 * IB Dashboard — summary stats
 */
const router = require('express').Router();
const prisma = require('../lib/prismaIB');
const { verifyIB } = require('../middleware/auth');

router.get('/', verifyIB, async (req, res, next) => {
  try {
    const customerId = req.user.customerId;

    const [total, pending, approved, rejected] = await Promise.all([
      prisma.iBTransaction.count({ where: { customerId } }),
      prisma.iBTransaction.count({ where: { customerId, status: { in: ['PENDING_CHECKER', 'PENDING_APPROVAL', 'PENDING'] } } }),
      prisma.iBTransaction.count({ where: { customerId, status: 'APPROVED' } }),
      prisma.iBTransaction.count({ where: { customerId, status: 'REJECTED' } }),
    ]);

    const recent = await prisma.iBTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.json({ stats: { total, pending, approved, rejected }, recentTransactions: recent });
  } catch (err) { next(err); }
});

module.exports = router;
