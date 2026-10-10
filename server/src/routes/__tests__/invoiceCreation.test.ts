import express from 'express'
import { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ quoteRequest: { findUnique: vi.fn() },
  invoiceSequence: { upsert: vi.fn() }, invoice: { create: vi.fn() } }))
vi.mock('../../config/database', () => ({ default: db }))
vi.mock('../../middleware/auth', () => ({ authenticate: (req: any, _res: any, next: () => void) => {
  req.user = { id: 'admin', role: 'ADMIN' }; next()
} }))
vi.mock('../../services/emailService', () => ({ sendQuoteReceivedEmail: vi.fn(), sendQuoteInternalEmail: vi.fn() }))
import router from '../business'

const app = express()
app.use(express.json())
app.use('/api/business', router)
let server: ReturnType<typeof app.listen>
let origin: string
beforeAll(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())) })
beforeEach(() => {
  vi.clearAllMocks()
  db.quoteRequest.findUnique.mockResolvedValue({ id: 'quote-a', name: 'Client', email: 'client@example.com', projectName: 'Project' })
  db.invoiceSequence.upsert.mockResolvedValue({ current: 1 })
  db.invoice.create.mockImplementation(async ({ data }: any) => data)
})
async function create(body: unknown) {
  return fetch(`${origin}/api/business/quotes/quote-a/invoice`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
describe('invoice amount validation', () => {
  it.each([0, -1, 0.001, 'Infinity', 'not-a-number', 1e20])('rejects an unchargeable fee %s', async amount => {
    expect((await create({ amount })).status).toBe(400)
    expect(db.invoice.create).not.toHaveBeenCalled()
    expect(db.invoiceSequence.upsert).not.toHaveBeenCalled()
  })
  it.each([-1, 101, 'not-a-number'])('rejects invalid VAT %s', async vatRate => {
    expect((await create({ amount: 100, vatRate })).status).toBe(400)
    expect(db.invoice.create).not.toHaveBeenCalled()
  })
  it('creates a chargeable invoice with a private token and rounded total', async () => {
    const response = await create({ amount: 10.01, vatRate: 20 })
    expect(response.status).toBe(201)
    const data = await response.json() as { total: number; accessToken: string }
    expect(data.total).toBe(12.01)
    expect(data.accessToken).toMatch(/^[a-f0-9-]{36}$/)
  })
})
