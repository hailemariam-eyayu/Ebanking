/**
 * BO Role & Menu Rights Management
 */
const router = require('express').Router();
const prisma = require('../../lib/prismaBO');
const { verifyBO } = require('../../middleware/auth');

// GET /api/bo/roles
router.get('/', verifyBO, async (req, res, next) => {
  try {
    const roles = await prisma.bORole.findMany({
      include: { menus: { include: { menu: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(roles);
  } catch (err) { next(err); }
});

// POST /api/bo/roles
router.post('/', verifyBO, async (req, res, next) => {
  try {
    const { name, description, menuRights } = req.body;
    // menuRights: [{ menuId, canView, canEdit }]
    const role = await prisma.bORole.create({
      data: {
        name, description,
        menus: {
          create: (menuRights || []).map(m => ({
            menuId: m.menuId, canView: m.canView ?? true, canEdit: m.canEdit ?? false,
          })),
        },
      },
      include: { menus: { include: { menu: true } } },
    });
    res.status(201).json(role);
  } catch (err) { next(err); }
});

// PUT /api/bo/roles/:id/menus — replace menu rights
router.put('/:id/menus', verifyBO, async (req, res, next) => {
  try {
    const { menuRights } = req.body; // [{ menuId, canView, canEdit }]
    // Delete old, create new
    await prisma.bOMenuRight.deleteMany({ where: { roleId: req.params.id } });
    await prisma.bOMenuRight.createMany({
      data: (menuRights || []).map(m => ({
        roleId: req.params.id, menuId: m.menuId,
        canView: m.canView ?? true, canEdit: m.canEdit ?? false,
      })),
    });
    res.json({ message: 'Menu rights updated' });
  } catch (err) { next(err); }
});

// GET /api/bo/roles/menus — all available menus
router.get('/menus', verifyBO, async (req, res, next) => {
  try {
    const menus = await prisma.bOMenu.findMany({ orderBy: { order: 'asc' } });
    res.json(menus);
  } catch (err) { next(err); }
});

module.exports = router;
