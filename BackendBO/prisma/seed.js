/**
 * Back-Office Seed
 * Seeds BO roles, menus, and admin users.
 * Run: node prisma/seed.js
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaPg }     = require('@prisma/adapter-pg')
const bcrypt           = require('bcryptjs')

const bo = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.BO_DATABASE_URL }),
})

const MENUS = [
  { key: 'dashboard',       label: 'Dashboard',         icon: 'LayoutDashboard',   order: 1 },
  { key: 'customer',        label: 'Customer',           icon: 'User2',             order: 2 },
  { key: 'customer.search', label: 'Search Customer',    icon: 'Search',            parent: 'customer', order: 3 },
  { key: 'administration',  label: 'Administration',     icon: 'Settings',          order: 4 },
  { key: 'users',           label: 'User Management',    icon: 'Users',             parent: 'administration', order: 5 },
  { key: 'roles',           label: 'Role Management',    icon: 'ShieldCheck',       parent: 'administration', order: 6 },
  { key: 'ib',              label: 'Internet Banking',   icon: 'MonitorSmartphone', order: 7 },
  { key: 'ib.activate',     label: 'Activate IB',        icon: 'UserCheck',         parent: 'ib', order: 8 },
  { key: 'ib.manage',       label: 'Manage IB Users',    icon: 'Users',             parent: 'ib', order: 9 },
  { key: 'service.request', label: 'Service Requests',   icon: 'FileText',          order: 10 },
  { key: 'wallet',          label: 'Wallet Management',  icon: 'Wallet',            order: 11 },
  { key: 'settings',        label: 'Settings',           icon: 'Settings2',         order: 12 },
]

const BO_ROLES = [
  {
    name: 'Super Admin',
    description: 'Full system access — all menus read/write',
    menuKeys: MENUS.map(m => m.key),
    editAll: true,
  },
  {
    name: 'Branch Manager',
    description: 'Customer management and IB activation',
    menuKeys: ['dashboard', 'customer', 'customer.search', 'ib', 'ib.activate', 'ib.manage'],
    editAll: false,
  },
  {
    name: 'Teller',
    description: 'Customer search and service requests only',
    menuKeys: ['dashboard', 'customer', 'customer.search', 'service.request'],
    editAll: false,
  },
]

const BO_USERS = [
  { username: 'admin',       fullName: 'System Administrator',  email: 'admin@enatbank.et',          branch: '001', role: 'Super Admin' },
  { username: 'hailemariam', fullName: 'Hailemariam Eyayu',     email: 'hailemariam@enatbank.et',    branch: '001', role: 'Super Admin' },
  { username: 'branch_mgr',  fullName: 'Tigist Alemu',          email: 'tigist@enatbank.et',         branch: '001', role: 'Branch Manager' },
  { username: 'teller01',    fullName: 'Solomon Bekele',        email: 'solomon@enatbank.et',        branch: '001', role: 'Teller' },
]

async function main() {
  console.log('🌱  Back-Office Seed')
  console.log('━'.repeat(50))

  // 1. Menus
  for (const m of MENUS) {
    await bo.bOMenu.upsert({
      where:  { key: m.key },
      update: { label: m.label, icon: m.icon, parent: m.parent ?? null, order: m.order },
      create: { key: m.key, label: m.label, icon: m.icon, parent: m.parent ?? null, order: m.order },
    })
  }
  console.log(`  ✔  ${MENUS.length} menus`)

  // 2. Roles + menu rights
  const roleMap = {}
  for (const r of BO_ROLES) {
    const role = await bo.bORole.upsert({
      where:  { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    })
    roleMap[r.name] = role.id

    const menuRecords = await bo.bOMenu.findMany({ where: { key: { in: r.menuKeys } } })
    for (const menu of menuRecords) {
      await bo.bOMenuRight.upsert({
        where:  { roleId_menuId: { roleId: role.id, menuId: menu.id } },
        update: { canView: true, canEdit: r.editAll },
        create: { roleId: role.id, menuId: menu.id, canView: true, canEdit: r.editAll },
      })
    }
  }
  console.log(`  ✔  ${BO_ROLES.length} roles + menu rights`)

  // 3. BO users (password: Admin@1234)
  const pw = await bcrypt.hash('Admin@1234', 12)
  for (const u of BO_USERS) {
    await bo.bOUser.upsert({
      where:  { username: u.username },
      update: { fullName: u.fullName, roleId: roleMap[u.role], branch: u.branch },
      create: {
        username: u.username, email: u.email, passwordHash: pw,
        fullName: u.fullName, roleId: roleMap[u.role],
        branch: u.branch, isActive: true,
      },
    })
  }
  console.log(`  ✔  ${BO_USERS.length} BO users (password: Admin@1234)`)

  console.log('\n━'.repeat(50))
  console.log('✅  Seed complete!\n')
  console.log('Back-Office logins (password: Admin@1234)')
  console.log('  admin        → Super Admin')
  console.log('  hailemariam  → Super Admin')
  console.log('  branch_mgr   → Branch Manager')
  console.log('  teller01     → Teller')
}

main()
  .catch(e => {
    console.error('\n❌  Seed failed:', e.message)
    process.exit(1)
  })
  .finally(() => bo.$disconnect())
