import { defineConfig } from 'prisma/config'
import 'dotenv/config'

// CLI commands (db push / migrate) target the BO database.
// IB database is managed separately via BackendIB/prisma.config.ts
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.BO_DATABASE_URL,
  },
})
