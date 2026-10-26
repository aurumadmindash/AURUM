import nodemailer from 'nodemailer'
import prisma from '../config/database'

// SMTP provider. Production uses Resend (smtp.resend.com); local dev may use
// anything else. Port 465 speaks implicit TLS; 587 uses STARTTLS, which needs
// secure:false — so the flag is derived from the port, never hardcoded.
function mailTransport() {
  const SMTP_PORT = Number(process.env.SMTP_PORT) || 587
  return nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.resend.com',
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  })
}
const transporter = {
  sendMail: (options: Parameters<ReturnType<typeof mailTransport>['sendMail']>[0]) => mailTransport().sendMail(options),
}

const emailConfigured = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
    throw new Error('Email is not configured: set SMTP_USER, SMTP_PASS and SMTP_FROM in Vercel.')
  }
  return true
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// With Resend the SMTP username is the literal string "resend" and the password
// is an API key, so the sender address cannot be derived from SMTP_USER.
// SMTP_FROM carries the verified sender (enquiries@aurumite.com);
// falling back to SMTP_USER keeps Gmail-style setups working unchanged.
const FROM = () => {
  const sender = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim()
  return sender.includes('<') ? sender : `"Aurum Project Controls" <${sender}>`
}

// Diagnostic helper: sends a plain test message so SMTP problems surface with
// the provider's exact error instead of dying silently inside a
// fire-and-forget notification. Used by scripts/check-email.ts and the
// CRON_SECRET-guarded /api/health/email diagnostic endpoint.
export async function sendTestEmail(to: string) {
  if (!emailConfigured()) {
    throw new Error('SMTP not configured - set SMTP_USER and SMTP_PASS')
  }
  const info = await transporter.sendMail({
    from: FROM(),
    to,
    subject: 'Aurum - test email',
    text: `SMTP test sent ${new Date().toISOString()} from ${FROM()}`,
    html: shell(
      `<h3 style="color:#080F1C;font-size:18px;margin:0 0 8px">It works</h3>` +
      `<p style="color:#6B7280;margin:0;font-size:14px">Test email sent at ${new Date().toISOString()}. Invitations, password resets and deadline alerts will arrive from this address too.</p>`,
    ),
  })
  return { messageId: info.messageId, response: info.response, accepted: info.accepted, rejected: info.rejected }
}

export async function sendClientForwardingEmail({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}) {
  if (!emailConfigured()) {
    throw new Error('SMTP not configured - set SMTP_USER and SMTP_PASS')
  }

  const info = await transporter.sendMail({
    from: FROM(),
    to,
    subject,
    text,
    html: shell(`
      <h3 style="color:#080F1C;font-size:18px;margin:0 0 12px">Message from Aurum</h3>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 16px">${escapeHtml(text).replace(/\n/g, '<br />')}</p>
      <p style="color:#64748B;font-size:12px;margin:0">Sent by Aurum Project Controls</p>
    `),
  })

  return {
    messageId: info.messageId,
    response: info.response,
    accepted: info.accepted,
    rejected: info.rejected,
  }
}

export async function sendThreadedReplyEmail({
  to,
  subject,
  text,
  inReplyTo,
  references,
}: {
  to: string
  subject: string
  text: string
  inReplyTo?: string | null
  references?: string | null
}) {
  if (!emailConfigured()) {
    throw new Error('SMTP not configured - set SMTP_USER and SMTP_PASS')
  }

  const headers: Record<string, string> = {}
  if (inReplyTo) headers['In-Reply-To'] = inReplyTo
  if (references) headers.References = references

  const info = await transporter.sendMail({
    from: FROM(),
    to,
    subject,
    text,
    headers,
    html: shell(`
      <h3 style="color:#080F1C;font-size:18px;margin:0 0 12px">Reply from Aurum</h3>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 16px">${escapeHtml(text).replace(/\n/g, '<br />')}</p>
      <p style="color:#64748B;font-size:12px;margin:0">This message was sent from Aurum Project Controls.</p>
    `),
  })

  return {
    messageId: info.messageId,
    response: info.response,
    accepted: info.accepted,
    rejected: info.rejected,
  }
}

