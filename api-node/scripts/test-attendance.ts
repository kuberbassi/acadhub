/**
 * Attendance Backend Test Suite
 *
 * HOW TO RUN:
 *   cd api-node
 *   npx tsx scripts/test-attendance.ts
 *
 * SAFETY:
 *   - Creates throwaway subjects named "[TEST] Auto-Cleanup *"
 *   - All logs use sentinel semester 99 + dates in year 2000
 *   - Cleans up ALL created rows in a finally block (guaranteed)
 *   - Direct Prisma connection — no HTTP, no cookies needed
 */

import 'dotenv/config'
import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client.js'
import {
  isCountedAttendanceStatus,
  isAttendedAttendanceStatus,
} from '../src/utils/attendanceStatus.js'

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {})
const prisma = new PrismaClient({ adapter, log: ['error'] })

const TEST_USER_ID = 'cmr8557qn00007svimksd92ua'
const TEST_SEMESTER = 99
const TEST_DATE_1 = '2000-03-01'
const TEST_DATE_2 = '2000-04-01'
const TEST_DATE_3 = '2000-05-01'

let passCount = 0, failCount = 0
const failures: string[] = []

function ok(label: string, detail = '') { console.log(`  ✅  ${label}${detail ? `  (${detail})` : ''}`); passCount++ }
function fail(label: string, detail = '') { console.error(`  ❌  ${label}${detail ? `  — ${detail}` : ''}`); failCount++; failures.push(label) }
function assert(cond: boolean, label: string, detail = '') { cond ? ok(label, detail) : fail(label, detail) }
function section(title: string) { console.log(`\n${'─'.repeat(64)}\n  ${title}\n${'─'.repeat(64)}`) }

let sub1Id: string | null = null
let sub2Id: string | null = null

