import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn(), project: vi.fn(), users: vi.fn() }))
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }))
vi.mock('../../config/database', () => ({ default: { project: { findUnique: mocks.project }, user: { findMany: mocks.users } } }))
import { notifyContractEvent, notifyBusinessChange, sendPasswordResetEmail, sendQuoteReceivedEmail } from '../emailService'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SMTP_USER', 'resend')
  vi.stubEnv('SMTP_PASS', 'test-key')
  vi.stubEnv('SMTP_FROM', 'contact@aurumite.com')
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail })
  mocks.sendMail.mockResolvedValue({ accepted: ['owner@example.com'] })
})

describe('project email delivery', () => {
  it('acknowledges receipt and review of a tender in both HTML and plain text', async () => {
    await sendQuoteReceivedEmail('sender@example.com', 'Client & team', 'Site <tender>')
    const message = mocks.sendMail.mock.calls[0][0]
    expect(message.to).toBe('sender@example.com')
    expect(message.subject).toContain('Tender received')
    expect(message.text).toContain('Our team is reviewing')
    expect(message.html).toContain('Client &amp; team')
    expect(message.html).toContain('Your tender has been received')
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
