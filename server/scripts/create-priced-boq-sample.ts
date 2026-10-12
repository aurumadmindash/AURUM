import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'

type Item = { ref: string; section: string; description: string; unit: string; quantity: number; ratePence: number; alternativeRatePence: number; sourceSheet: number; quantityCell: string; rateCell: string }
type Data = { title: string; basis: string; retrieved: string; sources: { id: string; url: string; sha256: string }[]; items: Item[] }
const data: Data = JSON.parse(fs.readFileSync('server/data/boq-worked-sample.json', 'utf8'))
const money = (pence: number) => (pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amount = (item: Item, alternative = false) => Math.round(item.quantity * (alternative ? item.alternativeRatePence : item.ratePence))
const totals = (items: Item[]) => [items.reduce((sum, item) => sum + amount(item), 0), items.reduce((sum, item) => sum + amount(item, true), 0)]
const sections = [...new Set(data.items.map(item => item.section))]

async function main() {
  for (const item of data.items) {
    if (!item.description || !item.unit || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.ratePence) || item.ratePence <= 0 || !Number.isSafeInteger(item.alternativeRatePence) || item.alternativeRatePence <= 0) throw new Error(`Incomplete pricing for ${item.ref}`)
  }
  const directory = path.resolve('client/public/samples')
  fs.mkdirSync(directory, { recursive: true })
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 42, bufferPages: true,
    info: { Title: 'Refurbishment Building BOQ', Subject: 'Published evaluation quantities and reference prices; not a live tender' } })
  const output = fs.createWriteStream(path.join(directory, 'boq-sample.pdf'))
  doc.pipe(output)
  const widths = [40, 430, 48, 36, 100, 104]
  const xs = widths.map((_, index) => 42 + widths.slice(0, index).reduce((a, b) => a + b, 0))
  const totalWidth = widths.reduce((a, b) => a + b, 0)
  const headers = ['Item', 'Description', 'Qty', 'Unit', 'Rate (£)', 'Amount (£)']
  const align = (column: number): 'left' | 'center' | 'right' => column === 3 ? 'center' : column >= 2 ? 'right' : 'left'
  let first = true
  let y = 0
  function page(title: string) {
    if (!first) doc.addPage()
    first = false
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#13234d').text(title, 42, 35, { width: totalWidth })
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Refurbishment Building BOQ • SAMPLE • Historical GBP rates • Revision 03', 42, 61, { width: totalWidth })
    y = 91
  }
  function tableHeader() {
    doc.rect(42, y, totalWidth, 28).fill('#13234d')
    headers.forEach((text, column) => doc.fillColor('white').font('Helvetica-Bold').fontSize(9).text(text, xs[column] + 5, y + 9, { width: widths[column] - 10, align: align(column) }))
    y += 28
  }
  function row(values: string[], index: number, bold = false) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11)
    const height = Math.max(42, ...values.map((text, column) => doc.heightOfString(text || ' ', { width: widths[column] - 10 }) + 20))
    if (y + height > doc.page.height - 64) throw new Error('Sample table exceeds its page.')
    doc.rect(42, y, totalWidth, height).fill(bold ? '#e8edf5' : index % 2 ? '#f3f6fa' : 'white')
    doc.save().strokeColor('#d6deea').lineWidth(0.4)
    for (const x of [...xs, 42 + totalWidth]) doc.moveTo(x, y).lineTo(x, y + height).stroke()
    doc.restore()
    values.forEach((text, column) => {
      if (text) doc.fillColor('#263247').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).text(text, xs[column] + 5, y + 10, { width: widths[column] - 10, align: align(column) })
    })
    y += height
  }
  for (const [index, section] of sections.entries()) {
    page(`Bill ${index + 1} • ${section}`)
    tableHeader()
    const items = data.items.filter(item => item.section === section)
    items.forEach((item, itemIndex) => row([item.ref, item.description, String(item.quantity), item.unit === 'm2' ? 'm²' : item.unit, money(item.ratePence), money(amount(item))], itemIndex))
    const [primary, alternate] = totals(items)
    row(['', 'Carried to summary', '', '', '', money(primary)], 0, true)
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Quantity and price references are listed in the source register. Section totals reconcile with the main summary.', 42, y + 18, { width: totalWidth })
  }
  page('Main summary')
  tableHeader()
  sections.forEach((section, index) => {
    const [primary, alternative] = totals(data.items.filter(item => item.section === section))
    row([String(index + 1), section, '', '', '', money(primary)], index)
  })
  const [primary, alternative] = totals(data.items)
  row(['', 'Total of selected works', '', '', '', money(primary)], 0, true)
  y += 18
  doc.font('Helvetica').fontSize(10).fillColor('#556174').text('Only the selected refurbishment work basket is totalled. Quantities are published evaluation quantities and rates are historical reference prices. VAT is not calculated. Confirm scope, measurements and current prices for a live project.', 42, y, { width: totalWidth })
  const pages = doc.bufferedPageRange()
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(index)
    doc.page.margins.bottom = 0
    doc.save().opacity(0.045).fillColor('#13234d').font('Helvetica-Bold').fontSize(76).rotate(-25, { origin: [421, 298] }).text('SAMPLE', 265, 260, { lineBreak: false }).restore()
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text(`SAMPLE • FOR ILLUSTRATION ONLY | ${index + 1}/${pages.count}`, 42, doc.page.height - 33, { width: totalWidth, align: 'center', lineBreak: false })
  }
  doc.end()
  await new Promise<void>((resolve, reject) => { output.on('finish', resolve); output.on('error', reject) })

  const workbook = new ExcelJS.Workbook()
  workbook.title = 'Sample priced Bill of Quantities'
  const priced = workbook.addWorksheet('Priced works', { views: [{ state: 'frozen', ySplit: 4 }] })
  priced.addRow(['SAMPLE • Published evaluation basket, not a live quotation'])
  priced.mergeCells('A1:H1')
  priced.addRow(['Source quantities; historical reference rates; amounts calculated from rates rounded to pence.'])
  priced.mergeCells('A2:H2')
  priced.addRow([])
  priced.addRow([...headers, 'Alt. rate (?)', 'Alt. amount (?)'])
  for (const item of data.items) {
    const row = priced.addRow([item.ref, item.description, item.quantity, item.unit, item.ratePence / 100, null, item.alternativeRatePence / 100, null])
    row.getCell(6).value = { formula: `ROUND(C${row.number}*E${row.number},2)`, result: amount(item) / 100 }
    row.getCell(8).value = { formula: `ROUND(C${row.number}*G${row.number},2)`, result: amount(item, true) / 100 }
  }
  const last = priced.lastRow!.number
  const totalRow = priced.addRow(['', 'TOTAL', '', '', '', { formula: `SUM(F5:F${last})`, result: primary / 100 }, '', { formula: `SUM(H5:H${last})`, result: alternative / 100 }])
  totalRow.font = { bold: true }
  const summary = workbook.addWorksheet('Summary')
  summary.addRow(['SAMPLE • Section totals', 'Amount (£)', 'Alt. amount (£)'])
  for (const section of sections) {
    const items = data.items.filter(item => item.section === section)
    const refs = items.map(item => data.items.indexOf(item) + 5)
    const [a, b] = totals(items)
    summary.addRow([section, { formula: refs.map(row => `'Priced works'!F${row}`).join('+'), result: a / 100 }, { formula: refs.map(row => `'Priced works'!H${row}`).join('+'), result: b / 100 }])
  }
  summary.addRow(['TOTAL', { formula: `SUM(B2:B${sections.length + 1})`, result: primary / 100 }, { formula: `SUM(C2:C${sections.length + 1})`, result: alternative / 100 }])
  const register = workbook.addWorksheet('Source register')
  register.addRow(['Item', 'Section', 'Source sheet', 'Quantity cell', 'Rate cell', 'Primary source', 'Alternative source'])
  data.items.forEach(item => register.addRow([item.ref, item.section, item.sourceSheet, item.quantityCell, item.rateCell, data.sources[0].url, data.sources[1].url]))
  const basis = workbook.addWorksheet('Basis')
  basis.addRow(['Purpose', data.basis])
  basis.addRow(['Retrieved', data.retrieved])
  basis.addRow(['Calculation', 'Rates rounded to pence; quantities multiplied by rates; totals calculated from item amounts.'])
  basis.addRow(['Use', 'Historical evaluation example only. Confirm live measurements, specification, prices and taxes before tender use.'])
  data.sources.forEach(source => basis.addRow([source.id, source.url, source.sha256]))
  priced.columns.forEach((column, index) => { column.width = [12, 48, 12, 10, 16, 18, 16, 18][index] })
  summary.columns.forEach((column, index) => { column.width = index ? 22 : 40 })
  register.columns.forEach((column, index) => { column.width = index >= 5 ? 50 : 20 })
  basis.columns.forEach((column, index) => { column.width = index ? 95 : 20 })
  for (const sheet of workbook.worksheets) {
    sheet.eachRow(row => { row.alignment = { vertical: 'middle', wrapText: true }; row.height = 30 })
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  }
  for (const index of [5, 6, 7, 8]) priced.getColumn(index).numFmt = '#,##0.00'
  for (const index of [2, 3]) summary.getColumn(index).numFmt = '#,##0.00'
  for (const [sheet, headerRow] of [[priced, 4], [summary, 1], [register, 1]] as const) {
    sheet.getRow(headerRow).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13234D' } } })
  }
  workbook.calcProperties.fullCalcOnLoad = true
  await workbook.xlsx.writeFile(path.resolve('server/data/boq-worked-sample.xlsx'))
  console.log(`Created ${pages.count}-page priced sample and formula-linked Excel. Totals: £${money(primary)} / £${money(alternative)}.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
