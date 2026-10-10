import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import Input from '../ui/Input'

export interface ProjectLetterhead {
  companyName: string
  companyEmail: string
  companyWebsite: string
  companyLogo: string | null
}
export const emptyLetterhead: ProjectLetterhead = { companyName: '', companyEmail: '', companyWebsite: '', companyLogo: null }

export default function ProjectLetterheadFields({ value, onChange, onBusyChange }: {
  value: ProjectLetterhead
  onChange: Dispatch<SetStateAction<ProjectLetterhead>>
  onBusyChange: (busy: boolean) => void
}) {
  const [error, setError] = useState('')
  const upload = async (file?: File) => {
    if (!file) return
    setError('')
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a PNG or JPEG image smaller than 5 MB.')
      return
    }
    onBusyChange(true)
    try {
      const image = await createImageBitmap(file)
      const scale = Math.min(1, 320 / image.width, 160 / image.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Image preview unavailable')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      image.close()
      const logo = canvas.toDataURL('image/png')
      onChange((current) => ({ ...current, companyLogo: logo }))
    } catch {
      setError('This image could not be opened. Try another PNG or JPEG.')
    } finally {
      onBusyChange(false)
    }
  }
  return <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <legend className="px-1 text-sm font-semibold text-navy-900">Company letterhead</legend>
    <p className="text-xs text-slate-500">Use the company issuing this project’s documents. Its name, logo and contact details appear on PDF exports.</p>
    <Input label="Company name" value={value.companyName} maxLength={200} placeholder="Company issuing the documents" onChange={(event) => onChange({ ...value, companyName: event.target.value })} />
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label="Company email" type="email" value={value.companyEmail} maxLength={200} onChange={(event) => onChange({ ...value, companyEmail: event.target.value })} />
      <Input label="Company website" value={value.companyWebsite} maxLength={200} onChange={(event) => onChange({ ...value, companyWebsite: event.target.value })} />
    </div>
    <label className="block text-sm font-medium text-slate-700">Company logo
      <input type="file" accept="image/png,image/jpeg" className="mt-2 block w-full text-xs" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = '' }} />
    </label>
    <p className="text-xs text-slate-500">PNG or JPEG, up to 5 MB. PNG preserves a transparent background.</p>
    {value.companyLogo && <div className="flex items-center gap-4 rounded-lg bg-white p-3">
      <img src={value.companyLogo} alt="Company logo preview" className="h-14 max-w-48 object-contain" />
      <button type="button" className="text-xs font-medium text-red-600" onClick={() => onChange({ ...value, companyLogo: null })}>Remove logo</button>
    </div>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </fieldset>
}
