import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'
import type { QuoteRequest, Invoice } from '@prisma/client'

type DocumentMeta = { id: string; name: string; kind: string; size: number }
export type JobRecord = QuoteRequest & { documents: DocumentMeta[]; invoices: Invoice[] }
const navy = '#13234d'
const muted = '#64748b'
const logo = fs.readFileSync(path.join(__dirname, '../../assets/logo.png'))
const human = (value: string) => value === 'BOQ' ? 'Bill of Quantities' : value === 'TAKE_OFF' ? 'Quantity take-off' : value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const date = (value: Date | null) => value ? value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not supplied'
const money = (value: number | null) => value == null ? 'Not agreed' : `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function createJobPdf(jobs: JobRecord[], kind: 'register' | 'record' | 'proposal'): Promise<Buffer> {
  const title = kind === 'register' ? 'Jobs register' : kind === 'record' ? 'Job record' : 'Fee proposal'
  const doc = new PDFDocument({ size: 'A4', margins: { top: 105, bottom: 62, left: 42, right: 42 }, bufferPages: true, info: { Title: `Aurum Project Controls — ${title}`, Author: 'Aurum Project Controls' } })
  const chunks: Buffer[] = []
  const completed = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const width = doc.page.width - 84
  function header() {
    doc.image(logo, 42, 28, { fit: [42, 42] })
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text('AURUM PROJECT CONTROLS', 96, 34, { width: width - 54 })
    doc.fillColor(muted).font('Helvetica').fontSize(9).text('Aberdeen, Scotland  |  enquiries@aurumite.com', 96, 54, { width: width - 54 })
    doc.moveTo(42, 83).lineTo(doc.page.width - 42, 83).strokeColor('#d6deea').stroke()
    doc.y = 105
  }
  header()
  doc.on('pageAdded', () => {
    const current = doc as typeof doc & { _font: { name: string }; _fontSize: number }
    const font = current._font.name
    const size = current._fontSize
    header()
    doc.font(font).fontSize(size).fillColor('#263247')
  })
  function space(height: number) { if (doc.y + height > doc.page.height - 62) doc.addPage() }
  function heading(text: string) {
    space(58); doc.moveDown(0.7).font('Helvetica-Bold').fontSize(13).fillColor(navy).text(text, 42, doc.y, { width }); doc.moveDown(0.5)
  }
  function field(key: string, value: string | null | undefined) {
    space(55)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(muted).text(key, 42, doc.y, { width })
    doc.font('Helvetica').fontSize(10).fillColor('#263247').text(value?.trim() || 'Not supplied', 42, doc.y + 4, { width, lineGap: 3 })
    doc.moveDown(0.7)
  }
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(24).text(title, 42, doc.y, { width })
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(`Generated ${date(new Date())}${kind !== 'proposal' ? '  |  Internal working document' : ''}`, 42, doc.y + 8, { width }); doc.moveDown(1)
  if (kind === 'register') {
    field('Register summary', `${jobs.length} jobs · ${jobs.filter(j => !['COMPLETED', 'DECLINED'].includes(j.status)).length} open · ${money(jobs.reduce((sum, j) => sum + (j.fee || 0), 0))} recorded fees`)
    if (!jobs.length) field('Jobs', 'No jobs recorded.')
    for (const j of jobs) {
      heading(j.projectName)
      field('Client / service / status', `${j.company} · ${j.name}\n${human(j.service)} · ${human(j.status)}`)
      field('Dates and fee', `Tender: ${date(j.tenderDeadline)}\nDelivery: ${date(j.requiredDelivery)}\nFee: ${money(j.fee)}`)
      field('Contact and documents', `${j.email}${j.telephone ? ` · ${j.telephone}` : ''}\n${j.documents.length} documents · ${j.invoices.length} invoices`)
    }
  } else {
    const j = jobs[0]
    if (!j) throw new Error('A job is required for this export.')
    heading(j.projectName)
    field('Job reference', j.id)
    field('Client', `${j.company}\n${j.name}\n${j.email}${j.telephone ? `\n${j.telephone}` : ''}`)
    field('Project location', j.projectLocation)
    field('Service', human(j.service))
    if (kind === 'record') {
      field('Status', human(j.status))
      field('Received / updated', `${date(j.createdAt)} / ${date(j.updatedAt)}`)
      heading('Project brief'); field('Original enquiry', j.briefDescription)
      field('Required trades', j.requiredTrades); field('Client requirements', j.clientRequirements)
      field('Missing information', j.missingInformation)
    }
    heading('Programme and fee')
    field('Tender deadline', date(j.tenderDeadline)); field('Target Aurum delivery', date(j.requiredDelivery)); field('Professional fee (GBP)', money(j.fee))
    if (kind === 'proposal') field('Tax treatment', 'Any applicable VAT and final tax treatment must be confirmed in the written appointment; this proposal does not add VAT.')
    heading('Scope and deliverables')
    field('Scope of service', j.proposalScope ?? `Aurum Project Controls will provide ${human(j.service).toLowerCase()} services for ${j.projectName}, based on the current drawings, specification and project information supplied by the client.`)
    field('Deliverables', j.proposalDeliverables ?? 'Quantity take-off / estimate in Excel, where applicable\nMarked-up drawings in PDF, where applicable\nAssumptions and exclusions schedule\nFinal PDF issue')
    field('Assumptions and exclusions', j.proposalAssumptions ?? 'Work is based on information supplied by the client. Missing information and material assumptions will be identified. Additional services and revisions outside the agreed scope require agreement of the fee and programme.')
    field('Payment terms', j.paymentTerms || 'To be agreed in writing before appointment.')
    heading('Documents supplied')
    if (!j.documents.length) field('Attachments', 'No documents recorded.')
    for (const d of j.documents) field(human(d.kind), `${d.name} (${Math.ceil(d.size / 1024)} KB)`)
    if (kind === 'record') {
      heading('Invoices')
      if (!j.invoices.length) field('Invoices', 'No invoices created.')
      for (const i of j.invoices) field(i.invoiceNumber, `${human(i.status)} · ${money(i.total)}\n${i.description}\nDue: ${date(i.dueDate)}${i.notes ? `\n${i.notes}` : ''}`)
      heading('Internal notes'); field('Team notes', j.notes)
    } else {
      heading('Client responsibilities and acceptance')
      field('Client responsibilities', 'Provide complete and current project information and notify Aurum of relevant drawing or design revisions. Services outside the agreed scope require written agreement of additional fees and programme.')
      field('Acceptance', 'Please confirm the scope, fee, programme and payment terms by email or signed return before commencement.')
      field('Prepared by', 'Jeremiah Elisha Gwani\nAurum Project Controls\nenquiries@aurumite.com')
    }
  }
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i); doc.page.margins.bottom = 0
    doc.font('Helvetica').fontSize(8).fillColor(muted).text(`${title}  |  ${i + 1} / ${pages.count}`, 42, doc.page.height - 35, { width, align: 'right', lineBreak: false })
  }
  doc.end()
  return completed
}
