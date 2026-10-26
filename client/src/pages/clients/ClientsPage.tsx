import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Mail, Plus, FolderOpen } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { getClients, createClient } from '../../api/clients'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import type { Client } from '../../types'

const schema = z.object({
  clientName: z.string().optional(),
  companyName: z.string().optional(),
  companyEmail: z.string().optional(),
  phone: z.string().optional(),
})

export default function ClientsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModalOpen(false)
      reset()
    },
  })

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">Client records and contact details</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>New Client</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">No clients yet</h2>
          <p className="text-sm text-slate-500 mt-1">Create the first client record to start sending updates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client: Client) => (
            <Link key={client.id} to={`/clients/${client.id}`} className="block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-navy-900 text-gold-500 flex items-center justify-center font-semibold text-sm">
                  {client.companyName?.slice(0, 2)?.toUpperCase() || client.clientName?.slice(0, 2)?.toUpperCase() || 'CL'}
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gold-100 text-gold-700">{client.reference}</span>
              </div>
              <h2 className="text-lg font-semibold text-navy-900 line-clamp-2">{client.companyName || client.clientName || 'Unnamed client'}</h2>
              {client.clientName && client.companyName && <p className="text-sm text-slate-500 mt-1">{client.clientName}</p>}
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {client.companyEmail && (
                  <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {client.companyEmail}</p>
                )}
                <p className="flex items-center gap-2"><FolderOpen className="w-4 h-4" /> {client._count?.projects ?? 0} associated projects</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }} title="New Client" size="md">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input label="Client name" placeholder="Client contact or company" {...register('clientName')} error={errors.clientName?.message} />
          <Input label="Company name" placeholder="Aurum Client Ltd" {...register('companyName')} error={errors.companyName?.message} />
          <Input label="Company email" type="email" placeholder="hello@company.com" {...register('companyEmail')} error={errors.companyEmail?.message} />
          <Input label="Phone" placeholder="+44 20 0000 0000" {...register('phone')} error={errors.phone?.message} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setModalOpen(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>Create Client</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
