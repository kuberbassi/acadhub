import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../config/prisma.js'

export async function unmarkAttendanceLogsAtomic(
  userId: string,
  date: string,
  semester: number,
  logIds: string[],
): Promise<{ requested_count: number; deleted_count: number }> {
  const requestedIds = [...new Set(logIds)]
  const rows = await prisma.$queryRaw<Array<{ requested_count: number; deleted_count: number }>>(Prisma.sql`
    WITH requested AS (
      SELECT l.*
      FROM attendance_logs l
      WHERE l.id IN (${Prisma.join(requestedIds)})
        AND l.user_id = ${userId}
        AND l.date = ${date}
        AND (
          l.semester = ${semester}
          OR (
            l.semester IS NULL
            AND EXISTS (
              SELECT 1 FROM subjects s
              WHERE s.id = l.subject_id AND s.semester = ${semester}
            )
          )
        )
    ),
    companions AS (
      SELECT companion.*
      FROM attendance_logs companion
      JOIN requested source
        ON source.status::text = 'substituted'
        AND source.substituted_by = companion.subject_id
      WHERE companion.user_id = ${userId}
        AND companion.date = ${date}
        AND companion.type = 'substitution_class'
    ),
    targets AS (
      SELECT * FROM requested
      UNION
      SELECT * FROM companions
    ),
    deleted AS (
      DELETE FROM attendance_logs l
      WHERE l.id IN (SELECT id FROM targets)
        AND (SELECT COUNT(*) FROM requested) = ${requestedIds.length}
      RETURNING l.subject_id, l.status
    ),
    deltas AS (
      SELECT
        subject_id,
        -SUM(CASE WHEN status::text IN ('present', 'absent', 'late', 'approved_medical', 'medical', 'duty', 'substituted') THEN 1 ELSE 0 END)::int AS total_delta,
        -SUM(CASE WHEN status::text IN ('present', 'late', 'approved_medical', 'medical', 'duty', 'substituted') THEN 1 ELSE 0 END)::int AS attended_delta
      FROM deleted
      GROUP BY subject_id
    ),
    updated_subjects AS (
      UPDATE subjects s
      SET
        total = s.total + d.total_delta,
        attended = s.attended + d.attended_delta
      FROM deltas d
      WHERE s.id = d.subject_id
      RETURNING s.id
    )
    SELECT
      (SELECT COUNT(*) FROM requested)::int AS requested_count,
      (SELECT COUNT(*) FROM deleted)::int AS deleted_count
  `)

  return rows[0] ?? { requested_count: 0, deleted_count: 0 }
}
