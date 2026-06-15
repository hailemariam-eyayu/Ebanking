/**
 * Internet Banking Seed
 * Seeds IB customers and their users with sample transactions.
 * Run: node prisma/seed.js
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaPg }     = require('@prisma/adapter-pg')
const bcrypt           = require('bcryptjs')

const ib = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.IB_DATABASE_URL }),
})

const IB_CUSTOMERS = [
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
    users: [
      {
        username: 'abenezer.desta',
        fullName: 'ABENEZER DESTA ZELEKE',
        email:    'abenezer.desta@gmail.com',
        userRole: 'OWNER',
        viewOnly: false,
        menus: [
          { menuKey: 'dashboard', canView: true, canAct: true },
          { menuKey: 'accounts',  canView: true, canAct: false },
          { menuKey: 'transfer',  canView: true, canAct: true },
          { menuKey: 'payment',   canView: true, canAct: true },
          { menuKey: 'statement', canView: true, canAct: false },
          { menuKey: 'settings',  canView: true, canAct: true },
        ],
      },
    ],
  },
  {
    custNo:          '2200150',
    fullName:        'SELAM TRADING PLC',
    email:           'finance@selamtrading.et',
    phone:           '0911223344',
    branch:          '001',
    accountType:     'CORPORATE',
    activationLevel: 2,
    approvalLimit:   50000,
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
  {
    custNo:          '3300890',
    fullName:        'ADDIS ABABA CITY ADMINISTRATION',
    email:           'treasury@addisababa.gov.et',
    phone:           '0115570000',
    branch:          '001',
    accountType:     'GOVERNMENT',
    activationLevel: 3,
    approvalLimit:   100000,
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

const SAMPLE_TXNS = [
  { custKey: '1111532', userKey: 'abenezer.desta',  type: 'INTERNAL_TRANSFER',    from: '0011111153213001', to: '0011223344550001', amount: 5000,    status: 'APPROVED',        wl: 1 },
  { custKey: '1111532', userKey: 'abenezer.desta',  type: 'BILL_PAYMENT',         from: '0011111153213001', to: 'ETHIO-TELECOM',    amount: 350,     status: 'PROCESSED',       wl: 1 },
  { custKey: '1111532', userKey: 'abenezer.desta',  type: 'OWN_ACCOUNT_TRANSFER', from: '0011111153213001', to: '0011111153213002', amount: 10000,   status: 'APPROVED',        wl: 1 },
  { custKey: '2200150', userKey: 'selam.maker',     type: 'INTERNAL_TRANSFER',    from: '0012200150001001', to: '0011223300020001', amount: 25000,   status: 'APPROVED',        wl: 2, checkerKey: 'selam.checker' },
  { custKey: '2200150', userKey: 'selam.maker',     type: 'EXTERNAL_TRANSFER',    from: '0012200150001001', to: '0021100330010001', amount: 150000,  status: 'PENDING_CHECKER', wl: 2 },
  { custKey: '2200150', userKey: 'selam.maker',     type: 'INTERNAL_TRANSFER',    from: '0012200150001001', to: '0011556677001001', amount: 75000,   status: 'REJECTED',        wl: 2, rejectedBy: 'selam.checker', rejectedReason: 'Insufficient documentation' },
  { custKey: '3300890', userKey: 'aaca.maker',      type: 'INTERNAL_TRANSFER',    from: '0013300890001001', to: '0011100220010001', amount: 500000,  status: 'PENDING_CHECKER', wl: 3 },
  { custKey: '3300890', userKey: 'aaca.maker',      type: 'EXTERNAL_TRANSFER',    from: '0013300890001001', to: '0022330011001001', amount: 2000000, status: 'PENDING_APPROVAL',wl: 3, checkerKey: 'aaca.checker' },
  { custKey: '3300890', userKey: 'aaca.maker',      type: 'BILL_PAYMENT',         from: '0013300890001001', to: 'WWDSE-INV-2024-09',amount: 80000,  status: 'APPROVED',        wl: 3, checkerKey: 'aaca.checker', approverKey: 'aaca.approver' },
]

async function main() {
  console.log('🌱  Internet Banking Seed')
  console.log('━'.repeat(50))

  const pw      = await bcrypt.hash('IB@1234', 12)
  const custMap = {}
  const userMap = {}

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

  const now = new Date()
  const daysAgo = (d) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); return dt }
  let txnCount = 0

  for (const t of SAMPLE_TXNS) {
    const customer = custMap[t.custKey]
    const maker    = userMap[t.userKey]
    if (!customer || !maker) continue

    const checker  = t.checkerKey  ? userMap[t.checkerKey]  : null
    const approver = t.approverKey ? userMap[t.approverKey] : null

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
        cbsReference:  (t.status === 'APPROVED' || t.status === 'PROCESSED')
                         ? `CBS-REF-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`
                         : null,
      },
    })
    txnCount++
  }
  console.log(`  ✔  ${txnCount} sample transactions`)

  console.log('\n━'.repeat(50))
  console.log('✅  Seed complete!\n')
  console.log('Internet Banking logins (password: IB@1234)')
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
    process.exit(1)
  })
  .finally(() => ib.$disconnect())
