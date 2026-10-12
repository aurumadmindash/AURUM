import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function AboutPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return <div className="min-h-screen bg-surface-50 text-navy-900">
    <header className="bg-navy-900 px-5 py-4 text-white sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3" aria-label="Aurum Project Controls home">
          <img src="/logo-light.png" alt="Aurum" className="h-12 w-12" />
          <div><div className="font-display text-[17px] font-extrabold tracking-[.13em]">AURUM</div><div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.28em] text-white/55">Project Controls</div></div>
        </Link>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-5 text-sm font-semibold">
          <Link to="/" className="hover:text-amber-300">Home</Link>
          <Link to="/#services" className="hover:text-amber-300">Services</Link>
          <Link to="/#deliverables" className="hover:text-amber-300">Samples</Link>
          <Link to="/about" aria-current="page" className="text-amber-300">About Aurum</Link>
          <Link to="/request-quote" className="rounded-lg bg-amber-400 px-4 py-3 text-xs font-bold text-navy-900 hover:bg-amber-300">Request a quote</Link>
        </nav>
      </div>
    </header>
    <main>
      <section id="about" className="scroll-mt-20 bg-surface-100 px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-[1400px]">
          <div className="max-w-4xl">
            <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[.22em] text-amber-800">About Aurum</p>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-[-.04em] sm:text-5xl">Aurum Project Controls</h1>
            <p className="mt-4 text-sm font-semibold text-amber-800">Quantity surveying <span className="mx-2" aria-hidden="true">|</span> Estimating <span className="mx-2" aria-hidden="true">|</span> Commercial support</p>
            <p className="mt-6 text-base leading-8 text-slate-600">Aurum Project Controls is a founder-led quantity surveying and estimating practice based in Aberdeen. We help building contractors and specialist subcontractors turn drawings and scope information into clear quantities, tender estimates and commercial documents. Each assignment starts with an agreed scope, deliverables, programme and fee.</p>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <div>
              <h3 className="font-display text-2xl font-semibold">Meet the founder</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">Jeremiah Elisha Gwani brings more than 12 years of quantity surveying experience, primarily from contractor and consultancy work in Nigeria. His work has covered measurement, Bills of Quantities, tender preparation and analysis, procurement, valuations, variations, cost reporting and final accounts across building, healthcare and services-intensive projects.</p>
              <p className="mt-4 text-sm leading-7 text-slate-600">Jeremiah holds a bachelor’s degree in Quantity Surveying from Ahmadu Bello University, Zaria, and a Professional Diploma in NEC Contracts. He is a Member of the Nigerian Institute of Quantity Surveyors (MNIQS) and a Registered Quantity Surveyor in Nigeria (RQS). He is based in Aberdeen and leads Aurum’s client discussions and commercial work.</p>
              <h3 className="mt-8 font-display text-2xl font-semibold">Experience Jeremiah brings</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">In previous consultancy roles, Jeremiah worked on subcontract packages, payment valuations, procurement and final accounts. This is his founder experience from earlier employment. Aurum assignments will be identified separately as they are delivered and approved for disclosure.</p>
            </div>
            <div className="rounded-2xl border border-black/[.06] bg-white p-6 sm:p-8">
              <h3 className="font-display text-2xl font-semibold">How Aurum can help</h3>
              <ul className="mt-5 space-y-5 text-sm leading-7 text-slate-600">
                <li><span className="font-semibold text-navy-900">Quantity take-offs and Bills of Quantities</span> — measured, structured information for pricing and review.</li>
                <li><span className="font-semibold text-navy-900">Tender estimating and analysis</span> — labour, materials, plant, subcontractors and preliminaries set out with clear assumptions.</li>
                <li><span className="font-semibold text-navy-900">Commercial support</span> — valuations, variations, cost reporting and contract administration within an agreed scope.</li>
              </ul>
              <h3 className="mt-8 border-t border-slate-100 pt-7 font-display text-2xl font-semibold">Service area and contact</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">Based in Aberdeen, Scotland. Project enquiries from Aberdeen, Aberdeenshire and elsewhere in the UK are considered by agreement, including work delivered remotely. To discuss a tender or commercial support requirement, send the project details through <Link to="/request-quote" className="font-semibold text-navy-900 underline underline-offset-4">www.aurumite.com/request-quote</Link>.</p>
              <Link to="/request-quote" className="mt-7 inline-flex items-center gap-3 rounded-lg bg-navy-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-navy-800">Discuss your project <ArrowRight size={16}/></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer className="bg-white px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-[1400px] flex-col gap-6 md:flex-row md:items-center md:justify-between"><Link to="/" className="flex items-center gap-3"><img src="/logo.png" alt="Aurum" className="h-9 w-9" /><div><div className="text-xs font-extrabold tracking-[.15em]">AURUM</div><div className="text-[9px] uppercase tracking-[.22em] text-slate-400">Project Controls</div></div></Link><p className="max-w-md text-[10px] leading-5 text-slate-500">© {new Date().getFullYear()} Aurum Project Controls. Outsourced estimating, quantity surveying and commercial support.</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-medium text-slate-500"><Link className="hover:text-slate-900" to="/legal/privacy">Privacy</Link><Link className="hover:text-slate-900" to="/legal/cookies">Cookies</Link><Link className="hover:text-slate-900" to="/legal/terms">Terms of use</Link><Link className="hover:text-slate-900" to="/legal/business">Terms of business</Link></div></div></footer>
  </div>
}
