import fs from 'fs'
import path from 'path'
import { expect, test, type Page } from '@playwright/test'

async function capture(page: Page, name: string) {
  if (process.env.JOB_UI_QA_DIR) { fs.mkdirSync(process.env.JOB_UI_QA_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.JOB_UI_QA_DIR, name + '.png') }) }
}
function fixture() {
  const timestamp = new Date().toISOString()
  return { id: 'job-1', projectName: 'Aberdeen Clinic Refurbishment', projectLocation: 'Aberdeen', name: 'Client Contact', company: 'Example Contractors', email: 'client@example.com', telephone: '01224000000', service: 'BOQ', status: 'REVIEWING', tenderDeadline: timestamp, requiredDelivery: null, fee: 2450.5, briefDescription: 'Measure the current clinic refurbishment drawings.', requiredTrades: 'Partitions and finishes', clientRequirements: 'Separate trade bills', missingInformation: 'Awaiting revised specification', notes: 'Internal commercial review', proposalScope: null, proposalDeliverables: null, proposalAssumptions: null, paymentTerms: null, createdAt: timestamp, updatedAt: timestamp, documents: [{ id: 'doc-1', name: 'Clinic drawings.pdf', kind: 'drawings', size: 4096, createdAt: timestamp }], invoices: [] as Record<string, unknown>[] }
}
async function setup(page: Page) {
  let job = fixture()
  let saveFails = false
  await page.addInitScript(() => localStorage.setItem('aurum-cookie-preference', JSON.stringify({ version: 1, enabled: false, expiresAt: Date.now() + 86400000 })))
  await page.addInitScript(() => { if (!sessionStorage.getItem('aurum-auth')) sessionStorage.setItem('aurum-auth', JSON.stringify({ state: { token: 'test-token', user: { id: 'admin', name: 'Aurum Admin', email: 'admin@example.com', role: 'ADMIN' } }, version: 0 })); })
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    const pathname = url.pathname
    if (pathname.endsWith('/business/quotes') && request.method() === 'GET') return route.fulfill({ json: [job, { ...job, id: 'job-2', projectName: 'Completed Office', status: 'COMPLETED', company: 'Other Contractor', documents: [], fee: 500 }] })
    if (pathname.endsWith('/documents/doc-1')) return route.fulfill({ body: 'Sample attachment bytes', contentType: 'application/octet-stream' })
    if (pathname.endsWith('/business/jobs.pdf') || pathname.endsWith('/proposal.pdf') || pathname.endsWith('/job-1/pdf')) return route.fulfill({ body: '%PDF-1.4\nPDF endpoint requested\n%%EOF', contentType: 'application/pdf' })
    if (pathname.endsWith('/business/quotes/job-1/invoice')) {
      const data = request.postDataJSON(); const amount = Number(data.amount), vatRate = data.vatRate === '' ? null : Number(data.vatRate)
      const invoice = { ...data, id: 'invoice-1', invoiceNumber: 'AUR-INV-2026-001', accessToken: 'private-payment-token', amount, vatRate, vatAmount: amount * (vatRate || 0) / 100, total: amount * (1 + (vatRate || 0) / 100), status: 'UNPAID', createdAt: new Date().toISOString() }
      job = { ...job, invoices: [invoice] }; return route.fulfill({ status: 201, json: invoice })
    }
    if (pathname.endsWith('/business/quotes/job-1')) {
      if (request.method() === 'PATCH') {
        if (saveFails) return route.fulfill({ status: 500, json: { message: 'Could not save this job.' } })
        job = { ...job, ...request.postDataJSON() }
      }
      return route.fulfill({ json: job })
    }
    return route.fulfill({ json: [] })
  })
  return { failSaves: () => { saveFails = true }, getJob: () => job }
}

