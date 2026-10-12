import axios from 'axios'
import api from '../../lib/apiClient'

export const statuses = ['NEW', 'REVIEWING', 'QUOTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED'] as const
export type JobStatus = typeof statuses[number]
export interface JobDocument { id: string; name: string; kind: string; size: number; mimeType?: string; createdAt?: string }
export interface JobInvoice { id: string; invoiceNumber: string; accessToken: string; total: number; amount: number; vatRate: number | null; vatAmount: number | null; status: string; description: string; dueDate: string | null; createdAt: string; notes: string | null }
export interface Job {
  id: string; projectName: string; projectLocation: string | null; name: string; company: string; email: string; telephone: string | null
  service: string; status: JobStatus; tenderDeadline: string | null; requiredDelivery: string | null; fee: number | null
  briefDescription: string | null; notes: string | null; clientRequirements: string | null; requiredTrades: string | null; missingInformation: string | null
  proposalScope: string | null; proposalDeliverables: string | null; proposalAssumptions: string | null; paymentTerms: string | null
  createdAt: string; updatedAt: string; documents: JobDocument[]; invoices: JobInvoice[]
}
export const label = (value: string) => value === 'BOQ' ? 'Bill of Quantities' : value === 'TAKE_OFF' ? 'Quantity take-off' : value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
export const money = (value: number | null | undefined) => value == null ? 'Not agreed' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
export const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not supplied'
export const inputDate = (value: string | null | undefined) => value?.slice(0, 10) || ''
export const active = (job: Job) => !['COMPLETED', 'DECLINED'].includes(job.status)
export function deadlineLabel(value: string | null) {
  if (!value) return 'No deadline'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const day = new Date(value); day.setHours(0, 0, 0, 0)
  const days = Math.round((day.getTime() - today.getTime()) / 86400000)
  return days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`
}
export const errorMessage = (error: unknown, fallback: string) => axios.isAxiosError(error) && typeof error.response?.data?.message === 'string' ? error.response.data.message : fallback
export const proposalDefaults = (job: Job) => ({
  proposalScope: job.proposalScope ?? `Aurum Project Controls will provide ${label(job.service).toLowerCase()} services for ${job.projectName}, based on the current drawings, specification and project information supplied by the client.`,
  proposalDeliverables: job.proposalDeliverables ?? 'Quantity take-off / estimate in Excel, where applicable\nMarked-up drawings in PDF, where applicable\nAssumptions and exclusions schedule\nFinal PDF issue',
  proposalAssumptions: job.proposalAssumptions ?? 'Work is based on the information supplied by the client. Missing information and material assumptions will be identified. Additional services and revisions outside the agreed scope require agreement of the fee and programme.',
  paymentTerms: job.paymentTerms ?? '',
})
export async function downloadFile(url: string, filename: string) {
  const response = await api.get(url, { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(response.data)
  const link = document.createElement('a'); link.href = objectUrl; link.download = filename
  document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
export const jobFilename = (job: Job, suffix: string) => `${job.projectName.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'Aurum-job'}-${suffix}`
