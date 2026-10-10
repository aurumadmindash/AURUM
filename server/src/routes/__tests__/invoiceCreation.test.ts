import express from 'express'
import { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ quoteRequest: { findUnique: vi.fn(), create: vi.fn() },
  invoiceSequence: { upsert: vi.fn() }, invoice: { create: vi.fn() } }))
vi.mock('../../config/database', () => ({ default: db }))
vi.mock('../../middleware/auth', () => ({ authenticate: (req: any, _res: any, next: () => void) => {
  req.user = { id: 'admin', role: 'ADMIN' }; next()
} }))
vi.mock('../../services/emailService', () => ({ sendQuoteReceivedEmail: vi.fn().mockResolvedValue(undefined), sendQuoteInternalEmail: vi.fn().mockResolvedValue(undefined), notifyBusinessChange: vi.fn().mockResolvedValue(undefined) }))
import { sendQuoteReceivedEmail, sendQuoteInternalEmail } from '../../services/emailService'
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
  db.quoteRequest.create.mockResolvedValue({ id: 'quote-a', name: 'Client', company: 'Company', email: 'client@example.com', projectName: 'Project', documents: [] })
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

describe('tender acknowledgement', () => {
  const submission = { name: 'Client', company: 'Company', email: 'client@example.com', projectName: 'Project', service: 'Tender support' }
  const submit = (body: unknown) => fetch(`${origin}/api/business/quote-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  it('saves the tender and automatically emails its sender', async () => {
    const response = await submit(submission)
    expect(response.status).toBe(201)
    expect(sendQuoteReceivedEmail).toHaveBeenCalledWith('client@example.com', 'Client', 'Project')
    expect(((await response.json()) as { id: string }).id).toBe('quote-a')
  })
  it('saves every uploaded document and forwards it with all form details to sales', async () => {
    db.quoteRequest.create.mockImplementationOnce(async ({ data }: any) => ({ id: 'quote-a', ...data, documents: data.documents.create }))
    const form = new FormData()
    for (const [key, value] of Object.entries({ ...submission, telephone: '+44 12345678', projectLocation: 'London', tenderDeadline: '2026-11-01', briefDescription: 'Complete project scope' })) form.append(key, value)
    const uploads = [
      ['drawings', 'drawing-1.pdf', 'drawing one', 'application/pdf'],
      ['drawings', 'drawing-2.pdf', 'drawing two', 'application/pdf'],
      ['specification', 'specification.pdf', 'full specification', 'application/pdf'],
      ['boq', 'boq.xlsx', 'bill of quantities', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ]
    for (const [field, filename, content, type] of uploads) form.append(field, new Blob([content], { type }), filename)
    const response = await fetch(`${origin}/api/business/quote-requests`, { method: 'POST', body: form })
    expect(response.status).toBe(201)
    const saved = db.quoteRequest.create.mock.calls[0][0].data.documents.create
    const internal = vi.mocked(sendQuoteInternalEmail).mock.calls[0][0]
    expect(internal.documents).toEqual(saved)
    expect(internal.documents).toHaveLength(4)
    uploads.forEach(([kind, name, content, mimeType], index) => expect(internal.documents[index]).toEqual(expect.objectContaining({ kind, name, mimeType, data: Buffer.from(content) })))
    expect(internal).toEqual(expect.objectContaining({ telephone: '+44 12345678', projectLocation: 'London', briefDescription: 'Complete project scope', service: 'TENDER_SUPPORT', tenderDeadline: new Date('2026-11-01') }))
    expect(sendQuoteReceivedEmail).toHaveBeenCalledWith('client@example.com', 'Client', 'Project')
  })
  it('keeps a saved tender and sender acknowledgement when the sales email fails', async () => {
    vi.mocked(sendQuoteInternalEmail).mockRejectedValueOnce(new Error('SMTP unavailable'))
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect((await submit(submission)).status).toBe(201)
      expect(db.quoteRequest.create).toHaveBeenCalled()
      expect(sendQuoteReceivedEmail).toHaveBeenCalled()
      expect(errorLog).toHaveBeenCalledWith('Quote email failed:', expect.any(Error))
    } finally { errorLog.mockRestore() }
  })
  it('rejects an invalid contact email before saving or sending', async () => {
    expect((await submit({ ...submission, email: 'invalid' })).status).toBe(400)
    expect(db.quoteRequest.create).not.toHaveBeenCalled()
    expect(sendQuoteReceivedEmail).not.toHaveBeenCalled()
  })
})
