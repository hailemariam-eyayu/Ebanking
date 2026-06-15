process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
require('dotenv').config()

try {
  const { PrismaClient } = require('@prisma/client')
  const { PrismaPg }     = require('@prisma/adapter-pg')
  console.log('Modules loaded OK')
  console.log('BO_URL:', process.env.BO_DATABASE_URL ? 'SET' : 'MISSING')
  console.log('IB_URL:', process.env.IB_DATABASE_URL ? 'SET' : 'MISSING')

  const adapter = new PrismaPg({ connectionString: process.env.BO_DATABASE_URL })
  console.log('Adapter created OK')
  const p = new PrismaClient({ adapter })
  console.log('PrismaClient created OK')

  p.$queryRaw`SELECT 1`
    .then(() => { console.log('✔ BO DB connected OK'); return p.$disconnect() })
    .catch(e  => { console.error('✘ Query failed:', e.message); return p.$disconnect() })
} catch (e) {
  console.error('TOP-LEVEL ERROR:', e.message)
  console.error(e.stack)
}
