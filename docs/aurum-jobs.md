# Aurum Jobs

Administrators and commercial managers use `/jobs` to manage website enquiries. Viewers cannot access jobs, their files or exports.

The register offers project/client/service/location search, status filters, date/fee sorting, upcoming tender deadlines, recorded fees and unpaid-invoice totals. `All jobs PDF` exports the complete register, regardless of screen filters. Sales Excel retains the invoice export.

Each job has five sections:

- **Overview:** editable project, contact, service, status, tender and delivery details; original project brief; readiness checklist; created/updated dates.
- **Scope & intake:** required trades, client requirements, missing information and internal notes.
- **Fee proposal:** saved scope, deliverables, assumptions, professional fee and payment terms.
- **Documents:** original attachment metadata and authenticated downloads scoped to that job.
- **Invoices:** amount, optional VAT, due date, description, notes, calculated totals and protected payment-page links.

Switching sections retains edits. Save changes before exporting, previewing or invoicing. Empty dates and fees can be cleared; a zero fee is retained. Browser reload/close warns about unsaved edits. Navigating away using in-app links requires the user to save first to preserve edits.

## PDF exports

- `GET /api/business/jobs.pdf`: complete jobs register.
- `GET /api/business/quotes/:id/pdf`: internal job record, including intake notes and invoice summaries.
- `GET /api/business/quotes/:id/proposal.pdf`: client-facing fee proposal based on persisted fields. Internal notes, internal clarifications and invoice access tokens are excluded.

PDFs use the bundled Aurum logo, continuation headers, page numbering and automatic pagination. Downloads require the same authorised role as the job. Missing fees/dates/payment terms are shown honestly rather than filled with fabricated values. The proposal preview flags incomplete fee, delivery date and payment terms before issue.

## Deployment

Migration `20261012210000_job_proposal_details` adds four nullable text fields to `QuoteRequest`. It preserves existing data. The configured server build runs `prisma migrate deploy` before serving the updated API. For an existing local database run `npm run db:deploy --workspace=server` before starting the changed API.

## Verification

`server/src/routes/__tests__/businessJobs.test.ts` covers persistence inputs, validation, access control, document ownership, PDF responses and invoice arithmetic using a mocked database. Set `JOB_PDF_QA_DIR` to save genuine PDF artifacts for visual/text checks.

`client/e2e/jobs.spec.ts` covers search/filtering, all detail sections, saved proposal reload, invoice creation, download controls, error recovery and mobile layout with intercepted API fixtures. Real PDF rendering is verified separately by the backend tests. Set `PLAYWRIGHT_BROWSER_PATH` to use installed Chrome; set `PLAYWRIGHT_REUSE_SERVER=1` only when intentionally testing an existing preview server. Production database persistence and deployment health must be verified against the deployed environment.
