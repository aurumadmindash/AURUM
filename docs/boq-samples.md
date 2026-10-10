# Website BOQ samples

The main website preview is a complete, costed housing refurbishment **evaluation basket**, not a measured five-unit development or a completed Aurum client project. All twelve quantities and both price sets come from publicly published council pricing schedules. No missing building measurements are invented.

The website also offers a completed copy of the client template as **Sample 2**. The original uncompleted preview is retained as a reference artifact, and the source spreadsheet remains unchanged.

## Published worked example

- `/samples/boq-sample.pdf`: six-page priced example, trade subtotals, summary and source/basis page.
- `/samples/boq-worked-sample.xlsx`: calculation workbook with formula-linked item amounts, section totals, summary, and cell-reference register.
- [Source data](../server/data/boq-worked-sample.json): selected published quantities, paired rates, original worksheet/cell references and source-file checksums.

Reference rates come from the [public council pricing schedules](https://www.royalgreenwich.gov.uk/downloads/download/1381/schedule_of_rates_for_a_long-term_major_works_contract). Sources were retrieved on 10 October 2026. These are historical framework prices, not current market quotes. Quantities are the original evaluation quantities, not site measurements. Descriptions are concise paraphrases; the original framework specifications govern the published prices. No claim of complete NRM compliance is made.

All rates are rounded to pence before multiplication. Each displayed amount is quantity multiplied by its displayed rate, rounded to pence; section and overall totals sum those amounts. Primary and alternative totals are independent comparisons and must never be added together. VAT is not calculated. No additional preliminaries, overheads or profit are added because these may already be included in the original rates.

Regenerate from the repository root:

```powershell
npx tsx server/scripts/create-priced-boq-sample.ts
```

## Original template layout

The second public sample is `/samples/boq-client-completed.pdf`, with its companion `/samples/boq-client-completed.xlsx`. The PDF retains the 25 original bill/summary pages and appends seven completion-basis pages. It repeats column headings on every page, preserves the source bill-page references and all supplied rates, and includes no identifying client names.

`server/scripts/complete-client-boq.ts` completes 86 quantity rows using an explicit five-dwelling sample model, and retains eight building lump sums and the original external-work figures. The model defines five detached two-storey dwellings, 10 x 8 m footprints, openings and finishes, plus provisional structural allowances. Quantities are **not** measurements of the actual client's site. Existing 150/190 kg per cubic metre reinforcement allowances are taken from the source helper formulas; diameter splits are stated provisional allocations, not engineered schedules. A detailed quantity basis is included in the workbook and PDF, and `server/data/boq-client-measurements.json` records the figures and calculated totals.

Broken alternative formulas are removed; zero alternative rates/amounts mean no alternative quotation was supplied. Extra source-summary blocks without worksheets are explicitly excluded, and a duplicate external-works line is excluded. Primary amounts, collections and summaries use formula-linked, recalculated results. The original supplied rates are unusually large when treated as GBP; they are retained at the user's instruction, without conversion or an assertion that they represent current UK market prices. The source 20% VAT calculation is labelled as illustrative arithmetic, with actual tax applicability unverified.

Regenerate Sample 2:

```powershell
npx tsx server/scripts/complete-client-boq.ts 'path-to-client-workbook.xlsx'
npx tsx server/scripts/create-boq-preview.ts client/public/samples/boq-client-completed.xlsx client/public/samples/boq-client-completed.pdf
```

`/samples/boq-template-preview.pdf` is the 25-page template-format example. The original spreadsheet remains unchanged outside the repository. Regenerate with its local path:

```powershell
npx tsx server/scripts/create-boq-preview.ts 'path-to-client-workbook.xlsx'
```

Both public examples are labelled as samples, contain no identifying client names, and serve distinct purposes. Before a document is issued for a live tender, quantities, scope, specifications, current rates and tax treatment must be confirmed for that actual project.
