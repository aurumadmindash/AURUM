import { expect, test } from '@playwright/test'

const invoice = { invoiceNumber: 'AUR-INV-2026-001', clientName: 'Test Client',
  projectName: 'Test Project', description: 'Estimate', total: 120, currency: 'GBP', status: 'UNPAID' }
const privateLink = `/payment/${invoice.invoiceNumber}#token=private-token-a`

test('missing token shows instructions and sends no invoice request', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('/api/business/invoices/')) requests.push(request.url()) })
  await page.goto(`/payment/${invoice.invoiceNumber}?paid=1`)
  await expect(page.getByRole('alert')).toContainText('complete private invoice link')
  await expect(page.getByText('Payment confirmed. Thank you.')).toHaveCount(0)
  expect(requests).toEqual([])
})

test('missing invoice remains readable and retries without a render crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/business/invoices/*', route => route.fulfill({ status: 404, json: { message: 'Unavailable' } }))
  await page.goto(privateLink)
  await expect(page.getByRole('alert')).toContainText('Invoice unavailable')
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(page.getByRole('alert')).toContainText('Invoice unavailable')
  expect(errors).toEqual([])
})

test('URL paid flag never shows success for an unpaid invoice', async ({ page }, testInfo) => {
  await page.route('**/api/business/invoices/*', async route => {
    expect(route.request().headers()['x-invoice-token']).toBe('private-token-a')
    await route.fulfill({ json: invoice })
  })
  await page.goto(`/payment/${invoice.invoiceNumber}?paid=1#token=private-token-a`)
  await expect(page.getByRole('heading', { name: `Invoice ${invoice.invoiceNumber}` })).toBeVisible()
  await expect(page.getByText('Payment confirmed. Thank you.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pay securely online' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('invoice-desktop.png'), fullPage: true })
})

test('failed confirmation shows pending state and allows a successful retry', async ({ page }) => {
  const errors: string[] = []
  let confirmed = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/business/invoices/**', async route => {
    expect(route.request().headers()['x-invoice-token']).toBe('private-token-a')
    if (route.request().url().endsWith('/verify')) {
      expect(route.request().postDataJSON()).toEqual({ sessionId: 'cs_a' })
      await route.fulfill({ json: { paid: confirmed } })
    } else await route.fulfill({ json: invoice })
  })
  await page.goto(`/payment/${invoice.invoiceNumber}?session_id=cs_a#token=private-token-a`)
  await expect(page.getByRole('alert')).toContainText('not been confirmed')
  await expect(page.getByText('Payment confirmed. Thank you.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Awaiting payment confirmation' })).toBeDisabled()
  confirmed = true
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(page.getByText('Payment confirmed. Thank you.')).toBeVisible()
  expect(errors).toEqual([])
})

test('checkout network failure keeps the invoice visible and permits retry', async ({ page }) => {
  await page.route('**/api/business/invoices/**', route => route.request().url().endsWith('/checkout')
    ? route.abort('failed') : route.fulfill({ json: invoice }))
  await page.goto(privateLink)
  await page.getByRole('button', { name: 'Pay securely online' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay securely online' })).toBeEnabled()
  await expect(page.getByRole('heading', { name: `Invoice ${invoice.invoiceNumber}` })).toBeVisible()
})

test('confirmed invoice fits on mobile and has no payment button', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/business/invoices/*', route => route.fulfill({ json: { ...invoice, status: 'PAID' } }))
  await page.goto(privateLink)
  await expect(page.getByText('Payment confirmed. Thank you.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay securely online' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('invoice-mobile.png'), fullPage: true })
})
