import express from 'express'
import multer from 'multer'
import ExcelJS from 'exceljs'
import { randomUUID } from 'crypto'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { sendQuoteReceivedEmail, sendQuoteInternalEmail, notifyBusinessChange } from '../services/emailService'
import { createJobPdf } from '../services/jobPdfService'
import { fileNameFor } from '../services/pdfService'

const router = express.Router()
const MAX_QUOTE_UPLOAD = 4 * 1024 * 1024
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_QUOTE_UPLOAD, files: 5, fields: 20, fieldSize: 64 * 1024 } })
const serviceMap: Record<string, any> = {
  'Take-off': 'TAKE_OFF', Estimate: 'ESTIMATE', 'Tender support': 'TENDER_SUPPORT',
  'Commercial support': 'COMMERCIAL_SUPPORT', 'Bill of Quantities': 'BOQ', Variation: 'VARIATION', Valuation: 'VALUATION', Other: 'OTHER',
}
const jobDocumentSelect = { id: true, name: true, kind: true, size: true, mimeType: true, createdAt: true } as const
const jobInclude = { documents: { select: jobDocumentSelect }, invoices: { orderBy: { createdAt: 'desc' as const } } }
const canManageJobs = (req: AuthRequest) => req.user?.role === 'ADMIN' || req.user?.role === 'COMMERCIAL_MANAGER'
const quoteStatuses = ['NEW', 'REVIEWING', 'QUOTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED']

function asDate(value: unknown): Date | undefined {
  if (!value) return undefined
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? undefined : d
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear()
  const row = await prisma.invoiceSequence.upsert({ where: { id: 1 }, create: { id: 1, current: 1 }, update: { current: { increment: 1 } } })
  return `AUR-INV-${year}-${String(row.current).padStart(3, '0')}`
}

// Public Layer 1 intake: this is the new front door for the business.
const receiveQuoteFiles = upload.fields([
  { name: 'drawings', maxCount: 3 },
  { name: 'specification', maxCount: 1 },
  { name: 'boq', maxCount: 1 },
])
router.post('/quote-requests', (req, res, next) => {
  receiveQuoteFiles(req, res, (error) => {
    if (!error) { next(); return }
    const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
    res.status(tooLarge ? 413 : 400).json({ message: tooLarge ? 'Keep all documents under 4 MB in total.' : 'Upload up to three drawings, one specification and one bill of quantities.' })
  })
}, async (req, res): Promise<void> => {
  try {
    const { name, company, email, telephone, projectName, projectLocation, service, tenderDeadline, briefDescription } = req.body
    if (!name || !company || !email || !projectName || !service) {
      res.status(400).json({ message: 'Name, company, email, project name and service are required.' }); return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) { res.status(400).json({ message: 'Enter a valid contact email address.' }); return }
    if (tenderDeadline && !asDate(tenderDeadline)) { res.status(400).json({ message: 'Choose a valid tender deadline.' }); return }
    const normalizedService = serviceMap[service] || service
    if (!Object.values(serviceMap).includes(normalizedService)) { res.status(400).json({ message: 'Invalid service.' }); return }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined
    const uploadSize = Object.values(files || {}).flat().reduce((total, file) => total + file.size, 0)
    if (uploadSize > MAX_QUOTE_UPLOAD) { res.status(413).json({ message: 'Keep all documents under 4 MB in total.' }); return }
    const documents = Object.entries(files || {}).flatMap(([kind, list]) => (list || []).map(file => ({
      kind, name: file.originalname, mimeType: file.mimetype, size: file.size, data: file.buffer,
    })))
    const quote = await prisma.quoteRequest.create({
      data: {
        name: String(name).trim(), company: String(company).trim(), email: String(email).trim().toLowerCase(),
        telephone: telephone ? String(telephone).trim() : null, projectName: String(projectName).trim(),
        projectLocation: projectLocation ? String(projectLocation).trim() : null,
        service: normalizedService, tenderDeadline: asDate(tenderDeadline), briefDescription: briefDescription ? String(briefDescription).trim() : null,
        documents: { create: documents },
      }, include: { documents: { select: { name: true, kind: true } } },
    })

    const emailResults = await Promise.allSettled([
      sendQuoteReceivedEmail(quote.email, quote.name, quote.projectName),
      sendQuoteInternalEmail({
        id: quote.id, name: quote.name, company: quote.company, email: quote.email,
        telephone: quote.telephone, projectName: quote.projectName, projectLocation: quote.projectLocation,
        service: normalizedService, tenderDeadline: quote.tenderDeadline,
        briefDescription: quote.briefDescription, documents,
      }),
    ])
    emailResults.forEach((result) => { if (result.status === 'rejected') console.error('Quote email failed:', result.reason) })
    res.status(201).json({ id: quote.id, message: 'Your project information has been received and is now under review.' })
  } catch (e) {
    console.error(e); res.status(500).json({ message: 'We could not receive the submission. Please try again or email the project information.' })
  }
})

