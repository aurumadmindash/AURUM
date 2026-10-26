import express from 'express'
import { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findConversation: vi.fn(),
  createConversation: vi.fn(),
  updateConversation: vi.fn(),
  createMessage: vi.fn(),
  sendAlert: vi.fn(),
}))

vi.mock('../../config/database', () => ({
  default: {
    emailConversation: {
      findFirst: mocks.findConversation,
      create: mocks.createConversation,
      update: mocks.updateConversation,
    },
    emailMessage: { create: mocks.createMessage },
  },
}))
vi.mock('../../services/emailService', () => ({
  sendNewInboxMessageAlert: mocks.sendAlert,
  sendThreadedReplyEmail: vi.fn(),
}))
vi.mock('../../services/inboundEmail', () => ({
  findInboundThreadConversation: vi.fn(),
  processIncomingResendEmail: vi.fn(),
  verifyResendWebhookSignature: vi.fn(),
}))

import router from '../inbox'

const app = express()
app.use(express.json())
app.use('/inbox', router)
let server: ReturnType<typeof app.listen>
let origin: string

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findConversation.mockResolvedValue(null)
  mocks.createConversation.mockResolvedValue({ id: 'chat-1', subject: 'Chat with Alex' })
  mocks.createMessage.mockResolvedValue({ id: 'message-1', createdAt: new Date('2026-10-26T10:00:00Z') })
  mocks.updateConversation.mockResolvedValue({})
  mocks.sendAlert.mockResolvedValue(undefined)
})

describe('public website chat', () => {
  it('stores a message and alerts admins without requiring email verification', async () => {
    const response = await fetch(`${origin}/inbox/public/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alex Example', email: 'Alex@Example.com', message: 'Can you help with a tender?' }),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ message: 'Message sent. We will reply to you by email.' })
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        direction: 'INBOUND',
        senderEmail: 'alex@example.com',
        textBody: 'Can you help with a tender?',
        provider: 'WEB_CHAT',
        isRead: false,
      }),
    }))
    expect(mocks.sendAlert).toHaveBeenCalledWith(expect.objectContaining({
      sender: 'Alex Example (alex@example.com)',
      senderEmail: 'alex@example.com',
      conversationId: 'chat-1',
    }))
  })

  it('rejects invalid email and empty messages', async () => {
    const response = await fetch(`${origin}/inbox/public/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alex', email: 'not-an-email', message: ' ' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.createMessage).not.toHaveBeenCalled()
  })
})