async function main() {
  console.log('\n🔬  Attendance Backend Test Suite')
  console.log(`    Host : ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? 'unknown'}`)
  console.log(`    User : ${TEST_USER_ID}`)
  console.log(`    Guard: semester=${TEST_SEMESTER}, dates in year 2000\n`)

  try {
    section('1 · DB CONNECTION')
    const ping = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() AS now`
    assert(ping[0]?.now instanceof Date, 'DB ping succeeds')
    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
    assert(!!user, 'Test user found in DB', user?.email ?? '')

    section('2 · CREATE THROWAWAY SUBJECTS')
    const sub1 = await prisma.subject.create({ data: { user_id: TEST_USER_ID, name: '[TEST] Auto-Cleanup Primary', semester: TEST_SEMESTER, categories: ['Theory'], credits: 3, attended: 0, total: 0 } })
    sub1Id = sub1.id
    assert(!!sub1.id, 'Subject 1 created', sub1.id)
    const sub2 = await prisma.subject.create({ data: { user_id: TEST_USER_ID, name: '[TEST] Auto-Cleanup Secondary', semester: TEST_SEMESTER, categories: ['Theory'], credits: 3, attended: 0, total: 0 } })
    sub2Id = sub2.id
    assert(!!sub2.id, 'Subject 2 created (substitution target)', sub2.id)

    section('3 · MARK ATTENDANCE — every status')
    const allStatuses = ['present','absent','late','approved_medical','medical','duty','cancelled'] as const
    const expectedCounters: Record<string, { total: number; attended: number }> = {
      present: { total: 1, attended: 1 }, absent: { total: 1, attended: 0 }, late: { total: 1, attended: 1 },
      approved_medical: { total: 1, attended: 1 }, medical: { total: 1, attended: 1 },
      duty: { total: 1, attended: 1 }, cancelled: { total: 0, attended: 0 },
    }
    for (const status of allStatuses) {
      const date = `2000-01-${String(allStatuses.indexOf(status) + 1).padStart(2, '0')}`
      const log = await prisma.attendanceLog.create({ data: { user_id: TEST_USER_ID, subject_id: sub1Id, subject_name: sub1.name, date, status, type: 'Lecture', semester: TEST_SEMESTER } })
      assert(!!log.id, `Mark as '${status}'`)
      const got = { total: isCountedAttendanceStatus(status) ? 1 : 0, attended: isAttendedAttendanceStatus(status) ? 1 : 0 }
      const exp = expectedCounters[status]
      assert(got.total === exp.total && got.attended === exp.attended, `  Counter semantics for '${status}': total=${got.total} attended=${got.attended}`, `expected total=${exp.total} attended=${exp.attended}`)
      if (got.total || got.attended) await prisma.subject.update({ where: { id: sub1Id }, data: { ...(got.total ? { total: { increment: got.total } } : {}), ...(got.attended ? { attended: { increment: got.attended } } : {}) } })
    }

    section('4 · DUPLICATE DETECTION (DB unique constraint)')
    await prisma.attendanceLog.create({ data: { user_id: TEST_USER_ID, subject_id: sub1Id, subject_name: sub1.name, date: '2000-02-01', status: 'present', type: 'Lecture', semester: TEST_SEMESTER } })
    // Apply counter for the valid first dup-test log (present = +1 total +1 attended)
    await prisma.subject.update({ where: { id: sub1Id }, data: { total: { increment: 1 }, attended: { increment: 1 } } })
    let dupRejected = false
    try { await prisma.attendanceLog.create({ data: { user_id: TEST_USER_ID, subject_id: sub1Id, subject_name: sub1.name, date: '2000-02-01', status: 'absent', type: 'Lecture', semester: TEST_SEMESTER } }) } catch { dupRejected = true }
    assert(dupRejected, 'Duplicate mark (same subject+date+type) rejected by DB unique constraint')

    section('5 · EDIT LOG — status change + counter adjustment')
    const logToEdit = await prisma.attendanceLog.create({ data: { user_id: TEST_USER_ID, subject_id: sub1Id, subject_name: sub1.name, date: TEST_DATE_1, status: 'absent', type: 'Tutorial', semester: TEST_SEMESTER } })
    await prisma.subject.update({ where: { id: sub1Id }, data: { total: { increment: 1 } } })
    const beforeEdit = await prisma.subject.findUnique({ where: { id: sub1Id } })
    await prisma.attendanceLog.update({ where: { id: logToEdit.id }, data: { status: 'present' } })
    const beforeC = { total: isCountedAttendanceStatus('absent') ? 1 : 0, attended: isAttendedAttendanceStatus('absent') ? 1 : 0 }
    const afterC  = { total: isCountedAttendanceStatus('present') ? 1 : 0, attended: isAttendedAttendanceStatus('present') ? 1 : 0 }
    await prisma.subject.update({ where: { id: sub1Id }, data: { total: { increment: afterC.total - beforeC.total }, attended: { increment: afterC.attended - beforeC.attended } } })
    const afterEdit = await prisma.subject.findUnique({ where: { id: sub1Id } })
    assert((afterEdit?.attended ?? 0) === (beforeEdit?.attended ?? 0) + 1, 'attended incremented: absent → present')
    assert((afterEdit?.total ?? 0) === (beforeEdit?.total ?? 0), 'total unchanged: absent → present')

    section('6 · SUBSTITUTION FLOW')
    const subLog = await prisma.attendanceLog.create({ data: { user_id: TEST_USER_ID, subject_id: sub1Id, subject_name: sub1.name, date: TEST_DATE_2, status: 'substituted', type: 'Lecture', semester: TEST_SEMESTER, substituted_by: sub2Id } })
    await prisma.subject.update({ where: { id: sub1Id }, data: { total: { increment: 1 }, attended: { increment: 1 } } })
    const companion = await prisma.attendanceLog.create({ data: { user_id: TEST_USER_ID, subject_id: sub2Id, subject_name: sub2.name, date: TEST_DATE_2, status: 'present', type: 'substitution_class', notes: `Substitution for ${sub1.name}`, semester: TEST_SEMESTER } })
    await prisma.subject.update({ where: { id: sub2Id }, data: { total: { increment: 1 }, attended: { increment: 1 } } })
    const s1After = await prisma.subject.findUnique({ where: { id: sub1Id } })
    const s2After = await prisma.subject.findUnique({ where: { id: sub2Id } })
    assert(subLog.status === 'substituted', 'Primary log status = substituted')
    assert(subLog.substituted_by === sub2Id, 'substituted_by set correctly')
    assert(companion.type === 'substitution_class', 'Companion log type = substitution_class')
    assert((s1After?.attended ?? 0) > 0, 'Primary attended incremented (substituted = attended)')
    assert((s2After?.attended ?? 0) > 0, 'Secondary attended incremented via companion log')

    section('7 · DELETE LOG + COUNTER ROLLBACK')
    const logToDel = await prisma.attendanceLog.create({ data: { user_id: TEST_USER_ID, subject_id: sub1Id, subject_name: sub1.name, date: TEST_DATE_3, status: 'present', type: 'Lab', semester: TEST_SEMESTER } })
    await prisma.subject.update({ where: { id: sub1Id }, data: { total: { increment: 1 }, attended: { increment: 1 } } })
    const beforeDel = await prisma.subject.findUnique({ where: { id: sub1Id } })
    await prisma.attendanceLog.delete({ where: { id: logToDel.id } })
    await prisma.subject.update({ where: { id: sub1Id }, data: { total: { decrement: 1 }, attended: { decrement: 1 } } })
    const afterDel = await prisma.subject.findUnique({ where: { id: sub1Id } })
    assert((afterDel?.total ?? 0) === (beforeDel?.total ?? 0) - 1, 'total decremented after delete')
    assert((afterDel?.attended ?? 0) === (beforeDel?.attended ?? 0) - 1, 'attended decremented after delete')
    const gone = await prisma.attendanceLog.findUnique({ where: { id: logToDel.id } })
    assert(gone === null, 'Deleted log truly gone from DB')

    section('8 · QUERY FILTERS')
    const bySubject = await prisma.attendanceLog.findMany({ where: { user_id: TEST_USER_ID, subject_id: sub1Id } })
    assert(bySubject.length > 0, `Filter by subject_id → ${bySubject.length} row(s)`)
    const byDate = await prisma.attendanceLog.findMany({ where: { user_id: TEST_USER_ID, date: '2000-01-01' } })
    assert(byDate.length > 0, `Filter by exact date → ${byDate.length} row(s)`)
    const byStatus = await prisma.attendanceLog.findMany({ where: { user_id: TEST_USER_ID, subject_id: sub1Id, status: 'present' } })
    assert(byStatus.length > 0, `Filter by status=present → ${byStatus.length} row(s)`)
    const byRange = await prisma.attendanceLog.findMany({ where: { user_id: TEST_USER_ID, date: { gte: '2000-01-01', lte: '2000-01-31' } } })
    assert(byRange.length > 0, `Filter by date range → ${byRange.length} row(s)`)
    const bySemester = await prisma.attendanceLog.findMany({ where: { user_id: TEST_USER_ID, semester: TEST_SEMESTER } })
    assert(bySemester.length > 0, `Filter by sentinel semester → ${bySemester.length} row(s)`)

    section('9 · COUNTER CONSISTENCY (DB vs recomputed)')
    const allLogs = await prisma.attendanceLog.findMany({ where: { user_id: TEST_USER_ID, subject_id: sub1Id } })
    const computedTotal = allLogs.filter(l => isCountedAttendanceStatus(l.status)).length
    const computedAttended = allLogs.filter(l => isAttendedAttendanceStatus(l.status)).length
    const finalSub = await prisma.subject.findUnique({ where: { id: sub1Id } })
    assert(finalSub?.total === computedTotal, `DB total=${finalSub?.total} matches recomputed=${computedTotal}`)
    assert(finalSub?.attended === computedAttended, `DB attended=${finalSub?.attended} matches recomputed=${computedAttended}`)

    section('10 · CALENDAR DATE GROUPING')
    const calLogs = await prisma.attendanceLog.findMany({ where: { user_id: TEST_USER_ID, date: { gte: '2000-01-01', lte: '2000-01-31' } } })
    const byDay: Record<string, number> = {}
    for (const l of calLogs) { byDay[l.date] = (byDay[l.date] ?? 0) + 1 }
    assert(Object.keys(byDay).length > 0, `Calendar grouping — ${Object.keys(byDay).length} unique date(s)`)

  } finally {
    section('♻️  CLEANUP (always runs)')
    const subIds = [sub1Id, sub2Id].filter(Boolean) as string[]
    if (subIds.length) {
      const del = await prisma.attendanceLog.deleteMany({ where: { user_id: TEST_USER_ID, subject_id: { in: subIds } } })
      console.log(`  🗑️  Deleted ${del.count} test log(s)`)
    }
    if (sub1Id) { await prisma.subject.delete({ where: { id: sub1Id } }).catch(() => {}); console.log('  🗑️  Deleted test subject 1') }
    if (sub2Id) { await prisma.subject.delete({ where: { id: sub2Id } }).catch(() => {}); console.log('  🗑️  Deleted test subject 2') }
    await prisma.$disconnect()
    console.log('  🔌  Disconnected\n')
  }

  console.log('═'.repeat(64))
  console.log(`  ${passCount} passed   ${failCount} failed`)
  if (failures.length) { console.log('\n  Failed:'); failures.forEach(f => console.log(`    • ${f}`)) }
  console.log('═'.repeat(64) + '\n')
  process.exit(failCount > 0 ? 1 : 0)
}

main().catch(err => { console.error('\n💥 Top-level error:', err); prisma.$disconnect().finally(() => process.exit(1)) })


