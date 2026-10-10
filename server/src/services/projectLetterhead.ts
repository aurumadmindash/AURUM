export class LetterheadValidationError extends Error {}

export function readLetterhead(input: Record<string, unknown>) {
  const data: Record<string, string | null> = {}
  for (const key of ['companyName', 'companyEmail', 'companyWebsite']) {
    if (input[key] === undefined) continue
    if (input[key] !== null && typeof input[key] !== 'string') throw new LetterheadValidationError('Company details must be text.')
    const value = String(input[key] ?? '').trim()
    if (value.length > 200) throw new LetterheadValidationError('Company details must be 200 characters or fewer.')
    if (key === 'companyEmail' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new LetterheadValidationError('Enter a valid company email address.')
    data[key] = value || null
  }
  if (input.companyLogo !== undefined) {
    if (!input.companyLogo) data.companyLogo = null
    else {
      if (typeof input.companyLogo !== 'string') throw new LetterheadValidationError('Upload a PNG or JPEG logo.')
      const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.companyLogo)
      if (!match) throw new LetterheadValidationError('Upload a PNG or JPEG logo.')
      const image = Buffer.from(match[2], 'base64')
      if (image.length > 256 * 1024) throw new LetterheadValidationError('Logo is too large. Please use a smaller image.')
      const png = image.length >= 24 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      const jpeg = image.length >= 4 && image[0] === 255 && image[1] === 216 && image[image.length - 2] === 255 && image[image.length - 1] === 217
      if ((match[1] === 'png' && !png) || (match[1] === 'jpeg' && !jpeg)) throw new LetterheadValidationError('The logo image is invalid.')
      if (png && (image.readUInt32BE(16) > 4096 || image.readUInt32BE(20) > 4096)) throw new LetterheadValidationError('Logo dimensions are too large.')
      data.companyLogo = input.companyLogo
    }
  }
  return data
}
