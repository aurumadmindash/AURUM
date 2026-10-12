import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'

// Render every populated workbook row as a public, watermarked sample.
async function main() {
  if (!process.argv[2]) throw new Error('Provide the source BOQ workbook path.')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(process.argv[2])
  const archive = await JSZip.loadAsync(fs.readFileSync(process.argv[2]))
  if (!workbook.worksheets.length) throw new Error('The workbook has no worksheets.')
  const destination = path.resolve(process.argv[3] || 'client/public/samples/boq-template-preview.pdf')
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const output = fs.createWriteStream(destination)
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 42, bufferPages: true,
    info: { Title: '5 Unit 2 Bedroom Building BOQ',
      Subject: 'Complete workbook content with original rates and amounts in GBP' } })
  doc.pipe(output)
  const widths = [30, 447, 55, 40, 105, 81]
  const xs = widths.map((_, i) => 42 + widths.slice(0, i).reduce((a, b) => a + b, 0))
  const totalWidth = widths.reduce((a, b) => a + b, 0)
  const headings = ['Item', 'Description', 'Qty', 'Unit', 'Rate (£)', 'Amount (£)']
  const alignment = (column: number): 'left' | 'center' | 'right' => column === 3 ? 'center' : column === 2 || column >= 4 ? 'right' : 'left'
  let y = 0
  let rowCount = 0
  let firstPage = true
  if (path.basename(destination) === 'boq-client-completed.pdf') {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8fafc')
    doc.rect(0, 0, 18, doc.page.height).fill('#b58a45')
    doc.fillColor('#13234d').font('Helvetica-Bold').fontSize(18).text('AURUM', 62, 60)
    doc.font('Helvetica').fontSize(10).text('PROJECT CONTROLS', 62, 86)
    doc.fillColor('#b58a45').font('Helvetica-Bold').fontSize(11).text('SAMPLE PROJECT DOCUMENT', 62, 158)
    doc.fillColor('#13234d').fontSize(32).text('5 Unit 2 Bedroom\nBuilding BOQ', 62, 194, { width: 700 })
    doc.font('Helvetica').fontSize(20).text('Bill of Quantities', 62, 290)
    doc.moveTo(62, 335).lineTo(780, 335).strokeColor('#b58a45').stroke()
    doc.fontSize(11).text('DOCUMENT REF.   AUR-SAMPLE-BOQ-002     |     REVISION 01', 62, 357)
    doc.text('Prepared by Aurum Project Controls', 62, 386)
    doc.fillColor('#64748b').fontSize(10).text('Detailed bills, collections, cost summary and quantity basis.\nFive detached two-storey dwellings. Modelled quantities and supplied rates.\nIllustrative sample only; not issued for tender or construction.', 62, 432, { width: 700, lineGap: 6 })
    firstPage = false
  }
  function startPage() {
    if (!firstPage) doc.addPage()
    firstPage = false
    y = 42
    doc.rect(42, y, totalWidth, 26).fill('#13234d')
    headings.forEach((text, i) => doc.fillColor('white').font('Helvetica-Bold').fontSize(8).text(text, xs[i] + 4, y + 8, { width: widths[i] - 8, align: alignment(i) }))
    y += 26
  }
  function sourceText(cell: ExcelJS.Cell, cachedNumbers: Map<string, string>) {
    // ExcelJS omits cached formula results of zero; retain the XML source values.
    const cached = cachedNumbers.get(cell.address)
    if (cached !== undefined) return cached
    if (cell.type === ExcelJS.ValueType.Merge || cell.value === null || cell.value === undefined) return ''
    if (cell.type === ExcelJS.ValueType.Error || /^#(REF!|VALUE!|DIV\/0!|NAME\?|N\/A|NUM!|NULL!)/.test(cell.text)) return 'Unavailable'
    if (typeof cell.value === 'object' && cell.value && 'result' in cell.value && typeof cell.value.result === 'object') return 'Unavailable'
    return cell.text.trim().replace(/^[-–—_]+$/, '')
  }
  for (const sheet of workbook.worksheets) {
    const xml = await archive.file(`xl/worksheets/sheet${workbook.worksheets.indexOf(sheet) + 1}.xml`)?.async('string')
    const cachedNumbers = new Map<string, string>()
    for (const match of (xml || '').matchAll(/<c\b([^>]*)(?<!\/)>([\s\S]*?)<\/c>/g)) {
      if (/\bt="(?:s|e|str|inlineStr|b)"/.test(match[1])) continue
      const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1]
      const value = /<v>([^<]+)<\/v>/.exec(match[2])?.[1]
      if (address && value !== undefined && Number.isFinite(Number(value))) cachedNumbers.set(address, value)
    }
    const groups: string[][][] = []
    let group: string[][] = []
    for (let index = 3; index <= sheet.rowCount; index++) {
      const row = sheet.getRow(index)
      const columns = [1, 2, 3, 5, 6, 7]
      const original = columns.map(column => sourceText(row.getCell(column), cachedNumbers))
      if (original.every(value => !value)) continue
      // Ignore blank spacer rows that contain only zero-valued formulas.
      if (!original[0] && !original[1] && !original[2] && !original[3] && original.slice(4).every(value => !value || value === '0')) continue
      const values = [...original]
      if (/\bDEVELOPMENT\b.*\b(?:MR|MRS|MISS|DR)\b/i.test(values[1])) {
        values[1] = /\bRESIDENTIAL\b/i.test(values[1]) ? 'SAMPLE RESIDENTIAL DEVELOPMENT' : 'SAMPLE DEVELOPMENT'
      }
      for (let column = 4; column < values.length; column++) {
        if (!original[column] || original[column] === 'Unavailable') continue
        const amount = Number(original[column])
        if (!Number.isFinite(amount)) continue
        values[column] = amount === 0 ? '0' : amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      group.push(values)
      // These rows are the workbook's bill-page endings, not collection references.
      if (/PAGE\s+\d+\s*\/\s*\d+.*TO\s+(?:COLLECTION|SUMMARY)/i.test(values[1]) || /^(?:CARRIED\s+)?TO MAIN SUMMARY$/i.test(values[1])) {
        groups.push(group)
        group = []
      }
    }
    if (group.length) {
      // Trailing formula-only cells belong to the last source page.
      if (groups.length && group.every(values => values.slice(0, 4).every(value => !value))) groups[groups.length - 1].push(...group)
      else groups.push(group)
    }
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      startPage()
      let fontSize = 9.5
      const sectionRow = (values: string[]) => !values[0] && values.slice(2).every(value => !value)
      const rowHeight = (values: string[]) => {
        doc.font(sectionRow(values) ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
        return Math.max(fontSize + 12, ...values.map((text, column) => doc.heightOfString(text || ' ', { width: widths[column] - 8 }) + 12))
      }
      const rows = groups[groupIndex]
      while (rows.reduce((sum, values) => sum + rowHeight(values), 0) > doc.page.height - 58 - y && fontSize > 7.5) fontSize -= 0.25
      if (rows.reduce((sum, values) => sum + rowHeight(values), 0) > doc.page.height - 58 - y) throw new Error(`Source page ${groupIndex + 1} in ${sheet.name} does not fit. Adjust the layout before publishing.`)
      let stripe = 0
      for (const values of rows) {
      const section = sectionRow(values)
      const height = rowHeight(values)
      doc.rect(42, y, totalWidth, height).fill(section ? '#e8edf5' : stripe++ % 2 ? '#f5f7fa' : '#ffffff')
      if (!section) {
        doc.save().lineWidth(0.35).strokeColor('#d7dee8')
        for (const x of [...xs, 42 + totalWidth]) doc.moveTo(x, y).lineTo(x, y + height).stroke()
        doc.restore()
      }
      values.forEach((text, column) => {
        if (!text) return
        doc.fillColor('#263247').font(section ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
          .text(text, xs[column] + 4, y + 6, { width: widths[column] - 8, align: alignment(column) })
      })
      y += height
      rowCount++
      }
    }
  }
  const pages = doc.bufferedPageRange()
  for (let page = 0; page < pages.count; page++) {
    doc.switchToPage(page)
    doc.page.margins.bottom = 0
    doc.save().opacity(0.055).fillColor('#13234d').font('Helvetica-Bold').fontSize(74)
      .rotate(-25, { origin: [421, 298] }).text('SAMPLE', 260, 265, { lineBreak: false }).restore()
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8)
      .text('SAMPLE • FOR ILLUSTRATION ONLY', 42, doc.page.height - 35,
        { width: totalWidth, align: 'center', lineBreak: false })
  }
  doc.end()
  await new Promise<void>((resolve, reject) => { output.on('finish', resolve); output.on('error', reject) })
  console.log(`Created ${destination}: ${pages.count} pages, ${rowCount} populated rows, ${workbook.worksheets.length} sheets`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
