import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, invalidateAuthCache, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, fail } from '../utils/response.js'
import { getClientIp } from '../utils/ip.js'
import multer from 'multer'
import sharp from 'sharp'
import { buildViewCacheId, clearUserViewCache, readViewCache, writeViewCache } from '../utils/viewCache.js'

const router = Router()
router.use(requireAuth)

// Multer: memory storage for base64 conversion
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const MAX_PFP_SIZE = 150 * 1024 // 150 KB

// ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  branch: z.string().max(200).optional(),
  college: z.string().max(200).optional(),
  semester: z.union([z.number().int().min(1).max(12), z.string()]).optional(),
  batch: z.string().max(20).optional(),
  course: z.string().max(200).optional(),
  attendance_threshold: z.number().min(0).max(100).optional(),
  warning_threshold: z.number().min(0).max(100).optional(),
  enrollment_number: z.string().max(50).optional(),

}).strict()

const ProfilePostSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  branch: z.string().max(200).optional(),
  course: z.string().max(200).optional(),
  college: z.string().max(200).optional(),
  batch: z.string().max(20).optional(),
  enrollment_number: z.string().max(50).optional(),
  current_semester: z.union([z.number().int().min(1).max(12), z.string()]).optional(),
  attendance_threshold: z.number().min(0).max(100).optional(),
  warning_threshold: z.number().min(0).max(100).optional(),
  target_attendance: z.number().min(0).max(100).optional(),

}).strict()

const DeleteAccountSchema = z.object({
  confirmation_email: z.string().email(),
  confirmation_text: z.literal('DELETE'),
}).strict()

async function sysLog(req: AuthRequest, user_id: string, action: string, description: string) {
  const ip = getClientIp(req)
  const user_agent = (req.headers['user-agent'] as string) || null
  await prisma.systemLog.create({ data: { user_id, action, description, ip, user_agent } }).catch(() => null)
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) { fail(res, 'User not found', 'USER_NOT_FOUND', 404); return }

    // Merge preferences thresholds
    const prefs = await prisma.userPreference.findUnique({ where: { user_id: userId } })
    const merged: Record<string, unknown> = { ...user, _id: user.id }
    if (prefs?.preferences) {
      const p = prefs.preferences as Record<string, unknown>
      if ('attendance_threshold' in p) merged.attendance_threshold = p.attendance_threshold
      if ('warning_threshold' in p) merged.warning_threshold = p.warning_threshold
      else if ('min_attendance' in p) merged.warning_threshold = p.min_attendance
    }

    ok(res, merged)
  } catch (err) {
    console.error('[profile GET]', err)
    fail(res, 'Failed to fetch profile', 'FETCH_FAILED', 500)
  }
})

router.put('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const parsed = ProfileUpdateSchema.safeParse(req.body)
    if (!parsed.success) { fail(res, parsed.error.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    const data = parsed.data
    const updateData: Record<string, unknown> = { ...data }

    // Map 'semester' â†’ 'current_semester'
    if ('semester' in updateData) {
      const semVal = parseInt(String(updateData.semester))
      if (!isNaN(semVal) && semVal >= 1 && semVal <= 12) {
        updateData.current_semester = semVal
      }
      delete updateData.semester
    }

    // Sync target_attendance = attendance_threshold
    if ('attendance_threshold' in updateData) {
      updateData.target_attendance = updateData.attendance_threshold
    }

    await prisma.user.update({ where: { id: userId }, data: updateData as Parameters<typeof prisma.user.update>[0]['data'] })

    // Mirror thresholds to UserPreference
    const thresholdMirror: Record<string, unknown> = {}
    if ('attendance_threshold' in data) thresholdMirror.attendance_threshold = data.attendance_threshold
    if ('warning_threshold' in data) thresholdMirror.warning_threshold = data.warning_threshold
    if (Object.keys(thresholdMirror).length) {
      const existing = await prisma.userPreference.findUnique({ where: { user_id: userId } })
      const existingPrefs = (existing?.preferences ?? {}) as Record<string, unknown>
      const merged = { ...existingPrefs, ...thresholdMirror }
      await prisma.userPreference.upsert({
        where: { user_id: userId },
        create: { user_id: userId, preferences: merged as any },
        update: { preferences: merged as any },
      })
    }

    invalidateAuthCache(req.headers.authorization?.slice(7))
    await sysLog(req, userId, 'Profile Updated', 'User updated their profile information.').catch(() => { })
    await clearUserViewCache(userId).catch(() => { })
    ok(res, { message: 'Profile updated' })
  } catch (err) {
    console.error('[profile PUT]', err)
    fail(res, 'Internal error', 'INTERNAL_ERROR', 500)
  }
})

