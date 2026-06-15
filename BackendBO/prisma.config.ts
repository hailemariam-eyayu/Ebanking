import { defineConfig } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.BO_DATABASE_URL,
  },
})
