import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

// Complete a separate sample copy. Never write to the supplied workbook.
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
type Measurement = { row: number; quantity: number; basis: string }
const measurements: Measurement[] = []
const add = (row: number, quantity: number, basis: string) => measurements.push({ row, quantity: round(quantity), basis })
const n = 5, footprint = n * 10 * 8, perimeter = n * 2 * (10 + 8), foundationLength = perimeter + n * 12
const bases = n * 8, excavation = foundationLength * .6 + bases * 1.2 * 1.2 * 1.2
const footing = foundationLength * .6 * .25, baseConcrete = bases * 1 * 1 * .35, stubs = bases * .23 * .23 * .65
const foundationWall = foundationLength * .65, returnFill = excavation - footing - baseConcrete - stubs - foundationWall * .23
const roofRun = 4.5 / Math.cos(Math.PI / 6), roofArea = n * 11 * 9 / Math.cos(Math.PI / 6), trusses = n * 20
const windowArea = n * (.9 * .9 + 2 * .9 * 1.2 + 2.3 * 1.2 + 2 * 1.2 * 1.2 + 1.5 * 1.2)
const externalWall = perimeter * 6 - windowArea - n * (1.2 * 2.175 + .9 * 2.175 + 2.5 * 2)
const internalWall = n * 80 * 3 - n * (6 * .9 * 2.1 + 3 * .75 * 2.1)
const wallRender = externalWall + 2 * internalWall, wallTiles = n * 50
const columns = bases * .23 * .23 * 6, floorBeams = foundationLength * .23 * .45, roofBeams = foundationLength * .23 * .3
const stairs = n * 1.1 * 4 * .15, lintels = n * 18 * .23 * .15, upperSlab = footprint * .15
const subSteel = (baseConcrete + stubs) * 150, structureSteel = (columns + floorBeams + roofBeams + stairs + upperSlab) * 190

