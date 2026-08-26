/**
 * Tracker activity integration test.
 * Creates one sentinel subject, toggles submitted -> unsubmitted, verifies the
 * persisted JSON and unique audit rows, checks stale-write protection, then
 * removes every row it created.
 */
import 'dotenv/config'
import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { updateSubjectWithActivityAtomic } from '../src/utils/subjectActivity.js'

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {})
const prisma = new PrismaClient({ adapter, log: ['error'] })
const TEST_USER_ID = 'cmr8557qn00007svimksd92ua'
const TEST_NAME = '[TEST] Auto-Cleanup Tracker Activity'

let subjectId: string | null = null
const activityIds: string[] = []

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
  console.log(`  ✅  ${message}`)
}

async function main() {
  console.log('\n🔬  Tracker activity transaction test\n')
  const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
  assert(user, 'test user exists')

  const original = await prisma.subject.create({
    data: {
      user_id: TEST_USER_ID,
      name: TEST_NAME,
      semester: 99,
      categories: ['Practical'],
      practicals: { total: 10, completed: 4, hardcopy: false },
    },
  })
  subjectId = original.id

  const [submitted, submittedLog] = await updateSubjectWithActivityAtomic({
    subjectId,
    expectedUpdatedAt: original.updated_at,
    updateData: { practicals: { total: 10, completed: 4, hardcopy: true } },
    userId: TEST_USER_ID,
    action: 'Submission Status Updated',
    description: `${TEST_NAME} — Practical: submission unsubmitted to submitted`,
  })
  activityIds.push(submittedLog.id)
  assert((submitted.practicals as { hardcopy: boolean }).hardcopy === true, 'submitted state persisted')

  const [unsubmitted, unsubmittedLog] = await updateSubjectWithActivityAtomic({
    subjectId,
    expectedUpdatedAt: submitted.updated_at,
    updateData: { practicals: { total: 10, completed: 4, hardcopy: false } },
    userId: TEST_USER_ID,
    action: 'Submission Status Updated',
    description: `${TEST_NAME} — Practical: submission submitted to unsubmitted`,
  })
  activityIds.push(unsubmittedLog.id)
  assert((unsubmitted.practicals as { hardcopy: boolean }).hardcopy === false, 'unsubmitted state persisted')
  assert(submittedLog.id !== unsubmittedLog.id, 'each real transition has a unique event ID')
  assert(unsubmittedLog.timestamp.getTime() >= submittedLog.timestamp.getTime(), 'database timestamps preserve event order')

  let staleRejected = false
  try {
    await updateSubjectWithActivityAtomic({
      subjectId,
      expectedUpdatedAt: original.updated_at,
      updateData: { practicals: { total: 10, completed: 4, hardcopy: true } },
      userId: TEST_USER_ID,
      action: 'Submission Status Updated',
      description: `${TEST_NAME} — stale write must roll back`,
    })
  } catch (error) {
    staleRejected = Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2025')
  }
  assert(staleRejected, 'stale concurrent update is rejected')

  const [subjectCount, logs] = await Promise.all([
    prisma.subject.count({ where: { id: subjectId } }),
    prisma.systemLog.findMany({ where: { user_id: TEST_USER_ID, description: { contains: TEST_NAME } } }),
  ])
  assert(subjectCount === 1, 'toggles update one subject row without duplicates')
  assert(logs.length === 2, 'only the two committed transitions created activity rows')
  console.log('\n✅  All tracker activity checks passed.\n')
}

main().catch((error) => {
  console.error('\n❌  Tracker activity test failed:', error)
  process.exitCode = 1
}).finally(async () => {
  if (subjectId) await prisma.subject.deleteMany({ where: { id: subjectId } }).catch(() => {})
  await prisma.systemLog.deleteMany({ where: { user_id: TEST_USER_ID, description: { contains: TEST_NAME } } }).catch(() => {})
  await prisma.$disconnect()
})