// Alias for Flask compat (POST also accepted for profile update)
router.post('/', async (req: AuthRequest, res) => {
  const userId = req.userId!
  try {
    const parsed = ProfilePostSchema.safeParse(req.body)
    if (!parsed.success) { fail(res, parsed.error.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    const updateData: Record<string, unknown> = { ...parsed.data }

    // Guard against NaN for current_semester
    if ('current_semester' in updateData) {
      const semVal = parseInt(String(updateData.current_semester))
      if (isNaN(semVal) || semVal < 1 || semVal > 12) {
        delete updateData.current_semester
      } else {
        updateData.current_semester = semVal
      }
    }

    if (Object.keys(updateData).length === 0) { ok(res, { message: 'No changes' }); return }

    await prisma.user.update({ where: { id: userId }, data: updateData as Parameters<typeof prisma.user.update>[0]['data'] })

    invalidateAuthCache(req.headers.authorization?.slice(7))
    await clearUserViewCache(userId).catch(() => { })
    ok(res, { message: 'Profile updated' })
  } catch (err) {
    console.error('[profile POST]', err)
    fail(res, 'Internal error', 'INTERNAL_ERROR', 500)
  }
})

// â”€â”€â”€ Profile Picture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/upload_pfp', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    if (!req.file) { fail(res, 'No file uploaded', 'MISSING_FILE'); return }

    // Compress the image to WebP, 256x256 max, under 50KB
    let quality = 80
    let compressedBuffer: Buffer
    do {
      compressedBuffer = await sharp(req.file.buffer)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality })
        .toBuffer()
      quality -= 10
    } while (compressedBuffer.length > MAX_PFP_SIZE && quality > 10)

    if (compressedBuffer.length > MAX_PFP_SIZE) {
      fail(res, 'Image too large even after compression', 'IMAGE_TOO_LARGE', 413)
      return
    }

    const b64 = compressedBuffer.toString('base64')
    const pfpUrl = `data:image/webp;base64,${b64}`

    await prisma.user.update({ where: { id: userId }, data: { picture: pfpUrl } })
    invalidateAuthCache(req.headers.authorization?.slice(7))
    await sysLog(req, userId, 'PFP Updated', 'User uploaded a new profile picture.').catch(() => { })
    await clearUserViewCache(userId).catch(() => { })
    ok(res, { url: pfpUrl })
  } catch (err) {
    console.error('[profile/upload_pfp]', err)
    fail(res, 'Failed to upload profile picture', 'UPLOAD_FAILED', 500)
  }
})

// â”€â”€â”€ Preferences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEFAULT_PREFS = {
  attendance_threshold: 75,
  warning_threshold: 76,
  notifications_enabled: false,
  accent_color: '#6750A4',
}

router.get('/preferences', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const cacheId = buildViewCacheId('preferences', {})
    const cached = await readViewCache<any>(userId, cacheId)
    if (cached) { ok(res, cached, 200, 0); return }
    const doc = await prisma.userPreference.findUnique({ where: { user_id: userId } })
    const merged = { ...DEFAULT_PREFS, ...((doc?.preferences ?? {}) as Record<string, unknown>) }
    ok(res, merged, 200, 0)
    void writeViewCache(userId, cacheId, merged, 10 * 60 * 1000).catch(() => {})
  } catch (err) {
    console.error('[profile/preferences GET]', err)
    fail(res, 'Failed to fetch preferences', 'FETCH_FAILED', 500)
  }
})

