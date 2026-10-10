import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ create: vi.fn(), user: vi.fn(), notify: vi.fn() }))
vi.mock('../../config/database', () => ({ default: { auditLog: { create: mocks.create }, user: { findUnique: mocks.user } } }))
vi.mock('../emailService', () => ({ notifyContractEvent: mocks.notify }))
import { logAudit } from '../auditService'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ name: 'Owner' })
  mocks.notify.mockResolvedValue(undefined)
})
const entry = { userId: 'owner', projectId: 'site', entityType: 'EarlyWarning', entityId: 'ew', action: 'UPDATE' as const }
describe('change notification coverage', () => {
  it('sends an email for an early-warning edit', async () => {
    await logAudit(entry)
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ heading: 'Early warning updated', projectId: 'site' }))
  })
  it('does not duplicate existing creation emails or notify about exports or restricted comments', async () => {
    await logAudit({ ...entry, action: 'CREATE' })
    await logAudit({ ...entry, action: 'EXPORT' })
    await logAudit({ ...entry, entityType: 'Comment' })
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it('keeps the save successful if the email provider fails', async () => {
    mocks.notify.mockRejectedValue(new Error('SMTP unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(logAudit(entry)).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('Project change email failed:', expect.any(Error))
    log.mockRestore()
  })
})
