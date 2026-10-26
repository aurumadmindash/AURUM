import prisma from '../config/database'

const buildClientReference = (sequence: number) => `AUR-CLI-${String(sequence).padStart(4, '0')}`

export async function generateClientReference(): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const seed = await tx.clientReferenceSequence.findUnique({ where: { id: 'client_reference_seed' } })
    const nextValue = seed ? seed.nextValue : 1

    if (seed) {
      await tx.clientReferenceSequence.update({
        where: { id: 'client_reference_seed' },
        data: { nextValue: nextValue + 1 },
      })
    } else {
      await tx.clientReferenceSequence.create({
        data: { id: 'client_reference_seed', nextValue: 2 },
      })
    }

    return buildClientReference(nextValue)
  }, { isolationLevel: 'Serializable' })
}

export async function createClientRecord(data: {
  clientName?: string | null
  companyName?: string | null
  companyEmail?: string | null
  companyWebsite?: string | null
  companyLogo?: string | null
  phone?: string | null
  notes?: string | null
}) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reference = await generateClientReference()
    try {
      return await prisma.client.create({
        data: {
          reference,
          clientName: data.clientName || data.companyName || null,
          companyName: data.companyName || null,
          companyEmail: data.companyEmail || null,
          companyWebsite: data.companyWebsite || null,
          companyLogo: data.companyLogo || null,
          phone: data.phone || null,
          notes: data.notes || null,
        },
      })
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error
    }
  }

  throw new Error('Unable to create a client record with a unique reference')
}
