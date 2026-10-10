# Aurum Project Controls

Aurum runs as one Vercel project with a Vite frontend and Express API.
Supabase Postgres stores accounts, projects, quotes, invoices and uploaded files.
Resend SMTP sends invitations, password resets and notifications.

- [Setup](docs/getting-started.md)
- [Vercel, Supabase and Resend deployment](docs/deployment.md)
- [Account and launch checklist](docs/launch-checklist.md)
- [Maintenance](docs/maintenance.md)

Import the repository root into Vercel and select **Services**.
The service build commands and frontend routing are defined in vercel.json.
The API uses server/src/app.ts; server/src/index.ts is only for local development.
The frontend calls the same-origin /api. No separate backend host is needed.

## Project structure

- client/src/pages: website and dashboard pages.
- client/src/components: shared interface components.
- client/src/api: requests grouped by feature.
- client/src/lib: API client and shared utilities.
- server/src/routes: API endpoints.
- server/src/services: business rules, payments, email and reporting.
- server/prisma: database schema, migrations and seed data.
- server/scripts: database deployment and service checks.
- docs: product, setup, deployment and maintenance guides.

See [the product overview](docs/product-overview.md) for supported features.

## Local checks

Run npm install at the repository root, then:

```sh
npm run build
npm run test --workspace=server
```

For payment-page browser tests, build first and run
npm run test:e2e --workspace=client. Install the Playwright Chromium browser,
or set PLAYWRIGHT_BROWSER_PATH to an installed compatible browser.

Database migrations and seeding require configured database credentials.
Never commit environment files or run migrations against an unintended project.
