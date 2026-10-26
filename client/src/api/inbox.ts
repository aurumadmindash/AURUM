import api from '../lib/apiClient'
import type { EmailConversation, EmailMessage } from '../types'

export const getInboxConversations = () => api.get<EmailConversation[]>('/inbox/conversations').then((r) => r.data)

export const getInboxConversation = (id: string) => api.get<EmailConversation>(`/inbox/conversations/${id}`).then((r) => r.data)

export const replyToInboxConversation = (id: string, data: { body: string }) =>
  api.post<{ message: string; emailMessage: EmailMessage }>(`/inbox/conversations/${id}/reply`, data).then((r) => r.data)
