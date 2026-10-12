# Website BOQ sample

The website presents one complete PDF sample: **Five-Dwelling Residential Development — Bill of Quantities**. It has 33 pages: a named project cover, 25 original bill/summary pages and seven completion-basis pages. The sample uses modelled quantities and supplied rates; it is not issued for tender or construction.

Both `/boq-samples/1` and `/boq-samples/2` open their respective samples. Alternative rate and amount columns are omitted from both public PDFs. Excel downloads are disabled; calculation workbooks are retained in `server/data`, outside the public website.

## Regeneration

From the repository root:

```powershell
npx tsx server/scripts/create-priced-boq-sample.ts
npx tsx server/scripts/complete-client-boq.ts 'path-to-client-workbook.xlsx'
npx tsx server/scripts/create-boq-preview.ts server/data/boq-client-completed.xlsx client/public/samples/boq-client-completed.pdf
python server/scripts/render-boq-previews.py
```

The original source workbook remains unchanged. Completion uses an explicit five-dwelling sample model. Quantities are not actual site measurements. Structural allowances and reinforcement allocations are provisional. Original supplied GBP rates are preserved; they are not asserted to be current market prices. The illustrative VAT calculation requires verification for a live project.

Mobile viewers use six and 33 static WebP pages respectively with page navigation and zoom. Regenerate the previews whenever the PDF changes. PDF is the only public download format.
