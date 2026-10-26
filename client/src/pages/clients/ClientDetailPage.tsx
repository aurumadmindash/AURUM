import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Building2, Mail, Phone, FolderOpen, Send } from 'lucide-react'
import { getClient, forwardClientEmail } from '../../api/clients'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Select from '../../components/ui/Select'
import type { Client } from '../../types'

const schema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Message is required'),
  projectId: z.string().optional(),
})

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const { data: client, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClient(clientId!),
    enabled: !!clientId,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })

  const sendMutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) => forwardClientEmail(clientId!, data),
    onSuccess: () => {
      reset()
    },
  })

  if (isLoading || !client) {
    return <div className="max-w-4xl p-4">Loading client…</div>
  }

  const projectOptions = (client.projects ?? []).map((project) => ({ value: project.id, label: project.name }))

  return (
    <div className="max-w-6xl space-y-6">
      <Link to="/clients" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-navy-900">
        <ArrowLeft className="w-4 h-4" /> Back to clients
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-navy-900 text-gold-500 flex items-center justify-center font-bold text-lg">
              {client.companyName?.slice(0, 2)?.toUpperCase() || client.clientName?.slice(0, 2)?.toUpperCase() || 'CL'}
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{client.reference}</div>
              <h1 className="text-2xl font-bold text-navy-900 mt-1">{client.companyName || client.clientName || 'Client record'}</h1>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-gold-100 text-gold-700 text-xs font-semibold">{client.companyEmail ? 'Active' : 'No email on file'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {client.companyEmail && (
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider"><Mail className="w-4 h-4" /> Email</div>
              <p className="mt-2 text-sm font-medium text-slate-800">{client.companyEmail}</p>
            </div>
          )}
          {client.phone && (
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider"><Phone className="w-4 h-4" /> Phone</div>
              <p className="mt-2 text-sm font-medium text-slate-800">{client.phone}</p>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider"><FolderOpen className="w-4 h-4" /> Projects</div>
            <p className="mt-2 text-sm font-medium text-slate-800">{client.projects?.length ?? 0} associated</p>
          </div>
        </div>

        {client.notes && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Notes</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-gold-500" />
            <h2 className="text-xl font-semibold text-navy-900">Associated projects</h2>
          </div>
          {client.projects && client.projects.length > 0 ? (
            <div className="space-y-3">
              {client.projects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}/dashboard`} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-gold-300 transition-colors">
                  <div>
                    <div className="font-medium text-slate-800">{project.name}</div>
                    <div className="text-xs text-slate-500">{project.contractType} · {project.isActive ? 'Active' : 'Completed'}</div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-700">{project.id.slice(0, 8)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No projects are currently linked to this client.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5 text-gold-500" />
            <h2 className="text-xl font-semibold text-navy-900">Forward information</h2>
          </div>

          <form onSubmit={handleSubmit((data) => sendMutation.mutate(data))} className="space-y-4">
            <Input label="Subject" placeholder="Project update" {...register('subject')} error={errors.subject?.message} />
            <Select label="Associated project (optional)" options={[{ value: '', label: 'No project selected' }, ...projectOptions]} {...register('projectId')} />
            <Textarea label="Message" placeholder="Share the latest update, specification, or client information…" rows={8} {...register('body')} error={errors.body?.message} />
            <Button type="submit" loading={isSubmitting || sendMutation.isPending} className="w-full">Send to {client.companyEmail || 'client email'}</Button>
            {sendMutation.isSuccess && <p className="text-sm text-green-600">Message sent successfully.</p>}
            {sendMutation.isError && <p className="text-sm text-red-600">Could not send the message. Check the email address and try again.</p>}
          </form>
        </div>
      </div>

      {client.emailLogs && client.emailLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-navy-900 mb-4">Recent outbound emails</h2>
          <div className="space-y-3">
            {client.emailLogs.map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-800">{event.subject}</p>
                  <p className="text-xs text-slate-500">{event.recipientEmail} · {new Date(event.createdAt).toLocaleString('en-GB')}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${event.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {event.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
