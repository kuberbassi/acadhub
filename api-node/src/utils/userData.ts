import { randomUUID } from 'crypto'
import { prisma } from '../config/prisma.js'
import { normalizeAttendanceStatus } from './attendanceStatus.js'

export type UserData = {
  subjects: unknown[]
  attendance_logs: unknown[]
  timetable?: unknown[]
  timetables?: unknown[]
  manual_courses: unknown[]
  user_preferences?: unknown[]
  user_preference?: unknown[]
  system_logs: unknown[]
  user_profile?: unknown
}

export function normalizeValue(val: any): any {
  if (val && typeof val === 'object') {
    if ('$oid' in val) return String(val.$oid)
    if ('$date' in val) return val.$date
    if ('$numberInt' in val) return Number(val.$numberInt)
    if ('$numberLong' in val) return Number(val.$numberLong)
    if ('$numberDouble' in val) return Number(val.$numberDouble)
    if ('$numberDecimal' in val) return Number(val.$numberDecimal)
  }
  return val
}

export async function clearUserData(userId: string) {
  const subs = await prisma.subject.findMany({ where: { user_id: userId }, select: { id: true } })
  await prisma.subject.deleteMany({ where: { id: { in: subs.map((s: any) => s.id) } } })
  await prisma.attendanceLog.deleteMany({ where: { user_id: userId } })
  await prisma.timetable.deleteMany({ where: { user_id: userId } })
  await prisma.manualCourse.deleteMany({ where: { user_id: userId } })
  await prisma.userPreference.deleteMany({ where: { user_id: userId } })
  await prisma.systemLog.deleteMany({ where: { user_id: userId } })
}

export function getSafeProfileUpdate(profile: any) {
  const allowedProfileFields = [
    'name', 'course', 'branch', 'college', 'batch', 'current_semester',
    'enrollment_number', 'target_attendance', 'attendance_threshold', 'warning_threshold',
    'admission_year', 'biometrics', 'picture',
  ]

  const filteredProfile = Object.fromEntries(
    Object.entries(profile ?? {}).filter(([key]) => allowedProfileFields.includes(key))
  ) as Record<string, any>

  if (filteredProfile.admission_year) filteredProfile.admission_year = String(normalizeValue(filteredProfile.admission_year))
  if (filteredProfile.current_semester) filteredProfile.current_semester = Number(normalizeValue(filteredProfile.current_semester))
  if (filteredProfile.target_attendance) filteredProfile.target_attendance = Number(normalizeValue(filteredProfile.target_attendance))
  if (filteredProfile.attendance_threshold) filteredProfile.attendance_threshold = Number(normalizeValue(filteredProfile.attendance_threshold))
  if (filteredProfile.warning_threshold) filteredProfile.warning_threshold = Number(normalizeValue(filteredProfile.warning_threshold))

  return filteredProfile
}

export async function collectUserData(userId: string): Promise<UserData> {
  const [subjects, attendance_logs, timetable, manual_courses, user_preferences, system_logs, user] = await Promise.all([
    prisma.subject.findMany({ where: { user_id: userId } }),
    prisma.attendanceLog.findMany({ where: { user_id: userId } }),
    prisma.timetable.findMany({ where: { user_id: userId } }),
    prisma.manualCourse.findMany({ where: { user_id: userId } }),
    prisma.userPreference.findMany({ where: { user_id: userId } }),
    prisma.systemLog.findMany({ where: { user_id: userId }, orderBy: { timestamp: 'desc' }, take: 500 }),
    prisma.user.findUnique({ where: { id: userId } }),
  ])

  const userData: UserData = {
    subjects,
    attendance_logs,
    timetable,
    manual_courses,
    user_preferences,
    system_logs,
  }

  if (user) {
    const { google_id: _g, ...safeUser } = user as any
    userData.user_profile = safeUser
  }

  return userData
}

export async function createInBatches<T>(items: T[], worker: (item: T) => Promise<unknown>, batchSize: number = 25) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map((item) => worker(item)))
  }
}

