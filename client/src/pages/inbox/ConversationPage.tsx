import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Send } from 'lucide-react'
import { getInboxConversation, replyToInboxConversation } from '../../api/inbox'
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
    <div className="max-w-4xl space-y-6">
      <Link to="/inbox" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-navy-900">
        <ArrowLeft className="w-4 h-4" /> Back to inbox
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Conversation</div>
          <h1 className="text-2xl font-bold text-navy-900 mt-2">{conversation.subject || 'No subject'}</h1>
          <div className="mt-2 text-sm text-slate-500">
            {conversation.client?.companyName || conversation.client?.reference || 'Unassigned client'}
            {conversation.project && ` · ${conversation.project.name}`}
          </div>
        </div>

        <div className="space-y-4">
          {conversation.messages?.map((message) => (
            <div key={message.id} className={`rounded-2xl border p-4 ${message.direction === 'INBOUND' ? 'bg-slate-50 border-slate-200' : 'bg-navy-900 text-white border-navy-900'}`}>
              <div className="flex items-center justify-between gap-3 text-xs mb-2">
                <span className="font-medium uppercase tracking-wide">{message.direction === 'INBOUND' ? 'Inbound' : 'Outbound'}</span>
                <span className={message.direction === 'INBOUND' ? 'text-slate-500' : 'text-slate-200'}>{new Date(message.createdAt).toLocaleString('en-GB')}</span>
              </div>
              <div className="text-sm opacity-90">{message.senderEmail || message.recipientEmail}</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.textBody || 'No plain-text body'}</div>
              {!!message.attachments?.length && (
                <ul className="mt-3 space-y-1 text-xs">
                  {message.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      {attachment.filename || 'Unnamed attachment'} · {Math.ceil(attachment.size / 1024)} KB
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => replyMutation.mutate(data))} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <Textarea label="Reply" placeholder="Type your response…" rows={6} {...register('body')} error={errors.body?.message} />
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting || replyMutation.isPending} icon={<Send className="w-4 h-4" />}>
            Send reply
          </Button>
        </div>
        {replyMutation.isSuccess && <p className="text-sm text-green-600">Reply sent successfully.</p>}
        {replyMutation.isError && <p className="text-sm text-red-600">The reply could not be sent.</p>}
      </form>
    </div>
  )
}
