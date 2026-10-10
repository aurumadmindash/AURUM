import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

// Publish only the work-item excerpt, excluding client names and summary data.
async function main() {
  const source = process.argv[2]
  if (!source) throw new Error('Provide the source BOQ workbook path.')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(source)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('The workbook has no worksheets.')
  const destination = path.resolve('client/public/samples/boq-sample.pdf')
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const output = fs.createWriteStream(destination)
  const doc = new PDFDocument({ size: 'A4', margin: 42, info: {
    Title: 'Aurum — Sample Bill of Quantities', Author: 'Aurum Project Controls',
    Subject: 'Illustrative excerpt; not a quotation or an editable template',
  } })
  doc.pipe(output)
  doc.x = 42
  doc.y = 42
  doc.fillColor('#13234d').font('Helvetica-Bold').fontSize(18).text('AURUM PROJECT CONTROLS')
  doc.moveDown(0.5).fontSize(15).text('Sample Bill of Quantities')
  doc.moveDown(0.5).font('Helvetica').fontSize(9).fillColor('#556174')
    .text('Work-item excerpt from the supplied BOQ. Client details and summary sheets are excluded. Layout adapted for this preview.')
  doc.moveDown(0.6).font('Helvetica-Bold').fillColor('#936500')
    .text('SAMPLE — FOR ILLUSTRATION ONLY')
  doc.moveDown(0.5).font('Helvetica').fillColor('#556174')
    .text('Rates and amounts are shown in pounds sterling (£). Pricing fields are left blank for this sample; this is not a quotation. CM = cubic metres; SM = square metres.')
  let y = doc.y + 18
  const widths = [30, 252, 43, 38, 64, 84]
  const xs = widths.map((_, index) => 42 + widths.slice(0, index).reduce((a, b) => a + b, 0))
  const headings = ['Item', 'Description', 'Qty', 'Unit', 'Rate (£)', 'Amount (£)']
  doc.rect(42, y, 511, 25).fill('#13234d')
  headings.forEach((text, i) => doc.fillColor('white').font('Helvetica-Bold').fontSize(8).text(text, xs[i] + 4, y + 8, { width: widths[i] - 8 }))
  y += 25
  doc.rect(42, y, 511, 24).fill('#eef1f6')
  doc.fillColor('#13234d').font('Helvetica-Bold').fontSize(9).text('SUBSTRUCTURES (All Provisional)', 48, y + 8)
  y += 24
  let stripe = 0
  for (let rowNumber = 9; rowNumber <= 46; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const description = row.getCell(2).text.trim()
    if (!description) continue
    const item = row.getCell(1).text.trim()
    if (!item) {
      doc.rect(42, y, 511, 23).fill('#eef1f6')
      doc.fillColor('#13234d').font('Helvetica-Bold').fontSize(9).text(description, 70, y + 7, { width: 475 })
      y += 23
      continue
    }
    doc.font('Helvetica').fontSize(9)
    const height = Math.max(30, doc.heightOfString(description, { width: widths[1] - 8 }) + 16)
    doc.rect(42, y, 511, height).fill(stripe++ % 2 ? '#f5f7fa' : '#ffffff')
    const values = [item, description, row.getCell(3).text || '—', row.getCell(5).text,
      '—', '—']
    values.forEach((text, i) => doc.fillColor('#263247').font('Helvetica').fontSize(9).text(text, xs[i] + 4, y + 8, { width: widths[i] - 8 }))
    y += height
  }
  doc.fillColor('#64748b').fontSize(8).text('Preview only. Final BOQs are prepared for the agreed project scope.', 42, y + 18, { width: 511 })
  doc.font('Helvetica-Bold').fontSize(8).text('SAMPLE — FOR ILLUSTRATION ONLY', 42, 785, { width: 511, align: 'center', lineBreak: false })
  doc.save().opacity(0.1).fillColor('#13234d').font('Helvetica-Bold').fontSize(68)
    .rotate(-35, { origin: [298, 420] }).text('SAMPLE', 130, 370, { lineBreak: false }).restore()
  doc.end()
  await new Promise<void>((resolve, reject) => { output.on('finish', resolve); output.on('error', reject) })
  console.log(`Created ${destination}`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
