import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, MessageCircle, Send, X } from 'lucide-react'
import { sendPublicChatMessage } from '../../api/inbox'

export default function PublicChatWidget({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const chatMutation = useMutation({ mutationFn: sendPublicChatMessage })

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    chatMutation.mutate({ name: name.trim(), email: email.trim(), message: message.trim() })
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {open && (
        <section aria-label="Chat with Aurum" className="w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-navy-900 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-amber-300"><MessageCircle size={19} /></div>
              <div><h2 className="text-sm font-bold">Chat with Aurum</h2><p className="mt-0.5 text-xs text-white/60">We’ll reply to your email</p></div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="Close chat" className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </header>

          {chatMutation.isSuccess ? (
            <div className="p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={24} /></div>
              <h3 className="mt-4 font-semibold text-navy-900">Message sent</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Thanks, {name.trim()}. Our team will reply to <span className="font-medium text-slate-800">{email.trim()}</span>.</p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Done</button>
                <button type="button" onClick={() => { chatMutation.reset(); setMessage('') }} className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">Send another</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3 p-5">
              <p className="mb-4 text-sm leading-6 text-slate-600">Leave us a message and we’ll continue the conversation by email. No email verification needed.</p>
              <label className="block text-xs font-semibold text-slate-700">Your name
                <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-navy-500" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">Email address
                <input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-navy-500" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">Message
                <textarea required maxLength={4000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-navy-500" />
              </label>
              {chatMutation.isError && <p role="alert" className="text-sm text-red-600">We couldn’t send your message. Please try again shortly.</p>}
              <button type="submit" disabled={chatMutation.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 text-sm font-bold text-navy-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                {chatMutation.isPending ? 'Sending…' : 'Send message'} <Send size={15} />
              </button>
            </form>
          )}
        </section>
      )}

      <button type="button" onClick={() => onOpenChange(!open)} aria-expanded={open} aria-label={open ? 'Close chat with Aurum' : 'Chat with us now'} className="group inline-flex items-center gap-2.5 rounded-full bg-navy-900 px-5 py-3.5 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-navy-800 focus:outline-none focus:ring-4 focus:ring-amber-300/60">
        {open ? <X size={19} /> : <MessageCircle size={19} className="text-amber-300" />}
        <span>Chat with us now</span>
      </button>
    </div>
  )
}
