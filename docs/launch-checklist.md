# Fresh Supabase and Vercel setup

1. Create your Supabase account at https://supabase.com/dashboard and complete
   email verification. Create an organization and a new project. Save its database
   password privately. This application uses Prisma with Supabase Postgres and its
   own JWT login; Supabase Auth and public API keys are not required.
2. In the project's Connect panel, copy the Transaction pooler connection string
   for DATABASE_URL (port 6543, with ?pgbouncer=true&connection_limit=1) and the
   Session pooler string for DIRECT_URL (port 5432). Replace the password placeholder
   with the URL-encoded database password.
3. Create your Vercel account at https://vercel.com/signup and connect the GitHub
   account that owns the repository. Use an existing GitHub account or create one
   if needed, and put the updated project in a private repository. Exclude ZIPs,
   node_modules, generated build output, and environment files.
4. Import that repository into one Vercel project. Root Directory must be the
   repository root, not client or server. Select the Services framework (Beta).
   Keep build/output overrides unset; vercel.json configures both services.
5. Add the required variables below in Vercel before the first deployment.
   Store secrets in the dashboard, not in GitHub or chat.

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Supabase transaction pooler URL |
| DIRECT_URL | Supabase session pooler URL for migrations |
| JWT_SECRET | Independently generated long random signing secret |
| CRON_SECRET | Independently generated long random cron secret |
| CLIENT_URL | Final public site URL without a trailing slash |
| NODE_ENV | production |
| SEED_ADMIN_EMAIL | Your administrator email |
| SEED_ADMIN_PASSWORD | Your chosen strong initial administrator password |
| SEED_DEMO | false |

Leave VITE_API_URL unset: frontend and API share the deployment domain.
Use a separate Supabase project for previews if preview builds are enabled,
since the backend build applies migrations and seeds the configured database.

6. Deploy and confirm that Prisma migrations and seed succeed in the server build
   logs. Database migration and seed failures now stop the deployment. Check
   /api/health, /api/health/db, administrator login, and a saved project record.
   Refresh a nested page to verify frontend routing.
7. If you want existing records, users, and documents, migrate them from the old
   database before switching the domain. A new Supabase project starts empty.
   Keep the old project available until the new deployment is verified.
8. Add your custom domain in Vercel and update its DNS at the registrar. If the
   domain is attached to another Vercel account, move that association. Update
   CLIENT_URL and redeploy after selecting the final domain.

## Other services

- Email invitations and password resets: create or reuse a Resend account,
  verify your sending domain, and configure SMTP_HOST=smtp.resend.com,
  SMTP_PORT=587, SMTP_USER=resend, SMTP_PASS (the sending API key), and SMTP_FROM
  (your verified sender). Supabase SMTP settings are not used by this app.
  Set SALES_EMAIL to the inbox that should receive quote enquiries.
- Stripe Checkout payments: create or reuse a Stripe account if payments are
  needed, then configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET privately.
  Register /api/business/stripe/webhook for checkout.session.completed and
  checkout.session.async_payment_succeeded. Test checkout before launch.
  Share complete invoice links including their #token= fragment; old tokenless
  invoice links no longer grant access.
- Replace the legal-page placeholders with approved Privacy Notice, Cookie Notice,
  Terms of Use, and Terms of Business before launch.

Account registration, email verification, billing choices, and sign-in must be
completed by you. Once both accounts and projects exist, the remaining work is
connecting the repository, configuring secrets, deploying, and checking the live flow.

References: https://vercel.com/kb/guide/vercel-services and
https://supabase.com/docs/guides/database/connecting-to-postgres
