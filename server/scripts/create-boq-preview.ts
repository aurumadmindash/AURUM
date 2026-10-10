import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

// Render every populated workbook row as a public, watermarked sample.
async function main() {
  if (!process.argv[2]) throw new Error('Provide the source BOQ workbook path.')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(process.argv[2])
  if (!workbook.worksheets.length) throw new Error('The workbook has no worksheets.')
  const destination = path.resolve('client/public/samples/boq-sample.pdf')
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const output = fs.createWriteStream(destination)
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 42, bufferPages: true,
    info: { Title: 'Aurum - Detailed Sample Bill of Quantities', Author: 'Aurum Project Controls',
      Subject: 'Complete workbook content with illustrative dummy GBP pricing' } })
  doc.pipe(output)
  const widths = [26, 350, 40, 34, 65, 80, 65, 98]
  const xs = widths.map((_, i) => 42 + widths.slice(0, i).reduce((a, b) => a + b, 0))
  const totalWidth = widths.reduce((a, b) => a + b, 0)
  const headings = ['Item', 'Description', 'Qty', 'Unit', 'Rate (£)', 'Amount (£)', 'Alt. rate (£)', 'Alt. amount (£)']
  let y = 0
  let rowCount = 0
  let firstPage = true
  let currentSheet = ''
  function startPage() {
    if (!firstPage) doc.addPage()
    firstPage = false
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#13234d').text('AURUM PROJECT CONTROLS', 42, 30)
    doc.fontSize(12).text(`Sample Bill of Quantities | ${currentSheet}`, 42, 53, { width: totalWidth })
    doc.font('Helvetica').fontSize(8).fillColor('#556174').text(
      'SAMPLE - FOR ILLUSTRATION ONLY. All pound prices are dummy examples, not converted source prices or a quotation. Original wording and quantities retained.',
      42, 75, { width: totalWidth })
    doc.text('Summary figures are independent examples, not reconciled totals. Unavailable = a broken source formula. CM = cubic metres; SM = square metres.',
      42, 91, { width: totalWidth })
    y = 112
    doc.rect(42, y, totalWidth, 26).fill('#13234d')
    headings.forEach((text, i) => doc.fillColor('white').font('Helvetica-Bold').fontSize(8).text(text, xs[i] + 4, y + 8, { width: widths[i] - 8 }))
    y += 26
  }
  function sourceText(cell: ExcelJS.Cell) {
    if (cell.type === ExcelJS.ValueType.Merge || cell.value === null || cell.value === undefined) return ''
    if (cell.type === ExcelJS.ValueType.Error || /^#(REF!|VALUE!|DIV\/0!|NAME\?|N\/A|NUM!|NULL!)/.test(cell.text)) return 'Unavailable'
    if (typeof cell.value === 'object' && cell.value && 'result' in cell.value && typeof cell.value.result === 'object') return 'Unavailable'
    return cell.text.trim()
  }
  for (const sheet of workbook.worksheets) {
    currentSheet = sheet.name
    startPage()
    let stripe = 0
    for (let index = 3; index <= sheet.rowCount; index++) {
      const row = sheet.getRow(index)
      const columns = [1, 2, 3, 5, 6, 7, 8, 9]
      const original = columns.map(column => sourceText(row.getCell(column)))
      if (original.every(value => !value)) continue
      // Ignore blank spacer rows that contain only zero-valued formulas.
      if (!original[0] && !original[1] && !original[2] && !original[3] && original.slice(4).every(value => !value || value === '0')) continue
      const values = [...original]
      const rate = 25 + (index % 15) * 10
      const quantity = Number(original[2]) > 0 ? Number(original[2]) : 10
      for (let column = 4; column < 8; column++) {
        if (!original[column] || original[column] === 'Unavailable') continue
        const amount = Number(original[column]) === 0 ? 0 : column % 2 === 0 ? rate : rate * quantity
        values[column] = amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      const section = !values[0] && values.slice(2).every(value => !value)
      doc.font(section ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
      const height = Math.max(23, ...values.map((text, column) => doc.heightOfString(text || ' ', { width: widths[column] - 8 }) + 12))
      if (y + height > doc.page.height - 58) startPage()
      doc.rect(42, y, totalWidth, height).fill(section ? '#e8edf5' : stripe++ % 2 ? '#f5f7fa' : '#ffffff')
      values.forEach((text, column) => doc.fillColor('#263247').font(section ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
        .text(text || (column >= 2 ? '—' : ''), xs[column] + 4, y + 6, { width: widths[column] - 8 }))
      y += height
      rowCount++
    }
  }
  const pages = doc.bufferedPageRange()
  for (let page = 0; page < pages.count; page++) {
    doc.switchToPage(page)
    doc.page.margins.bottom = 0
    doc.save().opacity(0.1).fillColor('#13234d').font('Helvetica-Bold').fontSize(74)
      .rotate(-25, { origin: [421, 298] }).text('SAMPLE', 260, 265, { lineBreak: false }).restore()
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8)
      .text(`SAMPLE - FOR ILLUSTRATION ONLY | Page ${page + 1} of ${pages.count}`, 42, doc.page.height - 35,
        { width: totalWidth, align: 'center', lineBreak: false })
  }
  doc.end()
  await new Promise<void>((resolve, reject) => { output.on('finish', resolve); output.on('error', reject) })
  console.log(`Created ${destination}: ${pages.count} pages, ${rowCount} populated rows, ${workbook.worksheets.length} sheets`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
