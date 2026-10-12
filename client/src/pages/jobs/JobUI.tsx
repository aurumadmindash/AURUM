import type { ReactNode } from 'react'
import { label } from './jobUtils'

export const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-50'
export const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:cursor-wait disabled:opacity-50'
export const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'
export function StatusBadge({ status }: { status: string }) {
  const colour = status === 'COMPLETED' || status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : status === 'DECLINED' || status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' : status === 'IN_PROGRESS' || status === 'ACCEPTED' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${colour}`}>{label(status)}</span>
}
export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-semibold text-navy-900">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}<div className="mt-5">{children}</div></section>
}
export function Detail({ title, children }: { title: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{title}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-slate-800">{children || 'Not supplied'}</dd></div>
}
export function Notice({ error, children }: { error?: boolean; children: ReactNode }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm leading-6 ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{children}</div>
}
