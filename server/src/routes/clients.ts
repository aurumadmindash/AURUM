import express from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireRole } from '../middleware/roleCheck'
import { createClientRecord } from '../services/clientReference'
import { sendClientForwardingEmail } from '../services/emailService'

const router = express.Router()

router.get('/', authenticate, requireRole('ADMIN', 'COMMERCIAL_MANAGER'), async (_req: AuthRequest, res): Promise<void> => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { projects: true } } },
    })
    res.json(clients)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/',
  authenticate,
  requireRole('ADMIN', 'COMMERCIAL_MANAGER'),
  body('clientName').optional().trim(),
  body('companyName').optional().trim(),
  body('companyEmail').optional().isEmail().withMessage('Company email must be valid'),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    try {
      const client = await createClientRecord({
        clientName: req.body.clientName || req.body.companyName || null,
        companyName: req.body.companyName || null,
        companyEmail: req.body.companyEmail || null,
        companyWebsite: req.body.companyWebsite || null,
        companyLogo: req.body.companyLogo || null,
        phone: req.body.phone || null,
        notes: req.body.notes || null,
      })
      res.status(201).json(client)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.get('/:clientId', authenticate, requireRole('ADMIN', 'COMMERCIAL_MANAGER'), async (req: AuthRequest, res): Promise<void> => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.clientId },
      include: {
        projects: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, clientName: true, companyName: true, contractType: true, isActive: true, createdAt: true },
        },
        emailLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, subject: true, recipientEmail: true, status: true, createdAt: true },
        },
      },
    })

    if (!client) { res.status(404).json({ message: 'Client not found' }); return }
    res.json(client)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.put('/:clientId',
  authenticate,
  requireRole('ADMIN', 'COMMERCIAL_MANAGER'),
  body('clientName').optional().trim(),
  body('companyName').optional().trim(),
  body('companyEmail').optional().isEmail().withMessage('Company email must be valid'),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    try {
      const client = await prisma.client.update({
        where: { id: req.params.clientId },
        data: {
          clientName: req.body.clientName ?? undefined,
          companyName: req.body.companyName ?? undefined,
          companyEmail: req.body.companyEmail ?? undefined,
          companyWebsite: req.body.companyWebsite ?? undefined,
          companyLogo: req.body.companyLogo ?? undefined,
          phone: req.body.phone ?? undefined,
          notes: req.body.notes ?? undefined,
        },
      })
      res.json(client)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.post('/:clientId/forward',
  authenticate,
  requireRole('ADMIN', 'COMMERCIAL_MANAGER'),
  body('subject').notEmpty().trim(),
  body('body').notEmpty().trim(),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    try {
      const client = await prisma.client.findUnique({ where: { id: req.params.clientId } })
      if (!client) { res.status(404).json({ message: 'Client not found' }); return }

      const projectId = req.body.projectId || undefined
      if (projectId) {
        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } })
        if (!project || project.clientId !== client.id) {
          res.status(400).json({ message: 'Selected project is not associated with this client' })
          return
        }
      }

      const recipientEmail = client.companyEmail || ''
      if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        res.status(400).json({ message: 'This client does not have a valid email address stored.' })
        return
      }

      const response = await sendClientForwardingEmail({
        to: recipientEmail,
        subject: req.body.subject,
        text: req.body.body,
      })

      const emailLog = await prisma.clientEmailLog.create({
        data: {
          clientId: client.id,
          projectId: projectId || null,
          sentBy: req.user!.id,
          recipientEmail,
          subject: req.body.subject,
          body: req.body.body,
          status: 'SENT',
          messageId: response.messageId || null,
        },
      })

      res.status(201).json({ client, emailLog, message: 'Email sent successfully.' })
    } catch (error: any) {
      const message = error?.message || 'Server error'
      const client = await prisma.client.findUnique({ where: { id: req.params.clientId } })
      if (client) {
        await prisma.clientEmailLog.create({
          data: {
            clientId: client.id,
            projectId: req.body.projectId || null,
            sentBy: req.user?.id || null,
            recipientEmail: client.companyEmail || '',
            subject: req.body.subject || 'Client forwarding failed',
            body: req.body.body || '',
            status: 'FAILED',
            errorMessage: message,
          },
        }).catch(() => undefined)
      }
      res.status(500).json({ message })
    }
  },
)

export default router
