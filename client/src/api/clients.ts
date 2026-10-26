import api from '../lib/apiClient'
import type { Client } from '../types'

export const getClients = () => api.get<Client[]>('/clients').then((r) => r.data)

export const getClient = (id: string) => api.get<Client>(`/clients/${id}`).then((r) => r.data)

export const createClient = (data: Partial<Client>) =>
  api.post<Client>('/clients', data).then((r) => r.data)

export const updateClient = (id: string, data: Partial<Client>) =>
  api.put<Client>(`/clients/${id}`, data).then((r) => r.data)

export const forwardClientEmail = (id: string, data: { subject: string; body: string; projectId?: string }) =>
  api.post<{ message: string; client: Client; emailLog: Record<string, unknown> }>(`/clients/${id}/forward`, data).then((r) => r.data)
