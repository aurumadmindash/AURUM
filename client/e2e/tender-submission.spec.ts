import { expect, test } from '@playwright/test'

async function fillTender(page: import('@playwright/test').Page) {
  await page.goto('/request-quote')
  await page.getByLabel('Your name').fill('Tender Sender')
  await page.getByLabel('Company', { exact: false }).fill('Site Company')
  await page.getByLabel('Work email').fill('sender@example.com')
  await page.getByLabel('Project name').fill('Site tender')
  await page.getByLabel('Service required').selectOption({ label: 'Tender support' })
}

test('shows a readable message when Vercel returns a plain-text upload error', async ({ page }) => {
  await page.route('**/api/business/quote-requests', route => route.fulfill({ status: 413, contentType: 'text/plain', body: 'FUNCTION_PAYLOAD_TOO_LARGE' }))
  await fillTender(page)
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByRole('alert')).toContainText('4 MB')
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeEnabled()
})

test('does not report successful receipt for an HTML server-error response', async ({ page }) => {
  await page.route('**/api/business/quote-requests', route => route.fulfill({ status: 500, contentType: 'text/html', body: '<h1>Server error</h1>' }))
  await fillTender(page)
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByRole('alert')).toContainText('could not submit your tender')
  await expect(page.getByText('Thanks for getting in touch.')).toHaveCount(0)
})

test('blocks oversized files before sending and allows submission without attachments', async ({ page }) => {
  let sent = 0
  await page.route('**/api/business/quote-requests', route => { sent++; return route.fulfill({ status: 201, json: { id: 'tender-a' } }) })
  await fillTender(page)
  await page.getByLabel('Drawings').setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(4 * 1024 * 1024 + 1) })
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByRole('alert')).toContainText('4 MB total')
  expect(sent).toBe(0)
  await page.getByLabel('Drawings').setInputFiles([])
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByText('Thanks for getting in touch.')).toBeVisible()
  expect(sent).toBe(1)
})
