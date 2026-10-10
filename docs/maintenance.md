# Aurum maintenance

## Fresh account setup

Follow [launch-checklist.md](launch-checklist.md) and
[deployment.md](deployment.md).

A fresh Supabase project starts empty. Run the included migrations through the
deployment build; do not wipe an existing database during routine maintenance.
If existing records are needed, back up and migrate them before changing domains.

## Administrator account

Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before the first deployment.
Production requires a valid email and a password of at least 12 characters.
The seed preserves existing passwords on redeploy. Set SEED_DEMO=false to keep
demo records out of production. Migration and seed failures stop deployment.

## Domain and email

Attach the chosen domain to the new Vercel project, update registrar DNS, and set
CLIENT_URL to the canonical HTTPS site URL without a trailing slash. Redeploy
after configuration changes.

Configure Resend SMTP in Vercel and verify the sending domain. Set SALES_EMAIL
to the internal quote-enquiry inbox. Supabase SMTP is not used by this application.
Test quote acknowledgement, internal enquiry mail, invitations and password reset.

## Payments

Stripe Checkout is implemented. Configure STRIPE_SECRET_KEY and
STRIPE_WEBHOOK_SECRET and register /api/business/stripe/webhook for
checkout.session.completed and checkout.session.async_payment_succeeded.
Use separate test-mode and live-mode webhook secrets.

Invoices require private access links containing #token=... from the Jobs
dashboard. The new migration backfills tokens on existing invoices. Replace old
links that contain only invoice numbers. Anyone with the complete link can view
and pay the invoice; share it with the intended client.

The API checks invoice identity, amount and currency before recording payment.
Both the customer return page and signed Stripe webhooks can confirm payment.
Reconcile any checkout sessions created before this change: they lack the new
invoice metadata and must not be treated as automatically verified.

## Validation and launch work

Server regression tests cover invoice access, payment verification, webhook
signatures and deployment failure handling, alongside the existing NEC and file
naming tests. Browser tests cover payment-page errors and confirmation states.

Before launch, verify the real database migrations, login, quote uploads, job
workflow, fee proposals, invoice creation, email delivery, payment in Stripe test
mode, the live webhook endpoint, and role permissions on the deployed site.
Replace legal-page placeholders with approved text.

Separate client/contractor/subcontractor organizations are not currently implemented. Project team access still uses the existing shared membership model.

## Project letterheads

Set the issuing company name, email, website and PNG/JPEG logo in New Project or Edit Details. Logos are resized before upload and stored with the project in Supabase. Exports use that company, including continuation pages and footers. Existing projects fall back to their contractor or client name until letterhead details are saved. The project_letterhead migration adds optional fields without replacing existing records.

## Notification checks

Project members receive contract changes, including their own changes, when Contract events is enabled. Active staff receive job updates and invoice-creation messages. Comments respect their separate preference and visibility rules. Saving waits for the email attempt; provider failure is logged without undoing the saved record. Failed change emails are not automatically retried.

Administrators can open Settings and choose Send test email. Provider acceptance is not a guarantee of inbox delivery: check spam and Resend email logs. Production requires SMTP_HOST=smtp.resend.com, SMTP_PORT=587, SMTP_USER=resend, SMTP_PASS set to the Resend API key, SMTP_FROM=contact@aurumite.com and a verified sending domain. Redeploy after changing Vercel settings.

## Tender submissions

The public tender form accepts up to three drawings, one specification and one bill of quantities, with a 4 MB combined file limit. It handles non-JSON hosting errors and confirms success only after the API returns a saved tender ID. On receipt, the sender is automatically emailed an acknowledgement that their tender is under review; the internal enquiry email is sent separately. Larger files require a direct-to-storage upload flow, which is not yet implemented. Resend must be configured and its sending domain verified for these messages to be delivered.
