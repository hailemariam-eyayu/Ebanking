'use strict'
require('dotenv').config()

const { PrismaClient } = require('../generated/ib-client')
const { PrismaPg }     = require('@prisma/adapter-pg')

const prismaIB = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.IB_DATABASE_URL }),
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

module.exports = prismaIB
