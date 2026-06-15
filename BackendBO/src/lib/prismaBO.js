'use strict'
require('dotenv').config()

const { PrismaClient } = require('../generated/bo-client')
const { PrismaPg }     = require('@prisma/adapter-pg')

const prismaBO = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.BO_DATABASE_URL }),
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

module.exports = prismaBO
