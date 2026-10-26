import express from 'express'
import { body, validationResult } from 'express-validator'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireRole } from '../middleware/roleCheck'
import { sendNewInboxMessageAlert, sendThreadedReplyEmail } from '../services/emailService'
import { findInboundThreadConversation, processIncomingResendEmail, verifyResendWebhookSignature } from '../services/inboundEmail'

const router = express.Router()
const publicChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Please wait before sending another message.' },
})
const inboxDeleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many delete attempts. Please wait before trying again.' },
})

router.post('/public/chat',
  publicChatLimiter,
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
  body('message').isString().trim().isLength({ min: 1, max: 4000 }),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ message: 'Enter your name, a valid email address and a message.' })
      return
    }

    const senderEmail = String(req.body.email).trim().toLowerCase()
    const senderName = String(req.body.name).trim()
    const textBody = String(req.body.message).trim()
    try {
      const existingConversation = await prisma.emailConversation.findFirst({
        where: {
          status: 'OPEN',
          lastMessageAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          messages: { some: { direction: 'INBOUND', senderEmail } },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
      const conversation = existingConversation || await prisma.emailConversation.create({
        data: {
          subject: `Chat with ${senderName}`,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      })
      const savedMessage = await prisma.emailMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          senderEmail,
          recipientEmail: process.env.SMTP_FROM || null,
          subject: conversation.subject || `Website chat with ${senderName}`,
          textBody,
          provider: 'WEB_CHAT',
          status: 'RECEIVED',
          isRead: false,
          processedAt: new Date(),
        },
      })
      await prisma.emailConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: savedMessage.createdAt, status: 'OPEN' },
      })
      try {
        await sendNewInboxMessageAlert({
          sender: `${senderName} (${senderEmail})`,
          senderEmail,
          subject: conversation.subject || 'Website chat',
          conversationId: conversation.id,
        })
      } catch (error) {
        console.error('Failed to send admin alert for website chat message.', error)
      }
      res.status(201).json({ message: 'Message sent. We will reply to you by email.' })
    } catch (error) {
      console.error('Failed to save public website chat message.', error)
      res.status(500).json({ message: 'Your message could not be sent. Please try again.' })
    }
  },
)

router.get('/unread-count', authenticate, requireRole('ADMIN', 'COMMERCIAL_MANAGER'), async (_req: AuthRequest, res) => {
  try {
    const count = await prisma.emailMessage.count({ where: { direction: 'INBOUND', isRead: false } })
    res.json({ count })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/conversations', authenticate, requireRole('ADMIN', 'COMMERCIAL_MANAGER'), async (_req: AuthRequest, res) => {
  try {
    const conversations = await prisma.emailConversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      include: {
        client: { select: { id: true, reference: true, companyName: true, companyEmail: true } },
        project: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    res.json(conversations)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.delete('/conversations',
  authenticate,
  requireRole('ADMIN'),
  inboxDeleteLimiter,
  body('password').isString().notEmpty(),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ message: 'Enter your password to clear the inbox.' })
      return
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { password: true } })
      if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
        res.status(401).json({ message: 'Incorrect password.' })
        return
      }

      const deleted = await prisma.$transaction(async (transaction) => {
        const messages = await transaction.emailMessage.deleteMany()
        const conversations = await transaction.emailConversation.deleteMany()
        return { messages: messages.count, conversations: conversations.count }
      })
      res.json({ message: 'Inbox cleared.', ...deleted })
    } catch (error) {
      console.error('Failed to clear inbox conversations.', error)
      res.status(500).json({ message: 'The inbox could not be cleared.' })
    }
  },
)

router.delete('/conversations/:id',
  authenticate,
  requireRole('ADMIN'),
  inboxDeleteLimiter,
  body('password').isString().notEmpty(),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ message: 'Enter your password to delete this conversation.' })
      return
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { password: true } })
      if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
        res.status(401).json({ message: 'Incorrect password.' })
        return
      }

      const deleted = await prisma.emailConversation.deleteMany({ where: { id: req.params.id } })
      if (!deleted.count) {
        res.status(404).json({ message: 'Conversation not found.' })
        return
      }
      res.json({ message: 'Conversation deleted.' })
    } catch (error) {
      console.error('Failed to delete inbox conversation.', error)
      res.status(500).json({ message: 'The conversation could not be deleted.' })
    }
  },
)

