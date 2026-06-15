'use strict'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const { PrismaPg }     = require('@prisma/adapter-pg')

const adapter = new PrismaPg({ connectionString: process.env.IB_DATABASE_URL })

const prismaIB = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

module.exports = prismaIB
