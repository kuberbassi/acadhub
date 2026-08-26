import { randomUUID } from 'node:crypto'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../config/prisma.js'

type SubjectActivityUpdate = {
  subjectId: string
  expectedUpdatedAt: Date
  updateData: Record<string, unknown>
  userId: string
  action: string
  description: string
  ip?: string | null
  userAgent?: string | null
}

const jsonValue = (value: unknown) => Prisma.sql`${JSON.stringify(value)}::jsonb`

function updateFragment(key: string, value: unknown) {
  switch (key) {
    case 'name': return Prisma.sql`"name" = ${value as string}`
    case 'semester': return Prisma.sql`"semester" = ${value as number}`
    case 'categories': return Prisma.sql`"categories" = ${value as string[]}`
    case 'type': return Prisma.sql`"type" = ${value as string}`
    case 'code': return Prisma.sql`"code" = ${value as string}`
    case 'professor': return Prisma.sql`"professor" = ${value as string}`
    case 'classroom': return Prisma.sql`"classroom" = ${value as string}`
    case 'credits': return Prisma.sql`"credits" = ${value as number | null}`
    case 'syllabus': return Prisma.sql`"syllabus" = ${value as string | null}`
    case 'target': return Prisma.sql`"target" = ${value as number}`
    case 'attended': return Prisma.sql`"attended" = ${value as number}`
    case 'total': return Prisma.sql`"total" = ${value as number}`
    case 'practicals': return Prisma.sql`"practicals" = ${jsonValue(value)}`
    case 'assignments': return Prisma.sql`"assignments" = ${jsonValue(value)}`
    default: throw new Error(`Unsupported subject update field: ${key}`)
  }
}

/** Atomically applies a guarded subject update and inserts its audit event. */
export async function updateSubjectWithActivityAtomic(input: SubjectActivityUpdate) {
  const fragments = Object.entries(input.updateData).map(([key, value]) => updateFragment(key, value))
  if (fragments.length === 0) throw new Error('Subject update cannot be empty')

  const activityId = randomUUID()
  const activityRows = await prisma.$queryRaw<Array<{ id: string; timestamp: Date }>>(Prisma.sql`
    WITH updated AS (
      UPDATE "subjects"
      SET ${Prisma.join(fragments, ', ')}, "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.subjectId} AND "updated_at" = ${input.expectedUpdatedAt}
      RETURNING "id"
    )
    INSERT INTO "system_logs" ("id", "user_id", "action", "description", "ip", "user_agent", "timestamp")
    SELECT ${activityId}, ${input.userId}, ${input.action}, ${input.description}, ${input.ip ?? null}, ${input.userAgent ?? null}, CURRENT_TIMESTAMP
    FROM updated
    RETURNING "id", "timestamp"
  `)

  if (activityRows.length === 0) {
    const staleError = new Error('Subject was updated by another request') as Error & { code: string }
    staleError.code = 'P2025'
    throw staleError
  }
  const updatedSubject = await prisma.subject.findUniqueOrThrow({ where: { id: input.subjectId } })
  return [updatedSubject, activityRows[0]] as const
}