router.get('/conversations/:id', authenticate, requireRole('ADMIN', 'COMMERCIAL_MANAGER'), async (req: AuthRequest, res) => {
  try {
    const conversation = await prisma.emailConversation.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, reference: true, companyName: true, companyEmail: true } },
        project: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' })
      return
    }

    res.json(conversation)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.patch('/conversations/:id/read', authenticate, requireRole('ADMIN', 'COMMERCIAL_MANAGER'), async (req: AuthRequest, res) => {
  try {
    const conversation = await prisma.emailConversation.findUnique({ where: { id: req.params.id }, select: { id: true } })
    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' })
      return
    }
    await prisma.emailMessage.updateMany({
      where: { conversationId: conversation.id, direction: 'INBOUND', isRead: false },
      data: { isRead: true },
    })
    res.json({ message: 'Conversation marked as read.' })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/resend/webhook', async (req, res) => {
  let verifiedPayload: unknown
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
    if (!rawBody.trim()) {
      res.status(400).json({ message: 'Invalid webhook payload' })
      return
    }

    JSON.parse(rawBody)
    verifiedPayload = await verifyResendWebhookSignature(req.headers as Record<string, string | string[] | undefined>, rawBody)
  } catch {
    res.status(400).json({ message: 'Invalid webhook payload or signature' })
    return
  }

  try {
    const result = await processIncomingResendEmail(verifiedPayload)
    if (result.isNew && result.conversationId) {
      try {
        await sendNewInboxMessageAlert({
          sender: result.senderEmail || 'Unknown sender',
          senderEmail: result.senderEmail,
          subject: result.subject || 'No subject',
          conversationId: result.conversationId,
        })
      } catch (error) {
        console.error('Failed to send admin alert for new inbox message.', error)
      }
    }
    res.status(200).json(result)
  } catch (error) {
    const details = error instanceof Error
      ? {
          name: error.name,
          code: 'code' in error && typeof error.code === 'string' ? error.code : undefined,
          message: error.message
            .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, '[redacted database URL]')
            .replace(/\bre_[A-Za-z0-9_-]+\b/g, '[redacted Resend key]')
            .slice(0, 300),
        }
      : { name: 'UnknownError' }
    console.error('Failed to process verified Resend inbound email event.', details)
    res.status(500).json({ message: 'Email processing failed; Resend may retry this event.' })
  }
})

router.post('/conversations/:id/reply',
  authenticate,
  requireRole('ADMIN', 'COMMERCIAL_MANAGER'),
  body('body').isString().notEmpty().trim(),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    try {
      const conversation = await prisma.emailConversation.findUnique({
        where: { id: req.params.id },
        include: {
          messages: {
            where: { direction: 'INBOUND' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })

      if (!conversation) {
        res.status(404).json({ message: 'Conversation not found' })
        return
      }

      const originalMessage = conversation.messages[0]
      if (!originalMessage) {
        res.status(400).json({ message: 'Unable to reply: this conversation has no incoming message.' })
        return
      }

      const recipient = originalMessage.senderEmail || ''
      if (!recipient) {
        res.status(400).json({ message: 'Unable to reply: no recipient address attached to this message.' })
        return
      }

      const threadMessageId = originalMessage.messageIdHeader || null
      const references = [originalMessage.references, originalMessage.messageIdHeader].filter(Boolean).join(' ')
      const subject = conversation.subject?.startsWith('Re:') ? conversation.subject : `Re: ${conversation.subject || 'Email thread'}`
      const reply = await sendThreadedReplyEmail({
        to: recipient,
        subject,
        text: String(req.body.body),
        inReplyTo: threadMessageId || undefined,
        references: references || undefined,
      })

      const saved = await prisma.emailMessage.create({
        data: {
          conversationId: conversation.id,
          clientId: conversation.clientId,
          projectId: conversation.projectId,
          direction: 'OUTBOUND',
          senderEmail: req.user?.email || null,
          recipientEmail: recipient,
          subject,
          textBody: String(req.body.body),
          provider: 'RESEND',
          providerMessageId: reply.messageId || null,
          messageIdHeader: reply.messageId || null,
          inReplyTo: threadMessageId,
          references: references || null,
          status: 'SENT',
          isRead: true,
          processedAt: new Date(),
        },
      })

      await prisma.emailConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          subject,
        },
      })

      const threadMatch = await findInboundThreadConversation({
        clientId: conversation.clientId,
        projectId: conversation.projectId,
        inReplyTo: threadMessageId,
        messageIdHeader: threadMessageId,
      })

      res.status(201).json({ message: 'Reply sent successfully.', threadConversationId: threadMatch, emailMessage: saved })
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'Failed to send reply.' })
    }
  },
)

export default router
