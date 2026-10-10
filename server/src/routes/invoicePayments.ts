import express from 'express'
import Stripe from 'stripe'
import prisma from '../config/database'
import { invoiceAccessMatches, sessionPaysInvoice, stripeClient } from '../services/invoicePayments'

const router = express.Router()

// Tokens are sent in a header, rather than a query string that enters request logs.
router.use('/invoices/:invoiceNumber', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const invoice = await prisma.invoice.findUnique({ where: { invoiceNumber: req.params.invoiceNumber } })
    if (!invoice || !invoiceAccessMatches(invoice.accessToken, req.headers['x-invoice-token'])) {
      res.status(404).json({ message: 'Invoice unavailable. Please use the complete private link supplied by Aurum.' })
      return
    }
    res.locals.invoice = invoice
    next()
  } catch {
    res.status(503).json({ message: 'Invoices are temporarily unavailable. Please try again.' })
  }
})

router.get('/invoices/:invoiceNumber', (_req, res) => {
  const i = res.locals.invoice
  res.json({ invoiceNumber: i.invoiceNumber, clientName: i.clientName, company: i.company,
    projectName: i.projectName, description: i.description, total: i.total, currency: i.currency,
    status: i.status, dueDate: i.dueDate })
})

router.post('/invoices/:invoiceNumber/checkout', async (_req, res): Promise<void> => {
  const invoice = res.locals.invoice
  if (invoice.status === 'PAID') { res.status(409).json({ message: 'This invoice has already been paid.' }); return }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ message: 'Online payment is not configured. Please contact Aurum for payment details.' }); return
  }
  const amount = Math.round(invoice.total * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) { res.status(400).json({ message: 'Invalid invoice amount.' }); return }
  try {
    const stripe = stripeClient()
    // Reuse an open session to avoid creating a second checkout on every click.
    if (invoice.stripeSession) {
      const previous = await stripe.checkout.sessions.retrieve(invoice.stripeSession)
      if (sessionPaysInvoice(previous, invoice)) {
        await prisma.invoice.updateMany({ where: { id: invoice.id, status: { not: 'PAID' } }, data: { status: 'PAID' } })
        res.status(409).json({ message: 'This invoice has already been paid. Refresh the page.' }); return
      }
      if (previous.status === 'open' && previous.url) { res.json({ url: previous.url }); return }
      if (previous.status === 'complete') {
        res.status(409).json({ message: 'Your payment is being confirmed. Please try again later.' }); return
      }
    }
    const origin = new URL(process.env.CLIENT_URL || '')
    if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('Invalid site URL')
    const page = `${origin.origin}/payment/${encodeURIComponent(invoice.invoiceNumber)}`
    const fragment = `#token=${encodeURIComponent(invoice.accessToken)}`
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', client_reference_id: invoice.id, metadata: { invoiceId: invoice.id },
      success_url: `${page}?session_id={CHECKOUT_SESSION_ID}${fragment}`,
      cancel_url: `${page}${fragment}`, customer_email: invoice.email,
      line_items: [{ price_data: { currency: invoice.currency.toLowerCase(), unit_amount: amount,
        product_data: { name: `Aurum - ${invoice.projectName}`, description: invoice.description } }, quantity: 1 }],
    }, { idempotencyKey: `invoice-${invoice.id}-${invoice.stripeSession || 'initial'}` })
    if (!session.url) throw new Error('No checkout URL')
    // Never overwrite a PAID status if a webhook arrives during this request.
    await prisma.invoice.updateMany({ where: { id: invoice.id, status: { not: 'PAID' } },
      data: { stripeSession: session.id, paymentUrl: session.url, status: 'PAYMENT_PENDING' } })
    res.json({ url: session.url })
  } catch {
    res.status(502).json({ message: 'Could not start payment. Please try again or contact Aurum.' })
  }
})

router.post('/invoices/:invoiceNumber/verify', async (req, res): Promise<void> => {
  const invoice = res.locals.invoice
  if (invoice.status === 'PAID') { res.json({ paid: true }); return }
  const sessionId = req.body?.sessionId || invoice.stripeSession
  if (!process.env.STRIPE_SECRET_KEY || !sessionId) { res.json({ paid: false }); return }
  // Reject arbitrary sessions before making any provider request.
  if (typeof sessionId !== 'string' || sessionId !== invoice.stripeSession) {
    res.status(400).json({ message: 'Payment session does not belong to this invoice.' }); return
  }
  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId)
    if (!sessionPaysInvoice(session, invoice)) { res.json({ paid: false }); return }
    await prisma.invoice.updateMany({ where: { id: invoice.id, status: { not: 'PAID' } }, data: { status: 'PAID' } })
    res.json({ paid: true })
  } catch {
    res.status(502).json({ message: 'Payment confirmation is temporarily unavailable. Please try again.' })
  }
})

// Mount before express.json(): Stripe signs the exact raw request bytes.
export async function stripeWebhook(req: express.Request, res: express.Response): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ message: 'Payments are not configured.' }); return
  }
  let event: Stripe.Event
  try {
    const signature = req.headers['stripe-signature']
    if (typeof signature !== 'string' || !Buffer.isBuffer(req.body)) throw new Error('Invalid request')
    event = stripeClient().webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    res.status(400).json({ message: 'Invalid webhook signature.' }); return
  }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    res.json({ received: true }); return
  }
  const session = event.data.object as Stripe.Checkout.Session
  if (session.payment_status !== 'paid') { res.json({ received: true }); return }
  try {
    const id = session.client_reference_id
    if (!id) { res.status(400).json({ message: 'Missing invoice reference.' }); return }
    const invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice || !sessionPaysInvoice(session, invoice)) {
      res.status(400).json({ message: 'Payment does not match an invoice.' }); return
    }
    // Binding metadata permits delivery before stripeSession has been saved.
    // Repeated deliveries are safe, and provider failures remain retryable.
    await prisma.invoice.updateMany({ where: { id: invoice.id, status: { not: 'PAID' } }, data: { status: 'PAID' } })
    res.json({ received: true })
  } catch {
    res.status(500).json({ message: 'Payment confirmation failed. Retry delivery.' })
  }
}

export default router
