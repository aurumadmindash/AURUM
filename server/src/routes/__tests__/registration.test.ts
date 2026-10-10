import express from 'express'
import { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findUser: vi.fn(), createUser: vi.fn(), hash: vi.fn(), notify: vi.fn(), audit: vi.fn() }))
vi.mock('../../config/database', () => ({ default: { user: { findUnique: mocks.findUser, create: mocks.createUser } } }))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))
vi.mock('../../services/auditService', () => ({ logAudit: mocks.audit }))
vi.mock('../../services/emailService', () => ({ sendAccountApprovalEmail: mocks.notify, sendPasswordResetEmail: vi.fn(), sendTestEmail: vi.fn() }))
import router from '../auth'

const app = express()
app.use(express.json())
app.use('/auth', router)
let server: ReturnType<typeof app.listen>
let origin: string
beforeAll(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.findUser.mockResolvedValue(null)
  mocks.hash.mockResolvedValue('hashed-password')
  mocks.createUser.mockImplementation(async ({ data }) => ({ id: 'pending-1', name: data.name, email: data.email, role: data.role, createdAt: new Date('2026-10-10T12:00:00Z') }))
  mocks.notify.mockResolvedValue(undefined)
  mocks.audit.mockResolvedValue(undefined)
})
const account = { name: 'New user', email: 'new@example.com', password: 'valid-test-password' }
const register = (body: unknown) => fetch(`${origin}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('registration approval notification', () => {
  it('creates an inactive account and alerts admins without exposing its password', async () => {
    const response = await register({ ...account, role: 'ADMIN', isActive: true })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(expect.objectContaining({ pendingApproval: true }))
    expect(mocks.createUser.mock.calls[0][0].data).toEqual({ name: account.name, email: account.email, password: 'hashed-password', role: 'COMMERCIAL_MANAGER', isActive: false })
    expect(mocks.notify).toHaveBeenCalledWith({ id: 'pending-1', name: account.name, email: account.email, role: 'COMMERCIAL_MANAGER', createdAt: new Date('2026-10-10T12:00:00Z') })
    expect(mocks.notify.mock.calls[0][0]).not.toHaveProperty('password')
  })
  it('does not alert admins for duplicate or invalid signup attempts', async () => {
    mocks.findUser.mockResolvedValue({ id: 'existing' })
    expect((await register(account)).status).toBe(409)
    expect((await register({ ...account, password: 'short' })).status).toBe(400)
    expect(mocks.createUser).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it('preserves the pending account when the mail provider is unavailable', async () => {
    mocks.notify.mockRejectedValue(new Error('SMTP unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await register(account)
      expect(response.status).toBe(201)
      expect(await response.json()).toEqual(expect.objectContaining({ pendingApproval: true }))
      expect(log).toHaveBeenCalledWith('Account approval notification failed:', expect.any(Error))
    } finally { log.mockRestore() }
  })
  it('waits for the notification before finishing registration', async () => {
    let finish!: () => void
    mocks.notify.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    let responded = false
    const response = register(account).then(result => { responded = true; return result })
    await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalled())
    expect(responded).toBe(false)
    finish()
    expect((await response).status).toBe(201)
  })
})
