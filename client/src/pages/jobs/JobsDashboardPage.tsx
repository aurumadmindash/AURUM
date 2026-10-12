import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, CalendarClock, Download, FileSpreadsheet, Search, RefreshCw, Receipt, PoundSterling } from 'lucide-react'
import api from '../../lib/apiClient'
import { useAuthStore } from '../../store/authStore'
import { active, date, deadlineLabel, downloadFile, errorMessage, Job, label, money, statuses } from './jobUtils'
import { Notice, primaryButton, secondaryButton, StatusBadge } from './JobUI'

export default function JobsDashboardPage() {
  const user = useAuthStore(s => s.user)
  const allowed = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL_MANAGER'
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [sort, setSort] = useState('recent')
  const [exporting, setExporting] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try { const response = await api.get<Job[]>('/business/quotes'); setJobs(response.data) }
    catch (e) { setError(errorMessage(e, 'Could not load jobs. Please try again.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (allowed) void load(); else setLoading(false) }, [allowed])
  const exportFile = async (format: 'pdf' | 'xlsx') => {
    setExporting(format); setError('')
    try { await downloadFile(format === 'pdf' ? '/business/jobs.pdf' : '/business/sales.xlsx', format === 'pdf' ? 'aurum-jobs-register.pdf' : 'aurum-sales.xlsx') }
    catch (e) { setError(errorMessage(e, 'Could not download the export. Please try again.')) }
    finally { setExporting('') }
  }
  if (!allowed) return <Notice error>Jobs are available to administrators and commercial managers. Contact your administrator for access.</Notice>
  const filtered = jobs.filter(j => (status === 'ALL' || (status === 'OPEN' ? active(j) : j.status === status)) && `${j.projectName} ${j.company} ${j.name} ${j.email} ${j.projectLocation || ''} ${label(j.service)}`.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) => sort === 'deadline' ? (a.tenderDeadline ? new Date(a.tenderDeadline).getTime() : Infinity) - (b.tenderDeadline ? new Date(b.tenderDeadline).getTime() : Infinity) : sort === 'fee' ? (b.fee || 0) - (a.fee || 0) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const upcoming = jobs.filter(j => active(j) && j.tenderDeadline && new Date(j.tenderDeadline).getTime() >= now.getTime() && new Date(j.tenderDeadline).getTime() <= now.getTime() + 7 * 86400000)
  const overdue = jobs.filter(j => active(j) && j.tenderDeadline && new Date(j.tenderDeadline).getTime() < now.getTime())
  const invoices = jobs.flatMap(j => j.invoices)
  const unpaid = invoices.filter(i => ['UNPAID', 'OVERDUE'].includes(i.status))
  const stats = [
    { title: 'Open jobs', value: jobs.filter(active).length, detail: `${jobs.length} total enquiries`, icon: Briefcase },
    { title: 'Due in 7 days', value: upcoming.length, detail: `${overdue.length} overdue tender deadlines`, icon: CalendarClock },
    { title: 'Recorded fees', value: money(jobs.reduce((sum, j) => sum + (j.fee || 0), 0)), detail: `${jobs.filter(j => j.fee != null).length} jobs with a fee`, icon: PoundSterling },
    { title: 'Outstanding invoices', value: money(unpaid.reduce((sum, i) => sum + i.total, 0)), detail: `${unpaid.length} unpaid invoices`, icon: Receipt },
  ]
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
      <div><p className="text-xs font-semibold uppercase tracking-[.15em] text-amber-700">Business workspace</p><h1 className="mt-2 font-display text-3xl font-bold text-navy-900">Aurum Jobs</h1><p className="mt-2 text-sm text-slate-500">Manage enquiries, project information, proposals and invoices in one place.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={load} disabled={loading} className={secondaryButton} aria-label="Refresh jobs"><RefreshCw size={16} /></button><button type="button" onClick={() => exportFile('xlsx')} disabled={!!exporting || loading} className={secondaryButton}><FileSpreadsheet size={16} />{exporting === 'xlsx' ? 'Exporting…' : 'Sales Excel'}</button><button type="button" onClick={() => exportFile('pdf')} disabled={!!exporting || loading} className={primaryButton}><Download size={16} />{exporting === 'pdf' ? 'Exporting…' : 'All jobs PDF'}</button></div>
    </div>
    {error && <Notice error>{error}</Notice>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ title, value, detail, icon: Icon }) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{title}</p><Icon size={18} className="text-amber-700" /></div><p className="mt-3 text-2xl font-bold text-navy-900">{loading ? '…' : value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>)}</div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-end">
        <label className="flex-1 text-xs font-semibold text-slate-600">Search jobs<div className="relative mt-2"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Project, client, location or service" className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm font-normal outline-none focus:border-amber-500" /></div></label>
        <label className="text-xs font-semibold text-slate-600">Status<select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal lg:w-44"><option value="ALL">All statuses</option><option value="OPEN">Open jobs</option>{statuses.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Sort by<select aria-label="Sort by" value={sort} onChange={e => setSort(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal lg:w-44"><option value="recent">Newest first</option><option value="deadline">Tender deadline</option><option value="fee">Highest fee</option></select></label>
      </div>
      <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-500"><span>{filtered.length} of {jobs.length} jobs</span>{(search || status !== 'ALL') && <button onClick={() => { setSearch(''); setStatus('ALL') }} className="min-h-9 font-semibold text-amber-800">Clear filters</button>}</div>
      {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading jobs…</p> : !filtered.length ? <div className="px-5 py-12 text-center"><Briefcase className="mx-auto text-slate-300" size={32} /><h2 className="mt-4 font-semibold text-navy-900">{jobs.length ? 'No matching jobs' : 'No jobs yet'}</h2><p className="mt-2 text-sm text-slate-500">{jobs.length ? 'Try a different search or clear your filters.' : 'Project enquiries submitted through the website will appear here.'}</p></div> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Project & client', 'Service', 'Tender deadline', 'Status', 'Fee / invoices', ''].map((h, i) => <th key={i} scope="col" className="px-5 py-3 font-semibold">{h || <span className="sr-only">Open job</span>}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(j => <tr key={j.id} className="hover:bg-slate-50/70"><td className="max-w-xs px-5 py-5"><Link to={`/jobs/${j.id}`} className="font-semibold text-navy-900 hover:text-amber-800 hover:underline">{j.projectName}</Link><p className="mt-1 text-xs text-slate-500">{j.company} · {j.name}</p><p className="mt-1 text-xs text-slate-400">{j.documents.length} documents</p></td><td className="px-5 py-5 text-slate-600">{label(j.service)}</td><td className="px-5 py-5"><p>{date(j.tenderDeadline)}</p>{j.tenderDeadline && active(j) && <p className={`mt-1 text-xs ${new Date(j.tenderDeadline).getTime() < now.getTime() ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{deadlineLabel(j.tenderDeadline)}</p>}</td><td className="px-5 py-5"><StatusBadge status={j.status} /></td><td className="px-5 py-5"><p className="font-semibold">{money(j.fee)}</p><p className="mt-1 text-xs text-slate-500">{j.invoices.length} invoices</p></td><td className="px-5 py-5"><Link to={`/jobs/${j.id}`} aria-label={`Open ${j.projectName}`} className="inline-flex min-h-10 items-center gap-2 font-semibold text-amber-800">Open <ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 md:hidden">{filtered.map(j => <Link key={j.id} to={`/jobs/${j.id}`} className="block p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-navy-900">{j.projectName}</h2><StatusBadge status={j.status} /></div><p className="mt-2 text-sm text-slate-500">{j.company} · {j.name}</p><p className="mt-1 text-xs text-slate-500">{label(j.service)} · {j.documents.length} documents</p><div className="mt-4 flex flex-wrap justify-between gap-2 text-xs"><span>Tender: {date(j.tenderDeadline)}</span><span className="font-semibold">{money(j.fee)}</span></div><p className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-800">View all job details <ArrowRight size={14} /></p></Link>)}</div>
      </>}
    </section>
  </div>
}