router.get('/quotes', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
  try {
    const quotes = await prisma.quoteRequest.findMany({ orderBy: [{ createdAt: 'desc' }], include: jobInclude })
    res.json(quotes)
  } catch (error) { console.error('Load jobs failed:', error); res.status(500).json({ message: 'Could not load jobs. Please try again.' }) }
})

router.get('/jobs.pdf', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (!canManageJobs(req)) { res.status(403).json({ message: 'Access denied' }); return }
  try {
    const jobs = await prisma.quoteRequest.findMany({ orderBy: { createdAt: 'desc' }, include: jobInclude })
    const pdf = await createJobPdf(jobs, 'register')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="aurum-jobs-register.pdf"')
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(pdf)
  } catch (error) { console.error('Export jobs failed:', error); res.status(500).json({ message: 'Could not export the jobs register.' }) }
})

router.get('/quotes/:id/documents/:documentId', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (!canManageJobs(req)) { res.status(403).json({ message: 'Access denied' }); return }
  try {
    const document = await prisma.quoteDocument.findFirst({ where: { id: req.params.documentId, quoteId: req.params.id } })
    if (!document) { res.status(404).json({ message: 'Document not found for this job.' }); return }
    const safeName = document.name.replace(/[\r\n"\\/]/g, '_').replace(/[^\x20-\x7E]/g, '_') || 'document'
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(Buffer.from(document.data))
  } catch (error) { console.error('Download job document failed:', error); res.status(500).json({ message: 'Could not download this document.' }) }
})

for (const [route, kind] of [['pdf', 'record'], ['proposal.pdf', 'proposal']] as const) {
  router.get(`/quotes/:id/${route}`, authenticate, async (req: AuthRequest, res): Promise<void> => {
    if (!canManageJobs(req)) { res.status(403).json({ message: 'Access denied' }); return }
    try {
      const job = await prisma.quoteRequest.findUnique({ where: { id: req.params.id }, include: jobInclude })
      if (!job) { res.status(404).json({ message: 'Job not found' }); return }
      const pdf = await createJobPdf([job], kind)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameFor(job.projectName, kind === 'record' ? 'job-record' : 'fee-proposal')}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.send(pdf)
    } catch (error) { console.error('Export job failed:', error); res.status(500).json({ message: 'Could not generate the PDF. Please try again.' }) }
  })
}

router.get('/quotes/:id', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
  try {
    const quote = await prisma.quoteRequest.findUnique({ where: { id: req.params.id }, include: jobInclude })
    if (!quote) { res.status(404).json({ message: 'Job not found' }); return }
    res.json(quote)
  } catch (error) { console.error('Load job failed:', error); res.status(500).json({ message: 'Could not load this job. Please try again.' }) }
})

router.patch('/quotes/:id', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) { res.status(400).json({ message: 'Provide the job details to save.' }); return }
  const allowed = ['name', 'company', 'email', 'telephone', 'projectName', 'projectLocation', 'service', 'tenderDeadline', 'briefDescription', 'status', 'requiredDelivery', 'fee', 'notes', 'clientRequirements', 'requiredTrades', 'missingInformation', 'proposalScope', 'proposalDeliverables', 'proposalAssumptions', 'paymentTerms']
  const data: Record<string, unknown> = {}
  for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key]
  if (data.status !== undefined && (typeof data.status !== 'string' || !quoteStatuses.includes(data.status))) { res.status(400).json({ message: 'Choose a valid job status.' }); return }
  if (data.service !== undefined && !Object.values(serviceMap).includes(data.service)) { res.status(400).json({ message: 'Choose a valid service.' }); return }
  for (const key of ['requiredDelivery', 'tenderDeadline']) {
    if (data[key] === undefined) continue
    if (data[key] === '' || data[key] === null) { data[key] = null; continue }
    if (typeof data[key] !== 'string' || !asDate(data[key])) { res.status(400).json({ message: 'Choose a valid date.' }); return }
    data[key] = asDate(data[key])
  }
  if (data.fee !== undefined) {
    if (data.fee === '' || data.fee === null) data.fee = null
    else {
      if (!['string', 'number'].includes(typeof data.fee)) { res.status(400).json({ message: 'Enter a valid fee.' }); return }
      data.fee = Number(data.fee)
      if (!Number.isFinite(data.fee) || Number(data.fee) < 0 || !Number.isSafeInteger(Math.round(Number(data.fee) * 100))) { res.status(400).json({ message: 'Enter a fee of zero or greater.' }); return }
      data.fee = Math.round(Number(data.fee) * 100) / 100
    }
  }
  for (const key of allowed.filter(key => !['status', 'service', 'fee', 'requiredDelivery', 'tenderDeadline'].includes(key))) {
    if (data[key] === undefined) continue
    if (data[key] !== null && (typeof data[key] !== 'string' || String(data[key]).length > 20000)) { res.status(400).json({ message: 'Text fields must contain no more than 20,000 characters.' }); return }
    data[key] = typeof data[key] === 'string' ? String(data[key]).trim() : null
    if (['name', 'company', 'email', 'projectName'].includes(key) && !data[key]) { res.status(400).json({ message: 'Client name, company, email and project name cannot be empty.' }); return }
  }
  if (data.email !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) { res.status(400).json({ message: 'Enter a valid client email address.' }); return }
    data.email = String(data.email).toLowerCase()
  }
  try {
    const exists = await prisma.quoteRequest.findUnique({ where: { id: req.params.id }, select: { id: true } })
    if (!exists) { res.status(404).json({ message: 'Job not found' }); return }
    const quote = await prisma.quoteRequest.update({ where: { id: req.params.id }, data, include: jobInclude })
    await notifyBusinessChange('Job updated', quote.projectName, quote.id).catch((error) => console.error('Job change email failed:', error))
    res.json(quote)
  } catch (error) { console.error('Save job failed:', error); res.status(500).json({ message: 'Could not save the job. Please try again.' }) }
})