export async function sendNewInboxMessageAlert({
  sender,
  subject,
  conversationId,
}: {
  sender: string
  subject: string
  conversationId: string
}) {
  if (!emailConfigured()) {
    throw new Error('Email is not configured: set SMTP_USER, SMTP_PASS and SMTP_FROM.')
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { email: true },
  })
  if (!admins.length) return

  const inboxUrl = `${(process.env.CLIENT_URL || 'https://www.aurumite.com').replace(/\/$/, '')}/inbox/${encodeURIComponent(conversationId)}`
  await transporter.sendMail({
    from: FROM(),
    to: admins.map((admin) => admin.email).join(', '),
    subject: `New client email: ${subject}`,
    text: `A new email has arrived in the Aurum inbox.\nFrom: ${sender}\nSubject: ${subject}\n\nOpen the conversation: ${inboxUrl}`,
    html: shell(`
      <h3 style="color:#080F1C;font-size:18px;margin:0 0 12px">New client email received</h3>
      <p style="color:#475569;font-size:14px;line-height:1.6"><strong>From:</strong> ${escapeHtml(sender)}</p>
      <p style="color:#475569;font-size:14px;line-height:1.6"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p style="margin-top:20px"><a href="${escapeHtml(inboxUrl)}" style="background:#080F1C;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open inbox conversation</a></p>
    `),
  })
}

