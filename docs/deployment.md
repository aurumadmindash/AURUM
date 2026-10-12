# Deploying Aurum with Vercel, Supabase and Resend

This app now runs entirely on **Vercel** (frontend static site **and** the Express API as
serverless functions) with **Supabase** as the Postgres database. No separate backend host.

The frontend calls the API at the same origin under `/api`, so there is **no CORS and no
`VITE_API_URL` to set**.

---

## 1. Supabase — get two connection strings

Click the green **"Connect"** button at the top of your Supabase project. Under
**Connection string** you'll see three options — Direct connection, Transaction pooler,
Session pooler. Use the two **pooler** ones:

- **`DATABASE_URL`** — the **Transaction pooler** URL (host contains `pooler`, port **6543**).
  Append the flags exactly:
  ```
  ...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
  ```
- **`DIRECT_URL`** — the **Session pooler** URL (host contains `pooler`, port **5432**).
  Used only for migrations. Copy it as-is (no extra flags).

⚠️ Do **not** use the "Direct connection" option (`db.xxxx.supabase.co`) — it is IPv6-only
and Vercel's build servers can't reach it, so migrations would fail. The **Session pooler**
is the IPv4-friendly equivalent that works for migrations.

Replace `[YOUR-PASSWORD]` in both with your database password (Supabase → Settings →
Database → *Reset database password* if you don't have it).

## 2. Vercel — project settings (this is the key part)

In your Vercel project → **Settings → General**:

- **Root Directory** → set to the **repository root** (blank / `./`), **NOT `client`**.
  The root `vercel.json` defines separate Vercel services for `client/` and `server/`.
- Set the project-wide Framework Preset to **Services** (currently Beta).
- Do not override the project-wide Build Command or Output Directory.
  Framework and build settings are configured per service in `vercel.json`.
- Public routing sends `/api/*` to the Express `server` service and all other paths
  to the Vite `client` service. The client calls the API through same-origin `/api`
  URLs, so no service binding or `VITE_API_URL` is needed.

## 3. Vercel — environment variables

**Settings → Environment Variables** (add for Production + Preview):

| Name | Value |
|------|-------|
| `DATABASE_URL` | Supabase pooler URL from step 1 (with `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Supabase Session pooler URL (port 5432) |
| `JWT_SECRET` | any long random string |
| `CLIENT_URL` | your site URL, e.g. `https://www.aurumite.com` (no trailing slash) |
| `CRON_SECRET` | any random string (protects the daily email job) |
| `SEED_ADMIN_EMAIL` | your administrator email address |
| `SEED_ADMIN_PASSWORD` | a strong password you choose before the first deployment |
| `SEED_DEMO` | `false` for a clean production database |
| `STRIPE_SECRET_KEY` | Stripe secret API key, if taking online payments |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/business/stripe/webhook` |
| `SALES_EMAIL` | Internal inbox for quote enquiries |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | Resend SMTP — see the Resend section below |
| `SMTP_FROM` | the verified sender address, e.g. `enquires@aurumite.com` |

**Delete `VITE_API_URL` if it exists** — the frontend must use the same-origin `/api`.

## 4. Deploy

Push to the connected GitHub repo (or click **Redeploy**). On build, Vercel automatically:
- installs dependencies and generates the Prisma client,
- runs `prisma migrate deploy` against Supabase (creates all tables),
- runs the seed (creates the admin user; demo content is opt-in),
- builds the frontend.

## 5. Log in

Use the `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` you set before the first deployment.
The seed preserves an existing administrator password on redeploy. Changing the
environment variable later does not reset that password. Development defaults
are not permitted for production seeding.

Production seeding now requires an explicit administrator email and a password
of at least 12 characters. Migration and seed failures stop the build.

## Online payments and private invoice links

Configure a Stripe webhook at `https://<your-site>/api/business/stripe/webhook`
for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
Store that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET` and configure
`STRIPE_SECRET_KEY` in the same deployment. Checkout is disabled until both exist.
Use test-mode credentials and a test webhook first; production uses separate
live-mode credentials and its own endpoint signing secret.

The `20261010090000_invoice_access` migration gives every invoice a private
access token. Share the complete link from the Jobs dashboard, including its
`#token=...` fragment. Old links containing only the invoice number no longer
grant access; replace them with the new links. The token is a bearer credential:
anyone with the complete link can view and pay that invoice.

The return page and signed webhook check invoice identity, amount, currency,
checkout mode and paid status before marking an invoice paid. Pre-update Stripe
sessions lack invoice metadata: reconcile any payments already in progress before
deploying, and issue fresh checkout links after the update where needed.

---

## Sending email with Resend (enquires@aurumite.com)

The app sends its own mail (invitations, password resets, comment alerts, the
daily deadline digest) through Resend's SMTP relay via Nodemailer. The SMTP
settings inside Supabase are **not used** — everything is configured by these
Vercel environment variables (add for Production + Preview):

| Name | Value |
|------|-------|
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `resend` (literally — Resend requires this username) |
| `SMTP_PASS` | a Resend API key (`re_…`) from resend.com/api-keys |
| `SMTP_FROM` | `enquires@aurumite.com` |

One-time setup, in order:

1. **Resend → Domains → Add domain** → `aurumite.com`. Copy the DKIM / SPF /
   DMARC records it generates into the domain's DNS at the registrar and wait
   until it shows **Verified**. Without this, Resend rejects sends.
2. **Resend → API Keys** → create a sending key → use it as `SMTP_PASS`.
3. **Vercel → Settings → Domains** → add `aurumite.com` (and `www`).
4. Set `SMTP_FROM=enquires@aurumite.com`, replace the old Gmail
   `SMTP_USER`/`SMTP_PASS` values, and set `CLIENT_URL` to the address Vercel
   serves (e.g. `https://www.aurumite.com`, no trailing slash).
5. **Redeploy** — environment variable changes only take effect on a new build.

Test afterwards: use "Forgot password" for a **registered** account (unknown
emails are silently ignored by design), then check the inbox and Resend → Logs.

### If no email arrives — run the diagnostic

- **Locally:** paste your Resend API key into `server/.env`, then from the
  `server` folder run `npm run email:test -- you@example.com`. It prints the
  exact SMTP error on failure.
- **In production:** open
  `https://<your-site>/api/health/email?to=you@example.com&secret=<CRON_SECRET>`
  (requires `CRON_SECRET` to be set). It shows the SMTP config the server sees
  and the provider's verbatim error.

The two most common causes:

1. **The sending domain is not Verified yet.** While `aurumite.com` is not
   Verified in Resend → Domains, Resend only allows sending to **your own
   account's email address** — every other recipient is rejected.
2. **Wrong Vercel env vars.** `SMTP_USER` must be the literal `resend`,
   `SMTP_PASS` the full API key, and `SMTP_FROM` the verified sender address.
   Env changes only take effect after a redeploy.

Also check **Resend → Logs** — failed sends appear there with the reason.

---

## Notes & limitations on serverless

- **File uploads** are stored as database bytes by the document and quote routes. Existing legacy files on a separate host must be migrated with their records. Test uploads on the deployed site, since hosting request-size limits also apply.
- The daily NEC overdue-email job runs via **Vercel Cron** (configured in `vercel.json`,
  08:00 UTC) instead of an always-on timer.
- Local development uses `server/src/index.ts`; production imports `server/src/app.ts` directly.

## Troubleshooting "Invalid credentials"

That message appears for **any** failure, including the API being unreachable. Check:
1. Root Directory is the repo root (step 2) — most common cause.
2. `DATABASE_URL` / `DIRECT_URL` are set and the build logs show "migrate deploy" + seed succeeded.
3. Open `https://<your-site>/api/health` — it should return `{"status":"ok"}`. If it 404s,
   the API isn't deploying (Root Directory wrong) . If it 500s, check DB env vars.
