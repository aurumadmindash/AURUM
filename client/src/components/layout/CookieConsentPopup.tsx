import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useMediaConsentStore } from '../../store/mediaConsentStore'

export default function CookieConsentPopup() {
  const { enabled, hasChoice, settingsOpen, setEnabled, closeSettings } = useMediaConsentStore()
  const { pathname } = useLocation()
  const dialog = useRef<HTMLDialogElement>(null)
  const show = settingsOpen || (pathname === '/' && !hasChoice)
  useEffect(() => {
    const element = dialog.current
    if (show && !element?.open) element?.showModal()
    if (!show && element?.open) element.close()
  }, [show])
  return <dialog ref={dialog} aria-labelledby="cookie-choice-title" aria-describedby="cookie-choice-description" onCancel={event => { event.preventDefault(); setEnabled(false) }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border-0 bg-white p-0 text-navy-900 shadow-2xl backdrop:bg-navy-950/55 backdrop:backdrop-blur-sm">
    <div className="max-h-[85svh] overflow-y-auto p-6 sm:p-8">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-3 text-amber-800"><ShieldCheck size={23} /></div><p className="text-xs font-bold uppercase tracking-[.15em] text-slate-500">Aurum Project Controls</p></div>
      <h2 id="cookie-choice-title" className="mt-5 font-display text-2xl font-bold">Your cookie choices</h2>
      <p id="cookie-choice-description" className="mt-3 text-sm leading-7 text-slate-600">We use essential storage to remember your choices and support account access when you sign in. Optional cookies are off until you accept them.</p>
      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p className="font-semibold text-navy-900">What you are choosing</p><p className="mt-2">Accepting allows the optional Pexels background video, which may set third-party security cookies and disclose your IP address. Rejecting keeps it disabled. We do not use advertising or analytics cookies in the application code.</p></div>
      {hasChoice && <p className="mt-3 text-xs text-slate-500">Current choice: optional cookies {enabled ? 'accepted' : 'rejected'}.</p>}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"><button autoFocus type="button" onClick={() => setEnabled(false)} className="min-h-12 rounded-xl border border-navy-900 bg-white px-4 py-3 text-sm font-bold text-navy-900 hover:bg-slate-50">Reject optional cookies</button><button type="button" onClick={() => setEnabled(true)} className="min-h-12 rounded-xl border border-navy-900 bg-navy-900 px-4 py-3 text-sm font-bold text-white hover:bg-navy-800">Accept optional cookies</button></div>
      <p className="mt-4 text-xs leading-6 text-slate-500">Both choices let you browse the website and use your account. We remember your choice for 180 days. Change it at any time through Cookie settings.</p>
      <Link to="/legal/cookies" onClick={closeSettings} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-amber-800 underline underline-offset-4">Read our cookie notice</Link>
    </div>
  </dialog>
}