router.post('/preferences', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const data = { ...(req.body as Record<string, unknown>) }

    // Normalize alias
    if ('min_attendance' in data) { data.warning_threshold = data.min_attendance; delete data.min_attendance }

    const existing = await prisma.userPreference.findUnique({ where: { user_id: userId } })
    const existingPrefs = (existing?.preferences ?? {}) as Record<string, unknown>
    const merged = { ...existingPrefs, ...data }

    await prisma.userPreference.upsert({
      where: { user_id: userId },
      create: { user_id: userId, preferences: merged as any },
      update: { preferences: merged as any },
    })

    // Mirror thresholds to user doc
    const mirror: Record<string, unknown> = {}
    if ('attendance_threshold' in data) {
      mirror.attendance_threshold = data.attendance_threshold
      mirror.target_attendance = data.attendance_threshold
    }
    if ('warning_threshold' in data) mirror.warning_threshold = data.warning_threshold
    if (Object.keys(mirror).length) {
      await prisma.user.update({ where: { id: userId }, data: mirror as Parameters<typeof prisma.user.update>[0]['data'] })
    }

    invalidateAuthCache(req.headers.authorization?.slice(7))
    await sysLog(req, userId, 'Preferences Updated', `Updated preferences: ${Object.keys(data).join(', ')}`).catch(() => { })

    await clearUserViewCache(userId).catch(() => { })
    ok(res, { message: 'Preferences saved' })
  } catch (err) {
    console.error('[profile/preferences POST]', err)
    fail(res, 'Failed to save preferences', 'SAVE_FAILED', 500)
  }
})

// â”€â”€â”€ Sync Thresholds to Subjects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/sync-thresholds', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) { fail(res, 'User not found', 'NOT_FOUND', 404); return }

    const threshold = user.attendance_threshold ?? 75
    const semester = req.body.semester ? parseInt(String(req.body.semester)) : undefined

    const subjects = await prisma.subject.findMany({
      where: { user_id: userId, ...(semester ? { semester } : {}) },
      select: { id: true },
    })

    let modified = 0
    for (const subject of subjects) {
      await prisma.subject.update({ where: { id: subject.id }, data: { target: threshold } })
      modified += 1
    }

    await sysLog(req, userId, 'Thresholds Synced', `Updated ${modified} subjects to ${threshold}% target${semester ? ` (semester ${semester})` : ''}`).catch(() => { })
    await clearUserViewCache(userId).catch(() => { })
    ok(res, { message: `Updated ${modified} subjects`, threshold, modified })
  } catch (err) {
    console.error('[profile/sync-thresholds]', err)
    fail(res, 'Failed to sync thresholds', 'SYNC_FAILED', 500)
  }
})

// â”€â”€â”€ Biometric â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/biometric/register', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { public_key, device_id = 'default' } = req.body as { public_key?: string; device_id?: string }
    if (!public_key) { fail(res, 'Public key required', 'KEY_REQUIRED'); return }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { biometrics: true } })
    const biometrics = ((user?.biometrics as Record<string, unknown>) ?? {})
    biometrics[device_id] = { public_key, registered_at: new Date().toISOString() }
    await prisma.user.update({ where: { id: userId }, data: { biometrics: biometrics as any } })
    ok(res, { message: 'Biometric credential registered' })
  } catch (err) {
    console.error('[profile/biometric/register]', err)
    fail(res, 'Failed to register biometric', 'REGISTER_FAILED', 500)
  }
})

// â”€â”€â”€ System Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ActivityLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
})

router.get('/logs', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { limit } = ActivityLogsQuerySchema.parse(req.query)
    const cacheId = buildViewCacheId('system_logs', { limit })
    const cached = await readViewCache<any>(userId, cacheId)
    if (cached) { ok(res, cached, 200, 0); return }
    const logs = await prisma.systemLog.findMany({
      where: { user_id: userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })
    ok(res, logs, 200, 0)
    void writeViewCache(userId, cacheId, logs, 60_000).catch(() => {})
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[profile/logs]', err)
    fail(res, 'Failed to fetch logs', 'FETCH_FAILED', 500)
  }
})

router.delete('/account', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const parsed = DeleteAccountSchema.safeParse(req.body)
    if (!parsed.success) {
      fail(res, parsed.error.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400)
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      fail(res, 'User not found', 'USER_NOT_FOUND', 404)
      return
    }
    if (user.email.toLowerCase() !== parsed.data.confirmation_email.toLowerCase()) {
      fail(res, 'Confirmation email mismatch', 'EMAIL_MISMATCH', 403)
      return
    }

    await prisma.user.delete({ where: { id: userId } })
    await clearUserViewCache(userId).catch(() => {})
    invalidateAuthCache(req.headers.authorization?.slice(7))
    ok(res, { message: 'Account deleted permanently' })
  } catch (err) {
    console.error('[profile/delete-account]', err)
    fail(res, 'Failed to delete account', 'DELETE_FAILED', 500)
  }
})

export default router

