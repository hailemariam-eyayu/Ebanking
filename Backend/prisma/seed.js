/**
 * Seed — creates:
 *  1. All BO menu items
 *  2. "Super Admin" role with full menu access
 *  3. One BO admin user: admin / Admin@1234
 *
 * Run:  node prisma/seed.js
 */

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient({
  datasourceUrl: process.env.BO_DATABASE_URL,
})

const MENUS = [
  { key: 'dashboard',          label: 'Dashboard',          icon: 'LayoutDashboard', order: 1 },
  { key: 'customer',           label: 'Customer',           icon: 'User2',           order: 2 },
  { key: 'customer.search',    label: 'Search Customer',    icon: 'Search',          parent: 'customer', order: 3 },
  { key: 'administration',     label: 'Administration',     icon: 'Settings',        order: 4 },
  { key: 'users',              label: 'User Management',    icon: 'Users',           parent: 'administration', order: 5 },
  { key: 'roles',              label: 'Role Management',    icon: 'ShieldCheck',     parent: 'administration', order: 6 },
  { key: 'ib',                 label: 'Internet Banking',   icon: 'MonitorSmartphone', order: 7 },
  { key: 'ib.activate',        label: 'Activate IB',        icon: 'UserCheck',       parent: 'ib', order: 8 },
  { key: 'ib.manage',          label: 'Manage IB Users',    icon: 'Users',           parent: 'ib', order: 9 },
  { key: 'service.request',    label: 'Service Requests',   icon: 'FileText',        order: 10 },
  { key: 'wallet',             label: 'Wallet Management',  icon: 'Wallet',          order: 11 },
  { key: 'settings',           label: 'Settings',           icon: 'Settings2',       order: 12 },
]

async function main() {
  console.log('🌱  Seeding BO database…')

  // 1. Upsert menus
  for (const menu of MENUS) {
    await prisma.bOMenu.upsert({
      where:  { key: menu.key },
      update: { label: menu.label, icon: menu.icon, parent: menu.parent ?? null, order: menu.order },
      create: { key: menu.key, label: menu.label, icon: menu.icon, parent: menu.parent ?? null, order: menu.order },
    })
  }
  console.log(`  ✔  ${MENUS.length} menus seeded`)

  // 2. Upsert Super Admin role
  const role = await prisma.bORole.upsert({
    where:  { name: 'Super Admin' },
    update: { description: 'Full system access' },
    create: { name: 'Super Admin', description: 'Full system access' },
  })
  console.log(`  ✔  Role "${role.name}" ready (id: ${role.id})`)

  // 3. Assign all menus to Super Admin role
  const allMenus = await prisma.bOMenu.findMany()
  for (const menu of allMenus) {
    await prisma.bOMenuRight.upsert({
      where:  { roleId_menuId: { roleId: role.id, menuId: menu.id } },
      update: { canView: true, canEdit: true },
      create: { roleId: role.id, menuId: menu.id, canView: true, canEdit: true },
    })
  }
  console.log(`  ✔  ${allMenus.length} menu rights assigned to Super Admin`)

  // 4. Upsert admin user
  const passwordHash = await bcrypt.hash('Admin@1234', 12)
  const user = await prisma.bOUser.upsert({
    where:  { username: 'admin' },
    update: { passwordHash, roleId: role.id },
    create: {
      username:     'admin',
      email:        'admin@enatbank.et',
      passwordHash,
      fullName:     'System Administrator',
      roleId:       role.id,
      branch:       '001',
      isActive:     true,
    },
  })
  console.log(`  ✔  BO user created:`)
  console.log(`       Username : admin`)
  console.log(`       Password : Admin@1234`)
  console.log(`       Email    : ${user.email}`)
  console.log(`       Branch   : ${user.branch}`)
  console.log(`       Role     : Super Admin`)
  console.log('\n✅  Seed complete.')
}

main()
  .catch(e => { console.error('❌  Seed failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
