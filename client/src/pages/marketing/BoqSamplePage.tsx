import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react'

const samples = {
  '1': { title: 'Refurbishment Building BOQ', pages: 5, file: 'boq-sample', description: 'Priced refurbishment example with historical reference rates, detailed trade bills and a cost summary. For illustration only.' },
  '2': { title: '5 Unit 2 Bedroom Building BOQ', pages: 33, file: 'boq-client-completed', description: 'Complete bill of quantities with a project cover, cost summary and detailed quantity basis. Modelled quantities and supplied rates. For illustration only.' },
}

export default function BoqSamplePage() {
  const { sample } = useParams()
  const data = samples[sample as keyof typeof samples]
  if (!data) return <Navigate to="/#deliverables" replace />
  return <SampleViewer key={sample} data={data} />
}

function SampleViewer({ data }: { data: typeof samples['2'] }) {
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [failedPage, setFailedPage] = useState<number | null>(null)
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-navy-900 disabled:opacity-40'
  return <main className="min-h-screen bg-surface-100 px-4 py-6 text-navy-900 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link to="/#deliverables" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft size={18} /> Back to samples</Link>
      <h1 className="mt-4 font-display text-2xl font-semibold sm:text-3xl">{data.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{data.description}</p>
      <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
        <a href={`/samples/${data.file}.pdf`} download className={button}><Download size={17} /> Download PDF</a>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <button type="button" className={button} disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button>
          <label className="text-sm font-semibold">Page <select className="min-h-11 rounded-lg border border-slate-300 px-2" value={page} onChange={event => setPage(Number(event.target.value))} aria-label="Select page">{Array.from({ length: data.pages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select> of {data.pages}</label>
          <button type="button" className={button} disabled={page === data.pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={18} /></button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={button} disabled={zoom === 100} onClick={() => setZoom(zoom - 50)} aria-label="Zoom out"><ZoomOut size={18} /></button>
          <span className="w-12 text-center text-sm" aria-live="polite">{zoom}%</span>
          <button type="button" className={button} disabled={zoom === 300} onClick={() => setZoom(zoom + 50)} aria-label="Zoom in"><ZoomIn size={18} /></button>
        </div>
      </div>
      <p className="my-3 text-xs text-slate-600">Zoom in to read the figures, then swipe across the page.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-200 p-2" tabIndex={0} aria-label="BOQ page preview">
        {failedPage === page ? <p role="alert" className="bg-white p-6 text-sm">This page could not load. You can download the PDF above to read the full sample.</p> : <img key={page} src={`/samples/previews/${data.file}/page-${page}.webp`} alt={`${data.title}, page ${page} of ${data.pages}. Full document text is available in the PDF download.`} width={1684} height={1190} className="h-auto max-w-none bg-white" style={{ width: `${zoom}%` }} onError={() => setFailedPage(page)} />}
      </div>
    </div>
  </main>
}
