'use strict'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prismaIB = new PrismaClient({
  datasourceUrl: process.env.IB_DATABASE_URL,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

module.exports = prismaIB
