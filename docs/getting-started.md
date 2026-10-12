# Setup: Vercel, Supabase and Resend

## Production

Follow [the deployment guide](deployment.md).
Use the repository root in Vercel and select Services.
The frontend and API share a domain; do not configure VITE_API_URL.

Set production secrets in Vercel, not in GitHub:
DATABASE_URL, DIRECT_URL, JWT_SECRET, CRON_SECRET,
SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.

Set CLIENT_URL to https://www.aurumite.com, NODE_ENV to production and
SEED_DEMO to false. The admin password must be at least 12 characters.
Existing administrator passwords are preserved on redeploy.

Supabase Connect supplies two PostgreSQL connection strings:
- DATABASE_URL: Transaction pooler, port 6543, with
  ?pgbouncer=true&connection_limit=1.
- DIRECT_URL: Session pooler, port 5432.

A Supabase HTTPS project/API URL is not a PostgreSQL connection string.
Both connection strings must reference the same project.
The server service build generates Prisma, applies migrations and seeds the admin.
Failures stop deployment. Do not create application tables by hand.

Resend must verify aurumite.com before sending as enquires@aurumite.com.
Set SMTP_HOST=smtp.resend.com, SMTP_PORT=587, SMTP_USER=resend,
SMTP_PASS to the Resend sending API key, and SMTP_FROM=enquires@aurumite.com.
Set SALES_EMAIL to a working inbox for enquiries.
Supabase Auth/SMTP settings are not used by this app.

Stripe payment code remains available but optional. Configure STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET and the webhook endpoint before accepting online payments.

## Local development

Requires Node.js 20+ and npm. Use a separate Supabase development project.

1. Run npm install at the repository root.
2. Copy server/.env.example to server/.env and fill in the development credentials.
3. Set CLIENT_URL=http://localhost:5173 and NODE_ENV=development locally.
4. Apply the included migrations using npm run db:deploy.
5. Run npm run dev from the root.

Vite serves the frontend on port 5173 and proxies /api to the local API on port
5000. No frontend environment file or standalone hosting configuration is needed.

## Validation

```sh
npm run build
npm run test --workspace=server
npm run test:e2e --workspace=client
```

Browser tests require a Playwright browser or PLAYWRIGHT_BROWSER_PATH.
Production checks: /api/health, /api/health/db, login, quote submission, email,
invoice access and test payments. A successful frontend build alone does not
establish database or email readiness.
