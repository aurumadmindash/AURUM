import api from '../lib/apiClient'
import type { EmailConversation, EmailMessage } from '../types'

export const sendPublicChatMessage = (data: { name: string; email: string; message: string }) =>
  api.post<{ message: string }>('/inbox/public/chat', data).then((r) => r.data)

export const getInboxConversations = () => api.get<EmailConversation[]>('/inbox/conversations').then((r) => r.data)

export const getInboxUnreadCount = () => api.get<{ count: number }>('/inbox/unread-count').then((r) => r.data.count)

export const getInboxConversation = (id: string) => api.get<EmailConversation>(`/inbox/conversations/${id}`).then((r) => r.data)

export const deleteInboxConversation = (id: string, password: string) =>
  api.delete(`/inbox/conversations/${encodeURIComponent(id)}`, { data: { password } }).then((r) => r.data)

export const clearInbox = (password: string) =>
  api.delete('/inbox/conversations', { data: { password } }).then((r) => r.data)

export const markInboxConversationRead = (id: string) => api.patch(`/inbox/conversations/${id}/read`)

export const replyToInboxConversation = (id: string, data: { body: string }) =>
  api.post<{ message: string; emailMessage: EmailMessage }>(`/inbox/conversations/${id}/reply`, data).then((r) => r.data)
