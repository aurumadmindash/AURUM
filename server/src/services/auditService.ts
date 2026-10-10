import prisma from '../config/database'
import { notifyContractEvent } from './emailService'

interface AuditEntry {
  userId: string
  projectId?: string
  entityType: string
  entityId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'EXPORT'
  changes?: Record<string, { old: unknown; new: unknown }>
  ipAddress?: string
  userAgent?: string
}

export const logAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        projectId: entry.projectId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        changes: entry.changes as object | undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }

  const labels: Record<string, string> = {
    Project: 'Project', EarlyWarning: 'Early warning', CompensationEvent: 'Compensation event',
    Notice: 'Notice', RiskItem: 'Risk', Document: 'Document', ProjectMember: 'Project membership',
  }
  const label = labels[entry.entityType]
  const hasCreationEmail = ['EarlyWarning', 'CompensationEvent', 'Notice'].includes(entry.entityType)
  if (!entry.projectId || !label || entry.action === 'EXPORT' || (entry.action === 'CREATE' && hasCreationEmail)) return

  try {
    const actor = await prisma.user.findUnique({ where: { id: entry.userId }, select: { name: true } })
    const action = entry.action === 'CREATE' ? 'created' : entry.action === 'DELETE' ? 'deleted' : 'updated'
    const fields: Array<[string, string]> = [['Changed by', actor?.name ?? 'Project team member'], ['Action', action]]
    const status = entry.changes?.status
    if (status) fields.push(['Status', `${String(status.old)} → ${String(status.new)}`])
    await notifyContractEvent({
      projectId: entry.projectId,
      heading: `${label} ${action}`,
      reference: label,
      subject: `${label} ${action} in your project`,
      fields,
      note: 'Open Aurum to review the project record and its audit history.',
    })
  } catch (err) {
    // Saving a record must remain successful when the email provider is unavailable.
    console.error('Project change email failed:', err)
  }
}

export const diffObjects = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> | undefined => {
  const changes: Record<string, { old: unknown; new: unknown }> = {}
  // Only diff fields present in the update - fields the caller didn't touch
  // must not appear in the audit trail as changes.
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { old: before[key], new: after[key] }
    }
  }
  return Object.keys(changes).length > 0 ? changes : undefined
}