function shell(inner: string): string {
  // Logo is served from the live site; hardcoding the production domain as a
  // fallback keeps the banner branded even in local dev (where CLIENT_URL is
  // localhost). Email clients block remote images until "show images" is
  // clicked, so the banner still reads fine without it.
  const logoUrl = `${(process.env.CLIENT_URL || 'https://aurumite.com').replace(/\/$/, '')}/logo-light.png`
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#080F1C;padding:20px 24px;border-radius:8px 8px 0 0">
        <img src="${logoUrl}" alt="Aurum" width="44" height="44" style="display:block;border:0;border-radius:8px;margin:0 0 10px" />
        <h2 style="color:#FFFFFF;margin:0;font-size:18px">Aurum Project Controls</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px">
        ${inner}
      </div>
    </div>`
}

// Daily NEC deadline clock: alerts for CEs already overdue AND CEs due within 3 days
export async function sendOverdueNotifications() {
  if (!emailConfigured()) return

  const now = new Date()
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const dueCEs = await prisma.compensationEvent.findMany({
    where: {
      status: { not: 'CLOSED' },
      // Completed projects are archived - no more reminder emails
      project: { isActive: true },
      OR: [
        { dateResponseDue: { lt: soon } },
        // cl. 62.3 quotation clock - runs while the CE awaits a quotation
        { status: 'NOTIFIED', dateQuotationDue: { lt: soon } },
      ],
    },
    include: {
      project: { select: { name: true } },
    },
  })

  if (dueCEs.length === 0) return

  const projects = await prisma.project.findMany({
    where: { id: { in: [...new Set(dueCEs.map((ce) => ce.projectId))] } },
    include: { members: { include: { user: { select: { email: true, name: true, notifyContractEvents: true } } } } },
  })

  for (const project of projects) {
    const projectCEs = dueCEs.filter((ce) => ce.projectId === project.id)
    const overdue = projectCEs.filter((ce) => ce.dateResponseDue && ce.dateResponseDue < now && ce.dateResponseDue < soon)
    const dueSoon = projectCEs.filter((ce) => ce.dateResponseDue && ce.dateResponseDue >= now && ce.dateResponseDue < soon)
    const quotationDue = projectCEs.filter((ce) => ce.status === 'NOTIFIED' && ce.dateQuotationDue && ce.dateQuotationDue < soon)
    const recipients = project.members
      .filter((m) => m.role !== 'VIEWER' && m.user.notifyContractEvents)
      .map((m) => m.user.email)

    if (recipients.length === 0) continue

    const rows = (list: typeof projectCEs, color: string, dateOf: (ce: typeof projectCEs[number]) => Date | null) => list.map((ce) => `
      <tr>
        <td style="padding:8px;border:1px solid #E2E8F0;font-size:12px;font-weight:bold">${ce.ceNumber}</td>
        <td style="padding:8px;border:1px solid #E2E8F0;font-size:12px">${ce.title}</td>
        <td style="padding:8px;border:1px solid #E2E8F0;font-size:12px;color:${color}">${dateOf(ce)?.toLocaleDateString('en-GB')}</td>
        <td style="padding:8px;border:1px solid #E2E8F0;font-size:12px">${ce.status}</td>
      </tr>`).join('')

    const table = (title: string, list: typeof projectCEs, color: string, dateOf: (ce: typeof projectCEs[number]) => Date | null = (ce) => ce.dateResponseDue) => list.length === 0 ? '' : `
      <h3 style="color:#0F172A;margin-top:16px">${title}</h3>
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#F8FAFC">
          <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;font-size:12px">CE No.</th>
          <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;font-size:12px">Title</th>
          <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;font-size:12px">Due Date</th>
          <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;font-size:12px">Status</th>
        </tr>
        ${rows(list, color, dateOf)}
      </table>`

    await transporter.sendMail({
      from: FROM(),
      to: recipients.join(', '),
      subject: `[ACTION REQUIRED] ${overdue.length} overdue / ${dueSoon.length + quotationDue.length} due soon - ${project.name}`,
      html: shell(`
        ${table(`⚠️ Overdue Compensation Events - ${project.name}`, overdue, '#DC2626')}
        ${table('⏳ Response due within 3 days', dueSoon, '#D97706')}
        ${table('📋 Quotation due (NEC cl. 62.3)', quotationDue, '#B45309', (ce) => ce.dateQuotationDue)}
        <p style="margin-top:20px"><a href="${process.env.CLIENT_URL}" style="background:#B45309;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">Open Aurum Project Controls</a></p>
      `),
    })
  }
}

export async function sendCEStatusChangeNotification(
  ceNumber: string,
  ceTitle: string,
  projectName: string,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  recipientEmails: string[],
) {
  if (!emailConfigured() || recipientEmails.length === 0) return

  await transporter.sendMail({
    from: FROM(),
    to: recipientEmails.join(', '),
    subject: `CE Status Update: ${ceNumber} → ${newStatus} - ${projectName}`,
    html: shell(`
      <h3>${ceNumber} status updated</h3>
      <p><strong>Project:</strong> ${projectName}</p>
      <p><strong>CE:</strong> ${ceTitle}</p>
      <p><strong>Status change:</strong> <span style="color:#64748B">${oldStatus}</span> → <span style="color:#16A34A;font-weight:bold">${newStatus}</span></p>
      <p><strong>Changed by:</strong> ${changedBy}</p>
    `),
  })
}

export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  projectName: string,
  role: string,
  inviteUrl: string,
) {
  if (!emailConfigured()) return

  await transporter.sendMail({
    from: FROM(),
    to: email,
    subject: `You've been invited to ${projectName} - Aurum Project Controls`,
    html: shell(`
      <h3 style="color:#080F1C;font-size:20px;margin:0 0 8px">You're invited</h3>
      <p style="color:#6B7280;margin:0 0 24px;font-size:14px">
        <strong>${inviterName}</strong> has invited you to join
        <strong>${projectName}</strong> as a <strong>${role.replace('_', ' ')}</strong>.
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#B45309" style="border-radius:8px"><a href="${inviteUrl}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none">Accept Invitation</a></td></tr></table>
      <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0">
        This invitation expires in 7 days. If you weren't expecting this, you can ignore this email.
      </p>
      <p style="color:#D1D5DB;font-size:11px;margin:8px 0 0">
        Or copy this link: ${inviteUrl}
      </p>
    `),
  })
}

