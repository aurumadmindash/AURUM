import express from 'express'
import Stripe from 'stripe'
import { AddressInfo } from 'net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ invoice: { findUnique: vi.fn(), updateMany: vi.fn() } }))
vi.mock('../../config/database', () => ({ default: db }))
import router, { stripeWebhook } from '../invoicePayments'

const invoice = { id: 'invoice-a', invoiceNumber: 'AUR-INV-2026-001', accessToken: 'private-token-a',
  clientName: 'Client', email: 'client@example.com', projectName: 'Project', description: 'Estimate',
  total: 120, currency: 'GBP', status: 'PAYMENT_PENDING', stripeSession: 'cs_a' }
const paid = { id: 'cs_a', object: 'checkout.session', mode: 'payment', status: 'complete',
  payment_status: 'paid', amount_total: 12000, currency: 'gbp', client_reference_id: 'invoice-a',
  metadata: { invoiceId: 'invoice-a' } }
const sdk = new Stripe('sk_test_fake')
const webhookSecret = 'whsec_test_secret'
const app = express()
app.post('/api/business/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook)
app.use(express.json())
app.use('/api/business', router)
let server: ReturnType<typeof app.listen>
let origin: string

async function request(path = '', method = 'GET', body?: unknown, token: string | null = invoice.accessToken) {
  return fetch(`${origin}/api/business/invoices/${invoice.invoiceNumber}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token === null ? {} : { 'X-Invoice-Token': token }) },
    body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
  })
}

async function webhook(session: unknown = paid, signatureOverride?: string, payloadOverride?: string, timestamp?: number) {
  const payload = JSON.stringify({ id: 'evt_a', object: 'event', type: 'checkout.session.completed', data: { object: session } })
  const signature = signatureOverride ?? sdk.webhooks.generateTestHeaderString({ payload, secret: webhookSecret, timestamp })
  return fetch(`${origin}/api/business/stripe/webhook`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: payloadOverride ?? payload })
}

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())) })
beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', webhookSecret)
  vi.stubEnv('CLIENT_URL', 'https://aurum.example')
  db.invoice.findUnique.mockResolvedValue({ ...invoice })
  db.invoice.updateMany.mockResolvedValue({ count: 1 })
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs() })

describe('private invoice access', () => {
  it.each([['', 'GET'], ['/checkout', 'POST'], ['/verify', 'POST']])('rejects missing and wrong tokens on %s', async (path, method) => {
    for (const token of [null, 'wrong-token']) {
      expect((await request(path, method, {}, token)).status).toBe(404)
    }
    expect(db.invoice.updateMany).not.toHaveBeenCalled()
  })
  it('does not disclose paid status without its token', async () => {
    db.invoice.findUnique.mockResolvedValue({ ...invoice, status: 'PAID' })
    expect((await request('/verify', 'POST', {}, null)).status).toBe(404)
  })
  it('returns only public display fields and disables caching', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const data = await response.json() as Record<string, unknown>
    expect(data.invoiceNumber).toBe(invoice.invoiceNumber)
    expect(data).not.toHaveProperty('accessToken')
    expect(data).not.toHaveProperty('email')
    expect(data).not.toHaveProperty('stripeSession')
  })
})

describe('payment return verification', () => {
  it('rejects a different paid session before calling Stripe', async () => {
    const retrieve = vi.spyOn(Object.getPrototypeOf(sdk.checkout.sessions), 'retrieve').mockResolvedValue(paid as any)
    expect((await request('/verify', 'POST', { sessionId: 'cs_other' })).status).toBe(400)
    expect(retrieve).not.toHaveBeenCalled()
    expect(db.invoice.updateMany).not.toHaveBeenCalled()
  })
  it.each([
    { client_reference_id: 'invoice-b' }, { metadata: { invoiceId: 'invoice-b' } },
    { amount_total: 11999 }, { currency: 'usd' }, { mode: 'subscription' },
    { payment_status: 'unpaid' }, { status: 'open' },
  ])('does not mark paid for a mismatched session %j', async change => {
    vi.spyOn(Object.getPrototypeOf(sdk.checkout.sessions), 'retrieve').mockResolvedValue({ ...paid, ...change } as any)
    expect(await (await request('/verify', 'POST', { sessionId: 'cs_a' })).json()).toEqual({ paid: false })
    expect(db.invoice.updateMany).not.toHaveBeenCalled()
  })
  it('confirms a legitimate bound payment and remains idempotent', async () => {
    const retrieve = vi.spyOn(Object.getPrototypeOf(sdk.checkout.sessions), 'retrieve').mockResolvedValue(paid as any)
    expect(await (await request('/verify', 'POST', { sessionId: 'cs_a' })).json()).toEqual({ paid: true })
    expect(db.invoice.updateMany).toHaveBeenCalledWith({ where: { id: invoice.id, status: { not: 'PAID' } }, data: { status: 'PAID' } })
    db.invoice.findUnique.mockResolvedValue({ ...invoice, status: 'PAID' })
    expect(await (await request('/verify', 'POST', {})).json()).toEqual({ paid: true })
    expect(retrieve).toHaveBeenCalledTimes(1)
  })
  it('keeps provider failures retryable without marking paid', async () => {
    vi.spyOn(Object.getPrototypeOf(sdk.checkout.sessions), 'retrieve').mockRejectedValue(new Error('Unavailable'))
    expect((await request('/verify', 'POST', {})).status).toBe(502)
    expect(db.invoice.updateMany).not.toHaveBeenCalled()
  })
})

describe('Stripe webhooks', () => {
  it('accepts signed raw JSON and safely repeats confirmation', async () => {
    expect((await webhook()).status).toBe(200)
    expect((await webhook()).status).toBe(200)
    expect(db.invoice.updateMany).toHaveBeenCalledTimes(2)
    expect(db.invoice.updateMany).toHaveBeenCalledWith({ where: { id: invoice.id, status: { not: 'PAID' } }, data: { status: 'PAID' } })
  })
  it('rejects forged, modified and expired signatures', async () => {
    expect((await webhook(paid, 't=1,v1=bad')).status).toBe(400)
    expect((await webhook(paid, undefined, '{}')).status).toBe(400)
    expect((await webhook(paid, undefined, undefined, Math.floor(Date.now() / 1000) - 600)).status).toBe(400)
    expect(db.invoice.updateMany).not.toHaveBeenCalled()
  })
  it('rejects a signed payment with the wrong invoice amount', async () => {
    expect((await webhook({ ...paid, amount_total: 1 })).status).toBe(400)
    expect(db.invoice.updateMany).not.toHaveBeenCalled()
  })
  it('asks Stripe to retry database failures', async () => {
    db.invoice.updateMany.mockRejectedValueOnce(new Error('Database unavailable'))
    expect((await webhook()).status).toBe(500)
  })
})

describe('checkout', () => {
  it('reuses an open checkout', async () => {
    vi.spyOn(Object.getPrototypeOf(sdk.checkout.sessions), 'retrieve').mockResolvedValue({ status: 'open', url: 'https://checkout.stripe.com/c/a' } as any)
    expect(await (await request('/checkout', 'POST')).json()).toEqual({ url: 'https://checkout.stripe.com/c/a' })
    expect(db.invoice.updateMany).not.toHaveBeenCalled()
  })
  it('binds new checkout to the invoice and preserves the token in redirects', async () => {
    db.invoice.findUnique.mockResolvedValue({ ...invoice, stripeSession: null })
    const create = vi.spyOn(Object.getPrototypeOf(sdk.checkout.sessions), 'create').mockResolvedValue({ id: 'cs_new', url: 'https://checkout.stripe.com/c/new' } as any)
    expect((await request('/checkout', 'POST')).status).toBe(200)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ client_reference_id: invoice.id,
      metadata: { invoiceId: invoice.id }, success_url: expect.stringContaining('#token=private-token-a'),
      cancel_url: expect.stringContaining('#token=private-token-a') }), expect.objectContaining({ idempotencyKey: expect.any(String) }))
    expect(db.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: invoice.id, status: { not: 'PAID' } } }))
  })
  it('requires webhook configuration before enabling checkout', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    expect((await request('/checkout', 'POST')).status).toBe(503)
  })
})
