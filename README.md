<p align="center">
  <img src="frontend/public/Semester-logo.png" alt="Semester Logo" width="140" />
</p>

# Semester — Your Academic Operating System

Semester is a high-performance, full-stack Academic Operating System designed for college students. It provides real-time attendance compliance tracking, target analysis, and interactive AI study assistance inside a premium dark-themed PWA container.

---

## 🚀 Key Features

- 📅 **Timetable & Attendance Log**: Plan weekly slots and record classes with substitution/cancellation support. Consecutive periods of the same subject share one smart attendance mark, while a later occurrence after another class is tracked separately.
- 📊 **Target Compliance & Bunk Guard**: Dynamic compliance indicators showing how many classes you can bunk or must attend to stay above your target percentage.
- 🤖 **Semester Assistant**: Contextual study chat assistant powered by Groq LLM with automatic failover to Google Gemini.
- 💾 **Google Drive Auto-Sync**: Auto-backup and sync academic data to your private Google AppData folder.
- 🔑 **Account Migration**: Cryptographically signed migration tokens to easily transfer data to another account.

---

## 📂 Project Structure

Semester is structured as a monorepo:
- **`frontend/`**: React + TypeScript + Vite Single Page Application (PWA).
- **`api-node/`**: Node.js + Express + Prisma + Neon PostgreSQL API backend.

---

## 🔑 Environment Setup

### Backend (`api-node/.env`)
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your_jwt_secret"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GROQ_API_KEY="your_groq_api_key"
GEMINI_API_KEY="your_gemini_api_key"
PORT=5001
NODE_ENV=development
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL="http://localhost:5001"
VITE_GOOGLE_CLIENT_ID="your_google_client_id"
```

---

## 🛠️ Quick Start

You can run the entire workspace concurrently from the root directory:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Sync Database Schema**:
   ```bash
   cd api-node
   npx prisma db push
   cd ..
   ```

3. **Start Development Servers**:
   ```bash
   npm run dev
   ```
   * Frontend will start on `http://localhost:5173`
   * Backend API will start on `http://localhost:5001`

---

## 🧪 Testing

Run the attendance backend test suite to verify DB connectivity, all attendance marking statuses, counter logic, duplicate detection, substitution flow, and query filters — without touching any real data:

```bash
cd api-node
npx tsx scripts/test-attendance.ts
```

> All test data is created under a sentinel semester (`99`) with dates in year `2000` and is fully cleaned up after the run.
