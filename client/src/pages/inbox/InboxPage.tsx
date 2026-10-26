import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Inbox, ArrowRight, Search, Users, Circle, Trash2, ShieldAlert } from 'lucide-react'
import { clearInbox, deleteInboxConversation, getInboxConversations } from '../../api/inbox'
import { useAuthStore } from '../../store/authStore'
import type { EmailConversation } from '../../types'

function formatPersonName(value?: string | null) {
  if (!value) return 'Client'

  const cleaned = value
    .replace(/<.*?>/g, '')
    .replace(/"/g, '')
    .trim()

  if (!cleaned) return 'Client'

  if (cleaned.includes('@')) {
    const localPart = cleaned.split('@')[0].replace(/[._-]+/g, ' ').trim()
    const readable = localPart.replace(/\d+$/g, '').trim()
    return readable
      ? readable.split(/\s+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ')
      : 'Client'
  }

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function getContactName(conversation: EmailConversation) {
  const nameFromChat = conversation.subject?.match(/^Chat with (.+)$/i)?.[1]
  const sender = conversation.messages?.[0]?.direction === 'INBOUND' ? formatPersonName(conversation.messages[0].senderEmail) : null
  return conversation.client?.companyName || conversation.client?.reference || nameFromChat || sender || 'Client'
}

export default function InboxPage() {
  const [filter, setFilter] = useState<'all' | 'unread' | 'unassigned'>('all')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; subject: string } | null>(null)
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN'
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: getInboxConversations,
    refetchInterval: 30_000,
  })
  const deleteMutation = useMutation({
    mutationFn: ({ id, password: enteredPassword }: { id?: string; password: string }) => (
      id ? deleteInboxConversation(id, enteredPassword) : clearInbox(enteredPassword)
    ),
    onSuccess: () => {
      setDeleteTarget(null)
      setPassword('')
      setDeleteError('')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inboxUnreadCount'] })
      queryClient.invalidateQueries({ queryKey: ['inboxConversation'] })
    },
    onError: (error: unknown) => {
      const response = (error as { response?: { status?: number; data?: { message?: string } } }).response
      setDeleteError(response?.status === 401 ? 'That password is incorrect.' : response?.data?.message || 'The inbox could not be deleted. Please try again.')
    },
  })
  const unreadCount = conversations.reduce((count, conversation) => (
    count + (conversation.messages?.[0]?.direction === 'INBOUND' && !conversation.messages[0].isRead ? 1 : 0)
  ), 0)
  const visibleConversations = useMemo(() => conversations.filter((conversation) => {
    const latest = conversation.messages?.[0]
    if (filter === 'unread' && !(latest?.direction === 'INBOUND' && !latest.isRead)) return false
    if (filter === 'unassigned' && conversation.clientId) return false
    const query = search.trim().toLowerCase()
    return !query || [
      conversation.subject,
      conversation.client?.companyName,
      conversation.client?.reference,
      latest?.senderEmail,
      latest?.textBody,
    ].some((value) => value?.toLowerCase().includes(query))
  }), [conversations, filter, search])
  const confirmDelete = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deleteTarget || !password) return
    deleteMutation.mutate({ id: deleteTarget.id, password })
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-900">Messages</h1>
            {unreadCount > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">{unreadCount} unread</span>}
          </div>
          <p className="text-sm text-slate-500 mt-1">Your client conversations in one place.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isAdmin && conversations.length > 0 && (
            <button
              type="button"
              onClick={() => { setDeleteTarget({ subject: `all ${conversations.length} conversations` }); setDeleteError('') }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Clear inbox
            </button>
          )}
          <label className="relative block w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-navy-400" />
          </label>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {([
          ['all', `All · ${conversations.length}`],
          ['unread', `Unread · ${unreadCount}`],
          ['unassigned', 'Unassigned'],
        ] as const).map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${filter === value ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">Loading conversations…</div>
      ) : visibleConversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">{conversations.length ? 'No matching conversations' : 'Your inbox is quiet'}</h2>
          <p className="text-sm text-slate-500 mt-1">{conversations.length ? 'Try another filter or search.' : 'New messages will appear here.'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {visibleConversations.map((conversation) => {
            const latest = conversation.messages?.[0]
            const preview = (latest?.textBody || latest?.htmlBody || 'No message preview available.').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            const unread = latest?.direction === 'INBOUND' && !latest.isRead
            const contactName = getContactName(conversation)
            const sender = latest?.direction === 'OUTBOUND' ? 'You' : contactName
            const date = conversation.lastMessageAt ? new Date(conversation.lastMessageAt) : null

            return (
              <div key={conversation.id} className={`flex items-center gap-2 pr-3 transition-colors hover:bg-slate-50 sm:pr-4 ${unread ? 'bg-sky-50/50' : ''}`}>
                <Link to={`/inbox/${conversation.id}`} className="flex min-w-0 flex-1 items-center gap-4 px-4 py-4 sm:px-5">
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-navy-900 text-gold-500 flex items-center justify-center font-semibold text-xs">
                      {contactName.slice(0, 2).toUpperCase()}
                    </div>
                    {unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`truncate text-sm ${unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{contactName}</div>
                      <time className={`shrink-0 text-xs ${unread ? 'font-semibold text-blue-700' : 'text-slate-400'}`}>
                        {date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </time>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-3">
                      <p className={`truncate text-sm ${unread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{conversation.subject || 'No subject'}</p>
                      {conversation.project && <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 sm:block">{conversation.project.name}</span>}
                    </div>
                    <p className={`mt-1 truncate text-sm ${unread ? 'text-slate-700' : 'text-slate-500'}`}><span className="text-slate-400">{sender}: </span>{preview}</p>
                    {!conversation.clientId && <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"><Users className="h-3 w-3" /> Unassigned</div>}
                  </div>
                  <div className="hidden shrink-0 text-slate-300 sm:block">
                    {unread ? <Circle className="h-2.5 w-2.5 fill-blue-600 text-blue-600" /> : <ArrowRight className="h-4 w-4" />}
                  </div>
                </Link>
                {isAdmin && (
                  <button
                    type="button"
                    aria-label={`Delete conversation with ${contactName}`}
                    title="Delete conversation"
                    onClick={() => { setDeleteTarget({ id: conversation.id, subject: contactName }); setDeleteError('') }}
                    className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button type="button" aria-label="Close delete confirmation" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { if (!deleteMutation.isPending) { setDeleteTarget(null); setPassword(''); setDeleteError('') } }} />
          <form onSubmit={confirmDelete} className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">{deleteTarget.id ? 'Delete conversation?' : 'Clear inbox?'}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {deleteTarget.id
                    ? `This permanently deletes the conversation with ${deleteTarget.subject} and its messages.`
                    : `This permanently deletes ${deleteTarget.subject} and all their messages. New messages can still arrive afterward.`}
                </p>
              </div>
            </div>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Enter your password to confirm
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setDeleteError('') }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              />
            </label>
            {deleteError && <p role="alert" className="mt-2 text-sm text-red-600">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={deleteMutation.isPending} onClick={() => { setDeleteTarget(null); setPassword(''); setDeleteError('') }} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={!password || deleteMutation.isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : deleteTarget.id ? 'Delete conversation' : 'Delete all messages'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
