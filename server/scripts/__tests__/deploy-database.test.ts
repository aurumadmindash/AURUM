import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const run = vi.hoisted(() => vi.fn())
vi.mock('child_process', () => ({ execSync: run }))
beforeEach(() => {
  // The build now refuses to run without a usable DATABASE_URL, so every test
  // supplies one (stubbed values also win over any real server/.env on disk).
  vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@pooler.example.com:6543/aurum?pgbouncer=true&connection_limit=1')
})
afterEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('deployment readiness', () => {
  it('stops deployment and does not seed after a migration failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    run.mockImplementation((command: string) => {
      if (command === 'npx prisma migrate deploy') throw new Error('Migration failed')
    })
    await expect(import('../deploy-database')).rejects.toThrow('Migration failed')
    expect(run).not.toHaveBeenCalledWith('npx tsx prisma/seed.ts', expect.anything())
  })
  it('stops deployment after a seed failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    run.mockImplementation((command: string) => {
      if (command === 'npx tsx prisma/seed.ts') throw new Error('Seed failed')
    })
    await expect(import('../deploy-database')).rejects.toThrow('Seed failed')
  })
  it('stops deployment before any command when DATABASE_URL is missing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubEnv('DATABASE_URL', '')
    await expect(import('../deploy-database')).rejects.toThrow('DATABASE_URL is not set')
    expect(run).not.toHaveBeenCalled()
  })
  it('stops deployment before any command when DATABASE_URL is malformed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubEnv('DATABASE_URL', 'not-a-postgres-url')
    await expect(import('../deploy-database')).rejects.toThrow('DATABASE_URL is not a valid postgres connection string')
    expect(run).not.toHaveBeenCalled()
  })
  it('runs generation, migrations and seed in order when successful', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    run.mockImplementation(() => '')
    await import('../deploy-database')
    expect(run.mock.calls.map(call => call[0])).toEqual(['npx prisma generate', 'npx prisma migrate deploy', 'npx tsx prisma/seed.ts'])
  })
})
