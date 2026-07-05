<p align="center">
  <img src="frontend/public/Semester-logo.png" alt="Semester Logo" width="140" />
</p>

# Semester — Your Academic Operating System

Semester is a high-performance, full-stack Academic Operating System designed for college students. It provides real-time attendance compliance tracking, IPU portal scraper automation, target analysis, and interactive AI study assistance inside a premium dark-themed PWA container.

## Key Features

- 📅 **Timetable & Attendance Log**: Plan weekly slots and record classes with substitution/cancellation support.
- 📊 **Target Compliance & Bunk Guard**: Dynamic compliance indicators showing how many classes you can bunk or must attend to stay above your target percentage.
- 🤖 **Semester Assistant**: Contextual study chat assistant powered by Groq LLM with automatic failover to Google Gemini.
- 💾 **Google Drive Auto-Sync**: Auto-backup and sync academic data to your private Google AppData folder.
- 🔑 **Account Migration**: Cryptographically signed migration tokens to easily transfer data to another account.

## Monorepo Layout

- `frontend/`: React + TypeScript + Vite + Tailwind CSS Single Page Application (PWA).
- `api-node/`: Node.js + Express + Prisma + Neon PostgreSQL Serverless API backend.

## Environment Variables

### Backend (`api-node/.env`)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GROQ_API_KEY=...
GEMINI_API_KEY=...
ALLOWED_ORIGINS=http://localhost:5173
PORT=5001
NODE_ENV=development
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=...
```

## Quick Start

1. **Database Push**: `cd api-node && npx prisma db push`
2. **Launch Backend**: `cd api-node && npm run dev` (Runs on port `5001`)
3. **Launch Frontend**: `cd frontend && npm run dev` (Runs on port `5173`)
