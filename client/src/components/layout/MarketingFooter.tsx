import { Link } from 'react-router-dom'
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react'
import { useCookieConsentStore } from '../../store/cookieConsentStore'

const linkClass = 'inline-flex min-h-10 items-center text-sm text-white/70 transition hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300'

export default function MarketingFooter() {
  const openCookieSettings = useCookieConsentStore(s => s.openSettings)
  return <footer className="bg-navy-950 px-5 text-white sm:px-8 lg:px-10">
    <div className="mx-auto max-w-[1400px]">
      <div className="grid grid-cols-2 gap-x-5 gap-y-9 py-12 sm:gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr] lg:gap-12 lg:py-16">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <Link to="/" aria-label="Aurum Project Controls home" className="inline-flex items-center gap-3">
            <img src="/logo-light.png" alt="" className="h-14 w-14" width={56} height={56} />
            <div><div className="font-display text-xl font-extrabold tracking-[.13em]">AURUM</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-[.25em] text-white/60">Project Controls</div></div>
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-7 text-white/65">Clear quantities. Confident tenders. Practical commercial support for contractors and specialist subcontractors.</p>
          <p className="mt-5 flex items-center gap-2 text-xs text-white/65"><MapPin size={15} className="shrink-0 text-amber-300" /> Aberdeen, Scotland</p>
          <p className="mt-2 max-w-xs text-xs leading-6 text-white/50">Supporting projects across the UK by agreement, including remote delivery.</p>
        </div>
        <nav aria-label="Footer services">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[.18em] text-amber-300">Our services</h2>
          <ul className="space-y-1">
            <li><Link to="/#services" className={linkClass}>Quantity take-offs</Link></li>
            <li><Link to="/#services" className={linkClass}>Bills of Quantities</Link></li>
            <li><Link to="/#services" className={linkClass}>Tender estimating</Link></li>
            <li><Link to="/#services" className={linkClass}>Commercial support</Link></li>
          </ul>
        </nav>
        <nav aria-label="Footer explore">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[.18em] text-amber-300">Explore Aurum</h2>
          <ul className="space-y-1">
            <li><Link to="/about" className={linkClass}>About &amp; founder</Link></li>
            <li><Link to="/#how" className={linkClass}>How we work</Link></li>
            <li><Link to="/#deliverables" className={linkClass}>Sample documents</Link></li>
            <li><Link to="/login" className={linkClass}>Platform login <ArrowUpRight size={14} className="ml-2" /></Link></li>
          </ul>
        </nav>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[.18em] text-amber-300">Discuss your project</h2>
          <p className="text-sm leading-7 text-white/65">Send your drawings, scope and deadline. We will agree the deliverables, programme and fee with you.</p>
          <div className="mt-4 space-y-2">
            <a href="mailto:enquiries@aurumite.com" aria-label="enquiries@aurumite.com" className={`${linkClass} flex w-full gap-3 rounded-lg border border-white/10 px-3 py-3`}><Mail size={18} className="shrink-0 text-amber-300" /><span className="min-w-0"><span className="block text-[10px] uppercase tracking-widest text-white/50">Email</span><span className="block whitespace-nowrap text-[13px] sm:text-sm">enquiries@aurumite.com</span></span></a>
            <a href="tel:+447873933154" aria-label="+44 7873 933154" className={`${linkClass} flex w-full gap-3 rounded-lg border border-white/10 px-3 py-3`}><Phone size={18} className="shrink-0 text-amber-300" /><span><span className="block text-[10px] uppercase tracking-widest text-white/50">Call</span><span className="block whitespace-nowrap">+44 7873 933154</span></span></a>
          </div>
          <Link to="/request-quote" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-3 sm:w-auto rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-navy-950 transition hover:bg-amber-300">Request a quote <ArrowUpRight size={17} /></Link>
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-white/50 lg:flex-row lg:items-center lg:justify-between">
        <p>© {new Date().getFullYear()} Aurum Project Controls. All rights reserved.</p>
        <nav aria-label="Footer legal" className="grid grid-cols-2 gap-x-5 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-6">
          <Link to="/legal/privacy" className="min-h-11 py-3 hover:text-white">Privacy</Link>
          <Link to="/legal/cookies" className="min-h-11 py-3 hover:text-white">Cookies</Link>
          <button type="button" onClick={openCookieSettings} className="min-h-11 py-3 text-left hover:text-white">Cookie settings</button>
          <Link to="/legal/terms" className="min-h-11 py-3 hover:text-white">Terms of use</Link>
          <Link to="/legal/business" className="min-h-11 py-3 hover:text-white">Terms of business</Link>
        </nav>
      </div>
    </div>
  </footer>
}
