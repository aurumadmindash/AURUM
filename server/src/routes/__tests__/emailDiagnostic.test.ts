import express from 'express'
import { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('../../config/database', () => ({ default: {} }))
vi.mock('../../services/auditService', () => ({ logAudit: vi.fn() }))
vi.mock('../../services/emailService', () => ({ sendPasswordResetEmail: vi.fn(), sendTestEmail: mocks.send }))
vi.mock('../../middleware/auth', () => ({ authenticate: (req: any, _res: any, next: () => void) => {
  req.user = { id: 'owner', email: 'owner@example.com', role: req.headers['x-test-role'] || 'ADMIN' }; next()
} }))
import router from '../auth'
const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use('/auth', router)
let server: ReturnType<typeof app.listen>
let origin: string
beforeAll(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SMTP_USER', 'resend'); vi.stubEnv('SMTP_PASS', 'test-key'); vi.stubEnv('SMTP_FROM', 'contact@aurumite.com')
  mocks.send.mockResolvedValue({ accepted: ['owner@example.com'], rejected: [] })
})
describe('email diagnostic', () => {
  it('sends only to the signed-in admin even if another recipient is supplied', async () => {
    const response = await fetch(`${origin}/auth/email-test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'outsider@example.com' }) })
    expect(response.status).toBe(200)
    expect(mocks.send).toHaveBeenCalledWith('owner@example.com')
  })
  it('rejects non-admin users without sending email', async () => {
    const response = await fetch(`${origin}/auth/email-test`, { method: 'POST', headers: { 'x-test-role': 'VIEWER' } })
    expect(response.status).toBe(403)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('reports missing configuration without exposing SMTP secrets', async () => {
    vi.stubEnv('SMTP_FROM', '')
    mocks.send.mockRejectedValue(new Error('secret-test-key'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await fetch(`${origin}/auth/email-test`, { method: 'POST' })
    expect(response.status).toBe(502)
    const body = await response.text()
    expect(body).toContain('SMTP_FROM')
    expect(body).not.toContain('secret-test-key')
    log.mockRestore()
  })
})
