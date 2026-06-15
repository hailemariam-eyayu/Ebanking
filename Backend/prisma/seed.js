/**
 * E-Banking Full Seed
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds BOTH databases:
 *   1. backoffice      → BO roles, menus, BO users, audit samples
 *   2. internet_banking → IB customers (real CBS data), IB users, sample txns
 *
 * Run:  node prisma/seed.js
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaPg }     = require('@prisma/adapter-pg')
const bcrypt           = require('bcryptjs')

// ── Two separate clients (Prisma v7 requires adapter for runtime) ─────────────
const bo = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.BO_DATABASE_URL }) })
const ib = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.IB_DATABASE_URL }) })

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — BACKOFFICE DATABASE
// ─────────────────────────────────────────────────────────────────────────────

const MENUS = [
  { key: 'dashboard',       label: 'Dashboard',         icon: 'LayoutDashboard',  order: 1 },
  { key: 'customer',        label: 'Customer',          icon: 'User2',            order: 2 },
  { key: 'customer.search', label: 'Search Customer',   icon: 'Search',           parent: 'customer', order: 3 },
  { key: 'administration',  label: 'Administration',    icon: 'Settings',         order: 4 },
  { key: 'users',           label: 'User Management',   icon: 'Users',            parent: 'administration', order: 5 },
  { key: 'roles',           label: 'Role Management',   icon: 'ShieldCheck',      parent: 'administration', order: 6 },
  { key: 'ib',              label: 'Internet Banking',  icon: 'MonitorSmartphone', order: 7 },
  { key: 'ib.activate',     label: 'Activate IB',       icon: 'UserCheck',        parent: 'ib', order: 8 },
  { key: 'ib.manage',       label: 'Manage IB Users',   icon: 'Users',            parent: 'ib', order: 9 },
  { key: 'service.request', label: 'Service Requests',  icon: 'FileText',         order: 10 },
  { key: 'wallet',          label: 'Wallet Management', icon: 'Wallet',           order: 11 },
  { key: 'settings',        label: 'Settings',          icon: 'Settings2',        order: 12 },
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

// Sample BO users — passwords are all Admin@1234
const BO_USERS = [
  { username: 'admin',    fullName: 'System Administrator',  email: 'admin@enatbank.et',       branch: '001', role: 'Super Admin' },
  { username: 'hailemariam', fullName: 'Hailemariam Eyayu', email: 'hailemariam@enatbank.et', branch: '001', role: 'Super Admin' },
  { username: 'branch_mgr',  fullName: 'Tigist Alemu',      email: 'tigist@enatbank.et',      branch: '001', role: 'Branch Manager' },
  { username: 'teller01',    fullName: 'Solomon Bekele',    email: 'solomon@enatbank.et',     branch: '001', role: 'Teller' },
]

async function seedBO() {
  console.log('\n📦  Seeding BACKOFFICE database…')

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

  // 3. BO users
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
  console.log('      └─ admin | hailemariam | branch_mgr | teller01')
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — INTERNET BANKING DATABASE
// ─────────────────────────────────────────────────────────────────────────────
// Sample customers derived from real CBS data in the txt files

const IB_CUSTOMERS = [
  // ── Individual (Level 1 — self-approve) ────────────────────────────────────
  {
    custNo:          '1111532',
    fullName:        'ABENEZER DESTA ZELEKE',
    email:           'abenezer.desta@gmail.com',
    phone:           '0715033159',
    branch:          '001',
    accountType:     'INDIVIDUAL',
    activationLevel: 1,
    approvalLimit:   null,
    status:          'ACTIVE',
    // IB users for this customer
    users: [
      {
        username: 'abenezer.desta',
        fullName: 'ABENEZER DESTA ZELEKE',
        email:    'abenezer.desta@gmail.com',
        userRole: 'OWNER',
        viewOnly: false,
        menus: [
          { menuKey: 'dashboard',  canView: true, canAct: true },
          { menuKey: 'accounts',   canView: true, canAct: false },
          { menuKey: 'transfer',   canView: true, canAct: true },
          { menuKey: 'payment',    canView: true, canAct: true },
          { menuKey: 'statement',  canView: true, canAct: false },
          { menuKey: 'settings',   canView: true, canAct: true },
        ],
      },
    ],
  },

  // ── Corporate (Level 2 — Maker + Checker) ──────────────────────────────────
  {
    custNo:          '2200150',
    fullName:        'SELAM TRADING PLC',
    email:           'finance@selamtrading.et',
    phone:           '0911223344',
    branch:          '001',
    accountType:     'CORPORATE',
    activationLevel: 2,
    approvalLimit:   50000,   // auto-approve up to 50,000 ETB
    status:          'ACTIVE',
    users: [
      {
        username: 'selam.maker',
        fullName: 'Dawit Girma',
        email:    'dawit.girma@selamtrading.et',
        userRole: 'MAKER',
        viewOnly: false,
        menus: [
          { menuKey: 'dashboard', canView: true, canAct: true },
          { menuKey: 'accounts',  canView: true, canAct: false },
          { menuKey: 'transfer',  canView: true, canAct: true },
          { menuKey: 'payment',   canView: true, canAct: true },
          { menuKey: 'statement', canView: true, canAct: false },
        ],
      },
      {
        username: 'selam.checker',
        fullName: 'Meron Haile',
        email:    'meron.haile@selamtrading.et',
        userRole: 'CHECKER',
        viewOnly: false,
        menus: [
          { menuKey: 'dashboard', canView: true, canAct: true },
          { menuKey: 'accounts',  canView: true, canAct: false },
          { menuKey: 'transfer',  canView: true, canAct: true },
          { menuKey: 'statement', canView: true, canAct: false },
        ],
      },
      {
        username: 'selam.viewer',
        fullName: 'Hiwot Tadesse',
        email:    'hiwot.tadesse@selamtrading.et',
        userRole: 'VIEWER',
        viewOnly: true,
        menus: [
          { menuKey: 'dashboard', canView: true, canAct: false },
          { menuKey: 'accounts',  canView: true, canAct: false },
          { menuKey: 'statement', canView: true, canAct: false },
        ],
      },
    ],
  },

  // ── Government (Level 3 — Maker + Checker + Approver) ──────────────────────
  {
    custNo:          '3300890',
    fullName:        'ADDIS ABABA CITY ADMINISTRATION',
    email:           'treasury@addisababa.gov.et',
    phone:           '0115570000',
    branch:          '001',
    accountType:     'GOVERNMENT',
    activationLevel: 3,
    approvalLimit:   100000,  // auto-approve up to 100,000 ETB
    status:          'ACTIVE',
    users: [
      {
        username: 'aaca.maker',
        fullName: 'Belay Worku',
        email:    'belay.worku@addisababa.gov.et',
        userRole: 'MAKER',
        viewOnly: false,
        menus: [
          { menuKey: 'dashboard', canView: true, canAct: true },
          { menuKey: 'accounts',  canView: true, canAct: false },
          { menuKey: 'transfer',  canView: true, canAct: true },
          { menuKey: 'payment',   canView: true, canAct: true },
          { menuKey: 'statement', canView: true, canAct: false },
        ],
      },
      {
        username: 'aaca.checker',
        fullName: 'Selamawit Yohannes',
        email:    'selamawit.y@addisababa.gov.et',
        userRole: 'CHECKER',
        viewOnly: false,
        menus: [
          { menuKey: 'dashboard', canView: true, canAct: true },
          { menuKey: 'accounts',  canView: true, canAct: false },
          { menuKey: 'transfer',  canView: true, canAct: true },
          { menuKey: 'statement', canView: true, canAct: false },
        ],
      },
      {
        username: 'aaca.approver',
        fullName: 'Ato Fikadu Tesfaye',
        email:    'fikadu.tesfaye@addisababa.gov.et',
        userRole: 'APPROVER',
        viewOnly: false,
        menus: [
          { menuKey: 'dashboard', canView: true, canAct: true },
          { menuKey: 'accounts',  canView: true, canAct: false },
          { menuKey: 'transfer',  canView: true, canAct: true },
          { menuKey: 'statement', canView: true, canAct: false },
        ],
      },
    ],
  },

  // ── Blocked customer example ────────────────────────────────────────────────
  {
    custNo:          '4401230',
    fullName:        'TIGIST BEKELE HAILU',
    email:           'tigist.bekele@yahoo.com',
    phone:           '0922334455',
    branch:          '002',
    accountType:     'INDIVIDUAL',
    activationLevel: 1,
    approvalLimit:   null,
    status:          'BLOCKED',
    users: [
      {
        username: 'tigist.bekele',
        fullName: 'TIGIST BEKELE HAILU',
        email:    'tigist.bekele@yahoo.com',
        userRole: 'OWNER',
        viewOnly: false,
        menus: [
          { menuKey: 'dashboard', canView: true, canAct: true },
          { menuKey: 'accounts',  canView: true, canAct: false },
          { menuKey: 'statement', canView: true, canAct: false },
        ],
      },
    ],
  },
]

// Sample transactions (will be attached to customers after insert)
const SAMPLE_TXNS = [
  // Abenezer — individual, auto-approved
  { custKey: '1111532', userKey: 'abenezer.desta',  type: 'INTERNAL_TRANSFER',    from: '0011111153213001', to: '0011223344550001', amount: 5000,     status: 'APPROVED',         wl: 1 },
  { custKey: '1111532', userKey: 'abenezer.desta',  type: 'BILL_PAYMENT',         from: '0011111153213001', to: 'ETHIO-TELECOM',    amount: 350,      status: 'PROCESSED',        wl: 1 },
  { custKey: '1111532', userKey: 'abenezer.desta',  type: 'OWN_ACCOUNT_TRANSFER', from: '0011111153213001', to: '0011111153213002', amount: 10000,    status: 'APPROVED',         wl: 1 },

  // Selam Trading — level 2, below limit auto-approved
  { custKey: '2200150', userKey: 'selam.maker',     type: 'INTERNAL_TRANSFER',    from: '0012200150001001', to: '0011223300020001', amount: 25000,    status: 'APPROVED',         wl: 2, checkerKey: 'selam.checker' },
  { custKey: '2200150', userKey: 'selam.maker',     type: 'EXTERNAL_TRANSFER',    from: '0012200150001001', to: '0021100330010001', amount: 150000,   status: 'PENDING_CHECKER',  wl: 2 },
  { custKey: '2200150', userKey: 'selam.maker',     type: 'BILL_PAYMENT',         from: '0012200150001001', to: 'EEU-REF-88821',    amount: 8500,     status: 'APPROVED',         wl: 2, checkerKey: 'selam.checker' },
  { custKey: '2200150', userKey: 'selam.maker',     type: 'INTERNAL_TRANSFER',    from: '0012200150001001', to: '0011556677001001', amount: 75000,    status: 'REJECTED',         wl: 2, rejectedBy: 'selam.checker', rejectedReason: 'Insufficient documentation' },

  // AACA — level 3, three-level workflow
  { custKey: '3300890', userKey: 'aaca.maker',      type: 'INTERNAL_TRANSFER',    from: '0013300890001001', to: '0011100220010001', amount: 500000,   status: 'PENDING_CHECKER',  wl: 3 },
  { custKey: '3300890', userKey: 'aaca.maker',      type: 'EXTERNAL_TRANSFER',    from: '0013300890001001', to: '0022330011001001', amount: 2000000,  status: 'PENDING_APPROVAL', wl: 3, checkerKey: 'aaca.checker' },
  { custKey: '3300890', userKey: 'aaca.maker',      type: 'BILL_PAYMENT',         from: '0013300890001001', to: 'WWDSE-INV-2024-09', amount: 80000,  status: 'APPROVED',         wl: 3, checkerKey: 'aaca.checker', approverKey: 'aaca.approver' },
  { custKey: '3300890', userKey: 'aaca.maker',      type: 'INTERNAL_TRANSFER',    from: '0013300890001001', to: '0013300890001002', amount: 95000,    status: 'APPROVED',         wl: 3, checkerKey: 'aaca.checker', approverKey: 'aaca.approver' },
]

async function seedIB() {
  console.log('\n📦  Seeding INTERNET_BANKING database…')

  const pw         = await bcrypt.hash('IB@1234', 12)
  const custMap    = {}   // custNo  → IBCustomer record
  const userMap    = {}   // username → IBUser record

  // 1. IB Customers + their users
  for (const c of IB_CUSTOMERS) {
    const customer = await ib.iBCustomer.upsert({
      where:  { custNo: c.custNo },
      update: {
        fullName: c.fullName, email: c.email, phone: c.phone,
        accountType: c.accountType, activationLevel: c.activationLevel,
        approvalLimit: c.approvalLimit, status: c.status,
      },
      create: {
        custNo: c.custNo, fullName: c.fullName, email: c.email,
        phone: c.phone, branch: c.branch, accountType: c.accountType,
        activationLevel: c.activationLevel, approvalLimit: c.approvalLimit,
        status: c.status,
      },
    })
    custMap[c.custNo] = customer

    for (const u of c.users) {
      const ibUser = await ib.iBUser.upsert({
        where:  { username: u.username },
        update: { fullName: u.fullName, userRole: u.userRole, viewOnly: u.viewOnly },
        create: {
          customerId: customer.id,
          username: u.username, email: u.email,
          passwordHash: pw, fullName: u.fullName,
          userRole: u.userRole, viewOnly: u.viewOnly,
          isActive: customer.status === 'ACTIVE',
        },
      })
      userMap[u.username] = ibUser

      // Menu rights
      await ib.iBUserMenuRight.deleteMany({ where: { userId: ibUser.id } })
      if (u.menus.length > 0) {
        await ib.iBUserMenuRight.createMany({
          data: u.menus.map(m => ({
            userId: ibUser.id, menuKey: m.menuKey,
            canView: m.canView, canAct: m.canAct,
          })),
          skipDuplicates: true,
        })
      }
    }
  }
  console.log(`  ✔  ${IB_CUSTOMERS.length} IB customers`)
  console.log(`  ✔  ${Object.keys(userMap).length} IB users (password: IB@1234)`)

  // 2. Sample transactions
  const now = new Date()
  let txnCount = 0

  for (const t of SAMPLE_TXNS) {
    const customer = custMap[t.custKey]
    const maker    = userMap[t.userKey]
    if (!customer || !maker) continue

    const checker  = t.checkerKey  ? userMap[t.checkerKey]  : null
    const approver = t.approverKey ? userMap[t.approverKey] : null

    const daysAgo = (d) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); return dt }

    await ib.iBTransaction.create({
      data: {
        customerId:    customer.id,
        type:          t.type,
        fromAccount:   t.from,
        toAccount:     t.to,
        amount:        t.amount,
        currency:      'ETB',
        description:   `Sample ${t.type.replace(/_/g, ' ')} — seeded`,
        status:        t.status,
        workflowLevel: t.wl,
        makerId:       maker.id,
        makerAt:       daysAgo(7),
        checkerId:     checker?.id  ?? null,
        checkerAt:     checker       ? daysAgo(6) : null,
        approverId:    approver?.id ?? null,
        approverAt:    approver      ? daysAgo(5) : null,
        rejectedBy:    t.rejectedBy     ? userMap[t.rejectedBy]?.id ?? null : null,
        rejectedAt:    t.rejectedReason ? daysAgo(6) : null,
        rejectedReason:t.rejectedReason ?? null,
        cbsReference:  t.status === 'APPROVED' || t.status === 'PROCESSED'
                         ? `CBS-REF-${Date.now()}-${Math.floor(Math.random()*9000+1000)}`
                         : null,
      },
    })
    txnCount++
  }
  console.log(`  ✔  ${txnCount} sample transactions`)
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  E-Banking Full Seed')
  console.log('━'.repeat(55))

  await seedBO()
  await seedIB()

  console.log('\n━'.repeat(55))
  console.log('✅  Seed complete!\n')

  console.log('Back-Office logins (password: Admin@1234)')
  console.log('  admin        → Super Admin')
  console.log('  hailemariam  → Super Admin')
  console.log('  branch_mgr   → Branch Manager')
  console.log('  teller01     → Teller')

  console.log('\nInternet Banking logins (password: IB@1234)')
  console.log('  abenezer.desta  → Individual owner    (Level 1)')
  console.log('  selam.maker     → Corporate maker     (Level 2)')
  console.log('  selam.checker   → Corporate checker   (Level 2)')
  console.log('  selam.viewer    → Corporate view-only (Level 2)')
  console.log('  aaca.maker      → Govt maker          (Level 3)')
  console.log('  aaca.checker    → Govt checker        (Level 3)')
  console.log('  aaca.approver   → Govt approver       (Level 3)')
}

main()
  .catch(e => {
    console.error('\n❌  Seed failed:', e.message)
    if (e.code) console.error('   Code:', e.code)
    process.exit(1)
  })
  .finally(async () => {
    await bo.$disconnect()
    await ib.$disconnect()
  })
