import { randomUUID } from 'crypto'
import { prisma } from '../config/prisma.js'
import { normalizeAttendanceStatus } from './attendanceStatus.js'

export type UserData = {
  subjects: unknown[]
  attendance_logs: unknown[]
  timetable?: unknown[]
  timetables?: unknown[]
  semester_results: unknown[]
  manual_courses: unknown[]
  user_preferences?: unknown[]
  user_preference?: unknown[]
  skills: unknown[]
  system_logs: unknown[]
  notes?: unknown[]
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
  await prisma.semesterResult.deleteMany({ where: { user_id: userId } })
  await prisma.manualCourse.deleteMany({ where: { user_id: userId } })
  await prisma.userPreference.deleteMany({ where: { user_id: userId } })
  await prisma.skill.deleteMany({ where: { user_id: userId } })
  await prisma.systemLog.deleteMany({ where: { user_id: userId } })
  await prisma.note.deleteMany({ where: { user_id: userId } })
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
  const [subjects, attendance_logs, timetable, semester_results, manual_courses, user_preferences, skills, system_logs, notes, user] = await Promise.all([
    prisma.subject.findMany({ where: { user_id: userId } }),
    prisma.attendanceLog.findMany({ where: { user_id: userId } }),
    prisma.timetable.findMany({ where: { user_id: userId } }),
    prisma.semesterResult.findMany({ where: { user_id: userId } }),
    prisma.manualCourse.findMany({ where: { user_id: userId } }),
    prisma.userPreference.findMany({ where: { user_id: userId } }),
    prisma.skill.findMany({ where: { user_id: userId } }),
    prisma.systemLog.findMany({ where: { user_id: userId }, orderBy: { timestamp: 'desc' }, take: 500 }),
    prisma.note.findMany({ where: { user_id: userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ])

  const userData: UserData = {
    subjects,
    attendance_logs,
    timetable,
    semester_results,
    manual_courses,
    user_preferences,
    skills,
    system_logs,
    notes,
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
    await Promise.all(batch.map(worker))
  }
}

export async function restoreUserData(userId: string, rawData: UserData) {
  const idMap = new Map<string, string>()

  if (rawData.subjects?.length) {
    const subjectsData = (rawData.subjects as any[]).map((s) => {
      const oldId = normalizeValue(s.id ?? s._id)
      const newId = randomUUID()
      if (oldId) idMap.set(String(oldId), newId)
      return {
        id: newId,
        user_id: userId,
        name: String(s.name ?? ''),
        code: String(s.code ?? ''),
        professor: String(s.professor ?? ''),
        classroom: String(s.classroom ?? ''),
        semester: Number(normalizeValue(s.semester) ?? 1),
        type: String(s.type ?? 'theory').toLowerCase(),
        credits: s.credits != null ? Number(normalizeValue(s.credits)) : null,
        attended: Number(normalizeValue(s.attended) ?? 0),
        total: Number(normalizeValue(s.total) ?? 0),
        target: Number(normalizeValue(s.target) ?? 75),
        categories: Array.isArray(s.categories) ? s.categories : ['Theory'],
        practicals: s.practicals ?? null,
        assignments: s.assignments ?? null,
        syllabus: s.syllabus ?? null,
      }
    })
    await createInBatches(subjectsData, (row) => prisma.subject.create({ data: row as any }))
  }

  if (rawData.attendance_logs?.length) {
    const logsData = (rawData.attendance_logs as any[]).map((l) => {
      const oldSubIdVal = normalizeValue(l.subject_id)
      if (!oldSubIdVal) return null
      const newSubId = idMap.get(String(oldSubIdVal))
      if (!newSubId) return null
      const timestamp = normalizeValue(l.timestamp)
      return {
        id: randomUUID(),
        user_id: userId,
        subject_id: newSubId,
        subject_name: String(l.subject_name ?? ''),
        date: String(normalizeValue(l.date) ?? ''),
        status: normalizeAttendanceStatus(normalizeValue(l.status)),
        type: String(l.type ?? 'Lecture'),
        notes: l.notes ?? null,
        semester: l.semester != null ? Number(normalizeValue(l.semester)) : null,
        substituted_by: l.substituted_by ? (idMap.get(String(normalizeValue(l.substituted_by))) || null) : null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      }
    }).filter(Boolean) as any[]
    await createInBatches(logsData, (row) => prisma.attendanceLog.create({ data: row as any }))
  }

  const ttable = rawData.timetable || rawData.timetables
  if (ttable?.length) {
    const timetableData = (ttable as any[]).map((t) => {
      const schedule = JSON.parse(JSON.stringify(t.schedule ?? {}))
      for (const day of Object.keys(schedule)) {
        if (!Array.isArray(schedule[day])) continue
        for (const slot of schedule[day]) {
          const slotType = String(slot.type ?? '').trim().toLowerCase()
          const hasSubjectRef = String(normalizeValue(slot.subject_id ?? slot.subjectId) ?? '').trim().length > 0
          const hasLabel = String(slot.label ?? slot.name ?? '').trim().length > 0
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

  if (rawData.semester_results?.length) {
    const resultsData = (rawData.semester_results as any[]).map((r) => ({
      id: randomUUID(),
      user_id: userId,
      semester: Number(r.semester ?? 1),
      subjects: r.subjects ?? [],
      sgpa: Number(r.sgpa ?? 0),
      total_credits: Number(r.total_credits ?? 0),
      student_info: r.student_info ?? null,
      source: String(r.source ?? 'manual').toLowerCase().includes('ipu') ? 'ipu_scraper' : 'manual',
      enrollment_number: r.enrollment_number ?? null,
      semester_label: r.semester_label ?? null,
      total_marks: r.total_marks ?? null,
      max_marks: r.max_marks ?? null,
      updated_at: r.updated_at ? new Date(normalizeValue(r.updated_at)) : new Date(),
    }))
    await createInBatches(resultsData as any[], (row) => prisma.semesterResult.create({ data: row as any }))
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

  if (rawData.skills?.length) {
    const skillsData = (rawData.skills as any[]).map((s) => ({
      id: randomUUID(),
      user_id: userId,
      name: String(s.name ?? ''),
      category: s.category ?? null,
      level: s.level ?? null,
      progress: Number(s.progress ?? 0),
      notes: s.notes ?? '',
    }))
    await createInBatches(skillsData as any[], (row) => prisma.skill.create({ data: row as any }))
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

  if (rawData.notes?.length) {
    const notesData = (rawData.notes as any[]).map((n) => ({
      id: randomUUID(),
      user_id: userId,
      title: String(n.title ?? ''),
      content: String(n.content ?? ''),
      is_todo: Boolean(n.is_todo ?? false),
      todos: n.todos ?? [],
      category: String(n.category ?? 'General'),
      color: String(n.color ?? ''),
      is_pinned: Boolean(n.is_pinned ?? false),
      is_archived: Boolean(n.is_archived ?? false),
      created_at: n.created_at ? new Date(normalizeValue(n.created_at)) : new Date(),
      updated_at: n.updated_at ? new Date(normalizeValue(n.updated_at)) : new Date(),
    }))
    await createInBatches(notesData as any[], (row) => prisma.note.create({ data: row as any }))
  }


  if (rawData.user_profile) {
    const filteredProfile = getSafeProfileUpdate(rawData.user_profile)
    if (Object.keys(filteredProfile).length) {
      await prisma.user.update({ where: { id: userId }, data: filteredProfile as any })
    }
  }
}

