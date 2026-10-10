import { timingSafeEqual } from 'crypto'
import Stripe from 'stripe'

export function invoiceAccessMatches(expected: string, provided: unknown): boolean {
  if (typeof provided !== 'string' || !expected || !provided) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface PaymentInvoice {
  id: string
  total: number
  currency: string
}

// Both webhook and return-page verification enforce the same payment boundary.
// A session ID alone is never proof that this invoice has been paid.
export function sessionPaysInvoice(session: Stripe.Checkout.Session, invoice: PaymentInvoice): boolean {
  const amount = Math.round(invoice.total * 100)
  return Number.isSafeInteger(amount) && amount > 0
    && session.mode === 'payment'
    && session.status === 'complete'
    && session.payment_status === 'paid'
    && session.client_reference_id === invoice.id
    && session.metadata?.invoiceId === invoice.id
    && session.amount_total === amount
    && session.currency === invoice.currency.toLowerCase()
}

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured')
  return new Stripe(key)
}
