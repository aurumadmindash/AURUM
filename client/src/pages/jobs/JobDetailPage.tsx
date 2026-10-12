import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Download, FileText, Mail, MapPin, Phone, Save, CheckCircle2, RefreshCw } from 'lucide-react'
import api from '../../lib/apiClient'
import { useAuthStore } from '../../store/authStore'
import { date, deadlineLabel, downloadFile, errorMessage, inputDate, Job, jobFilename, label, money, proposalDefaults, statuses } from './jobUtils'
import { Detail, inputClass, Notice, Panel, primaryButton, secondaryButton, StatusBadge } from './JobUI'

const services = ['TAKE_OFF', 'ESTIMATE', 'TENDER_SUPPORT', 'COMMERCIAL_SUPPORT', 'BOQ', 'VARIATION', 'VALUATION', 'OTHER']
function draft(job: Job): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of ['projectName', 'projectLocation', 'name', 'company', 'email', 'telephone', 'service', 'status', 'briefDescription', 'requiredTrades', 'clientRequirements', 'missingInformation', 'notes'] as const) result[key] = job[key] || ''
  return { ...result, ...proposalDefaults(job), fee: job.fee == null ? '' : String(job.fee), tenderDeadline: inputDate(job.tenderDeadline), requiredDelivery: inputDate(job.requiredDelivery) }
}
export default function JobDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const allowed = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL_MANAGER'
  const [job, setJob] = useState<Job | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState('')
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [invoice, setInvoice] = useState({ amount: '', vatRate: '', dueDate: '', description: '', notes: '' })
  const dirty = !!job && JSON.stringify(form) !== saved
  const accept = (data: Job) => { setJob(data); const next = draft(data); setForm(next); setSaved(JSON.stringify(next)) }
  const load = async () => {
    setLoading(true); setError('')
    try { const response = await api.get<Job>(`/business/quotes/${id}`); accept(response.data) }
    catch (e) { setError(errorMessage(e, 'Could not load this job. Please try again.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { setJob(null); setTab('overview'); if (allowed) void load(); else setLoading(false) }, [id, allowed])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const change = (key: string, value: string) => { setForm(previous => ({ ...previous, [key]: value })); setNotice('') }
  const save = async () => {
    setBusy('save'); setError(''); setNotice('')
    try { const response = await api.patch<Job>(`/business/quotes/${id}`, { ...form, fee: form.fee === '' ? null : Number(form.fee), tenderDeadline: form.tenderDeadline || null, requiredDelivery: form.requiredDelivery || null }); accept(response.data); setNotice('All job and proposal details saved.') }
    catch (e) { setError(errorMessage(e, 'Could not save changes. Your edits are still here.')) }
    finally { setBusy('') }
  }
  const download = async (url: string, filename: string) => {
    setBusy(url); setError('')
    try { await downloadFile(url, filename) }
    catch (e) { setError(errorMessage(e, 'Could not download the file. Please try again.')) }
    finally { setBusy('') }
  }
  const createInvoice = async (event: FormEvent) => {
    event.preventDefault(); setBusy('invoice'); setError(''); setNotice('')
    try {
      const response = await api.post(`/business/quotes/${id}/invoice`, invoice)
      const fresh = await api.get<Job>(`/business/quotes/${id}`); accept(fresh.data)
      setInvoiceOpen(false); setNotice(`Invoice ${response.data.invoiceNumber} created.`)
    } catch (e) { setError(errorMessage(e, 'Could not create the invoice. Check the job invoices before retrying.')) }
    finally { setBusy('') }
  }
  const field = (key: string, title: string, type = 'text', required = false) => <label className="block text-xs font-semibold text-slate-600">{title}<input type={type} required={required} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={form[key] || ''} onChange={e => change(key, e.target.value)} className={inputClass} disabled={!!busy} /></label>
  const textarea = (key: string, title: string, rows = 4) => <label className="block text-xs font-semibold text-slate-600">{title}<textarea rows={rows} maxLength={20000} value={form[key] || ''} onChange={e => change(key, e.target.value)} className={inputClass} disabled={!!busy} /></label>
  if (!allowed) return <Notice error>Jobs are available to administrators and commercial managers.</Notice>
  if (loading) return <p role="status" className="p-10 text-center text-slate-500">Loading job details…</p>
  if (!job) return <div className="space-y-4"><Link to="/jobs" className={secondaryButton}><ArrowLeft size={16} /> Back to jobs</Link><Notice error>{error || 'Job not found.'}</Notice><button onClick={load} className={primaryButton}>Try again</button></div>
  const tabs = [{ id: 'overview', title: 'Overview' }, { id: 'intake', title: 'Scope & intake' }, { id: 'proposal', title: 'Fee proposal' }, { id: 'documents', title: `Documents (${job.documents.length})` }, { id: 'invoices', title: `Invoices (${job.invoices.length})` }]
  const readyItems = [{ title: 'Client contact recorded', complete: !!job.email }, { title: 'Documents supplied', complete: job.documents.length > 0 }, { title: 'Delivery date recorded', complete: !!job.requiredDelivery }, { title: 'Fee recorded', complete: job.fee != null }, { title: 'Payment terms recorded', complete: !!job.paymentTerms }]
  const invoiceAmount = Number(invoice.amount) || 0
  const invoiceVAT = invoice.vatRate === '' ? 0 : invoiceAmount * Number(invoice.vatRate) / 100
  return <div className="mx-auto max-w-7xl space-y-6">
    <Link to="/jobs" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16} /> Back to jobs</Link>
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><p className="text-xs font-semibold uppercase tracking-[.15em] text-amber-700">Job workspace</p><StatusBadge status={job.status} /></div><h1 className="mt-3 break-words font-display text-3xl font-bold text-navy-900">{job.projectName}</h1><p className="mt-2 text-sm text-slate-500">{job.company} · {label(job.service)} · Received {date(job.createdAt)}</p></div><div className="flex flex-wrap gap-2"><button disabled={!!busy || dirty} onClick={load} className={secondaryButton} aria-label="Refresh job"><RefreshCw size={16} /></button><button disabled={!!busy || dirty} onClick={() => download(`/business/quotes/${id}/pdf`, jobFilename(job, 'job-record.pdf'))} className={secondaryButton}><Download size={16} /> Job PDF</button><button disabled={!!busy || dirty} onClick={() => navigate(`/jobs/${id}/proposal`)} className={secondaryButton}><FileText size={16} /> Preview proposal</button><button disabled={!!busy || !dirty} onClick={save} className={primaryButton}><Save size={16} />{busy === 'save' ? 'Saving…' : 'Save changes'}</button></div></div>
    {dirty && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">You have unsaved changes. Save before exporting a PDF, previewing the proposal or creating an invoice.</p>}
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ title: 'Tender deadline', value: date(job.tenderDeadline), note: deadlineLabel(job.tenderDeadline) }, { title: 'Aurum delivery', value: date(job.requiredDelivery), note: 'Target issue date' }, { title: 'Professional fee', value: money(job.fee), note: 'GBP · before any applicable VAT' }, { title: 'Documents / invoices', value: `${job.documents.length} / ${job.invoices.length}`, note: 'Available in the sections below' }].map(item => <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{item.title}</p><p className="mt-2 text-lg font-bold text-navy-900">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.note}</p></div>)}</div>
    <nav aria-label="Job sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">{tabs.map(t => <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${tab === t.id ? 'bg-navy-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{t.title}</button>)}</nav>
    {tab === 'overview' && <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6"><Panel title="Project information" description="Review or correct the original enquiry details."><div className="grid gap-5 sm:grid-cols-2">{field('projectName', 'Project name', 'text', true)}{field('projectLocation', 'Project location')}<label className="block text-xs font-semibold text-slate-600">Service<select aria-label="Service" value={form.service} onChange={e => change('service', e.target.value)} disabled={!!busy} className={inputClass}>{services.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label><label className="block text-xs font-semibold text-slate-600">Job status<select aria-label="Job status" value={form.status} onChange={e => change('status', e.target.value)} disabled={!!busy} className={inputClass}>{statuses.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>{field('tenderDeadline', 'Tender deadline', 'date')}{field('requiredDelivery', 'Required Aurum delivery date', 'date')}<div className="sm:col-span-2">{textarea('briefDescription', 'Project brief', 5)}</div></div></Panel>
      <Panel title="Client contact"><div className="grid gap-5 sm:grid-cols-2">{field('name', 'Client name', 'text', true)}{field('company', 'Company', 'text', true)}{field('email', 'Client email', 'email', true)}{field('telephone', 'Telephone', 'tel')}</div><div className="mt-5 flex flex-wrap gap-3"><a href={`mailto:${job.email}`} className={secondaryButton}><Mail size={16} /> Email client</a>{job.telephone && <a href={`tel:${job.telephone}`} className={secondaryButton}><Phone size={16} /> Call client</a>}</div></Panel></div>
      <div className="space-y-6"><Panel title="Job readiness" description="A practical checklist before agreeing the assignment."><ul className="space-y-4">{readyItems.map(item => <li key={item.title} className="flex items-center gap-3 text-sm"><CheckCircle2 size={18} className={item.complete ? 'text-emerald-600' : 'text-slate-300'} /><span>{item.title}</span><span className="ml-auto text-xs text-slate-500">{item.complete ? 'Recorded' : 'Missing'}</span></li>)}</ul>{job.missingInformation && <p className="mt-5 whitespace-pre-wrap rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">{job.missingInformation}</p>}</Panel><Panel title="Record details"><dl className="space-y-4"><Detail title="Job reference">{job.id}</Detail><Detail title="Created">{date(job.createdAt)}</Detail><Detail title="Last updated">{date(job.updatedAt)}</Detail><Detail title="Location">{job.projectLocation && <span className="inline-flex items-center gap-2"><MapPin size={14} />{job.projectLocation}</span>}</Detail></dl><p className="mt-5 text-xs leading-6 text-slate-500">Job PDF includes internal notes. Fee proposal PDF contains the client-facing proposal and document register.</p></Panel></div>
    </div>}
    {tab === 'intake' && <div className="grid gap-6 lg:grid-cols-2"><Panel title="Client requirements" description="Record the trades and requirements agreed with the client."><div className="space-y-5">{textarea('requiredTrades', 'Required trades')}{textarea('clientRequirements', 'Client requirements', 6)}</div></Panel><Panel title="Clarifications & internal notes" description="Internal notes are included in the job record PDF, but excluded from the fee proposal PDF."><div className="space-y-5">{textarea('missingInformation', 'Missing information / clarifications', 5)}{textarea('notes', 'Internal notes', 5)}</div></Panel></div>}
    {tab === 'proposal' && <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]"><Panel title="Scope & deliverables" description="These saved fields are used in the proposal preview and PDF export."><div className="space-y-5">{textarea('proposalScope', 'Scope of service', 5)}{textarea('proposalDeliverables', 'Deliverables (one per line)', 5)}{textarea('proposalAssumptions', 'Assumptions and exclusions', 5)}</div></Panel><div className="space-y-6"><Panel title="Fee & payment"><div className="space-y-5">{field('fee', 'Professional fee (GBP)', 'number')}{textarea('paymentTerms', 'Payment terms', 5)}<p className="text-xs leading-6 text-slate-500">Set the agreed payment terms before issuing the proposal. VAT is set separately when creating an invoice.</p></div></Panel><Panel title="Proposal PDF"><p className="text-sm leading-6 text-slate-500">A branded document with client details, scope, deliverables, programme, fee, payment terms and supplied document references.</p><button disabled={!!busy || dirty} onClick={() => download(`/business/quotes/${id}/proposal.pdf`, jobFilename(job, 'fee-proposal.pdf'))} className={`${primaryButton} mt-5`}><Download size={16} /> Download proposal PDF</button></Panel></div></div>}
    {tab === 'documents' && <Panel title="Project documents" description="Download the files submitted with the original enquiry.">{job.documents.length ? <ul className="divide-y divide-slate-100">{job.documents.map(d => <li key={d.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-slate-50 p-3 text-amber-700"><FileText size={20} /></div><div className="min-w-0"><p className="break-words text-sm font-semibold text-navy-900">{d.name}</p><p className="mt-1 text-xs text-slate-500">{label(d.kind)} · {Math.ceil(d.size / 1024)} KB{d.createdAt ? ` · ${date(d.createdAt)}` : ''}</p></div></div><button disabled={!!busy} onClick={() => download(`/business/quotes/${id}/documents/${d.id}`, d.name)} className={secondaryButton} aria-label={`Download ${d.name}`}><Download size={16} /> Download</button></li>)}</ul> : <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No documents were supplied with this enquiry. Record any required information under Scope &amp; intake.</p>}</Panel>}
    {tab === 'invoices' && <div className="space-y-6"><Panel title="Invoices & payments" description="Create an invoice with an explicit amount, VAT treatment and due date."><button disabled={!!busy || dirty} onClick={() => { setInvoiceOpen(!invoiceOpen); setInvoice({ amount: job.fee == null ? '' : String(job.fee), vatRate: '', dueDate: '', description: `${label(job.service)} — ${job.projectName}`, notes: '' }) }} className={primaryButton}>{invoiceOpen ? 'Close invoice form' : 'Create invoice'}</button>
      {invoiceOpen && <form onSubmit={createInvoice} className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="grid gap-5 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Invoice amount (GBP)<input type="number" required min="0.01" step="0.01" value={invoice.amount} onChange={e => setInvoice({ ...invoice, amount: e.target.value })} className={inputClass} /></label><label className="text-xs font-semibold text-slate-600">VAT rate (%) — blank if not applicable<input type="number" min="0" max="100" step="0.01" value={invoice.vatRate} onChange={e => setInvoice({ ...invoice, vatRate: e.target.value })} className={inputClass} /></label><label className="text-xs font-semibold text-slate-600">Invoice due date<input type="date" value={invoice.dueDate} onChange={e => setInvoice({ ...invoice, dueDate: e.target.value })} className={inputClass} /></label><label className="text-xs font-semibold text-slate-600">Description<input required value={invoice.description} onChange={e => setInvoice({ ...invoice, description: e.target.value })} className={inputClass} /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Invoice notes<textarea rows={3} value={invoice.notes} onChange={e => setInvoice({ ...invoice, notes: e.target.value })} className={inputClass} /></label></div><div className="mt-5 flex flex-wrap items-center justify-between gap-4"><p className="text-sm">VAT {money(invoiceVAT)} · <strong>Total {money(Math.round((invoiceAmount + invoiceVAT) * 100) / 100)}</strong></p><button disabled={!!busy || dirty} className={primaryButton}>{busy === 'invoice' ? 'Creating…' : 'Confirm invoice'}</button></div></form>}
      <div className="mt-6 space-y-4">{job.invoices.length ? job.invoices.map(i => <article key={i.id} className="rounded-xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-navy-900">{i.invoiceNumber}</h3><StatusBadge status={i.status} /></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{i.description}</p><dl className="mt-4 grid gap-4 sm:grid-cols-3"><Detail title="Amount / VAT">{money(i.amount)} / {money(i.vatAmount || 0)}</Detail><Detail title="Total">{money(i.total)}</Detail><Detail title="Due date">{date(i.dueDate)}</Detail></dl>{i.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-slate-500">{i.notes}</p>}<Link to={`/payment/${i.invoiceNumber}#token=${encodeURIComponent(i.accessToken)}`} className={`${secondaryButton} mt-5`}>Open payment page <ArrowUpRight size={16} /></Link></article>) : <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No invoices have been created for this job.</p>}</div>
    </Panel></div>}
    {dirty && <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">Your edits are kept when switching job sections.</p><button disabled={!!busy} onClick={save} className={primaryButton}><Save size={16} />{busy === 'save' ? 'Saving…' : 'Save all changes'}</button></div>}
  </div>
}
