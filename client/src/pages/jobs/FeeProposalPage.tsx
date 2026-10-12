import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import api from '../../lib/apiClient'
import { useAuthStore } from '../../store/authStore'
import { date, downloadFile, errorMessage, Job, jobFilename, label, money, proposalDefaults } from './jobUtils'
import { Detail, Notice, primaryButton, secondaryButton } from './JobUI'

export default function FeeProposalPage() {
  const { id = '' } = useParams()
  const user = useAuthStore(s => s.user)
  const allowed = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL_MANAGER'
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (!allowed) { setLoading(false); return }
    setLoading(true); setError('')
    api.get<Job>(`/business/quotes/${id}`).then(r => { if (!cancelled) setJob(r.data) }).catch(e => { if (!cancelled) setError(errorMessage(e, 'Could not load the proposal.')) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, allowed])
  const exportPdf = async () => {
    if (!job) return
    setBusy(true); setError('')
    try { await downloadFile(`/business/quotes/${id}/proposal.pdf`, jobFilename(job, 'fee-proposal.pdf')) }
    catch (e) { setError(errorMessage(e, 'Could not export the proposal. Please try again.')) }
    finally { setBusy(false) }
  }
  if (!allowed) return <Notice error>Fee proposals are available to administrators and commercial managers.</Notice>
  if (loading) return <p role="status" className="p-10 text-center text-slate-500">Loading fee proposal…</p>
  const proposal = job ? proposalDefaults(job) : null
  return <div className="mx-auto max-w-4xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to={`/jobs/${id}`} className={secondaryButton}><ArrowLeft size={16} /> Back to job</Link><button disabled={busy || !job} onClick={exportPdf} className={primaryButton}><Download size={16} />{busy ? 'Exporting…' : 'Download proposal PDF'}</button></div>
    {error && <Notice error>{error}</Notice>}
    {job && proposal && <>
      {(job.fee == null || !job.requiredDelivery || !job.paymentTerms) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Proposal needs review: {[job.fee == null && 'fee', !job.requiredDelivery && 'delivery date', !job.paymentTerms && 'payment terms'].filter(Boolean).join(', ')} not recorded. Complete these in the job before issuing to the client.</div>}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6"><div className="flex items-center gap-3"><img src="/logo.png" alt="Aurum logo" className="h-14 w-14" /><div><p className="font-display text-lg font-bold text-navy-900">AURUM PROJECT CONTROLS</p><p className="mt-1 text-xs text-slate-500">Aberdeen, Scotland</p></div></div><p className="text-xs text-slate-500">enquiries@aurumite.com</p></div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[.2em] text-amber-700">Fee proposal</p><h1 className="mt-3 break-words font-display text-3xl font-bold text-navy-900">{job.projectName}</h1>
        <dl className="mt-7 grid gap-5 sm:grid-cols-2"><Detail title="Client">{job.company}<br />{job.name}</Detail><Detail title="Contact">{job.email}{job.telephone && <><br />{job.telephone}</>}</Detail><Detail title="Service">{label(job.service)}</Detail><Detail title="Project location">{job.projectLocation}</Detail><Detail title="Proposal date">{date(new Date().toISOString())}</Detail><Detail title="Job reference">{job.id}</Detail></dl>
        <Section title="Scope of service"><p className="whitespace-pre-wrap">{proposal.proposalScope || 'Not recorded.'}</p></Section>
        <Section title="Deliverables">{proposal.proposalDeliverables ? <ul className="list-disc space-y-2 pl-5">{proposal.proposalDeliverables.split('\n').filter(line => line.trim()).map((line, index) => <li key={index}>{line}</li>)}</ul> : 'Not recorded.'}</Section>
        <Section title="Programme"><dl className="grid gap-4 sm:grid-cols-2"><Detail title="Tender deadline">{date(job.tenderDeadline)}</Detail><Detail title="Target Aurum delivery">{date(job.requiredDelivery)}</Detail></dl></Section>
        <Section title="Professional fee"><p className="text-3xl font-bold text-navy-900">{money(job.fee)}</p><p className="mt-3 text-xs leading-6 text-slate-500">GBP. Any applicable VAT and final tax treatment must be confirmed in the written appointment; this proposal does not add VAT.</p></Section>
        <Section title="Payment terms"><p className="whitespace-pre-wrap">{proposal.paymentTerms || 'To be agreed in writing before appointment.'}</p></Section>
        <Section title="Documents supplied">{job.documents.length ? <ul className="space-y-2">{job.documents.map(d => <li key={d.id} className="break-words">{d.name} <span className="text-xs text-slate-400">· {label(d.kind)}</span></li>)}</ul> : 'No documents recorded.'}</Section>
        <Section title="Assumptions and exclusions"><p className="whitespace-pre-wrap">{proposal.proposalAssumptions || 'Not recorded.'}</p></Section>
        <Section title="Client responsibilities & additional services">Provide complete and current project information and notify Aurum of relevant drawing or design revisions. Services outside the agreed scope require written agreement of additional fees and programme.</Section>
        <Section title="Acceptance">Please confirm the scope, fee, programme and payment terms by email or signed return before commencement.</Section>
        <div className="mt-8 border-t border-slate-200 pt-6 text-sm leading-6"><p className="font-semibold">Prepared by Jeremiah Elisha Gwani</p><p>Aurum Project Controls</p><a href="mailto:enquiries@aurumite.com" className="text-amber-800 underline">enquiries@aurumite.com</a></div>
      </article>
    </>}
  </div>
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="mt-7 border-t border-slate-100 pt-5"><h2 className="font-display text-lg font-semibold text-navy-900">{title}</h2><div className="mt-3 text-sm leading-7 text-slate-600">{children}</div></section> }
