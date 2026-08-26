/** Real DB integration test for the empty-date-only bulk-mark contract. */
import 'dotenv/config'
import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { markAllAttendanceAtomic } from '../src/utils/bulkAttendance.js'

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {})
const prisma = new PrismaClient({ adapter, log: ['error'] })
const USER_ID = 'cmr8557qn00007svimksd92ua'
const DATE = '2000-08-27'
const NAME = '[TEST] Auto-Cleanup Bulk Guard'
let subjectId: string | null = null

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message)
  console.log(`  ✅  ${message}`)
}

async function main() {
  console.log('\n🔬  Bulk attendance guard integration test\n')
  const subject = await prisma.subject.create({
    data: { user_id: USER_ID, name: NAME, semester: 99, categories: ['Theory'], attended: 0, total: 0 },
  })
  subjectId = subject.id

  const first = await markAllAttendanceAtomic({
    userId: USER_ID,
    date: DATE,
    semester: 99,
    status: 'present',
    classes: [{ subject_id: subject.id, type: 'Lecture::09:00 AM' }],
  })
  assert(first.marked_count === 1, 'empty date is bulk marked once')

  let blocked = false
  try {
    await markAllAttendanceAtomic({
      userId: USER_ID,
      date: DATE,
      semester: 99,
      status: 'absent',
      classes: [{ subject_id: subject.id, type: 'Lecture::09:00 AM' }],
    })
  } catch (error) {
    blocked = Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'BULK_DATE_NOT_EMPTY')
  }
  assert(blocked, 'second bulk mark is rejected when any record exists')

  const [logs, stored, activities] = await Promise.all([
    prisma.attendanceLog.findMany({ where: { user_id: USER_ID, date: DATE, semester: 99 } }),
    prisma.subject.findUniqueOrThrow({ where: { id: subject.id } }),
    prisma.systemLog.findMany({ where: { user_id: USER_ID, description: { contains: DATE } } }),
  ])
  assert(logs.length === 1 && logs[0].status === 'present', 'rejected retry does not replace or duplicate the existing mark')
  assert(stored.total === 1 && stored.attended === 1, 'subject counters changed exactly once')
  assert(activities.filter(log => log.action === 'Attendance Bulk Marked').length === 1, 'only one bulk activity event exists')
  console.log('\n✅  All bulk attendance guard checks passed.\n')
}

main().catch(error => {
  console.error('\n❌  Bulk attendance guard test failed:', error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.attendanceLog.deleteMany({ where: { user_id: USER_ID, date: DATE, semester: 99 } }).catch(() => {})
  await prisma.systemLog.deleteMany({ where: { user_id: USER_ID, action: 'Attendance Bulk Marked', description: { contains: DATE } } }).catch(() => {})
  if (subjectId) await prisma.subject.deleteMany({ where: { id: subjectId } }).catch(() => {})
  await prisma.$disconnect()
})
