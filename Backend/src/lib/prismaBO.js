'use strict'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

// Prisma v7 runtime client — URL passed via datasourceUrl.
// The adapter is only needed for Prisma CLI (migrate/push), configured in prisma.config.ts.
const prismaBO = new PrismaClient({
  datasourceUrl: process.env.BO_DATABASE_URL,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

module.exports = prismaBO