add(9, footprint * .15, '5 x 10 x 8 m footprint x 0.15 m reduced-level excavation')
add(12, foundationLength * .6, '240 m strip trenches x 0.60 m width x 1.00 m depth; separate from internal column pits')
add(15, bases * 1.2 ** 3, '40 separate internal column pits x 1.20 x 1.20 x 1.20 m')
add(18, returnFill, 'Trench/pit excavation less footing, bases, stubs and foundation blockwork volumes')
add(21, footprint * .15 + excavation - returnFill, 'Reduced-level + foundation excavation less return fill; all surplus removed')
add(24, footprint * .3, '400 m2 footprint x 0.30 m compacted fill')
add(27, footprint, '400 m2 net footprint; laps included in the supplied rate')
add(32, (foundationLength * .6 + bases * 1.2 ** 2) * .04, 'Strip/pit base areas x 0.04 m blinding thickness')
add(35, footing, '240 x 0.60 x 0.25 m strip footing')
add(40, baseConcrete, '40 x 1.00 x 1.00 x 0.35 m bases')
add(43, stubs, '40 x 0.23 x 0.23 x 0.65 m column stubs')
add(46, footprint * .15, '400 m2 ground-floor slab x 0.15 m')
add(55, bases * 4 * .35, '40 bases x four 1.00 m sides x 0.35 m depth')
add(58, bases * 4 * .23 * .65 + perimeter * .15, 'Column stub faces plus exposed slab perimeter edge')
add(64, subSteel * .3, '30% of 150 kg/m3 provisional reinforcement allowance on bases and stubs')
add(67, subSteel * .3, '30% of the same provisional reinforcement allowance')
add(70, subSteel * .25, '25% of the same provisional reinforcement allowance')
add(73, subSteel * .15, '15% of the same provisional reinforcement allowance')
add(77, footprint, '400 m2 net ground-floor slab mesh; no lap area added')
add(80, foundationWall, '240 m foundation wall length x 0.65 m height')
add(161, columns, '40 columns x 0.23 x 0.23 x 6.00 m above ground')
add(164, floorBeams, '240 m floor-beam length x 0.23 x 0.45 m; separate sample beam/slab volumes')
add(167, roofBeams, '240 m roof-beam length x 0.23 x 0.30 m')
add(170, stairs, '5 stair waist slabs x 1.10 x 4.00 x 0.15 m; steps included in allowance')
add(173, 0, '0: lintels are priced with reinforcement under item F on source page 2/5; avoids duplicate pricing')
add(176, upperSlab, '400 m2 upper-floor slab x 0.15 m')
add(181, bases * 4 * .23 * 6, '40 columns x four 0.23 m sides x 6.00 m height')
add(184, foundationLength * (2 * .45 + .23), '240 m floor beams x two sides and soffit widths')
add(187, foundationLength * (2 * .3 + .23), '240 m roof beams x two sides and soffit widths')
add(190, 0, '0: precast lintel rate includes the complete item; no separate formwork')
add(193, footprint, '400 m2 net suspended-floor soffit')
add(196, n * (1.1 * 4 + 2 * 4 * .15), '5 stairs: sloping soffit plus two waist edges')
add(216, structureSteel * .3, '30% of source 190 kg/m3 provisional reinforcement allowance; excludes precast lintels')
add(219, structureSteel * .4, '40% of the same provisional reinforcement allowance')
add(222, structureSteel * .2, '20% of the same provisional reinforcement allowance')
add(226, structureSteel * .1, '10% of the same provisional reinforcement allowance')
add(231, n * (.9 + 2 * .9 + 2.3 + 2 * 1.2 + 1.5), 'Sum of window widths: seven scheduled windows per dwelling')
add(234, n * 18, '18 m total precast lintel length per dwelling, including end bearings')
add(319, roofArea, '5 separate 11 x 9 m roofs on plan, 30-degree slope; includes overhangs')
add(324, n * 11, '5 ridges x 11 m')
add(327, n * 2 * 11, '5 roofs x two 11 m eaves')
add(330, 0, '0: detached pitched roofs have no abutment flashing in this sample scope')
add(333, n * 4 * roofRun, 'Four sloping verge edges per roof x 4.5/cos(30 degrees)')
add(338, perimeter, 'Two 10 m wall plates plus two 8 m returns per dwelling')
add(341, trusses * 2 * roofRun, '20 trusses per dwelling x two sloping rafters')
add(344, trusses * 9, '100 trusses x 9 m tie span')
add(347, trusses * 2 * 2, '100 trusses x two 2 m struts')
add(350, n * 2 * 5 * 11, 'Five purlin lines per roof slope x two slopes x 11 m')
add(353, footprint * 2 / .6 + n * 10 / .6, '600 mm grid over 400 m2 upper ceiling, plus transverse noggins over 50 m2 eaves')
add(365, n * (2 * 11 + 4 * roofRun), 'Both eaves plus four sloping verges per roof')
add(368, n, 'One 3.00 x 1.50 m pergola per dwelling')
add(471, externalWall, '180 m total external perimeter x 6 m height, less scheduled windows and external doors')
add(474, internalWall, '80 m internal partitions per dwelling x 3 m storey height, less internal door openings')
add(481, n, 'One 900 x 900 mm window per dwelling')
add(484, n * 2, 'Two 900 x 1200 mm windows per dwelling')
add(487, n, 'One 2300 x 1200 mm window per dwelling')
add(490, n * 2, 'Two 1200 x 1200 mm bedroom windows per dwelling')
add(493, n, 'One 1500 x 1200 mm window per dwelling')
add(520, n, 'One 1200 mm entrance door per dwelling')
add(523, n, 'One 900 mm external door per dwelling')
add(526, n, 'One garage shutter per dwelling; garage included in ground-floor footprint')
add(531, n * 6, 'Six 900 mm internal doors per dwelling')
add(534, n * 3, 'Three 750 mm internal doors per dwelling')
add(538, n * (6 * .9 + 3 * .75) * 2.1 * 2, 'Both faces of 45 internal door leaves; lining finish included in rate')
add(670, wallRender, 'Internal face of external walls plus both faces of partitions, net of openings')
add(673, footprint, '400 m2 exposed lower-storey concrete soffits')
add(679, wallRender - wallTiles, 'Net internal wall rendering less 250 m2 tiled wall finish')
add(682, footprint, '400 m2 lower-storey soffit skim')
add(687, wallRender - wallTiles, 'Same net skimmed wall area; tiled areas excluded')
add(690, footprint, '400 m2 lower-storey painted concrete soffits')
add(696, externalWall, 'Net external wall area; one exterior face only')
add(699, externalWall, 'Same external rendered wall area')
add(702, wallTiles, '50 m2 tiled kitchen/bathroom wall finishes per dwelling')
add(720, n * 120, '120 m2 ceramic floors per dwelling; total net floor area 152 m2 each')
add(723, n * 110, '110 m ceramic skirting per dwelling, excluding door gaps and granite zones')
add(728, n * 17, '17 m2 granite circulation floors per dwelling; excludes ceramic and garage areas')
add(731, n * 16 * 1.1, '16 stair treads per dwelling x 1.10 m width')
add(734, n * 16 * 1.1, '16 stair risers per dwelling x 1.10 m width')
add(737, n * 30, '30 m granite skirting per dwelling, excluding ceramic zones')
add(744, n * 15, '15 m2 garage floor finish per dwelling')
add(747, n * 137, 'Ceramic and granite floor areas: 120 + 17 m2 per dwelling')
add(750, wallTiles, 'Backing to the 250 m2 wall tiling only')
add(766, footprint, '400 m2 top-storey plasterboard ceiling')
add(769, n * 120, '120 m ceiling cornice per dwelling, after openings/untreated garage zones')
add(772, footprint, '400 m2 top-storey plasterboard ceiling painted')
add(775, n * 10, '10 m2 horizontal eaves soffit per dwelling')

