import { Resend } from 'resend'
import prisma from '../config/database'

export type ResendWebhookHeaders = Record<string, string | string[] | undefined>

export function normalizeEmailValue(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string') {
    const cleaned = value.trim()
    return cleaned ? cleaned.toLowerCase() : null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeEmailValue(item)
      if (normalized) return normalized
    }
    return null
  }

  if (typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    const direct = candidate.address ?? candidate.email ?? candidate.value
    if (typeof direct === 'string' && direct.trim()) {
      return normalizeEmailValue(direct)
    }
  }

  return null
}

export function getHeader(headers: ResendWebhookHeaders | undefined, key: string): string | null {
  if (!headers) return null

  const candidates = new Set<string>([
    key,
    key.toLowerCase(),
    key.toUpperCase(),
    key.replace(/-/g, '_'),
    key.replace(/_/g, '-'),
    key.replace(/^webhook-/, 'svix-'),
    key.replace(/^svix-/, 'webhook-'),
  ])

  for (const candidate of candidates) {
    const value = headers[candidate]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value) && value[0]) return String(value[0]).trim()
  }

  return null
}

export function getTextBody(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null

  const text = typeof payload.text === 'string' ? payload.text : payload.body
  if (typeof text === 'string' && text.trim()) return text.trim()

  if (typeof payload.html === 'string' && payload.html.trim()) {
    return payload.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  return null
}

export function getHtmlBody(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.html === 'string') return payload.html.trim() || null
  return null
}

export async function verifyResendWebhookSignature(headers: ResendWebhookHeaders, payload: string | unknown): Promise<any> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('RESEND_WEBHOOK_SECRET is not configured.')
  }

  const id = getHeader(headers, 'svix-id') || getHeader(headers, 'webhook-id')
  const timestamp = getHeader(headers, 'svix-timestamp') || getHeader(headers, 'webhook-timestamp')
  const signature = getHeader(headers, 'svix-signature') || getHeader(headers, 'webhook-signature')

  if (!id || !timestamp || !signature) {
    throw new Error('Missing Resend webhook signing headers.')
  }

  const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const resend = new Resend(process.env.RESEND_API_KEY || 'dev-only')
  return resend.webhooks.verify({
    webhookSecret,
    payload: rawPayload,
    headers: {
      id,
      timestamp,
      signature,
    },
  })
}

export async function resolveClientAssociation(emailAddress?: string | null, projectId?: string | null): Promise<{ clientId: string | null; projectId: string | null }> {
  const normalized = normalizeEmailValue(emailAddress)
  if (!normalized) {
    return { clientId: null, projectId: null }
  }

  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { companyEmail: normalized },
        { clientName: normalized },
      ],
    },
    include: { projects: true },
  })

  if (!client) {
    return { clientId: null, projectId: null }
  }

  let matchedProjectId = projectId || null
  if (!matchedProjectId && client.projects.length > 0) {
    const projectMatch = client.projects.find((project) => normalizeEmailValue(project.companyEmail) === normalized)
    matchedProjectId = projectMatch?.id || null
  }

  return { clientId: client.id, projectId: matchedProjectId }
}

export async function findInboundThreadConversation(args: {
  clientId: string | null
  projectId?: string | null
  inReplyTo?: string | null
  messageIdHeader?: string | null
}): Promise<string | null> {
  const candidates = [args.inReplyTo, args.messageIdHeader].filter((value): value is string => Boolean(value && value.trim()))
  if (candidates.length === 0) return null

  const message = await prisma.emailMessage.findFirst({
    where: {
      OR: [
        { messageIdHeader: { in: candidates } },
        { inReplyTo: { in: candidates } },
        { providerMessageId: { in: candidates } },
      ],
      ...(args.clientId ? { clientId: args.clientId } : {}),
      ...(args.projectId ? { projectId: args.projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { conversation: true },
  })

  return message?.conversationId || null
}

export async function processIncomingResendEmail(payload: any): Promise<{ ok: boolean; message: string; conversationId?: string | null; clientId?: string | null; projectId?: string | null }> {
  const event = payload?.data ?? payload
  const eventType = payload?.type ?? event?.type
  if (!eventType || !['email.received', 'inbox.email.received'].includes(eventType)) {
    return { ok: false, message: 'Unsupported Resend event type' }
  }

  const providerMessageId = event.id || event.messageId || null
  if (!providerMessageId) {
    throw new Error('Resend payload did not include an email identifier.')
  }

  const senderEmail = normalizeEmailValue(event.from ?? event.sender ?? event.from_email ?? event.fromEmail)
  const recipientEmail = normalizeEmailValue(event.to ?? event.to_email ?? event.toEmail ?? event.recipient ?? event.receiving_address)
  const subject = typeof event.subject === 'string' ? event.subject.trim() || 'No subject' : 'No subject'
  const textBody = getTextBody(event)
  const htmlBody = getHtmlBody(event)
  const replyThread = {
    inReplyTo: normalizeEmailValue(event.headers?.['In-Reply-To'] ?? event.in_reply_to ?? event.inReplyTo),
    messageIdHeader: normalizeEmailValue(event.headers?.['Message-ID'] ?? event.message_id ?? event.messageIdHeader),
    references: normalizeEmailValue(event.headers?.References ?? event.references),
  }

  const association = await resolveClientAssociation(senderEmail || recipientEmail, null)
  const clientId = association.clientId
  const projectId = association.projectId

  const existing = await prisma.emailMessage.findUnique({
    where: { provider_providerMessageId: { provider: 'RESEND', providerMessageId } },
    include: { conversation: true },
  })

  if (existing) {
    return {
      ok: true,
      message: 'Inbound message already processed.',
      conversationId: existing.conversationId,
      clientId: existing.clientId,
      projectId: existing.projectId,
    }
  }

  const matchedConversationId = clientId
    ? await findInboundThreadConversation({
        clientId,
        projectId,
        inReplyTo: replyThread.inReplyTo,
        messageIdHeader: replyThread.messageIdHeader,
      })
    : null

  const conversation = matchedConversationId
    ? await prisma.emailConversation.findUnique({ where: { id: matchedConversationId } })
    : await prisma.emailConversation.create({
        data: {
          clientId: clientId || null,
          projectId: projectId || null,
          subject,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      })

  if (!conversation) {
    throw new Error('Failed to create or load the email conversation.')
  }

  const savedMessage = await prisma.emailMessage.create({
    data: {
      conversationId: conversation.id,
      clientId: clientId || null,
      projectId: projectId || null,
      direction: 'INBOUND',
      senderEmail: senderEmail || null,
      recipientEmail: recipientEmail || null,
      subject,
      textBody: textBody || null,
      htmlBody: htmlBody || null,
      provider: 'RESEND',
      providerMessageId,
      messageIdHeader: replyThread.messageIdHeader || null,
      inReplyTo: replyThread.inReplyTo || null,
      references: replyThread.references || null,
      status: 'RECEIVED',
      isRead: false,
      processedAt: new Date(),
    },
  })

  await prisma.emailConversation.update({
    where: { id: conversation.id },
    data: {
      clientId: clientId || conversation.clientId || null,
      projectId: projectId || conversation.projectId || null,
      subject,
      status: 'OPEN',
      lastMessageAt: new Date(),
    },
  })

  return {
    ok: true,
    message: 'Inbound email saved successfully.',
    conversationId: conversation.id,
    clientId: savedMessage.clientId,
    projectId: savedMessage.projectId,
  }
}
