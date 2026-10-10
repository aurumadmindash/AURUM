interface DbErrorShape {
  code?: string
  name?: string
  message?: string
}

// Operator-facing hints for the Prisma error codes that carry enough meaning
// on their own; anything else falls through to the error's own text.
const CODE_HINTS: Record<string, string> = {
  P1000: 'Authentication failed - the password in DATABASE_URL does not match the database.',
  P1001: 'Cannot reach the database server - host/port wrong or project paused.',
  P2021: 'Connected, but tables are missing - migrations have not run.',
}

// PrismaClientInitializationError wraps its cause as
// "Invalid `prisma.$queryRaw()` invocation:\n\n\n<actual reason>" — the first
// line is empty and the second is the wrapper, so both are dropped to reach
// the sentence that explains the failure (missing env var, bad URL, ...).
export function summarizeDbError(e: unknown): { code: string; name: string; hint: string } {
  const err = (e ?? {}) as DbErrorShape
  const code = err.code ?? 'UNKNOWN'
  const name = err.name ?? 'UnknownError'
  const cause = (err.message ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('Invalid `'))
    .join(' ')
    .slice(0, 300)
  return { code, name, hint: CODE_HINTS[code] ?? (cause || name) }
}
