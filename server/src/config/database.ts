import { PrismaClient } from '@prisma/client'

// Vercel env values are pasted by hand, so a connection string can arrive
// wrapped in quotes or with a stray newline. scripts/deploy-database.ts strips those
// before migrate/seed — without the same cleaning here, a build could succeed
// while every runtime query fails URL validation. Clean before the client
// resolves env("DATABASE_URL").
function clean(v?: string): string | undefined {
  if (!v) return v
  return v.trim().replace(/^["'\s]+/, '').replace(/["'\s]+$/, '')
}
const cleanedDbUrl = clean(process.env.DATABASE_URL)
if (cleanedDbUrl) process.env.DATABASE_URL = cleanedDbUrl
const cleanedDirectUrl = clean(process.env.DIRECT_URL)
if (cleanedDirectUrl) process.env.DIRECT_URL = cleanedDirectUrl

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

export default prisma
