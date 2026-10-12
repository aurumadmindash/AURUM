import { Link, useParams } from 'react-router-dom'

type LegalContent = { title: string; sections: { title: string; body: string }[] }
const content: Record<string, LegalContent> = {
  privacy: { title: 'Privacy Notice', sections: [
    { title: 'Who we are', body: 'Aurum Project Controls provides estimating, quantity surveying and commercial support. This notice explains how we handle personal information when you use our website, request a quotation or work with us. Contact enquiries@aurumite.com with privacy enquiries.' },
    { title: 'Information we collect', body: 'We collect the contact and company details you provide, project descriptions, deadlines, drawings, specifications and other documents you send us. Our hosting and security providers may process technical information such as your IP address, browser details and request logs.' },
    { title: 'How we use information', body: 'We use information to respond to enquiries, prepare quotations, deliver agreed services, administer accounts and payments, and protect our systems. Where applicable, we rely on steps to enter or perform a contract, our legitimate interests in managing and securing our business, and legal obligations. Where consent is required, you may withdraw it by contacting us.' },
    { title: 'Sharing and international processing', body: 'Information may be processed by service providers supporting hosting, email, document storage and payments, and by advisers or authorities where necessary. We do not sell personal information. Providers may process information outside your country; where required, appropriate transfer safeguards apply. Project information is shared only where needed for the agreed work or required by law.' },
    { title: 'Retention and security', body: 'We retain information for as long as needed for the enquiry, agreed work, accounting requirements and resolution of disputes, then delete or anonymise it. Retention depends on the record and applicable obligations. We take reasonable steps to protect information, but no online service can guarantee absolute security. Please avoid sending unrelated personal or sensitive information in project documents.' },
    { title: 'Your choices and rights', body: 'Depending on applicable law, you may request access, correction, deletion, restriction or portability of your information, or object to certain processing. Email enquiries@aurumite.com to make a request. We may need to verify your identity. You may complain to your local data protection authority; in the UK this is the Information Commissioner’s Office at ico.org.uk.' },
  ] },
  cookies: { title: 'Cookie Notice', sections: [
    { title: 'Cookies and browser storage', body: 'Cookies are small files stored on your device. Similar technologies include browser local storage. These technologies can help a website remember information and support secure access.' },
    { title: 'Storage used by this website', body: 'The Aurum application uses local storage named aurum-auth to retain account information and an authentication token for signed-in users. It persists across browser sessions until you sign out or clear site data. This supports access to the account area. The public website code does not add advertising or analytics cookies.' },
    { title: 'External services', body: 'Some website images load from external providers, including Unsplash. Requests to those providers disclose technical information such as your IP address and are subject to their privacy practices. Hosting and security services may also use necessary technologies to deliver and protect the website.' },
    { title: 'Your controls', body: 'You can remove cookies and local storage through your browser’s site-data settings. Blocking or clearing account storage can sign you out or affect account functionality. If optional tracking technologies are introduced, this notice and the relevant consent controls will be updated before they are used where consent is required.' },
  ] },
  terms: { title: 'Terms of Use', sections: [
    { title: 'Using this website', body: 'These terms apply to your use of the Aurum Project Controls website. Use the website lawfully and do not attempt unauthorised access, interfere with its operation or upload harmful material. Contact enquiries@aurumite.com if you have questions.' },
    { title: 'Website information and samples', body: 'Website information is general guidance. Sample bills of quantities and other documents illustrate our presentation and are not project-specific advice, live quotations or documents issued for construction. Check quantities, scope, specifications, rates and tax treatment for your project before relying on any figures.' },
    { title: 'Content and permitted use', body: 'Aurum content and branding, except identified third-party material, belong to Aurum or its licensors. You may view and download public samples for internal evaluation of our services. Do not misrepresent a sample as a commissioned project document or reproduce our branding for commercial use without permission. Third-party rights remain with their owners.' },
    { title: 'Enquiries and external links', body: 'Submitting an enquiry does not create an appointment or guarantee availability, a price or a deadline. Services start only under an agreed quotation or appointment. External websites have their own terms and privacy practices; we do not control their content or availability.' },
    { title: 'Availability and responsibility', body: 'We aim to keep information accurate and the website available, but information may change and access may be interrupted. To the extent permitted by applicable law, we are not responsible for losses arising solely from reliance on general website material. Nothing in these terms excludes liability or rights that cannot lawfully be excluded.' },
  ] },
  business: { title: 'Terms of Business', sections: [
    { title: 'Agreement and scope', body: 'These general terms describe the basis of our estimating, quantity surveying and commercial support services. Each assignment requires written agreement of the scope, deliverables, fee and programme. The accepted quotation or appointment takes priority if it differs from these general terms.' },
    { title: 'Client information', body: 'Provide complete, accurate drawings, specifications, instructions and relevant project information, and ensure you have permission to share them. Tell us promptly about revisions. We work from the information supplied and identify material assumptions or exclusions in our deliverables.' },
    { title: 'Fees, payment and changes', body: 'Fees, currency, taxes, payment dates and any deposit are set out in the agreed quotation. Changes to scope, information, deadlines or requested revisions may require an additional fee and revised programme, agreed in writing before the additional work proceeds. Cancellation charges, if any, must be stated in the appointment.' },
    { title: 'Programme and deliverables', body: 'Agreed deadlines depend on timely receipt of information and responses. We will advise you if missing information or changes affect delivery. Review deliverables promptly and notify us of queries. File formats and included revisions are those agreed for the assignment.' },
    { title: 'Estimates and professional scope', body: 'Estimates reflect stated assumptions, scope and pricing information at the time of preparation; they do not guarantee tender prices or final construction costs. Structural design, site verification, statutory approvals and specialist advice are included only if expressly agreed. Confirm the suitability of documents before tendering, purchasing or construction.' },
    { title: 'Confidentiality and use of work', body: 'Both parties should keep confidential project and business information secure, except for necessary service delivery or legal disclosure. Once agreed fees are paid, the client may use the deliverables for the agreed project and purpose, subject to the appointment. Reuse for other projects or reliance by third parties requires written agreement.' },
    { title: 'Queries and disputes', body: 'Raise concerns promptly with enquiries@aurumite.com so we can seek a practical resolution. Any specific liability provisions, insurance requirements, governing law and dispute procedure should be recorded in the written appointment. Nothing in these terms removes rights or liabilities that applicable law does not allow to be excluded.' },
  ] },
}

