import { describe, expect, it } from 'vitest'
import { readLetterhead } from '../projectLetterhead'

describe('project letterhead validation', () => {
  it('keeps omitted fields unchanged and lets an owner remove a logo', () => {
    expect(readLetterhead({})).toEqual({})
    expect(readLetterhead({ companyLogo: null, companyName: '  Site Company  ' })).toEqual({ companyLogo: null, companyName: 'Site Company' })
  })
  it('rejects an invalid email, unsupported logo format and disguised image', () => {
    expect(() => readLetterhead({ companyEmail: 'invalid' })).toThrow('email')
    expect(() => readLetterhead({ companyLogo: 'data:image/svg+xml;base64,PHN2Zz4=' })).toThrow('PNG or JPEG')
    expect(() => readLetterhead({ companyLogo: 'data:image/png;base64,ZmFrZQ==' })).toThrow('invalid')
  })
  it('limits both encoded image bytes and image dimensions', () => {
    expect(() => readLetterhead({ companyLogo: `data:image/png;base64,${Buffer.alloc(256 * 1024 + 1).toString('base64')}` })).toThrow('too large')
    const image = Buffer.alloc(24)
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image)
    image.writeUInt32BE(100000, 16)
    expect(() => readLetterhead({ companyLogo: `data:image/png;base64,${image.toString('base64')}` })).toThrow('dimensions')
  })
})
