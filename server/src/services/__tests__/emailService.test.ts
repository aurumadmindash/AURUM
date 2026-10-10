import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn(), project: vi.fn(), users: vi.fn() }))
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }))
vi.mock('../../config/database', () => ({ default: { project: { findUnique: mocks.project }, user: { findMany: mocks.users } } }))
import { notifyContractEvent, notifyBusinessChange, sendPasswordResetEmail, sendQuoteReceivedEmail, sendQuoteInternalEmail, sendAccountApprovalEmail } from '../emailService'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SMTP_USER', 'resend')
  vi.stubEnv('SMTP_PASS', 'test-key')
  vi.stubEnv('SMTP_FROM', 'contact@aurumite.com')
  vi.stubEnv('SALES_EMAIL', 'sales@aurumite.com')
  vi.stubEnv('CLIENT_URL', 'https://aurumite.com')
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail })
  mocks.sendMail.mockResolvedValue({ accepted: ['owner@example.com'] })
})

describe('project email delivery', () => {
  it('alerts every active administrator to a pending account with a review link', async () => {
    mocks.users.mockResolvedValue([{ email: 'admin-one@example.com' }, { email: 'admin-two@example.com' }])
    await sendAccountApprovalEmail({ id: 'pending-1', name: 'New <user>', email: 'new@example.com', createdAt: new Date('2026-10-10T12:00:00Z') })
    expect(mocks.users).toHaveBeenCalledWith({ where: { role: 'ADMIN', isActive: true }, select: { email: true } })
    const message = mocks.sendMail.mock.calls[0][0]
    expect(message.to).toEqual(['admin-one@example.com', 'admin-two@example.com'])
    expect(message.subject).toContain('Account awaiting approval')
    expect(message.html).toContain('New &lt;user&gt;')
    expect(message.text).toContain('new@example.com')
    expect(message.text).toContain('2026-10-10T12:00:00.000Z')
    expect(message.text).toContain('cannot sign in until an administrator approves')
    expect(message.html).toContain('https://aurumite.com/admin/users')
    expect(message.text).not.toContain('password')
  })
  it('does not send a pending-account email when there are no active admins', async () => {
    mocks.users.mockResolvedValue([])
    await sendAccountApprovalEmail({ id: 'pending-1', name: 'New user', email: 'new@example.com', createdAt: new Date() })
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
  it.each([
    ['contact@aurumite.com', '"Aurum Project Controls" <contact@aurumite.com>'],
    ['Aurum <contact@aurumite.com>', 'Aurum <contact@aurumite.com>'],
  ])('keeps a valid sender address for %s', async (sender, expected) => {
    vi.stubEnv('SMTP_FROM', sender)
    await sendQuoteReceivedEmail('sender@example.com', 'Client', 'Site')
    expect(mocks.sendMail.mock.calls[0][0].from).toBe(expected)
  })
  it('acknowledges receipt and review of a tender in both HTML and plain text', async () => {
    await sendQuoteReceivedEmail('sender@example.com', 'Client & team', 'Site <tender>')
    const message = mocks.sendMail.mock.calls[0][0]
    expect(message.to).toBe('sender@example.com')
    expect(message.subject).toContain('Tender received')
    expect(message.text).toContain('Our team is reviewing')
    expect(message.html).toContain('Client &amp; team')
    expect(message.html).toContain('Your tender has been received')
  })
  it('sends all tender information and original file bytes to sales with a reply address', async () => {
    const drawing = Buffer.from([0, 255, 10, 20])
    const boq = Buffer.from('spreadsheet bytes')
    await sendQuoteInternalEmail({
      id: 'quote-1', name: 'Client & team', company: '<Company>', email: 'client@example.com',
      telephone: '+44 1234 567890', projectName: 'Project', projectLocation: 'London & area',
      service: 'TENDER_SUPPORT', tenderDeadline: new Date('2026-11-01T00:00:00Z'),
      briefDescription: 'Full scope <details>\nSecond line', documents: [
        { name: 'drawing.pdf', kind: 'drawings', mimeType: 'application/pdf', data: drawing },
        { name: 'costs & quantities.xlsx', kind: 'boq', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: boq },
      ],
    })
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.to).toBe('sales@aurumite.com')
    expect(mail.replyTo).toBe('client@example.com')
    expect(mail.attachments).toEqual([
      { filename: 'drawing.pdf', content: drawing, contentType: 'application/pdf' },
      { filename: 'costs & quantities.xlsx', content: boq, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    ])
    for (const text of ['Client &amp; team', '&lt;Company&gt;', '+44 1234 567890', 'London &amp; area', 'Tender support', '01/11/2026', 'Full scope &lt;details&gt;<br>Second line', 'costs &amp; quantities.xlsx', 'https://aurumite.com/jobs/quote-1']) expect(mail.html).toContain(text)
    expect(mail.text).toContain('Full scope <details>\nSecond line')
    expect(mail.text).toContain('Telephone: +44 1234 567890')
  })
  it('handles tenders without files or optional details without claiming attachments', async () => {
    await sendQuoteInternalEmail({ id: 'quote-1', name: 'Client', company: 'Company', email: 'client@example.com', projectName: 'Project', service: 'ESTIMATE', documents: [] })
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.attachments).toEqual([])
    expect(mail.html).toContain('None uploaded')
    expect(mail.html).toContain('Not supplied')
    expect(mail.text).not.toContain('attached to this email')
  })
  it('restricts business notifications to active opted-in staff', async () => {
    mocks.users.mockResolvedValue([{ email: 'owner@example.com' }])
    await notifyBusinessChange('Job updated', 'Site project', 'job-1')
    expect(mocks.users).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true, notifyContractEvents: true, role: { in: ['ADMIN', 'COMMERCIAL_MANAGER'] } } }))
    expect(mocks.sendMail.mock.calls[0][0].to).toBe('owner@example.com')
  })
  it('notifies the author too and excludes inactive and opted-out members', async () => {
    mocks.project.mockResolvedValue({ name: 'Site & team', members: [
      { user: { id: 'owner', email: 'owner@example.com', isActive: true, notifyContractEvents: true } },
      { user: { id: 'inactive', email: 'inactive@example.com', isActive: false, notifyContractEvents: true } },
      { user: { id: 'quiet', email: 'quiet@example.com', isActive: true, notifyContractEvents: false } },
    ] })
    await notifyContractEvent({ projectId: 'site', heading: 'Updated', reference: 'EW-001', subject: '<subject>', fields: [['Title', '<script>']] })
    const mail = mocks.sendMail.mock.calls[0][0]
    expect(mail.to).toBe('owner@example.com')
    expect(mail.html).toContain('&lt;script&gt;')
    expect(mail.html).toContain('Site &amp; team')
  })

  it('does not finish before the SMTP send completes', async () => {
    let complete!: () => void
    mocks.sendMail.mockReturnValue(new Promise<void>((resolve) => { complete = resolve }))
    let finished = false
    const sending = sendPasswordResetEmail('owner@example.com', 'Owner', 'token').then(() => { finished = true })
    await Promise.resolve()
    expect(finished).toBe(false)
    complete()
    await sending
    expect(finished).toBe(true)
  })

  it('reports missing email configuration instead of claiming delivery', async () => {
    vi.stubEnv('SMTP_FROM', '')
    await expect(sendPasswordResetEmail('owner@example.com', 'Owner', 'token')).rejects.toThrow('SMTP_FROM')
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })

  it('reads SMTP configuration when sending, after environment loading', async () => {
    vi.stubEnv('SMTP_PORT', '465')
    await sendPasswordResetEmail('owner@example.com', 'Owner', 'token')
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true, connectionTimeout: 10000 }))
  })
})
