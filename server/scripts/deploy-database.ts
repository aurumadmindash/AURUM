import { execSync } from 'child_process'
import dotenv from 'dotenv'

// Locally the Prisma CLI loads server/.env itself; this script reads
// process.env directly, so load it here too before capturing the env below.
dotenv.config()

// Defends against the most common Vercel env-var paste mistakes: a value
// accidentally wrapped in quotes, or with stray leading/trailing whitespace or
// newlines. Prisma reads these vars directly, so we sanitise them here before
// running migrations + seed.
function clean(v?: string): string | undefined {
  if (!v) return v
  return v.trim().replace(/^["'\s]+/, '').replace(/["'\s]+$/, '')
}

const env = { ...process.env }
if (env.DATABASE_URL) env.DATABASE_URL = clean(env.DATABASE_URL)
if (env.DIRECT_URL) env.DIRECT_URL = clean(env.DIRECT_URL)

// Helpful, non-sensitive diagnostics (never prints the password itself — only
// its length and whether it contains symbols, to catch empty/typo'd values).
function describe(label: string, url?: string) {
  if (!url) { console.log(`${label}: (not set)`); return }
  try {
    const u = new URL(url)
    const pw = u.password
    const pwAlnum = /^[A-Za-z0-9]*$/.test(pw)
    console.log(`${label}: host=${u.hostname} port=${u.port} db=${u.pathname.replace('/', '')} user=${u.username} passwordLength=${pw.length} passwordIsAlphanumericOnly=${pwAlnum}`)
  } catch {
    console.log(`${label}: (unparseable — check for quotes or missing parts)`)
  }
}
describe('DATABASE_URL', env.DATABASE_URL)
describe('DIRECT_URL', env.DIRECT_URL)

// Runtime queries always go through DATABASE_URL — migrate/seed can fall back
// to DIRECT_URL, so a build can pass without DATABASE_URL and still deploy an
// API that cannot answer a single request. Fail here instead of shipping that.
function assertRuntimeUrl(url: string | undefined): void {
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set - the deployed API needs it for every query. ' +
      'Add it in Vercel -> Settings -> Environment Variables (Transaction pooler URL: host contains "pooler", port 6543, with ?pgbouncer=true&connection_limit=1) and redeploy.',
    )
  }
  try {
    const u = new URL(url)
    if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') throw new Error('not postgres')
  } catch {
    throw new Error(
      'DATABASE_URL is not a valid postgres connection string - check for ' +
      'quotes, a missing postgresql:// prefix, or stray whitespace.',
    )
  }
}
assertRuntimeUrl(env.DATABASE_URL)

const run = (cmd: string) => execSync(cmd, { stdio: 'inherit', env })

// Prisma client generation has no DB dependency and must succeed.
run('npx prisma generate')

// Any migration or seed failure must stop deployment.
run('npx prisma migrate deploy')
run('npx tsx prisma/seed.ts')