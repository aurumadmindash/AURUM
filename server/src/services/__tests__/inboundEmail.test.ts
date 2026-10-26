import { describe, expect, it } from 'vitest'
import { getHeader, getTextBody, normalizeEmailValue } from '../inboundEmail'

describe('inbound email helpers', () => {
  it('normalizes email addresses consistently', () => {
    expect(normalizeEmailValue('Client@Example.com')).toBe('client@example.com')
    expect(normalizeEmailValue({ address: 'Support@Example.com' })).toBe('support@example.com')
  })

  it('reads both Resend and Svix signature headers safely', () => {
    expect(getHeader({ 'svix-id': 'abc', 'svix-timestamp': '123', 'svix-signature': 'sig' }, 'svix-id')).toBe('abc')
    expect(getHeader({ 'webhook-signature': ['sig'] }, 'webhook-signature')).toBe('sig')
  })

  it('extracts plain text from common payload shapes', () => {
    expect(getTextBody({ text: 'hello world' })).toBe('hello world')
    expect(getTextBody({ html: '<p>Hello <strong>world</strong></p>' })).toBe('Hello world')
  })
})
