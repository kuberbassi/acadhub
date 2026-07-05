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
│   │   ├── pages/               # Main pages (Dashboard, Settings, Timetable, Calendar, etc.)
│   │   ├── services/            # Axios API client handlers
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/               # PDF rendering & calculation routines
│   └── package.json
```

---

## 2. Database Schema (Prisma)

**Prisma Schema File**: `api-node/prisma/schema.prisma`

All tables are deployed on a Serverless PostgreSQL database (Neon). Below is the comprehensive schema documentation:

### 2.1 Model: `User` (Table: `users`)
Contains base profile data, targets, and auth configurations. Deleting a user cascades deletions down to all child rows.

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique user identifier. |
| `google_id` | `String` | `@unique` | Linked Google authentication identity. |
| `email` | `String` | `@unique` | Primary email address. |
| `name` | `String` | | Display name of the user. |
| `picture` | `String?` | | Profile avatar URL. |
| `branch` | `String?` | | Engineering / academic branch. |
| `course` | `String?` | | Current degree course. |
| `college` | `String?` | | Name of the institution. |
| `batch` | `String?` | | Batch code. |
| `enrollment_number` | `String?`| | Student registry identifier. |
| `admission_year` | `String?` | | Year of admission. |
| `current_semester` | `Int` | `@default(1)` | Current active semester. |
| `target_attendance` | `Int` | `@default(75)` | Default target attendance percentage. |
| `attendance_threshold`| `Int` | `@default(75)` | Minimum threshold target limit. |
| `warning_threshold` | `Int` | `@default(76)` | Threshold warning color limit. |
| `biometrics` | `Json` | `@default("{}")` | Biometric configuration flags. |
| `created_at` | `DateTime` | `@default(now())` | Creation date. |
| `updated_at` | `DateTime` | `@updatedAt` | Automatic update timestamp. |

---

### 2.2 Model: `UserSession` (Table: `user_sessions`)
Represents active refresh tokens, logged-in browsers, and session parameters.

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique session identifier. |
| `user_id` | `String` | | Foreign key referencing `User.id`. |
| `device_id` | `String?` | | Unique hardware signature. |
| `refresh_token_hash` | `String` | `@unique` | Securely hashed OAuth token. |
| `refresh_expires_at` | `DateTime`| | Session expiration timestamp. |
| `refresh_issued_at` | `DateTime`| `@default(now())` | Issuance timestamp. |
| `ip` | `String?` | | Client IP address. |
| `user_agent` | `String?` | | User agent header string. |
| `last_active_at` | `DateTime`| `@default(now())` | Last session heartbeat ping. |
| `rotated_at` | `DateTime?`| | Token rotation grace period marker. |
| `created_at` | `DateTime`| `@default(now())` | Creation date. |

---

### 2.3 Model: `Subject` (Table: `subjects`)
Tracks subjects, compliance requirements, practicals, assignments, and credit hours.

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique subject identifier. |
| `user_id` | `String` | | Foreign key referencing `User.id`. |
| `name` | `String` | | Display name of the subject. |
| `code` | `String` | `@default("")` | Academic course code. |
| `professor` | `String` | `@default("")` | Professor's name. |
| `classroom` | `String` | `@default("")` | Room / lecture hall number. |
| `semester` | `Int` | `@default(1)` | Mapped academic semester. |
| `type` | `String` | `@default("theory")` | Type of subject (e.g. `theory`, `practical`). |
| `credits` | `Int?` | | Subject weight credits. |
| `attended` | `Int` | `@default(0)` | Count of attended lectures. |
| `total` | `Int` | `@default(0)` | Count of total lectures. |
| `target` | `Int` | `@default(75)` | Specific attendance target % for this subject. |
| `categories` | `String[]` | | Array of assigned categories (Theory, Practical). |
| `practicals` | `Json?` | | Practical checklist (total, completed, hardcopy). |
| `assignments` | `Json?` | | Assignment checklist (total, completed, hardcopy). |
| `syllabus` | `String?` | | Subject syllabus detailed text. |
| `created_at` | `DateTime` | `@default(now())` | Row creation timestamp. |
| `updated_at` | `DateTime` | `@updatedAt` | Row update timestamp. |

---

### 2.4 Model: `AttendanceLog` (Table: `attendance_logs`)
Tracks individual marked attendance logs.

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique log entry identifier. |
| `user_id` | `String` | | Foreign key referencing `User.id`. |
| `subject_id` | `String` | | Foreign key referencing `Subject.id`. |
| `subject_name` | `String` | | Helper string cache of subject name. |
| `date` | `String` | | Date of lecture (Format: `YYYY-MM-DD`). |
| `status` | `Enum` | `AttendanceStatus` | `present`, `absent`, `late`, `medical`, `substituted`, `cancelled`. |
| `type` | `String` | `@default("Lecture")` | Type of slot (e.g. `Lecture`, `Practical`). |
| `notes` | `String?` | | Student notes. |
| `semester` | `Int?` | | Cached semester number. |
| `substituted_by`| `String?` | | Foreign key referencing substitute subject ID. |
| `timestamp` | `DateTime` | `@default(now())` | Entry log creation time. |

---

### 2.5 Model: `ManualCourse` (Table: `manual_courses`)
Tracks non-academic online certifications (e.g., Coursera, Udemy).

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique course identifier. |
| `user_id` | `String` | | Foreign key referencing `User.id`. |
| `name` | `String?` | | Title of the online course. |
| `platform` | `String?` | | Hosting platform provider. |
| `status` | `String?` | | e.g. `not_started`, `in_progress`, `Completed`. |
| `progress` | `Int` | `@default(0)` | Completion percentage. |
| `url` | `String?` | | Hyperlink reference. |
| `notes` | `String?` | | Study notes. |
| `extra` | `Json?` | | Free-form key-value metadata. |
| `created_at` | `DateTime` | `@default(now())` | Row creation timestamp. |

---

### 2.6 Model: `Timetable` (Table: `timetable`)
Stores slot timetables and weekly class matrices.

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique timetable identifier. |
| `user_id` | `String` | | Foreign key referencing `User.id`. |
| `semester` | `Int` | `@default(1)` | Corresponding semester number. |
| `schedule` | `Json` | `@default("{}")` | Map of weekly schedules (e.g. Monday slots array). |
| `periods` | `Json?` | | Configured period slots. |
| `updated_at` | `DateTime` | `@default(now())`, `@updatedAt`| Row modification timestamp. |

---

### 2.7 Model: `UserPreference` (Table: `user_preferences`)
Handles application configs (e.g. google drive token, theme states).

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique preference row identifier. |
| `user_id` | `String` | `@unique` | Foreign key referencing `User.id`. |
| `preferences` | `Json` | `@default("{}")` | Key-value settings dictionary. |
| `updated_at` | `DateTime` | `@default(now())`, `@updatedAt`| Preference update timestamp. |

---

### 2.8 Model: `UserBackup` (Table: `user_backups`)
Handles secure automated backups.

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique backup identifier. |
| `user_id` | `String` | | Foreign key referencing `User.id`. |
| `backup_type` | `String` | `@default("pre_delete_auto")`| System-labeled type (e.g. `pre_import_auto`). |
| `data` | `Json` | `@default("{}")` | Hashed/secure backup data payload. |
| `created_at` | `DateTime` | `@default(now())` | Creation date. |
| `expires_at` | `DateTime` | | Deletion schedule timestamp. |

---

### 2.9 Model: `SystemLog` (Table: `system_logs`)
Tracks user logs and system heartbeats.

| Field Name | Type | Attributes / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id`, `@default(cuid())` | Unique system log entry identifier. |
| `user_id` | `String` | | Foreign key referencing `User.id`. |
| `action` | `String` | | Log action title. |
| `description`| `String` | | Detailed activity explanation. |
| `ip` | `String?` | | Client IP registry. |
| `user_agent` | `String?` | | Client user agent registry. |
| `timestamp` | `DateTime` | `@default(now())` | Activity occurrence date/time. |

---

## 3. Key Architectural Workflows

### 3.1 ☁️ Google Drive Sync
Users can authenticate with Google Drive to back up their data. The backend connects directly to Google APIs using OAuth tokens to perform `multipart/related` file uploads inside Google Drive's private sandbox folder (`appDataFolder`). The system retains the 5 most recent backups and automatically cleans up older files.

### 3.2 🔑 Cryptographic Account Migration
Semester enables seamless data migrations. The source user initiates migration, generating a cryptographically-signed token containing their user ID and expiration date.
The destination account submits this token. The backend verifies the signature, initiates safety backups for both accounts, wipes the destination data, transfers the source records, updates the destination profile fields, and deletes the source user account.

### 3.3 🤖 LLM Failover In Semester Assistant
The AI Semester Assistant uses a Groq LLM (`llama-3.3-70b-versatile`) to generate query completions. In the event of rate limit errors or API timeouts, it falls back to a Google Gemini API (`gemini-2.5-flash`) stream, guaranteeing uninterrupted utility for users.
