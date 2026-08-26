const CUID_TIMESTAMP_LENGTH = 8

export function instantFromCuid(id: string): Date | null {
  if (!/^c[0-9a-z]{24}$/i.test(id)) return null
  const milliseconds = Number.parseInt(id.slice(1, 1 + CUID_TIMESTAMP_LENGTH), 36)
  if (!Number.isFinite(milliseconds)) return null
  const value = new Date(milliseconds)
  return Number.isNaN(value.getTime()) ? null : value
}

/** Corrects legacy timezone-less Prisma values using the CUID's UTC clock. */
export function normalizeLegacyPrismaInstant(id: string, value: Date): Date {
  const createdAt = instantFromCuid(id)
  if (!createdAt) return value
  const offset = value.getTime() - createdAt.getTime()
  const roundedOffset = Math.round(offset / 60_000) * 60_000
  return Math.abs(offset - roundedOffset) <= 1_000 && Math.abs(roundedOffset) <= 14 * 60 * 60 * 1000
    ? new Date(value.getTime() - roundedOffset)
    : value
}

export function normalizeRelatedInstant(id: string, reference: Date, value: Date | null): Date | null {
  if (!value) return null
  const createdAt = instantFromCuid(id)
  if (!createdAt) return value
  const offset = Math.round((reference.getTime() - createdAt.getTime()) / 60_000) * 60_000
  return Math.abs(offset) <= 14 * 60 * 60 * 1000 ? new Date(value.getTime() - offset) : value
}
