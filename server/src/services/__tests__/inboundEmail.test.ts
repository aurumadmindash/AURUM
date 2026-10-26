import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  client: { findMany: vi.fn() },
  emailMessage: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  emailConversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}))

vi.mock('../../config/database', () => ({ default: db }))

import { getHeader, getTextBody, normalizeEmailValue, processIncomingResendEmail } from '../inboundEmail'

const receivedEmail = {
  id: 'resend-email-1',
  from: 'Client Name <Client@Example.com>',
  to: ['inbox@aurumite.com'],
  received_for: ['clients@aurumite.com'],
  subject: 'Project update',
  text: 'Email body',
  html: '<p>Email body</p>',
  headers: { 'Message-ID': '<message-1@example.com>' },
  message_id: '<message-1@example.com>',
  created_at: '2026-10-26T00:00:00.000Z',
  attachments: [{ id: 'attachment-1', filename: 'scope.pdf', size: 10, content_type: 'application/pdf', content_id: null, content_disposition: 'attachment' }],
}

beforeEach(() => {
  vi.clearAllMocks()
})

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

  it('retrieves and persists the full email referenced by Resend email.received', async () => {
    db.emailMessage.findUnique.mockResolvedValue(null)
    db.client.findMany.mockResolvedValue([{
      id: 'client-1',
      projects: [{ id: 'project-1', companyEmail: 'client@example.com' }],
    }])
    db.emailMessage.findFirst.mockResolvedValue(null)
    db.emailConversation.create.mockResolvedValue({ id: 'conversation-1', clientId: 'client-1', projectId: 'project-1' })
    db.emailMessage.create.mockImplementation(async ({ data }) => ({ id: 'saved-1', ...data }))
    db.emailConversation.update.mockResolvedValue({})

    const retrieveEmail = vi.fn().mockResolvedValue(receivedEmail)
    const result = await processIncomingResendEmail(
      { type: 'email.received', data: { email_id: 'resend-email-1' } },
      retrieveEmail,
    )

    expect(retrieveEmail).toHaveBeenCalledWith('resend-email-1')
    expect(db.emailMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        providerMessageId: 'resend-email-1',
        senderEmail: 'client@example.com',
        recipientEmail: 'clients@aurumite.com',
        textBody: 'Email body',
        htmlBody: '<p>Email body</p>',
        attachments: receivedEmail.attachments,
        messageIdHeader: '<message-1@example.com>',
      }),
    }))
    expect(result).toMatchObject({
      ok: true,
      isNew: true,
      conversationId: 'conversation-1',
      clientId: 'client-1',
      senderEmail: 'client@example.com',
      subject: 'Project update',
    })
  })

  it('acknowledges duplicate events without retrieving the message again', async () => {
    db.emailMessage.findUnique.mockResolvedValue({
      conversationId: 'conversation-1',
      clientId: 'client-1',
      projectId: null,
    })
    const retrieveEmail = vi.fn()

    const result = await processIncomingResendEmail(
      { type: 'email.received', data: { email_id: 'resend-email-1' } },
      retrieveEmail,
    )

    expect(retrieveEmail).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, isNew: false, conversationId: 'conversation-1', clientId: 'client-1' })
  })
})