export default function LegalPage() {
  const { type = 'privacy' } = useParams()
  const page = content[type] || content.privacy
  return <main className="min-h-screen bg-slate-50 px-5 py-12 text-navy-900">
    <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
      <Link to="/" className="text-sm font-semibold text-slate-500">← Back to Aurum</Link>
      <p className="mt-8 text-sm font-bold uppercase tracking-widest text-amber-600">Aurum Project Controls</p>
      <h1 className="mt-2 font-display text-3xl font-bold">{page.title}</h1>
      <p className="mt-3 text-xs text-slate-500">Last updated: 12 October 2026</p>
      {page.sections.map(section => <section key={section.title} className="mt-8">
        <h2 className="text-lg font-semibold">{section.title}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p>
      </section>)}
      <p className="mt-8 text-sm text-slate-600">Contact: <a href="mailto:enquiries@aurumite.com" className="font-semibold underline">enquiries@aurumite.com</a></p>
      <nav aria-label="Legal pages" className="mt-8 flex flex-wrap gap-4 border-t border-slate-100 pt-5 text-xs font-semibold">
        {Object.entries(content).map(([key, value]) => <Link key={key} to={`/legal/${key}`} aria-current={type === key ? 'page' : undefined} className="hover:underline">{value.title}</Link>)}
      </nav>
    </article>
  </main>
}
