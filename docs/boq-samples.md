# Website BOQ samples

The main website preview is a complete, costed housing refurbishment **evaluation basket**, not a measured five-unit development or a completed Aurum client project. All twelve quantities and both price sets come from publicly published council pricing schedules. No missing building measurements are invented.

The original client workbook remains represented by the separate anonymised full template preview. Its source figures, zeros, bill-page references and column structure are preserved; it is a layout example and contains incomplete source calculations.

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

`/samples/boq-template-preview.pdf` is the 25-page template-format example. The original spreadsheet remains unchanged outside the repository. Regenerate with its local path:

```powershell
npx tsx server/scripts/create-boq-preview.ts 'path-to-client-workbook.xlsx'
```

Both PDFs are labelled as samples, contain no identifying client names, and serve distinct purposes. Before a document is issued for a live tender, quantities, scope, specifications, current rates and tax treatment must be confirmed for that actual project.