router.post('/quotes/:id/invoice', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) { res.status(400).json({ message: 'Provide the invoice details.' }); return }
  if (req.body.dueDate && !asDate(req.body.dueDate)) { res.status(400).json({ message: 'Choose a valid invoice due date.' }); return }
  if (req.body.description !== undefined && (typeof req.body.description !== 'string' || req.body.description.length > 20000)) { res.status(400).json({ message: 'Enter a valid invoice description.' }); return }
  if (req.body.notes !== undefined && (typeof req.body.notes !== 'string' || req.body.notes.length > 20000)) { res.status(400).json({ message: 'Enter valid invoice notes.' }); return }
  try {
    const quote = await prisma.quoteRequest.findUnique({ where: { id: req.params.id } })
    if (!quote) { res.status(404).json({ message: 'Job not found' }); return }
    const amount = Number(req.body.amount ?? quote.fee ?? 0)
    if (!Number.isFinite(amount) || !(amount > 0) || !Number.isSafeInteger(Math.round(amount * 100)) || Math.round(amount * 100) <= 0) { res.status(400).json({ message: 'Enter a fee greater than zero before creating the invoice.' }); return }
    const vatRate = req.body.vatRate === '' || req.body.vatRate === undefined ? null : Number(req.body.vatRate)
    if (vatRate !== null && (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100)) { res.status(400).json({ message: 'Enter a VAT rate between 0 and 100.' }); return }
    const vatAmount = vatRate === null ? 0 : amount * vatRate / 100
    const total = Math.round((amount + vatAmount) * 100) / 100
    if (!Number.isSafeInteger(Math.round(total * 100)) || total <= 0) { res.status(400).json({ message: 'Invalid invoice total.' }); return }
    const invoice = await prisma.invoice.create({ data: {
      invoiceNumber: await nextInvoiceNumber(), accessToken: randomUUID(), quoteId: quote.id, clientName: quote.name, company: quote.company, email: quote.email,
      projectName: quote.projectName, description: String(req.body.description || `Aurum Project Controls - ${quote.projectName}`), amount,
      vatRate, vatAmount, total, dueDate: asDate(req.body.dueDate), notes: req.body.notes || null,
    } })
    await notifyBusinessChange('Invoice created', invoice.projectName, invoice.invoiceNumber).catch((error) => console.error('Invoice email failed:', error))
    res.status(201).json(invoice)
  } catch (error) { console.error('Create job invoice failed:', error); res.status(500).json({ message: 'Could not create the invoice. Check the job invoices before retrying.' }) }
})

router.get('/sales.xlsx', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
  const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } })
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Sales')
  ws.columns = [
    { header: 'Invoice', key: 'invoice', width: 20 }, { header: 'Date', key: 'date', width: 14 }, { header: 'Client', key: 'client', width: 24 },
    { header: 'Company', key: 'company', width: 24 }, { header: 'Project', key: 'project', width: 30 }, { header: 'Description', key: 'description', width: 40 },
    { header: 'Amount', key: 'amount', width: 14 }, { header: 'VAT', key: 'vat', width: 14 }, { header: 'Total', key: 'total', width: 14 }, { header: 'Status', key: 'status', width: 18 },
  ]
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  invoices.forEach(i => ws.addRow({ invoice: i.invoiceNumber, date: i.createdAt.toISOString().slice(0,10), client: i.clientName, company: i.company || '', project: i.projectName, description: i.description, amount: i.amount, vat: i.vatAmount || 0, total: i.total, status: i.status }))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', 'attachment; filename="aurum-sales.xlsx"')
  await wb.xlsx.write(res); res.end()
})

export default router
