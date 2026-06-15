import { defineConfig } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.IB_DATABASE_URL,
  },
})