// Contract events are legally significant - an unnoticed one costs money - so
// these go to every project member who hasn't opted out.
export async function notifyContractEvent(opts: {
  projectId: string
  excludeUserId?: string
  heading: string
  reference: string
  subject: string
  fields: Array<[string, string]>
  note?: string
}) {
  if (!emailConfigured()) return

  const project = await prisma.project.findUnique({
    where: { id: opts.projectId },
    include: { members: { include: { user: { select: { id: true, email: true, isActive: true, notifyContractEvents: true } } } } },
  })
  if (!project) return

  const recipients = project.members
    .filter((m) => m.user.id !== opts.excludeUserId && m.user.isActive && m.user.notifyContractEvents)
    .map((m) => m.user.email)
  if (recipients.length === 0) return

  const rows = opts.fields.map(([label, value]) => `
    <tr>
      <td style="padding:6px 12px 6px 0;font-size:13px;color:#6B7280;white-space:nowrap">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:13px;color:#0F1F4B;font-weight:bold">${escapeHtml(value || '-')}</td>
    </tr>`).join('')

  await transporter.sendMail({
    from: FROM(),
    to: recipients.join(', '),
    subject: `${opts.heading}: ${opts.reference} - ${project.name}`,
    html: shell(`
      <h3 style="color:#080F1C;font-size:18px;margin:0 0 4px">${escapeHtml(opts.heading)}</h3>
      <p style="color:#6B7280;margin:0 0 16px;font-size:13px">${escapeHtml(project.name)}</p>
      <p style="font-size:15px;color:#0F1F4B;font-weight:bold;margin:0 0 12px">${escapeHtml(opts.subject)}</p>
      <table style="border-collapse:collapse">${rows}</table>
      ${opts.note ? `<p style="color:#B45309;font-size:13px;margin-top:16px">${escapeHtml(opts.note)}</p>` : ''}
      <p style="margin-top:20px">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#B45309" style="border-radius:8px">
          <a href="${process.env.CLIENT_URL}" target="_blank" style="display:inline-block;padding:11px 26px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none">Open Aurum</a>
        </td></tr></table>
      </p>
    `),
  })
}