async function main() {
  const source = process.argv[2]
  if (!source) throw new Error('Provide the original client workbook path.')
  const original = new ExcelJS.Workbook()
  await original.xlsx.readFile(source)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Aurum Project Controls'
  workbook.title = 'Sample 2: completed five-dwelling BOQ'
  workbook.calcProperties.fullCalcOnLoad = true
  const names = ['Building works', 'External works', 'Summary']
  original.worksheets.forEach((input, index) => {
    const sheet = workbook.addWorksheet(names[index], { views: [{ state: 'frozen', ySplit: 1 }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' } })
    input.eachRow((row, number) => row.eachCell((cell, column) => {
      if (cell.type === ExcelJS.ValueType.Merge) return
      let value: ExcelJS.CellValue = cell.value
      if (cell.formula) {
        let formula = cell.formula
        original.worksheets.forEach((s, i) => { formula = formula.replaceAll(`'${s.name}'!`, `'${names[i]}'!`) })
        value = { formula }
      }
      if (typeof value === 'string') {
        value = value.replace(/\b(?:RESIDENTIAL )?DEVELOPMENT\b.*\b(?:MR|MRS|MISS|DR)\b.*/i, 'SAMPLE FIVE-DWELLING DEVELOPMENT')
          .replace(/\bPC N\s*(\d)/g, 'PC £$1').replace(/^[-–—_]+$/, '')
      }
      sheet.getCell(number, column).value = value
    }))
    sheet.columns = [{ width: 7 }, { width: 80 }, { width: 14 }, { width: 2 }, { width: 10 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 22 }]
    sheet.getRow(1).values = ['Item', 'Description', 'Qty', '', 'Unit', 'Rate (£)', 'Amount (£)', 'Alt. rate (£)', 'Alt. amount (£)']
    // No alternative quotation was supplied. Explicit zeros do not fabricate a competing bid.
    sheet.eachRow(row => { row.getCell(8).value = null; row.getCell(9).value = null })
  })
  const building = workbook.worksheets[0], external = workbook.worksheets[1], summary = workbook.worksheets[2]
  const seen = new Set<number>()
  for (const item of measurements) {
    if (seen.has(item.row)) throw new Error(`Duplicate measurement: ${item.row}`)
    seen.add(item.row)
    building.getCell(`C${item.row}`).value = item.quantity
    building.getCell(`G${item.row}`).value = { formula: `ROUND(C${item.row}*F${item.row},2)` }
  }
  for (const sheet of [building, external]) sheet.eachRow((row, index) => {
    const c = row.getCell(3), e = row.getCell(5), f = row.getCell(6), g = row.getCell(7)
    if (typeof c.value === 'number' || c.formula) {
      if (e.text && (typeof f.value === 'number' || f.formula)) g.value = { formula: `ROUND(C${index}*F${index},2)` }
    } else if (typeof g.value === 'number' && g.value > 0 && row.getCell(1).text) {
      c.value = 1; e.value = 'sum'; f.value = g.value
      g.value = { formula: `ROUND(C${index}*F${index},2)` }
    }
    // Merged source cells already collapse to their description in this clean copy.
    if (g.value && (typeof g.value === 'number' || g.formula)) {
      row.getCell(8).value = 0; row.getCell(9).value = 0
    }
    if (g.formula && /^C\d+\*F\d+$/.test(g.formula) && !e.text && !f.value) {
      g.value = null; row.getCell(8).value = null; row.getCell(9).value = null
    }
  })
  building.getCell('B3').value = 'SAMPLE FIVE-DWELLING DEVELOPMENT - MODELLED QUANTITIES; SUPPLIED GBP RATES'
  building.getCell('B920').value = 'BILL Nr 2 - FIVE TWO-BEDROOM DWELLINGS'
  building.getCell('B60').value = 'Reinforcement quantities are provisional allowances; see Quantity basis.'
  building.getCell('B63').value = null
  building.getCell('B211').value = 'Reinforcement quantities are provisional allowances; see Quantity basis.'
  building.getCell('B214').value = null
  building.getCell('B562').value = null
  external.getCell('B211').value = 'BILL Nr 5 - EXTERNAL WORKS'
  summary.getCell('B4').value = 'SAMPLE FIVE-DWELLING DEVELOPMENT'
  summary.getCell('B15').value = 'BILL Nr 2 - FIVE TWO-BEDROOM DWELLINGS'
  summary.getCell('B20').value = 'BILL Nr 5 - EXTERNAL WORKS'
  const excludedBills = ['Additional four-unit block A: excluded, supporting worksheet not supplied', 'Additional four-unit block C: excluded, supporting worksheet not supplied', 'Additional two-unit block D: excluded, supporting worksheet not supplied', 'Duplicate external-works line: excluded to avoid counting the same bill twice']
  for (const [index, row] of [22, 25, 28, 31].entries()) {
    summary.getCell(`B${row}`).value = excludedBills[index]
    summary.getCell(`G${row}`).value = 0
  }
  summary.getCell('B41').value = 'Source VAT calculation at 20% (sample arithmetic; tax treatment unverified)'
  summary.getCell('B37').value = 'Source contingency allowance retained'
  summary.getCell('C37').value = null
  summary.getCell('G39').value = { formula: 'SUM(G10,G15,G20,G37)' }
  summary.getCell('B39').value = 'SUBTOTAL BEFORE SOURCE VAT CALCULATION'
  summary.getCell('I966').value = null
  const visiting = new Set<string>(), results = new Map<string, number>()
  function calculate(sheet: ExcelJS.Worksheet, address: string): number {
    const key = `${sheet.name}!${address}`
    if (results.has(key)) return results.get(key)!
    if (visiting.has(key)) throw new Error(`Circular formula ${key}`)
    visiting.add(key)
    const cell = sheet.getCell(address)
    let value = typeof cell.value === 'number' ? cell.value : 0
    if (cell.formula) {
      let formula = cell.formula
      if (formula.includes('#REF!')) throw new Error(`Unrepaired formula ${key}`)
      const resolve = (reference: string) => {
        const parts = /^(?:'([^']+)'!)?([A-Z]+\d+)$/.exec(reference)
        if (!parts) throw new Error(`Unsupported reference ${reference}`)
        return calculate(parts[1] ? workbook.getWorksheet(parts[1])! : sheet, parts[2])
      }
      formula = formula.replace(/SUM\(([^()]*)\)/g, (_, expression: string) => {
        const sum = expression.split(',').reduce((total, term) => {
          const range = /^([A-Z]+)(\d+):\1(\d+)$/.exec(term)
          if (range) { for (let r = Number(range[2]); r <= Number(range[3]); r++) total += calculate(sheet, `${range[1]}${r}`); return total }
          return total + resolve(term)
        }, 0)
        return String(round(sum))
      })
      formula = formula.replace(/(?:'[^']+'!)?[A-Z]+\d+/g, ref => String(resolve(ref)))
      formula = formula.replace(/([\d.]+)%/g, '($1/100)')
      formula = formula.replace(/^ROUND\((.*),2\)$/, '$1')
      // Arithmetic parser accepts only numbers/operators; no dynamic code execution.
      const tokens = formula.match(/\d+(?:\.\d+)?|[()+*\/-]/g) || []
      if (tokens.join('') !== formula) throw new Error(`Unsupported formula ${key}: ${formula}`)
      let position = 0
      function atom(): number { const token = tokens[position++]; if (token === '(') { const v = sum(); if (tokens[position++] !== ')') throw new Error('Unbalanced formula'); return v }; return Number(token) }
      function product(): number { let v = atom(); while (['*', '/'].includes(tokens[position])) { const op = tokens[position++], right = atom(); v = op === '*' ? v * right : v / right }; return v }
      function sum(): number { let v = product(); while (['+', '-'].includes(tokens[position])) { const op = tokens[position++], right = product(); v = op === '+' ? v + right : v - right }; return v }
      value = round(sum())
      if (position !== tokens.length || !Number.isFinite(value)) throw new Error(`Invalid result ${key}`)
      cell.value = { formula: cell.formula, result: value }
    } else if (cell.type === ExcelJS.ValueType.Error) throw new Error(`Unrepaired error ${key}`)
    visiting.delete(key); results.set(key, value); return value
  }
  for (const sheet of workbook.worksheets) sheet.eachRow(row => row.eachCell(cell => { if (cell.formula || cell.type === ExcelJS.ValueType.Error) calculate(sheet, cell.address) }))
  building.eachRow((row, index) => {
    if (index > 1 && row.getCell(1).text && row.getCell(2).text && row.getCell(5).text && row.getCell(6).value && typeof row.getCell(3).value !== 'number') throw new Error(`Missing quantity at building row ${index}`)
  })
  const basis = workbook.addWorksheet('Quantity basis')
  basis.columns = building.columns.map(c => ({ width: c.width }))
  const notes = [
    'SAMPLE 2 - COMPLETION BASIS; READ WITH ALL BILL PAGES',
    'This is a completed sample copy of the supplied template, not a measured client project. No drawings were supplied. Original source file remains unchanged.',
    'Sample measurement model: five detached two-storey two-bedroom dwellings; each footprint 10 x 8 m, two 3 m storeys. Ground and upper gross areas are 400 m2 each. This model is a stated scope, not a survey.',
    'Per dwelling: seven windows; two external doors; one garage shutter; six 900 mm and three 750 mm internal doors. Internal partitions total 80 m per dwelling, measured across both storeys.',
    'Per dwelling net finished floors: ceramic 120 m2 + granite 17 m2 + garage 15 m2 = 152 m2; gross 160 m2 less 8 m2 wall/void allowance. Wall tiles: 50 m2 per dwelling.',
    'Structural sizes and reinforcement quantities are provisional sample allowances, not structural design. Source mass allowances 150 kg/m3 (bases/stubs) and 190 kg/m3 (frame) are split by stated percentages; all require engineered schedules for a live project.',
    'External-work quantities and all supplied lump sums are retained from the source; they were not measured against this model. Original rates and allowances remain GBP without conversion or market validation.',
    'All priced amounts are displayed quantity x supplied rate, rounded to pence. Collections and summaries are recalculated. Zero means excluded/not applicable; alternative prices are zero because no alternative quotation was supplied.',
    'Source unit key: CM = cubic metres (m3); SM = square metres (m2); M = linear metres; Kg = kilograms; Nr = number; sum = one complete provisional/lump-sum allowance.',
    'Unsupported extra building bills from the source summary are explicitly excluded, rather than inventing entire missing buildings. The five-dwelling bill and external works are included once only.',
    'The source 20% VAT arithmetic is retained for illustration only; applicability to an actual new-build project has not been established. Preliminaries and contingency are the original source allowances.',
    'Measurement reference: RICS NRM guidance https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm . No claim of full NRM compliance is made.',
  ]
  let row = 3
  for (const note of notes) basis.getCell(`B${row++}`).value = note
  basis.getCell(`B${row++}`).value = 'TO MAIN SUMMARY'
  for (let index = 0; index < measurements.length; index++) {
    const item = measurements[index]
    basis.getCell(`A${row}`).value = String(index + 1)
    basis.getCell(`B${row}`).value = `Building row ${item.row}: ${item.basis}`
    basis.getCell(`C${row}`).value = item.quantity
    basis.getCell(`E${row}`).value = building.getCell(`E${item.row}`).text
    row++
    if ((index + 1) % 15 === 0 || index === measurements.length - 1) basis.getCell(`B${row++}`).value = 'TO MAIN SUMMARY'
  }
  for (const sheet of workbook.worksheets) sheet.eachRow((r, index) => {
    r.height = index === 1 ? 28 : r.getCell(2).text ? Math.max(24, Math.ceil(r.getCell(2).text.length / 90) * 16) : 6
    r.eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF263247' } }
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: Number(cell.col) <= 2 ? 'left' : Number(cell.col) === 5 ? 'center' : 'right' }
      if ([3, 6, 7, 8, 9].includes(Number(cell.col))) cell.numFmt = Number(cell.col) === 3 ? '0.##' : '#,##0.00;(#,##0.00);0'
    })
    if (index === 1) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13234D' } }; c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } } })
  })
  const destination = path.resolve('client/public/samples/boq-client-completed.xlsx')
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  await workbook.xlsx.writeFile(destination)
  fs.writeFileSync('server/data/boq-client-measurements.json', JSON.stringify({ basis: notes, measurements, buildingTotal: calculate(building, 'G965'), externalTotal: calculate(external, 'G260'), totalWithSourceVat: calculate(summary, 'G45') }, null, 2) + '\n')
  console.log(`Created ${destination}; ${measurements.length} modelled quantities; total £${calculate(summary, 'G45').toLocaleString('en-GB')}`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