test('searches, filters and opens every job information section', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await setup(page); await page.goto('/jobs')
  await expect(page.getByRole('heading', { name: 'Aurum Jobs' })).toBeVisible()
  await expect(page.getByText('2 of 2 jobs')).toBeVisible(); await capture(page, 'jobs-desktop');
  await page.getByLabel('Search jobs').fill('clinic')
  await expect(page.getByText('1 of 2 jobs')).toBeVisible()
  await page.getByLabel('Status', { exact: true }).selectOption('COMPLETED')
  await expect(page.getByRole('heading', { name: 'No matching jobs' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('link', { name: 'Open Aberdeen Clinic Refurbishment' }).click()
  await expect(page.getByLabel('Project brief')).toHaveValue('Measure the current clinic refurbishment drawings.')
  await expect(page.getByLabel('Client email')).toHaveValue('client@example.com'); await capture(page, 'job-overview-desktop')
  await page.getByRole('button', { name: 'Refresh job', exact: true }).click()
  await expect(page.getByLabel('Project brief')).toHaveValue('Measure the current clinic refurbishment drawings.')
  await page.getByRole('button', { name: 'Scope & intake' }).click()
  await expect(page.getByLabel('Required trades')).toHaveValue('Partitions and finishes')
  await expect(page.getByLabel('Internal notes')).toHaveValue('Internal commercial review')
  await page.getByRole('button', { name: 'Documents (1)' }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Clinic drawings.pdf' }).click()
  expect((await downloaded).suggestedFilename()).toBe('Clinic drawings.pdf')
  await page.getByRole('button', { name: 'Invoices (0)' }).click()
  await expect(page.getByText('No invoices have been created for this job.')).toBeVisible()
})

test('persists proposal edits across sections and reload, then exports the proposal', async ({ page }) => {
  const state = await setup(page); await page.goto('/jobs/job-1')
  await page.getByRole('button', { name: 'Fee proposal', exact: true }).click()
  await page.getByLabel('Scope of service').fill('Measured BOQ for the current clinic drawings.')
  await page.getByLabel('Deliverables (one per line)').fill('Measured trade bills\nPDF issue')
  await page.getByLabel('Payment terms', { exact: true }).fill('Due on appointment')
  await page.getByLabel('Professional fee (GBP)').fill('0')
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByLabel('Required Aurum delivery date').fill('2026-11-02')
  await expect(page.getByRole('button', { name: 'Job PDF', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'All job and proposal details saved.' })).toBeVisible()
  expect(state.getJob().fee).toBe(0)
  await page.reload()
  await page.getByRole('button', { name: 'Fee proposal', exact: true }).click()
  await expect(page.getByLabel('Scope of service')).toHaveValue('Measured BOQ for the current clinic drawings.')
  await page.getByRole('button', { name: 'Preview proposal' }).click()
  await expect(page.getByRole('heading', { name: 'Aberdeen Clinic Refurbishment' })).toBeVisible()
  await expect(page.getByText('Measured BOQ for the current clinic drawings.', { exact: true })).toBeVisible()
  await expect(page.getByText('Due on appointment', { exact: true })).toBeVisible(); await capture(page, 'proposal-desktop')
  await expect(page.getByText('Internal commercial review', { exact: true })).toHaveCount(0)
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download proposal PDF' }).click()
  expect((await download).suggestedFilename()).toBe('Aberdeen-Clinic-Refurbishment-fee-proposal.pdf')
})

test('keeps edits after a failed save and creates an invoice with explicit VAT', async ({ page }) => {
  const state = await setup(page); await page.goto('/jobs/job-1')
  await page.getByRole('button', { name: 'Invoices (0)' }).click()
  await page.getByRole('button', { name: 'Create invoice', exact: true }).click()
  await page.getByLabel('Invoice amount (GBP)').fill('100')
  await page.getByLabel('VAT rate (%)').fill('20')
  await page.getByLabel('Invoice due date').fill('2026-11-10')
  await page.getByRole('button', { name: 'Confirm invoice' }).click()
  await expect(page.getByRole('heading', { name: 'AUR-INV-2026-001' })).toBeVisible()
  expect(state.getJob().invoices[0].total).toBe(120)
  await expect(page.getByRole('link', { name: 'Open payment page' })).toHaveAttribute('href', '/payment/AUR-INV-2026-001#token=private-payment-token')
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  state.failSaves()
  await page.getByLabel('Project location').fill('New location retained after failure')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not save this job.')
  await expect(page.getByLabel('Project location')).toHaveValue('New location retained after failure')
})

test('mobile cards open a usable detail layout with every section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page); await page.goto('/jobs')
  await page.getByRole('link', { name: /Aberdeen Clinic Refurbishment.*View all job details/ }).click()
  await expect(page.getByRole('heading', { name: 'Aberdeen Clinic Refurbishment' })).toBeVisible()
  await page.getByRole('button', { name: 'Fee proposal', exact: true }).click()
  await expect(page.getByLabel('Payment terms', { exact: true })).toBeVisible(); await capture(page, 'job-mobile')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('shows a recoverable job-load error and denies viewers access', async ({ page }) => {
  await setup(page)
  await page.route('**/api/business/quotes/job-1', route => route.fulfill({ status: 404, json: { message: 'Job not found' } }))
  await page.goto('/jobs/job-1'); await expect(page.getByRole('alert')).toContainText('Job not found')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('aurum-auth', JSON.stringify({ state: { token: 'viewer-token', user: { id: 'viewer', name: 'Viewer', email: 'viewer@example.com', role: 'VIEWER' } }, version: 0 })))
  await page.reload(); await expect(page.getByRole('alert')).toContainText('administrators and commercial managers')
})