// Activity notification: someone commented on the project or a record in it
export async function sendCommentNotification(opts: {
  recipients: string[]
  projectName: string
  on: string
  authorName: string
  body: string
}) {
  if (!emailConfigured() || opts.recipients.length === 0) return

  const excerpt = opts.body.length > 600 ? `${opts.body.slice(0, 600)}…` : opts.body
  const escaped = excerpt
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  await transporter.sendMail({
    from: FROM(),
    to: opts.recipients.join(', '),
    subject: `New comment on ${opts.on} - ${opts.projectName}`,
    html: shell(`
      <h3 style="color:#080F1C;font-size:18px;margin:0 0 4px">New comment</h3>
      <p style="color:#6B7280;margin:0 0 16px;font-size:13px">
        <strong>${opts.authorName}</strong> commented on <strong>${opts.on}</strong> in ${opts.projectName}.
      </p>
      <div style="border-left:3px solid #B45309;background:#F8FAFC;padding:12px 16px;color:#334155;font-size:14px;line-height:1.5">
        ${escaped}
      </div>
      <p style="margin-top:20px">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#B45309" style="border-radius:8px">
          <a href="${process.env.CLIENT_URL}" target="_blank" style="display:inline-block;padding:11px 26px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none">Open Aurum</a>
        </td></tr></table>
      </p>
    `),
  })
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  if (!emailConfigured()) return

  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${token}`
  await transporter.sendMail({
    from: FROM(),
    to: email,
    subject: 'Reset your password - Aurum Project Controls',
    html: shell(`
      <h3 style="color:#080F1C;font-size:20px;margin:0 0 8px">Password reset</h3>
      <p style="color:#6B7280;margin:0 0 24px;font-size:14px">
        Hi ${name}, we received a request to reset your password. This link expires in 1 hour.
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#B45309" style="border-radius:8px"><a href="${resetUrl}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none">Reset Password</a></td></tr></table>
      <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0">
        If you didn't request this, you can safely ignore this email - your password will not change.
      </p>
      <p style="color:#D1D5DB;font-size:11px;margin:8px 0 0">
        Or copy this link: ${resetUrl}
      </p>
    `),
  })
}

export async function sendQuoteReceivedEmail(to: string, clientName: string, projectName: string) {
  if (!emailConfigured()) return
  await transporter.sendMail({
    from: FROM(), to,
    subject: `Tender received - ${projectName} - Aurum`,
    text: `Hi ${clientName},\n\nWe have received your tender submission for ${projectName}, including any documents you uploaded. Our team is reviewing your information and will contact you with the next steps, scope, programme and proposed fee.\n\nThank you,\nAurum Project Controls\nenquiries@aurumite.com`,
    html: shell(`
      <h3 style="color:#080F1C;font-size:20px;margin:0 0 8px">Your tender has been received</h3>
      <p style="color:#475569;font-size:14px;line-height:1.6">Hi ${escapeHtml(clientName)}, thank you for sending your tender for <strong>${escapeHtml(projectName)}</strong>. We have received your information and any documents you uploaded. Our team is reviewing your submission.</p>
      <p style="color:#475569;font-size:14px;line-height:1.6">We will review the scope, programme and information supplied and come back to you with the agreed deliverables, programme and fixed fee.</p>
    `),
  })
}

export async function notifyBusinessChange(heading: string, projectName: string, reference: string) {
  emailConfigured()
  const users = await prisma.user.findMany({
    where: { isActive: true, notifyContractEvents: true, role: { in: ['ADMIN', 'COMMERCIAL_MANAGER'] } },
    select: { email: true },
  })
  if (!users.length) return
  await transporter.sendMail({
    from: FROM(), to: users.map((user) => user.email).join(', '),
    subject: `${heading} - ${projectName}`,
    html: shell(`<h3>${escapeHtml(heading)}</h3><p>${escapeHtml(projectName)}</p><p>Reference: ${escapeHtml(reference)}</p><p>Open the Aurum Jobs dashboard to review the saved changes.</p>`),
  })
}

export async function sendAccountApprovalEmail(user: { id: string; name: string; email: string; createdAt: Date }) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { email: true },
  })
  if (!admins.length) return
  emailConfigured()
  const reviewUrl = `${(process.env.CLIENT_URL || 'https://aurumite.com').replace(/\/$/, '')}/admin/users`
  const registeredAt = user.createdAt.toISOString()
  await transporter.sendMail({
    from: FROM(), to: admins.map(admin => admin.email),
    subject: `Account awaiting approval - ${user.name}`,
    text: [
      'A new account is awaiting administrator approval.', `Name: ${user.name}`, `Email: ${user.email}`,
      `Registered (UTC): ${registeredAt}`, `Account reference: ${user.id}`,
      '', 'This person cannot sign in until an administrator approves the account.',
      `Review and approve in Aurum: ${reviewUrl}`,
    ].join('\n'),
    html: shell(`
      <h3 style="color:#080F1C;font-size:20px;margin:0 0 12px">Account awaiting approval</h3>
      <p style="font-size:14px;line-height:1.6">A new account has been created and requires administrator approval.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:5px 18px 5px 0;color:#64748B">Name</td><td>${escapeHtml(user.name)}</td></tr>
        <tr><td style="padding:5px 18px 5px 0;color:#64748B">Email</td><td>${escapeHtml(user.email)}</td></tr>
        <tr><td style="padding:5px 18px 5px 0;color:#64748B">Registered (UTC)</td><td>${registeredAt}</td></tr>
        <tr><td style="padding:5px 18px 5px 0;color:#64748B">Account reference</td><td>${escapeHtml(user.id)}</td></tr>
      </table>
      <p style="font-size:14px;line-height:1.6">This person cannot sign in until an administrator approves the account.</p>
      <p><a href="${escapeHtml(reviewUrl)}" style="color:#0F1F4B">Review the account in Aurum Users</a></p>
    `),
  })
}

export async function sendQuoteInternalEmail(opts: {
  id: string; name: string; company: string; email: string; telephone?: string | null;
  projectName: string; projectLocation?: string | null; service: string; tenderDeadline?: Date | null;
  briefDescription?: string | null;
  documents: { name: string; kind: string; mimeType: string; data: Buffer }[];
}) {
  if (!emailConfigured()) return
  const to = process.env.SALES_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER
  if (!to) return
  const serviceNames: Record<string, string> = {
    TAKE_OFF: 'Quantity take-off', ESTIMATE: 'Tender estimate', TENDER_SUPPORT: 'Tender support',
    COMMERCIAL_SUPPORT: 'Commercial support', BOQ: 'Bill of Quantities', VARIATION: 'Variation', VALUATION: 'Valuation', OTHER: 'Other',
  }
  const kindNames: Record<string, string> = { drawings: 'Drawing', specification: 'Specification', boq: 'Bill of Quantities' }
  const deadline = opts.tenderDeadline ? opts.tenderDeadline.toLocaleDateString('en-GB', { timeZone: 'UTC' }) : 'Not supplied'
  const fields: [string, string][] = [
    ['Client', opts.name], ['Company', opts.company], ['Email', opts.email],
    ['Telephone', opts.telephone || 'Not supplied'], ['Project', opts.projectName],
    ['Project location', opts.projectLocation || 'Not supplied'],
    ['Service', serviceNames[opts.service] || opts.service], ['Tender deadline', deadline],
  ]
  const brief = opts.briefDescription || 'Not supplied'
  const documentList = opts.documents.map(document => `${kindNames[document.kind] || document.kind}: ${document.name}`)
  const jobUrl = `${(process.env.CLIENT_URL || 'https://aurumite.com').replace(/\/$/, '')}/jobs/${encodeURIComponent(opts.id)}`
  await transporter.sendMail({
    from: FROM(), to,
    replyTo: opts.email,
    subject: `New Aurum quote request - ${opts.projectName}`,
    text: [
      'New project enquiry', ...fields.map(([label, value]) => `${label}: ${value}`),
      '', 'Project description:', brief, '',
      'Documents:', documentList.length ? documentList.join('\n') : 'None uploaded',
      '', ...(documentList.length ? ['Uploaded documents are attached to this email.'] : []),
      `Quote request ID: ${opts.id}`, `View saved submission: ${jobUrl}`,
    ].join('\n'),
    attachments: opts.documents.map(document => ({
      filename: document.name.split(/[\\/]/).pop() || 'document',
      content: document.data, contentType: document.mimeType,
    })),
    html: shell(`
      <h3 style="color:#080F1C;font-size:20px;margin:0 0 12px">New project enquiry</h3>
      <table style="border-collapse:collapse;font-size:14px">
        ${fields.map(([label, value]) => `<tr><td style="padding:5px 18px 5px 0;color:#64748B;vertical-align:top">${label}</td><td>${escapeHtml(value)}</td></tr>`).join('')}
      </table>
      <h4 style="margin:20px 0 8px">Project description</h4>
      <p style="font-size:14px;line-height:1.6">${escapeHtml(brief).replace(/\n/g, '<br>')}</p>
      <h4 style="margin:20px 0 8px">Documents</h4>
      ${documentList.length ? `<ul style="font-size:14px;line-height:1.6">${documentList.map(document => `<li>${escapeHtml(document)}</li>`).join('')}</ul><p style="font-size:14px">The uploaded files are attached to this email.</p>` : '<p style="font-size:14px">None uploaded.</p>'}
      <p style="margin-top:18px;color:#64748B;font-size:12px">Quote request ID: ${escapeHtml(opts.id)}</p>
      <p><a href="${escapeHtml(jobUrl)}" style="color:#0F1F4B">View the saved submission in Aurum Jobs</a></p>
    `),
  })
}
