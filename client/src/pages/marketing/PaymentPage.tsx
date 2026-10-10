import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'

interface Invoice {
  invoiceNumber: string
  clientName: string
  projectName: string
  description: string
  total: number
  currency: string
  status: string
}

export default function PaymentPage() {
  const { invoiceNumber = '' } = useParams()
  const [query] = useSearchParams()
  const { hash } = useLocation()
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token') || ''
  const sessionId = query.get('session_id')
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const endpoint = `/api/business/invoices/${encodeURIComponent(invoiceNumber)}`

  useEffect(() => {
    const controller = new AbortController()
    setInvoice(null)
    setError('')
    setNotice('')
    async function load() {
      if (!token) { setError('Please use the complete private invoice link supplied by Aurum.'); return }
      const headers = { 'X-Invoice-Token': token }
      try {
        const response = await fetch(endpoint, { headers, signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 404
          ? 'Invoice unavailable. Please check your private link or contact Aurum.'
          : 'Could not load your invoice. Please try again.')
        const data = await response.json()
        if (!data || typeof data.total !== 'number' || !Number.isFinite(data.total)
          || typeof data.currency !== 'string' || typeof data.invoiceNumber !== 'string') {
          throw new Error('Could not load your invoice. Please contact Aurum.')
        }
        if (data.status !== 'PAID' && sessionId) {
          try {
            const verification = await fetch(`${endpoint}/verify`, {
              method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }), signal: controller.signal,
            })
            const result = await verification.json()
            if (verification.ok && result.paid === true) data.status = 'PAID'
            else if (!controller.signal.aborted) setNotice('Payment has not been confirmed yet. Please check again before making another payment.')
          } catch {
            if (controller.signal.aborted) return
            setNotice('We could not confirm payment right now. Please check again before making another payment.')
          }
        }
        if (!controller.signal.aborted) setInvoice(data)
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load your invoice.')
      }
    }
    void load()
    return () => controller.abort()
  }, [endpoint, token, sessionId, attempt])

  async function pay() {
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch(`${endpoint}/checkout`, { method: 'POST', headers: { 'X-Invoice-Token': token } })
      const result = await response.json()
      if (!response.ok || typeof result.url !== 'string') throw new Error(result.message || 'Payment is unavailable. Please try again.')
      const destination = new URL(result.url)
      if (destination.protocol !== 'https:' || destination.hostname !== 'checkout.stripe.com') throw new Error('Payment is unavailable. Please contact Aurum.')
      window.location.assign(destination.href)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not start payment. Please try again.')
    } finally { setBusy(false) }
  }

  const retry = <button onClick={() => setAttempt(n => n + 1)} className="mt-4 rounded-lg border px-4 py-2 font-semibold">Check again</button>
  if (error) return <div className="p-10 text-center"><p role="alert">{error}</p>{retry}<Link to="/" className="mt-5 block">Back to Aurum</Link></div>
  if (!invoice) return <div className="p-10 text-center" role="status">Loading invoice…</div>
  let total: string
  try { total = new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(invoice.total) }
  catch { total = `${invoice.currency} ${invoice.total.toFixed(2)}` }
  return <div className="min-h-screen bg-slate-50 px-5 py-12"><div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
    <div className="text-sm font-bold text-amber-600">AURUM PROJECT CONTROLS</div>
    <h1 className="mt-2 font-display text-3xl font-bold">Invoice {invoice.invoiceNumber}</h1>
    {invoice.status === 'PAID' && <div role="status" className="mt-5 rounded-lg bg-emerald-50 p-4 font-semibold text-emerald-700">Payment confirmed. Thank you.</div>}
    <div className="mt-7 space-y-3 border-y py-6 text-sm">
      <div className="flex justify-between gap-4"><span>Client</span><b>{invoice.clientName}</b></div>
      <div className="flex justify-between gap-4"><span>Project</span><b>{invoice.projectName}</b></div>
      <div><span className="text-slate-500">Description</span><p className="mt-1 font-semibold">{invoice.description}</p></div>
      <div className="flex justify-between pt-3 text-lg"><span>Total</span><b>{total}</b></div>
    </div>
    {notice && <div role="alert" className="mt-5 rounded-lg bg-amber-50 p-4 text-sm">{notice}{retry}</div>}
    {invoice.status !== 'PAID' && <button onClick={pay} disabled={busy || Boolean(sessionId)} className="mt-7 w-full rounded-lg bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{busy ? 'Connecting to payment…' : sessionId ? 'Awaiting payment confirmation' : 'Pay securely online'}</button>}
    <Link to="/" className="mt-5 block text-center text-sm font-semibold text-slate-500">Back to Aurum</Link>
  </div></div>
}
