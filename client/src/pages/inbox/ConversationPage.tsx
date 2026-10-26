import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Send, Paperclip, UserRound } from 'lucide-react'
import { getInboxConversation, markInboxConversationRead, replyToInboxConversation } from '../../api/inbox'
import Button from '../../components/ui/Button'
import Textarea from '../../components/ui/Textarea'

const schema = z.object({
  body: z.string().min(1, 'Reply is required'),
})

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const queryClient = useQueryClient()

  const { data: conversation, isLoading } = useQuery({
    queryKey: ['inboxConversation', conversationId],
    queryFn: () => getInboxConversation(conversationId!),
    enabled: !!conversationId,
  })
  const readConversationId = useRef<string | null>(null)

  const markReadMutation = useMutation({
    mutationFn: () => markInboxConversationRead(conversationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inboxUnreadCount'] })
    },
    onError: () => {
      readConversationId.current = null
    },
  })

  useEffect(() => {
    const hasUnreadMessages = conversation?.messages?.some((message) => message.direction === 'INBOUND' && !message.isRead)
    if (hasUnreadMessages && conversationId && readConversationId.current !== conversationId) {
      readConversationId.current = conversationId
      markReadMutation.mutate()
    }
  }, [conversation, conversationId, markReadMutation.mutate])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })

  const replyMutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) => replyToInboxConversation(conversationId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inboxConversation', conversationId] })
      reset()
    },
  })

  if (isLoading || !conversation) {
    return <div className="max-w-4xl p-4">Loading conversation…</div>
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Link to="/inbox" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-navy-900">
        <ArrowLeft className="w-4 h-4" /> Back to inbox
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-gold-500"><UserRound className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-navy-900">{conversation.subject || 'No subject'}</h1>
              <div className="mt-1 text-sm text-slate-500">
                {conversation.client?.companyName || conversation.client?.reference || conversation.messages?.find((message) => message.direction === 'INBOUND')?.senderEmail || 'Unassigned sender'}
                {conversation.project && ` · ${conversation.project.name}`}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 bg-slate-50/70 p-4 sm:p-6">
          {conversation.messages?.map((message) => (
            <div key={message.id} className={`flex ${message.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[78%] ${message.direction === 'OUTBOUND' ? 'rounded-br-md bg-navy-900 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'}`}>
                <div className={`mb-1.5 flex items-center justify-between gap-5 text-xs ${message.direction === 'OUTBOUND' ? 'text-slate-300' : 'text-slate-400'}`}>
                  <span className="max-w-[18rem] truncate">{message.direction === 'OUTBOUND' ? 'You' : message.senderEmail || 'Sender'}</span>
                  <time className="shrink-0">{new Date(message.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </div>
                <div className="whitespace-pre-wrap break-words text-sm leading-6">{message.textBody || 'No message text.'}</div>
                {!!message.attachments?.length && (
                  <ul className={`mt-3 space-y-2 border-t pt-3 text-xs ${message.direction === 'OUTBOUND' ? 'border-white/15' : 'border-slate-100'}`}>
                    {message.attachments.map((attachment) => (
                      <li key={attachment.id} className="flex items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{attachment.filename || 'Unnamed attachment'}</span>
                        <span className="shrink-0 opacity-70">{Math.ceil(attachment.size / 1024)} KB</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => replyMutation.mutate(data))} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 sm:p-5">
        <Textarea label="Write a message" placeholder="Type your response…" rows={4} {...register('body')} error={errors.body?.message} />
        <div className="flex items-center justify-between gap-3">
          {markReadMutation.isError && <p className="text-xs text-red-600">Could not update read status.</p>}
          <Button type="submit" loading={isSubmitting || replyMutation.isPending} icon={<Send className="w-4 h-4" />}>
            Send message
          </Button>
        </div>
        {replyMutation.isSuccess && <p className="text-sm text-green-600">Reply sent successfully.</p>}
        {replyMutation.isError && <p className="text-sm text-red-600">The reply could not be sent.</p>}
      </form>
    </div>
  )
}
