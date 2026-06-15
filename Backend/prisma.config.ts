import { defineConfig } from 'prisma/config'
import 'dotenv/config'

// Prisma v7 — connection URL for CLI commands (migrate / db push).
// Runtime clients pass datasourceUrl directly to PrismaClient constructor.
export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    async adapter() {
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const url =
        process.env.MIGRATE_DATABASE_URL ||
        process.env.BO_DATABASE_URL ||
        ''
      return new PrismaPg({ connectionString: url })
    },
  },
})
