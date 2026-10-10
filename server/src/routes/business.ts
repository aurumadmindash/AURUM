import express from 'express'
import multer from 'multer'
import ExcelJS from 'exceljs'
import { randomUUID } from 'crypto'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { sendQuoteReceivedEmail, sendQuoteInternalEmail } from '../services/emailService'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 6 } })
const serviceMap: Record<string, any> = {
  'Take-off': 'TAKE_OFF', Estimate: 'ESTIMATE', 'Tender support': 'TENDER_SUPPORT',
  'Commercial support': 'COMMERCIAL_SUPPORT', 'Bill of Quantities': 'BOQ', Variation: 'VARIATION', Valuation: 'VALUATION', Other: 'OTHER',
}

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
router.post('/quote-requests', upload.fields([
  { name: 'drawings', maxCount: 3 },
  { name: 'specification', maxCount: 1 },
  { name: 'boq', maxCount: 1 },
]), async (req, res): Promise<void> => {
  try {
    const { name, company, email, telephone, projectName, projectLocation, service, tenderDeadline, briefDescription } = req.body
    if (!name || !company || !email || !projectName || !service) {
      res.status(400).json({ message: 'Name, company, email, project name and service are required.' }); return
    }
    const normalizedService = serviceMap[service] || service
    if (!Object.values(serviceMap).includes(normalizedService)) { res.status(400).json({ message: 'Invalid service.' }); return }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined
    const quote = await prisma.quoteRequest.create({
      data: {
        name: String(name).trim(), company: String(company).trim(), email: String(email).trim().toLowerCase(),
        telephone: telephone ? String(telephone).trim() : null, projectName: String(projectName).trim(),
        projectLocation: projectLocation ? String(projectLocation).trim() : null,
        service: normalizedService, tenderDeadline: asDate(tenderDeadline), briefDescription: briefDescription ? String(briefDescription).trim() : null,
        documents: {
          create: Object.entries(files || {}).flatMap(([kind, list]) => (list || []).map((f) => ({
            kind, name: f.originalname, mimeType: f.mimetype, size: f.size, data: f.buffer,
          }))),
        },
      }, include: { documents: { select: { name: true, kind: true } } },
    })

    await Promise.allSettled([
      sendQuoteReceivedEmail(quote.email, quote.name, quote.projectName),
      sendQuoteInternalEmail({ id: quote.id, name: quote.name, company: quote.company, email: quote.email, projectName: quote.projectName, service: normalizedService, tenderDeadline: quote.tenderDeadline, documents: quote.documents.map(d => d.name) }),
    ])
    res.status(201).json({ id: quote.id, message: 'Your project information has been received and is now under review.' })
  } catch (e) {
    console.error(e); res.status(500).json({ message: 'We could not receive the submission. Please try again or email the project information.' })
  }
})

router.get('/quotes', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
  const quotes = await prisma.quoteRequest.findMany({ orderBy: [{ status: 'asc' }, { tenderDeadline: 'asc' }, { createdAt: 'desc' }], include: { documents: { select: { id: true, name: true, kind: true, size: true } }, invoices: true } })
  res.json(quotes)
})

router.get('/quotes/:id', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
  const quote = await prisma.quoteRequest.findUnique({ where: { id: req.params.id }, include: { documents: true, invoices: true } })
  if (!quote) { res.status(404).json({ message: 'Job not found' }); return }
  res.json(quote)
})

router.patch('/quotes/:id', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
  const allowed = ['status', 'requiredDelivery', 'fee', 'notes', 'clientRequirements', 'requiredTrades', 'missingInformation']
  const data: Record<string, unknown> = {}
  for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key]
  if (data.requiredDelivery) data.requiredDelivery = asDate(data.requiredDelivery)
  if (data.fee !== undefined) data.fee = Number(data.fee)
  const quote = await prisma.quoteRequest.update({ where: { id: req.params.id }, data })
  res.json(quote)
})

router.post('/quotes/:id/invoice', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COMMERCIAL_MANAGER') { res.status(403).json({ message: 'Access denied' }); return }
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
  res.status(201).json(invoice)
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
