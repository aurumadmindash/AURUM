import { describe, expect, it } from 'vitest'
import { summarizeDbError } from '../databaseHealth'

describe('database health summaries', () => {
  it('surfaces the real cause hidden behind Prisma init-error wrapper lines', () => {
    const e = Object.assign(new Error(''), {
      name: 'PrismaClientInitializationError',
      message: "\nInvalid `prisma.$queryRaw()` invocation:\n\n\nerror: Environment variable not found: DATABASE_URL.",
    })
    const { code, name, hint } = summarizeDbError(e)
    expect(code).toBe('UNKNOWN')
    expect(name).toBe('PrismaClientInitializationError')
    expect(hint).toContain('Environment variable not found: DATABASE_URL.')
  })
  it('prefers the coded hint for known Prisma codes', () => {
    const e = Object.assign(new Error('ignored'), { code: 'P1001' })
    expect(summarizeDbError(e).hint).toMatch(/Cannot reach the database server/)
  })
  it('reports an unreachable server when the message names it', () => {
    const e = Object.assign(new Error(''), {
      name: 'PrismaClientInitializationError',
      message: "\nInvalid `prisma.$queryRaw()` invocation:\n\n\nCan't reach database server at `db.example.com:6543`\n\nPlease make sure your database server is running.",
    })
    expect(summarizeDbError(e).hint).toContain("Can't reach database server at `db.example.com:6543`")
  })
  it('never returns an empty hint', () => {
    expect(summarizeDbError(undefined).hint).not.toBe('')
    expect(summarizeDbError(new Error('')).hint).not.toBe('')
    expect(summarizeDbError('boom').hint).not.toBe('')
  })
  it('passes a plain message through unchanged', () => {
    expect(summarizeDbError(new Error('boom')).hint).toBe('boom')
  })
})