export async function restoreUserData(userId: string, rawData: UserData) {
  await clearUserData(userId)

  const idMap = new Map<string, string>()

  if (rawData.subjects?.length) {
    const subjectsData = (rawData.subjects as any[]).map((s) => {
      const oldId = String(normalizeValue(s.id ?? s._id) ?? '')
      const newId = randomUUID()
      if (oldId) idMap.set(oldId, newId)
      return {
        id: newId,
        user_id: userId,
        name: String(s.name ?? ''),
        code: s.code ? String(s.code) : null,
        professor: s.professor ? String(s.professor) : null,
        target: Number(normalizeValue(s.target ?? s.target_attendance) ?? 75),
        attended: Number(normalizeValue(s.attended) ?? 0),
        total: Number(normalizeValue(s.total) ?? 0),
        semester: Number(normalizeValue(s.semester) ?? 1),
        categories: Array.isArray(s.categories) ? s.categories : ['Theory'],
        practicals: s.practicals ?? null,
        assignments: s.assignments ?? null,
        credits: s.credits !== undefined ? Number(s.credits) : 3,
        updated_at: s.updated_at ? new Date(normalizeValue(s.updated_at)) : new Date(),
      }
    })
    await createInBatches(subjectsData as any[], (row) => prisma.subject.create({ data: row as any }))
  }

  if (rawData.attendance_logs?.length) {
    const logsData = (rawData.attendance_logs as any[]).map((log) => {
      const sRef = String(normalizeValue(log.subject_id ?? log.subjectId) ?? '')
      const status = String(log.status ?? '').toLowerCase()
      const type = String(log.type ?? '').toLowerCase()
      return {
        id: randomUUID(),
        user_id: userId,
        subject_id: sRef && idMap.has(sRef) ? idMap.get(sRef)! : sRef,
        subject_name: String(log.subject_name ?? ''),
        date: String(log.date ?? '').substring(0, 10),
        status: normalizeAttendanceStatus(status),
        type: ['original', 'substitution', 'extra'].includes(type) ? type : 'original',
        notes: log.notes ? String(log.notes) : null,
        timestamp: log.timestamp ? new Date(normalizeValue(log.timestamp)) : new Date(),
      }
    })
    await createInBatches(logsData as any[], (row) => prisma.attendanceLog.create({ data: row as any }))
  }

  const ttData = rawData.timetable || rawData.timetables
  if (Array.isArray(ttData) && ttData.length > 0) {
    const timetableData = (ttData as any[]).map((t) => {
      const schedule = (t.schedule as Record<string, any[]>) || {}
      for (const [day, slots] of Object.entries(schedule)) {
        if (!Array.isArray(slots)) continue
        for (const slot of slots) {
          const slotType = String(slot.type ?? '').toLowerCase()
          const hasSubjectRef = slot.subject_id || slot.subjectId
          const hasLabel = slot.label
          slot.id = String(normalizeValue(slot.id ?? slot._id) ?? randomUUID())
          delete slot._id
          if (slot.startTime && !slot.start_time) slot.start_time = slot.startTime
          if (slot.endTime && !slot.end_time) slot.end_time = slot.endTime
          delete slot.startTime
          delete slot.endTime
          if (!slot.type) slot.type = hasSubjectRef ? 'class' : (hasLabel ? 'custom' : 'class')
          else slot.type = slotType || 'class'
          const sRef = String(normalizeValue(slot.subject_id ?? slot.subjectId) ?? '')
          if (sRef && idMap.has(sRef)) slot.subject_id = idMap.get(sRef)
          else if (sRef) slot.subject_id = sRef
          delete slot.subjectId
          if (slot.type !== 'class') slot.subject_id = ''
        }
      }
      return {
        id: randomUUID(),
        user_id: userId,
        semester: Number(normalizeValue(t.semester) ?? 1),
        schedule,
        periods: t.periods ?? null,
      }
    })
    await createInBatches(timetableData as any[], (row) => prisma.timetable.create({ data: row as any }))
  }

  if (rawData.manual_courses?.length) {
    const coursesData = (rawData.manual_courses as any[]).map((c) => {
      const extra = c.extra ?? {}
      if (c.instructor && !extra.instructor) extra.instructor = c.instructor
      if (c.enrolledDate && !extra.enrolledDate) extra.enrolledDate = c.enrolledDate
      if (c.targetCompletionDate && !extra.targetCompletionDate) extra.targetCompletionDate = c.targetCompletionDate
      return {
        id: randomUUID(),
        user_id: userId,
        name: String(c.name ?? c.title ?? ''),
        platform: String(c.platform ?? c.provider ?? ''),
        status: String(c.status ?? 'not_started'),
        progress: Number(c.progress ?? c.percentage ?? 0),
        url: c.url ? String(c.url) : null,
        notes: c.notes ? String(c.notes) : null,
        extra: Object.keys(extra).length ? extra : null,
      }
    })
    await createInBatches(coursesData as any[], (row) => prisma.manualCourse.create({ data: row as any }))
  }

  const prefData = rawData.user_preferences || rawData.user_preference
  if (Array.isArray(prefData) ? prefData.length : !!prefData) {
    const pref = Array.isArray(prefData) ? (prefData as any[])[0] : prefData
    await prisma.userPreference.upsert({
      where: { user_id: userId },
      create: { user_id: userId, preferences: pref.preferences ?? {} },
      update: { preferences: pref.preferences ?? {} },
    })
  }

  if (rawData.system_logs?.length) {
    const systemLogsData = (rawData.system_logs as any[]).map((entry) => ({
      user_id: userId,
      action: String(entry.action ?? 'Imported Log'),
      description: String(entry.description ?? ''),
      ip: entry.ip ? String(entry.ip) : null,
      user_agent: entry.user_agent ? String(entry.user_agent) : null,
      timestamp: entry.timestamp ? new Date(normalizeValue(entry.timestamp)) : new Date(),
    }))
    await createInBatches(systemLogsData as any[], (row) => prisma.systemLog.create({ data: row as any }))
  }
}
