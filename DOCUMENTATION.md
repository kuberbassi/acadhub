# Semester — Core Technical Documentation

Semester is a full-stack, responsive Academic Operating System designed to help college students track compliance, view schedules, query their records via an AI assistant, and manage backups.

---

## 1. Directory Structure & Architecture

Semester is structured as a monorepo containing two active primary directories:
- **`frontend/`**: Single Page Application built on React, Vite, and TypeScript, compiled into a progressive web app (PWA).
- **`api-node/`**: Core API server built on Express, TypeScript, and Prisma ORM, deployed on Neon Serverless PostgreSQL.

```
Semester/
├── api-node/                     # Express Backend Engine
│   ├── prisma/
│   │   └── schema.prisma        # Database schema definitions
│   ├── scripts/                  # Developer smoke testing & IPU validation scripts
│   ├── src/
│   │   ├── app.ts               # Express configuration, rate limiting, & security middlewares
│   │   ├── index.ts             # Server runtime entry point
│   │   ├── config/              # Prisma singleton & environment verification
│   │   ├── middleware/          # Authorization checks & platform parsing
│   │   ├── routes/              # Modular API endpoints
│   │   ├── utils/               # LLM, Google Drive, & response wrappers
│   │   └── vercel.ts            # Vercel serverless integration
│   └── package.json
│
├── frontend/                    # Vite + React Client App
│   ├── public/                  # Logo images, manifest configurations, and sw.js
│   ├── src/
│   │   ├── App.tsx             # Application router
│   │   ├── index.css            # Custom CSS Variables and Dark Mode theme configurations
│   │   ├── components/
│   │   │   ├── layout/          # AIChat sidebar, BottomNav, and layout wrapper
│   │   │   ├── modals/          # Modal sheets (subject edits, timetables)
│   │   │   └── ui/              # Reusable responsive buttons, inputs, & modals
│   │   ├── contexts/            # Global Auth, Semester, and Theme providers
│   │   ├── hooks/               # Custom lifecycle handlers
│   │   ├── pages/               # Main application pages
│   │   ├── services/            # Axios API client handlers
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/               # PDF rendering & calculation routines
│   └── package.json
```

---

## 2. Active vs. Obsolete Files Audit

### 🗑️ Obsolete Files Cleaned Up
The following files were identified as obsolete, unused, or temporary dev scripts and have been permanently purged:
- `api` (empty directory proxy)
- `api-node/fix.js` (refactoring script)
- `api-node/src/routes/ipu.ts` (unmounted routes)
- `api-node/src/routes/notes.ts` (unreferenced notes API routes)
- `api-node/src/routes/skills.ts` (unreferenced skills API routes)
- `api-node/src/services/ipuClient.ts` (unreferenced scraping service)
- `api-node/src/services/ipuResultsFetcher.service.ts` (unreferenced scraping service)
- `api-node/scripts/test-ipu-connectivity.ts` (obsolete developer script)
- `api-node/scripts/test-ipu-parallel.ts` (obsolete developer script)
- `frontend/eval4.js` (scratch db script)
- `frontend/replace_spinners.cjs` (regex utility script)
- `frontend/src/components/ScheduleGrid.tsx` (unused component)
- `frontend/src/components/dashboard/StatCard.tsx` (unused component)
- `frontend/src/components/dashboard/SubjectCard.tsx` (unused component)
- `frontend/src/services/skills.service.ts` (unused api service)
- `frontend/src/services/resume.service.ts` (unused api service)
- `frontend/src/services/google-classroom.service.ts` (unused api service)
- `frontend/src/utils/pushNotifications.ts` (unused utility)
- `frontend/src/utils/downloadResultsPdf.ts` (unused utility)

### 📂 Active Files Manifest
All other source files in `frontend/src/` and `api-node/src/` are actively used:
- **Pages**: `Dashboard.tsx`, `Courses.tsx`, `TimeTable.tsx`, `Calendar.tsx`, `Settings.tsx`, `Landing.tsx`, `Login.tsx`, `NotFound.tsx`, `Practicals.tsx`, `PrivacyPolicy.tsx`, `TermsOfService.tsx`.
- **Modals**: `EditSubjectModal.tsx`, `AttendanceModal.tsx`, `AddSubjectModal.tsx`, `SlotModal.tsx`, `StructureModal.tsx`.
- **Services**: `api.ts` (Axios client), `auth.service.ts` (OAuth login requests), `attendance.service.ts` (core logs, subjects, Google Drive backups, and account migrations), `dashboardService.ts` (dashboard analytics).

---

## 3. Database Schema (Prisma)

**File**: `api-node/prisma/schema.prisma`

### Core Models & Relationships:
1. **`User`**: Base profile record containing email, course, college, targets, and auth parameters. Cascades deletions down to all children records.
2. **`UserSession`**: Represents active refresh tokens, logged-in browsers, IPs, and agent metadata. Used for device session tracking.
3. **`Subject`**: Tracks name, credits, categories (Theory, Practical, Assignment), code, professor details, and target attendance.
4. **`AttendanceLog`**: Individual marked attendance entries linked to a `Subject` with status (e.g. `present`, `absent`, `late`, `medical`, `substituted`, `cancelled`).
5. **`ManualCourse`**: Tracks non-academic online learning certifications.
6. **`Timetable`**: Stores weekly time slots and schedule matrices mapped to subjects.
7. **`UserPreference`**: Stores JSON parameters like active Google Drive integration states.
8. **`UserBackup`**: Handles transient pre-wipe security back-ups.

---

## 4. Key Architectural Workflows

### ☁️ Google Drive Sync
Users can authenticate with Google Drive to back up their data. The backend connects directly to Google APIs using oauth tokens to perform `multipart/related` file uploads inside Google Drive's private sandbox folder (`appDataFolder`). The system retains the 5 most recent backups and automatically cleans up older files.

### 🔑 Cryptographic Account Migration
Semester enables seamless data migrations. The source user initiates migration, generating a cryptographically-signed token containing their user ID and expiration date.
The destination account submits this token. The backend verifies the signature, initiates safety backups for both accounts, wipes the destination data, transfers the source records, updates the destination profile fields, and deletes the source user account.

### 🤖 LLM Failover In Semester Assistant
The AI Semester Assistant uses aGroq LLM (`llama-3.3-70b-versatile`) to generate query completions. In the event of rate limit errors or API timeouts, it falls back to a Google Gemini API (`gemini-2.5-flash`) stream, guaranteeing uninterrupted utility for users.
