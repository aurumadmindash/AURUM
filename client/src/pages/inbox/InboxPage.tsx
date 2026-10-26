import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Mail, Inbox, ArrowRight } from 'lucide-react'
import { getInboxConversations } from '../../api/inbox'

export default function InboxPage() {
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: getInboxConversations,
  })

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Inbox</h1>
          <p className="text-sm text-slate-500 mt-1">Client communications and inbound replies</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">Loading conversations…</div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">No inbound emails yet</h2>
          <p className="text-sm text-slate-500 mt-1">New client replies will appear here once Resend is configured.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => {
            const latest = conversation.messages?.[0]
            const preview = latest?.textBody || latest?.htmlBody || 'No message preview available.'
            const clientName = conversation.client?.companyName || conversation.client?.reference || 'Unassigned client'

            return (
              <Link key={conversation.id} to={`/inbox/${conversation.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-gold-300 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-navy-900 text-gold-500 flex items-center justify-center font-semibold text-xs">
                      {clientName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{conversation.subject || 'No subject'}</div>
                      <div className="text-sm text-slate-500 truncate">{clientName}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {latest?.direction === 'INBOUND' ? 'Inbound' : 'Outbound'}</span>
                  <span>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString('en-GB') : 'No timestamp'}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600 line-clamp-3">{preview.replace(/<[^>]*>/g, ' ').trim()}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
