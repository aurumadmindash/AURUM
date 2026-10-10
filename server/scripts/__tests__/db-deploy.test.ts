import { afterEach, describe, expect, it, vi } from 'vitest'
const run = vi.hoisted(() => vi.fn())
vi.mock('child_process', () => ({ execSync: run }))
afterEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.restoreAllMocks() })

describe('deployment readiness', () => {
  it('stops deployment and does not seed after a migration failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    run.mockImplementation((command: string) => {
      if (command === 'npx prisma migrate deploy') throw new Error('Migration failed')
    })
    await expect(import('../db-deploy')).rejects.toThrow('Migration failed')
    expect(run).not.toHaveBeenCalledWith('npx tsx prisma/seed.ts', expect.anything())
  })
  it('stops deployment after a seed failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    run.mockImplementation((command: string) => {
      if (command === 'npx tsx prisma/seed.ts') throw new Error('Seed failed')
    })
    await expect(import('../db-deploy')).rejects.toThrow('Seed failed')
  })
  it('runs generation, migrations and seed in order when successful', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    run.mockImplementation(() => '')
    await import('../db-deploy')
    expect(run.mock.calls.map(call => call[0])).toEqual(['npx prisma generate', 'npx prisma migrate deploy', 'npx tsx prisma/seed.ts'])
  })
})
