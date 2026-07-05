/**
 * API Version Router — v1
 *
 * Mounts all domain routers under /api/v1/ namespace.
 * This is the canonical versioned API that both web and mobile consume.
 *
 * Structure:
 *   /api/v1/auth/*          — Authentication (Google OAuth, JWT)
 *   /api/v1/subjects/*      — Legacy subject CRUD
 *   /api/v1/attendance/*    — Attendance marking, logs, calendar, classes
 *   /api/v1/academic/*      — Subjects, results, courses (academic domain)
 *   /api/v1/dashboard/*     — Dashboard data, reports, analytics, notifications
 *   /api/v1/timetable/*     — Timetable and slots
 *   /api/v1/profile/*       — User profile, preferences, biometric, system logs
 *   /api/v1/skills/*        — Skills tracker
 *   /api/v1/data/*          — Export, import, backup, restore, delete
 *   /api/v1/scraper/*       — Notice scraper
 */

import { Router } from 'express'
import authRoutes from './auth.js'
import subjectRoutes from './subjects.js'
import attendanceRoutes from './attendance.js'
import academicRoutes from './academic.js'
import dashboardRoutes from './dashboard.js'
import timetableRoutes from './timetable.js'
import profileRoutes from './profile.js'
import dataRoutes from './data.js'
import aiRoutes from './ai.js'

const v1Router = Router()

v1Router.use('/auth', authRoutes)
v1Router.use('/subjects', subjectRoutes)
v1Router.use('/attendance', attendanceRoutes)
v1Router.use('/academic', academicRoutes)
v1Router.use('/dashboard', dashboardRoutes)
v1Router.use('/timetable', timetableRoutes)
v1Router.use('/profile', profileRoutes)
v1Router.use('/data', dataRoutes)
v1Router.use('/ai', aiRoutes)

export default v1Router
