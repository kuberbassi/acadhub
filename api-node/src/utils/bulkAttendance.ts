import { randomUUID } from 'node:crypto'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../config/prisma.js'

export type BulkMarkClass = { subject_id: string; type: string }

type BulkMarkInput = {
  userId: string
  date: string
  semester: number
  status: 'present' | 'absent' | 'approved_medical' | 'cancelled'
  classes: BulkMarkClass[]
  ip?: string | null
  userAgent?: string | null
}

/**
 * Marks a completely empty date in one statement. The eligibility check,
 * inserts, subject counters, and audit event share the same PostgreSQL command,
 * so a race cannot produce a partially bulk-marked date.
 */
export async function markAllAttendanceAtomic(input: BulkMarkInput) {
  const rows = input.classes.map(item => ({ ...item, id: randomUUID() }))
  const activityId = randomUUID()
  const result = await prisma.$queryRaw<Array<{ activity_id: string; inserted_count: bigint }>>(Prisma.sql`
    WITH requested AS (
      SELECT x."id", x."subject_id", x."type"
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        AS x("id" text, "subject_id" text, "type" text)
    ),
    valid_requested AS (
      SELECT r.*, s."name" AS "subject_name"
      FROM requested r
      JOIN "subjects" s ON s."id" = r."subject_id" AND s."user_id" = ${input.userId}
    ),
    eligibility AS (
      SELECT
        (SELECT COUNT(*) FROM requested) AS requested_count,
        (SELECT COUNT(*) FROM valid_requested) AS valid_count,
        NOT EXISTS (
          SELECT 1 FROM "attendance_logs" l
          LEFT JOIN "subjects" ls ON ls."id" = l."subject_id"
          WHERE l."user_id" = ${input.userId}
            AND l."date" = ${input.date}
            AND (l."semester" = ${input.semester} OR (l."semester" IS NULL AND ls."semester" = ${input.semester}))
        ) AS date_is_empty
    ),
    inserted AS (
      INSERT INTO "attendance_logs" (
        "id", "user_id", "subject_id", "subject_name", "date", "status", "type", "semester", "notes", "timestamp"
      )
      SELECT v."id", ${input.userId}, v."subject_id", v."subject_name", ${input.date},
        ${input.status}, v."type", ${input.semester}, '', CURRENT_TIMESTAMP
      FROM valid_requested v CROSS JOIN eligibility e
      WHERE e.date_is_empty AND e.requested_count > 0 AND e.requested_count = e.valid_count
      RETURNING "subject_id"
    ),
    attendance_deltas AS (
      SELECT "subject_id", COUNT(*)::integer AS amount FROM inserted GROUP BY "subject_id"
    ),
    updated_subjects AS (
      UPDATE "subjects" s
      SET "total" = s."total" + CASE WHEN ${input.status} = 'cancelled' THEN 0 ELSE d.amount END,
          "attended" = s."attended" + CASE WHEN ${input.status} IN ('present', 'approved_medical') THEN d.amount ELSE 0 END,
          "updated_at" = CURRENT_TIMESTAMP
      FROM attendance_deltas d
      WHERE s."id" = d."subject_id"
      RETURNING s."id"
    ),
    activity AS (
      INSERT INTO "system_logs" ("id", "user_id", "action", "description", "ip", "user_agent", "timestamp")
      SELECT ${activityId}, ${input.userId}, 'Attendance Bulk Marked',
        ${`Marked all scheduled classes as ${input.status} on ${input.date}`},
        ${input.ip ?? null}, ${input.userAgent ?? null}, CURRENT_TIMESTAMP
      FROM eligibility e
      WHERE e.date_is_empty AND e.requested_count > 0 AND e.requested_count = e.valid_count
        AND (SELECT COUNT(*) FROM inserted) = e.requested_count
      RETURNING "id"
    )
    SELECT a."id" AS activity_id, (SELECT COUNT(*) FROM inserted) AS inserted_count
    FROM activity a
  `)

  if (result.length === 0) {
    const existingCount = await prisma.attendanceLog.count({
      where: {
        user_id: input.userId,
        date: input.date,
        OR: [{ semester: input.semester }, { semester: null, subject: { semester: input.semester } }],
      },
    })
    const error = new Error(existingCount > 0 ? 'BULK_DATE_NOT_EMPTY' : 'BULK_CLASSES_INVALID') as Error & { code: string }
    error.code = existingCount > 0 ? 'BULK_DATE_NOT_EMPTY' : 'BULK_CLASSES_INVALID'
    throw error
  }

  return { activity_id: result[0].activity_id, marked_count: Number(result[0].inserted_count) }
}
