import express from 'express'
import { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findConversation: vi.fn(),
  createConversation: vi.fn(),
  updateConversation: vi.fn(),
  createMessage: vi.fn(),
  sendAlert: vi.fn(),
  findUser: vi.fn(),
  deleteConversations: vi.fn(),
  deleteMessages: vi.fn(),
  transaction: vi.fn(),
  comparePassword: vi.fn(),
  findConversationById: vi.fn(),
  sendReply: vi.fn(),
  findInboundThread: vi.fn(),
}))

vi.mock('../../config/database', () => ({
  default: {
    emailConversation: {
      findFirst: mocks.findConversation,
      findUnique: mocks.findConversationById,
      create: mocks.createConversation,
      update: mocks.updateConversation,
      deleteMany: mocks.deleteConversations,
    },
    emailMessage: { create: mocks.createMessage, deleteMany: mocks.deleteMessages },
    user: { findUnique: mocks.findUser },
    $transaction: mocks.transaction,
  },
}))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.comparePassword } }))
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' }
    next()
  },
}))
vi.mock('../../middleware/roleCheck', () => ({
  requireRole: (...roles: string[]) => (req: { user?: { role?: string } }, res: { status: (status: number) => { json: (body: unknown) => void } }, next: () => void) => {
    if (req.user?.role && roles.includes(req.user.role)) next()
    else res.status(403).json({ message: 'Insufficient permissions' })
  },
}))
vi.mock('../../services/emailService', () => ({
  sendNewInboxMessageAlert: mocks.sendAlert,
  sendThreadedReplyEmail: mocks.sendReply,
}))
vi.mock('../../services/inboundEmail', () => ({
  findInboundThreadConversation: mocks.findInboundThread,
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
  mocks.findUser.mockResolvedValue({ password: 'hashed-password' })
  mocks.comparePassword.mockResolvedValue(true)
  mocks.deleteConversations.mockResolvedValue({ count: 1 })
  mocks.deleteMessages.mockResolvedValue({ count: 4 })
  mocks.findInboundThread.mockResolvedValue(null)
  mocks.sendReply.mockResolvedValue({ messageId: 'outbound-1', accepted: ['alex@example.com'], rejected: [] })
  mocks.transaction.mockImplementation(async (callback: (transaction: unknown) => Promise<unknown>) => callback({
    emailMessage: { deleteMany: mocks.deleteMessages },
    emailConversation: { deleteMany: mocks.deleteConversations },
  }))
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

describe('password-protected inbox deletion', () => {
  it('clears all messages and conversations inside one transaction after password confirmation', async () => {
    const response = await fetch(`${origin}/inbox/conversations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ messages: 4, conversations: 1 })
    expect(mocks.comparePassword).toHaveBeenCalledWith('correct-password', 'hashed-password')
    expect(mocks.transaction).toHaveBeenCalledOnce()
  })

  it('does not delete anything when the password is wrong', async () => {
    mocks.comparePassword.mockResolvedValue(false)
    const response = await fetch(`${origin}/inbox/conversations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    })

    expect(response.status).toBe(401)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('deletes a single conversation only after password confirmation', async () => {
    const response = await fetch(`${origin}/inbox/conversations/conversation-1`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.deleteConversations).toHaveBeenCalledWith({ where: { id: 'conversation-1' } })
  })
})

describe('website chat replies', () => {
  beforeEach(() => {
    mocks.findConversationById.mockResolvedValue({
      id: 'chat-1',
      clientId: null,
      projectId: null,
      subject: 'Chat with Alex',
      messages: [{ senderEmail: 'alex@example.com', messageIdHeader: null, references: null }],
    })
  })

  it('records a reply only after the provider accepts the recipient', async () => {
    const response = await fetch(`${origin}/inbox/conversations/chat-1/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Thanks for getting in touch.' }),
    })

    expect(response.status).toBe(201)
    expect(mocks.sendReply).toHaveBeenCalledWith(expect.objectContaining({ to: 'alex@example.com' }))
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ direction: 'OUTBOUND', recipientEmail: 'alex@example.com', status: 'SENT' }),
    }))
  })

  it('reports provider rejection without recording a sent message', async () => {
    mocks.sendReply.mockResolvedValueOnce({ messageId: '', accepted: [], rejected: ['alex@example.com'] })

    const response = await fetch(`${origin}/inbox/conversations/chat-1/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Thanks for getting in touch.' }),
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ message: expect.stringContaining('did not accept') })
    expect(mocks.createMessage).not.toHaveBeenCalled()
  })
})
