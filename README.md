# Classroom Attendance App

A full-stack, serverless classroom attendance application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Neon PostgreSQL**, and **Drizzle ORM**.  
Optimized for continuous 24/7 serverless deployment on **Vercel**. 🚀

---

## 🚀 Key Technical Features

- **App Router Architecture**: Leverages Next.js Server Actions and Route Handlers for backend operations.  
- **Server-Side IP Whitelisting**: Restricts attendance logging strictly to authorized classroom Wi-Fi public IP addresses via headers evaluation.  
- **Concurrency & Anti-Duplicate Protection**: Composite PostgreSQL unique constraint `(class_id, student_id, attendance_date)` safely absorbs burst submissions (40–50 concurrent requests).  
- **Session Management**: Custom JWT authentication (`jose`) paired with `bcryptjs` for secure HttpOnly cookie management.  
- **Dynamic File I/O**: Automated bulk ingestion and export of CSV/XLSX files via standard stream processing.  

---

## 🛠 Tech Stack

| Category      | Technology |
|---------------|------------|
| Framework     | Next.js (App Router, React) |
| Language      | TypeScript |
| Database      | Neon PostgreSQL (Serverless Engine) |
| ORM           | Drizzle ORM + Drizzle Kit |
| Styling       | Tailwind CSS + Lucide Icons |
| Validation & Auth | Zod, jose (JWT), bcryptjs |
| Data Parsing  | XLSX / CSV handling (`xlsx`) |

---
src/
├── app/
│   ├── page.tsx                      # Student attendance landing page
│   ├── layout.tsx                    # Root layout
│   ├── mentor/                       # Mentor administrative UI routes
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── classes/
│   │   ├── students/
│   │   ├── attendance/
│   │   ├── reports/
│   │   └── settings/
│   └── api/                          # REST API Endpoints
│       ├── attendance/               # IP verification & submission handlers
│       ├── mentor/                   # Auth routes (login, logout, session check)
│       ├── classes/                  # Class CRUD routes
│       ├── students/                 # Student CRUD & bulk import endpoints
│       ├── reports/                  # Analytics & export generation
│       └── settings/                 # Application configuration endpoints
├── db/
│   ├── schema.ts                     # Single-source-of-truth database schema
│   ├── index.ts                      # Neon PostgreSQL client initialization
│   ├── migrate.ts                    # Migration script runner
│   └── seed.ts                       # Seed data handler
└── lib/
    ├── auth/session.ts              # JWT session creation & verification
    ├── network/                      # Client IP detection & subnet evaluation logic
    ├── validation/schemas.ts        # Zod input validation schemas
    ├── rate-limit.ts                 # Sliding-window rate limiting helper
    └── export.ts                     # Binary spreadsheet export utilities

---

## ⚙️ Development Environment Setup

### 1. Installation
```bash
git clone <repository-url>
cd attendanceApp
npm install

DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<db_name>?sslmode=require"
MENTOR_SESSION_SECRET="your-32-character-secret-key-goes-here"
CLASSROOM_ALLOWED_IPS="127.0.0.1,::1,103.20.30.40"

# Push schema changes directly (Development)
npm run db:push

# Generate and apply migrations
npm run db:generate
npm run db:migrate

# Seed local database
npm run db:seed

npm run dev


---

Now you can copy this entire block in one go and drop it straight into your README.md.
## 📁 Repository Structure

