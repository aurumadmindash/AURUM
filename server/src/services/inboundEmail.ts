import { Resend } from 'resend'
import prisma from '../config/database'

export type ResendWebhookHeaders = Record<string, string | string[] | undefined>
type ReceivedEmail = {
  id: string
  from: string
  to: string[]
  received_for: string[]
  subject: string
  text: string | null
  html: string | null
  headers: Record<string, string> | null
  message_id: string
  created_at: string
  attachments: Array<{
    id: string
    filename: string | null
    size: number
    content_type: string
    content_id: string | null
    content_disposition: string | null
  }>
}

async function retrieveReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.')
  }

  const { data, error } = await new Resend(apiKey).emails.receiving.get(emailId)
  if (error) {
    throw new Error(`Resend could not retrieve received email (${error.statusCode}).`)
  }
  if (!data) {
    throw new Error('Resend returned no received email data.')
  }

  return data
}

function extractEmailAddress(value: unknown): string | null {
  if (typeof value !== 'string') return normalizeEmailValue(value)
  const bracketedAddress = value.match(/<([^<>]+)>/)
  return normalizeEmailValue(bracketedAddress?.[1] ?? value)
}

function getMessageHeader(headers: Record<string, string> | null, name: string): string | null {
  if (!headers) return null
  const key = Object.keys(headers).find((header) => header.toLowerCase() === name.toLowerCase())
  return key ? headers[key]?.trim() || null : null
}

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
  if (typeof text === 'string' && text.trim()) return stripQuotedEmailText(text)

  if (typeof payload.html === 'string' && payload.html.trim()) {
    return stripQuotedEmailText(payload.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))
  }

  return null
}

export function stripQuotedEmailText(value: string): string | null {
  const lines = value.replace(/\r\n/g, '\n').split('\n')
  const quoteStart = lines.findIndex((line, index) => {
    if (/^\s*(?:-{2,}\s*Original Message\s*-{2,}|Begin forwarded message:)\s*$/i.test(line)) return true
    if (/^\s*On .{0,300}\b wrote:\s*$/i.test(line) || /^\s*On .{0,300}<\s*$/i.test(line)) return true
    return /^\s*>/.test(line) && lines.slice(index).some((quotedLine) => /^\s*>/.test(quotedLine))
  })
  const message = lines.slice(0, quoteStart < 0 ? lines.length : quoteStart).join('\n').trim()
  return message || null
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

  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { companyEmail: { equals: normalized, mode: 'insensitive' } },
        { projects: { some: { companyEmail: { equals: normalized, mode: 'insensitive' } } } },
      ],
    },
    include: { projects: true },
  })

  if (clients.length !== 1) {
    return { clientId: null, projectId: null }
  }
  const client = clients[0]

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
  references?: string | null
}): Promise<string | null> {
  const candidates = [...new Set([
    args.inReplyTo,
    args.messageIdHeader,
    ...(args.references?.match(/<[^<>]+>/g) ?? []),
  ].filter((value): value is string => Boolean(value && value.trim())))]
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

export async function processIncomingResendEmail(
  payload: any,
  retrieveEmail: (emailId: string) => Promise<ReceivedEmail> = retrieveReceivedEmail,
): Promise<{ ok: boolean; message: string; conversationId?: string | null; clientId?: string | null; projectId?: string | null; isNew?: boolean; senderEmail?: string | null; subject?: string }> {
  const event = payload?.data ?? payload
  const eventType = payload?.type ?? event?.type
  if (eventType !== 'email.received') {
    return { ok: false, message: 'Unsupported Resend event type' }
  }

  const providerMessageId = event.email_id || null
  if (!providerMessageId) {
    throw new Error('Resend email.received payload did not include data.email_id.')
  }

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
      isNew: false,
    }
  }

  const receivedEmail = await retrieveEmail(providerMessageId)
  const senderEmail = extractEmailAddress(receivedEmail.from)
  const recipientEmail = extractEmailAddress(receivedEmail.received_for?.[0] ?? receivedEmail.to?.[0])
  const subject = receivedEmail.subject?.trim() || 'No subject'
  const internalSenderAddresses = new Set(
    [extractEmailAddress(process.env.SMTP_FROM), extractEmailAddress(process.env.SALES_EMAIL)]
      .filter((address): address is string => address !== null),
  )
  if (senderEmail && internalSenderAddresses.has(senderEmail)) {
    return {
      ok: true,
      message: 'Internal email ignored.',
      isNew: false,
      senderEmail,
      subject,
    }
  }

  const textBody = getTextBody(receivedEmail)
  const htmlBody = getHtmlBody(receivedEmail)
  const replyThread = {
    inReplyTo: getMessageHeader(receivedEmail.headers, 'In-Reply-To'),
    messageIdHeader: getMessageHeader(receivedEmail.headers, 'Message-ID') || receivedEmail.message_id,
    references: getMessageHeader(receivedEmail.headers, 'References'),
  }

  const association = await resolveClientAssociation(senderEmail, null)
  const clientId = association.clientId
  const projectId = association.projectId

  const matchedConversationId = clientId
    ? await findInboundThreadConversation({
        clientId,
        projectId,
        inReplyTo: replyThread.inReplyTo,
        messageIdHeader: replyThread.messageIdHeader,
        references: replyThread.references,
      })
    : null

  const recentSenderConversation = matchedConversationId || !senderEmail
    ? null
    : await prisma.emailConversation.findFirst({
        where: {
          status: 'OPEN',
          lastMessageAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          messages: { some: { direction: 'INBOUND', senderEmail } },
        },
        orderBy: { lastMessageAt: 'desc' },
      })

  const existingConversationId = matchedConversationId || recentSenderConversation?.id
  const conversation = existingConversationId
    ? await prisma.emailConversation.findUnique({ where: { id: existingConversationId } })
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
      attachments: receivedEmail.attachments,
      provider: 'RESEND',
      providerMessageId,
      messageIdHeader: replyThread.messageIdHeader || null,
      inReplyTo: replyThread.inReplyTo || null,
      references: replyThread.references || null,
      status: 'RECEIVED',
      isRead: false,
      processedAt: new Date(receivedEmail.created_at),
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
    isNew: true,
    senderEmail,
    subject,
  }
}
