import express from 'express'
import { AddressInfo } from 'net'
import fs from 'fs'
import path from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  quoteRequest: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  quoteDocument: { findFirst: vi.fn() },
  invoice: { create: vi.fn() }, invoiceSequence: { upsert: vi.fn() },
}))
vi.mock('../../config/database', () => ({ default: db }))
vi.mock('../../services/emailService', () => ({ sendQuoteReceivedEmail: vi.fn(), sendQuoteInternalEmail: vi.fn(), notifyBusinessChange: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../middleware/auth', () => ({ authenticate: (req: any, res: any, next: () => void) => {
  if (!req.headers.authorization) { res.status(401).json({ message: 'No token provided' }); return }
  req.user = { id: 'owner', role: req.headers['x-test-role'] || 'ADMIN' }; next()
} }))
import router from '../business'
import { createJobPdf, JobRecord } from '../../services/jobPdfService'

const sample: JobRecord = {
  id: 'job-1', projectName: 'Aberdeen Clinic Refurbishment', projectLocation: 'Aberdeen', name: 'Client Contact', company: 'Example Contractors', email: 'client@example.com', telephone: '01224 000000', service: 'BOQ', status: 'REVIEWING',
  tenderDeadline: new Date('2026-11-10'), requiredDelivery: new Date('2026-11-01'), fee: 2450.5, briefDescription: 'Measure and price the clinic refurbishment.', requiredTrades: 'Partitions, finishes and M&E', clientRequirements: 'Separate trade bills', missingInformation: 'Awaiting revised specification', notes: 'INTERNAL_CONFIDENTIAL_MARKER',
  proposalScope: 'SAVED_SCOPE_MARKER: Measure the current clinic drawings.', proposalDeliverables: 'Measured bill of quantities\nPDF assumptions schedule', proposalAssumptions: 'Exclude equipment procurement.', paymentTerms: '50% on appointment; 50% before final issue.', createdAt: new Date('2026-10-12'), updatedAt: new Date('2026-10-12'),
  documents: [{ id: 'doc-1', name: 'Clinic drawings.pdf', kind: 'drawings', size: 4000 }],
  invoices: [{ id: 'invoice-1', invoiceNumber: 'AUR-INV-2026-001', accessToken: 'SECRET_PAYMENT_TOKEN_MARKER', quoteId: 'job-1', clientName: 'Client Contact', company: 'Example Contractors', email: 'client@example.com', projectName: 'Aberdeen Clinic Refurbishment', description: 'Appointment fee', amount: 1225.25, vatRate: null, vatAmount: 0, total: 1225.25, currency: 'GBP', status: 'UNPAID', dueDate: null, paymentUrl: null, stripeSession: null, notes: null, createdAt: new Date(), updatedAt: new Date() }],
}
const app = express(); app.use(express.json()); app.use('/business', router)
let server: ReturnType<typeof app.listen>, origin: string
beforeAll(async () => { server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}` })
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())) })
beforeEach(() => {
  vi.clearAllMocks()
  db.quoteRequest.findMany.mockResolvedValue([sample]); db.quoteRequest.findUnique.mockResolvedValue(sample)
  db.quoteRequest.update.mockImplementation(async ({ data }) => ({ ...sample, ...data }))
  db.quoteDocument.findFirst.mockResolvedValue({ ...sample.documents[0], data: Buffer.from('downloaded document'), mimeType: 'application/pdf' })
  db.invoiceSequence.upsert.mockResolvedValue({ current: 2 }); db.invoice.create.mockImplementation(async ({ data }) => ({ id: 'invoice-2', ...data }))
})
const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }

describe('Jobs management', () => {
  it('returns document metadata without loading file bytes', async () => {
    const response = await fetch(`${origin}/business/quotes/job-1`, { headers })
    expect(response.status).toBe(200)
    const options = db.quoteRequest.findUnique.mock.calls[0][0]
    expect(options.include.documents.select).not.toHaveProperty('data')
    const body = await response.json() as { documents: unknown[] }
    expect(body.documents[0]).not.toHaveProperty('data')
  })
  it('saves client details, proposal fields, zero fees and cleared dates', async () => {
    const changes = { projectLocation: 'Aberdeenshire', proposalScope: 'New saved scope', proposalDeliverables: 'PDF\nExcel', paymentTerms: 'Due on appointment', fee: 0, requiredDelivery: null, tenderDeadline: '' }
    const response = await fetch(`${origin}/business/quotes/job-1`, { method: 'PATCH', headers, body: JSON.stringify(changes) })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ...changes, tenderDeadline: null })
    expect(db.quoteRequest.update.mock.calls[0][0].data).toMatchObject({ fee: 0, requiredDelivery: null, proposalScope: 'New saved scope' })
  })
  it.each([{ fee: -1 }, { fee: 'NaN' }, { fee: true }, { requiredDelivery: 'invalid' }, { status: 'BOGUS' }, { email: 'invalid' }, { projectName: '' }, { notes: {} }])('rejects malformed updates %j without writing', async changes => {
    const response = await fetch(`${origin}/business/quotes/job-1`, { method: 'PATCH', headers, body: JSON.stringify(changes) })
    expect(response.status).toBe(400); expect(db.quoteRequest.update).not.toHaveBeenCalled()
  })
  it('downloads only a document belonging to the requested job', async () => {
    const response = await fetch(`${origin}/business/quotes/job-1/documents/doc-1`, { headers })
    expect(response.status).toBe(200); expect(await response.text()).toBe('downloaded document')
    expect(db.quoteDocument.findFirst).toHaveBeenCalledWith({ where: { id: 'doc-1', quoteId: 'job-1' } })
    db.quoteDocument.findFirst.mockResolvedValue(null)
    expect((await fetch(`${origin}/business/quotes/job-other/documents/doc-1`, { headers })).status).toBe(404)
  })
  it.each(['/quotes', '/jobs.pdf', '/quotes/job-1', '/quotes/job-1/pdf', '/quotes/job-1/proposal.pdf', '/quotes/job-1/documents/doc-1'])('rejects unauthenticated and viewer access to %s', async route => {
    expect((await fetch(`${origin}/business${route}`)).status).toBe(401)
    expect((await fetch(`${origin}/business${route}`, { headers: { ...headers, 'x-test-role': 'VIEWER' } })).status).toBe(403)
    expect(db.quoteRequest.findUnique).not.toHaveBeenCalled(); expect(db.quoteRequest.findMany).not.toHaveBeenCalled(); expect(db.quoteDocument.findFirst).not.toHaveBeenCalled()
  })
  it('exports PDFs with attachment headers and returns a missing-job error', async () => {
    for (const route of ['jobs.pdf', 'quotes/job-1/pdf', 'quotes/job-1/proposal.pdf']) {
      const response = await fetch(`${origin}/business/${route}`, { headers })
      expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('application/pdf')
      expect(response.headers.get('content-disposition')).toContain('attachment; filename=')
      expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-')
    }
    db.quoteRequest.findUnique.mockResolvedValue(null)
    expect((await fetch(`${origin}/business/quotes/missing/pdf`, { headers })).status).toBe(404)
  })
  it('creates an invoice with VAT and rejects invalid fees or dates', async () => {
    const response = await fetch(`${origin}/business/quotes/job-1/invoice`, { method: 'POST', headers, body: JSON.stringify({ amount: '100', vatRate: '20', dueDate: '2026-11-01', description: 'Agreed work' }) })
    expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ total: 120, vatAmount: 20, invoiceNumber: 'AUR-INV-2026-002' })
    db.invoice.create.mockClear()
    for (const body of [{ amount: 0 }, { amount: -1 }, { amount: 100, vatRate: 101 }, { amount: 100, dueDate: 'bad' }]) {
      expect((await fetch(`${origin}/business/quotes/job-1/invoice`, { method: 'POST', headers, body: JSON.stringify(body) })).status).toBe(400)
    }
    expect(db.invoice.create).not.toHaveBeenCalled()
  })
  it('produces paginated record and client proposal artifacts for visual QA', async () => {
    const longJob = { ...sample, notes: `${sample.notes}\n${'Long internal note line covering measurement and commercial reviews.\n'.repeat(160)}END_OF_INTERNAL_NOTES`, clientRequirements: 'Coordinate current drawing revisions.\n'.repeat(50) }
    for (const kind of ['record', 'proposal', 'register'] as const) {
      const pdf = await createJobPdf([longJob], kind)
      expect(pdf.length).toBeGreaterThan(1000)
      if (process.env.JOB_PDF_QA_DIR) { fs.mkdirSync(process.env.JOB_PDF_QA_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.JOB_PDF_QA_DIR, `${kind}.pdf`), pdf) }
    }
  })
})
