# Deploying the Server with Supabase Database

This repo uses an Express API server with Prisma. You can keep the backend logic unchanged while migrating the database to Supabase.

For the combined Vercel frontend/API deployment, follow
[the full-stack guide](../docs/DEPLOY_VERCEL_SUPABASE.md) and
[the fresh-account checklist](../docs/NEW_ACCOUNTS_CHECKLIST.md).
Set the Vercel root to the repository root and select Services.

## Recommended deployment pattern
1. Create a Supabase project.
2. Use Supabase Postgres and copy the `DATABASE_URL` connection string.
3. Set the same `DATABASE_URL` in your backend host environment.
4. Keep `JWT_SECRET` and `CLIENT_URL` configured in your host environment.

## Environment variables
- `DATABASE_URL` — Supabase Postgres URL
- `JWT_SECRET` — secure JWT signing key
- `CLIENT_URL` — Vercel frontend URL, e.g. `https://aurum-app.vercel.app`
- `PORT` — optional port for your backend host

## Notes
- You do not need to change any business code for Supabase Postgres.
- The Prisma schema already uses `env("DATABASE_URL")`.
- If you deploy the backend separately, point the frontend `VITE_API_URL` to the backend URL.

## Layer 1 business workflow
The 2026 reform adds a service-first workflow without removing the existing NEC platform.

New environment variables:
- `SALES_EMAIL` — inbox for new public quote enquiries.
- `STRIPE_SECRET_KEY` — optional Stripe secret key. If omitted, the invoice page remains available but online card checkout is disabled.
- `STRIPE_WEBHOOK_SECRET` — signing secret for `/api/business/stripe/webhook`.
  Online checkout requires both Stripe secrets. Enable `checkout.session.completed`
  and `checkout.session.async_payment_succeeded` on that endpoint.
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` — required for production seeding;
  the password must be at least 12 characters. Existing passwords are preserved.
- `SMTP_*` — required for the automatic client acknowledgement and internal enquiry emails.

The new Prisma migration `20261006090000_layer1_business` adds quote requests, uploaded enquiry documents, invoices, invoice numbering, and business settings.

Public workflow:
- `/` — service-first Aurum website.
- `/request-quote` — drawing/specification/BoQ submission form.
- `/payment/:invoiceNumber` — client invoice/payment page.
  Share the complete private link including `#token=...` from the Jobs dashboard.
  Migration `20261010090000_invoice_access` backfills access tokens on existing
  invoices. Replace old tokenless links. Reconcile any old Stripe sessions before
  switching, since they lack the new invoice-binding metadata.

Authenticated workflow:
- `/jobs` — Layer 1 jobs and deadline dashboard.
- `/jobs/:id` — client intake and fee management.
- `/jobs/:id/proposal` — printable fee proposal.
- `/api/business/sales.xlsx` — sales export for Excel.

The NEC3/NEC4 project-control modules remain under the authenticated project area as the Layer 3 platform. Before public launch, replace the legal-page placeholders with the approved Privacy Notice, Cookie Notice, Terms of Use and Terms of Business.
