# Aurum product overview

Aurum supports estimating, quantity take-offs, tender preparation and commercial project management.

## Public website

Visitors can explore services, request a quotation and upload drawings, specifications and bills of quantities. Quote requests create job records and send acknowledgement emails when Resend is configured.

## Jobs and invoicing

Staff manage enquiries, delivery requirements, tender deadlines and job status. They can prepare fee proposals, create numbered invoices and export sales data to Excel. Clients view invoices through private links. Optional Stripe Checkout supports online payment with server-side verification and signed webhook confirmation.

## Project controls

Project teams manage NEC3 and NEC4 early warnings, compensation events, notices, risks, documents, drawings and comments. Dashboards, PDF reports, audit records and notifications support day-to-day administration.

## Hosting and services

- Vercel serves the website and API and runs scheduled notifications.
- Supabase Postgres stores application records and uploaded documents.
- Resend sends invitations, password resets and notifications.
- The application manages its own login; it does not use Supabase Auth.

## Launch requirements

Configure production credentials, confirm database access and test login and email delivery. Replace legal-page placeholders with approved wording. Configure and test Stripe before accepting online payments.

See [setup](getting-started.md), [deployment](deployment.md), [launch checklist](launch-checklist.md) and [maintenance](maintenance.md).
