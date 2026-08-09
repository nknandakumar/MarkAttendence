# Classroom Attendance

A production-ready, 24/7 automated classroom attendance web application replacing legacy local Python/Flask/MySQL servers. The application is built with Next.js (App Router), TypeScript, React, Tailwind CSS, Neon PostgreSQL, and Drizzle ORM, optimized for seamless deployment on Vercel.

---

## 🌟 Key Capabilities & Principles

- **Zero Mentor Maintenance**: Deployed online 24/7. No terminal commands, no Python scripts, no daily server startup required.
- **Server-Side Classroom Public IP Protection**: Enforces attendance submissions exclusively from approved classroom Wi-Fi public IP addresses via `CLASSROOM_ALLOWED_IPS`.
- **Atomic Concurrency Protection**: High-throughput PostgreSQL unique constraint `(class_id, student_id, attendance_date)` prevents duplicate records even when 40–50 students submit simultaneously.
- **Simplified Workflow**: No attendance sessions, start/end buttons, QR codes, GPS, or OTPs. Class context is configured globally by the mentor (`current_class_id`).

---

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions & API Routes)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [Neon PostgreSQL](https://neon.tech/) (Serverless Cloud PostgreSQL)
- **ORM & Migrations**: [Drizzle ORM](https://orm.drizzle.team/) & Drizzle Kit
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & Lucide Icons
- **Authentication**: Secure HttpOnly cookies with JWT (`jose`) & `bcryptjs` password hashing
- **Validation**: [Zod](https://zod.dev/) input validation and phone number normalization
- **Export / Import**: CSV and XLSX spreadsheet generation & bulk import (`xlsx`)
- **Hosting Platform**: [Vercel](https://vercel.com/)

---

## 📁 Repository Structure

```
src/
├── app/
│   ├── page.tsx                      # Student attendance landing page (/)
│   ├── layout.tsx                    # Root application layout
│   ├── globals.css                   # Global styles & glassmorphism theme
│   ├── mentor/
│   │   ├── login/page.tsx            # Mentor authentication portal
│   │   ├── dashboard/page.tsx        # Overview & active class configuration
│   │   ├── classes/page.tsx          # Class creation & management
│   │   ├── students/page.tsx         # Student directory & bulk CSV/XLSX import
│   │   ├── attendance/page.tsx       # Live attendance records log
│   │   ├── reports/page.tsx          # Analytics & CSV/XLSX export
│   │   └── settings/page.tsx         # App settings & security network status
│   └── api/
│       ├── attendance/
│       │   ├── check-network/route.ts# Server-side IP verification
│       │   ├── mark/route.ts         # Fast attendance marking endpoint
│       │   └── route.ts              # Attendance records log API
│       ├── mentor/
│       │   ├── login/route.ts        # Mentor login route
│       │   ├── logout/route.ts       # Mentor logout route
│       │   └── me/route.ts           # Mentor session verification
│       ├── classes/
│       │   ├── route.ts              # Class list & creation
│       │   └── [id]/route.ts         # Class update/archive
│       ├── students/
│       │   ├── route.ts              # Student list & creation
│       │   ├── [id]/route.ts         # Student update/delete
│       │   └── import/route.ts       # Bulk CSV/XLSX student import
│       ├── reports/route.ts          # Student & class attendance reports & exports
│       └── settings/route.ts         # Application settings API
├── db/
│   ├── schema.ts                     # Source-of-truth Drizzle database schema
│   ├── index.ts                      # Neon database connection pool
│   ├── migrate.ts                    # Migration executor script
│   └── seed.ts                       # Development seed script
└── lib/
    ├── auth/session.ts               # JWT & bcrypt authentication session logic
    ├── network/
    │   ├── get-client-ip.ts          # Real IP extraction and normalization
    │   └── is-classroom-network.ts   # Server-side IP whitelist checking
    ├── validation/schemas.ts         # Zod schemas & phone normalization
    ├── rate-limit.ts                 # Sliding-window rate limiter
    └── export.ts                     # CSV and XLSX binary export utilities

drizzle/                              # Auto-generated SQL migration files
drizzle.config.ts                     # Drizzle Kit configuration file
.env.example                          # Environment variables template
```

---

## ⚡ Step-by-Step Setup Guide

### 1. Prerequisites
- Node.js (v18.x or later) installed locally.
- Git installed.
- A free [Neon PostgreSQL](https://neon.tech/) account.
- A free [Vercel](https://vercel.com/) account.

### 2. Local Installation

```bash
# Clone repository
git clone <your-repository-url>
cd attendenceApp

# Install dependencies
npm install
```

### 3. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Define the environment variables in `.env`:

```env
# Neon PostgreSQL Database URL
DATABASE_URL="postgresql://neondb_owner:your_neon_password@ep-example.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Secret string used to sign mentor session JWT cookies
MENTOR_SESSION_SECRET="classroom_attendance_super_secret_mentor_jwt_key_32bytes_long"

# Comma-separated list of approved classroom public IPv4 addresses
# Include 127.0.0.1 and ::1 for local testing
CLASSROOM_ALLOWED_IPS="127.0.0.1,::1,103.20.30.40"
```

### 4. Database Setup & Migrations (Neon PostgreSQL)

1. Create a project in [Neon PostgreSQL](https://neon.tech/).
2. Copy the Connection String from Neon dashboard and paste it as `DATABASE_URL` in `.env`.
3. Execute migrations to create all database tables:

```bash
npm run db:migrate
```

*(Alternatively, use `npm run db:push` during development).*

### 5. Seeding Demo Data

To populate demo classes, demo mentor, and sample students:

```bash
npm run db:seed
```

**Default Demo Mentor Credentials**:
- **Email**: `mentor@classroom.com`
- **Password**: `password123`

### 6. Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- Student Attendance Page: `http://localhost:3000/`
- Mentor Login Portal: `http://localhost:3000/mentor/login`

---

## 🚀 Deploying to Vercel (Production)

1. Push your code to GitHub repository.
2. Go to [Vercel](https://vercel.com/) -> **Add New Project**.
3. Import your GitHub repository.
4. Add Environment Variables in Vercel project settings:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `MENTOR_SESSION_SECRET`: A long random secret key.
   - `CLASSROOM_ALLOWED_IPS`: The actual classroom public IPv4 address (e.g. `103.20.30.40`).
5. Click **Deploy**. Vercel will automatically build and publish your app online 24/7.

---

## 🛡 Configuring & Changing Classroom Public IP

1. Find the classroom's public IP address (open `https://api.ipify.org` or Google "what is my IP" while connected to classroom Wi-Fi).
2. Go to **Vercel Dashboard** -> **Project Settings** -> **Environment Variables**.
3. Edit `CLASSROOM_ALLOWED_IPS` to set the new IP address:
   ```env
   CLASSROOM_ALLOWED_IPS="103.20.30.40"
   ```
4. Support multiple classroom IPs if needed:
   ```env
   CLASSROOM_ALLOWED_IPS="103.20.30.40,103.20.30.41"
   ```
5. Save and redeploy. The server-side network restriction updates instantly.

---

## 📊 Mentor Operations & Workflow

### 1. Login to Portal
Navigate to `/mentor/login`, enter your email and password.

### 2. Configure Current Attendance Class
On the **Dashboard** or **Settings** page, select the **Current Attendance Class** (e.g. Python). When students open the home page `/` on classroom Wi-Fi, their phone submission registers attendance for that selected class.

### 3. Managing Classes
Go to `/mentor/classes` to add new subjects (Python, SQL, Linux, etc.), edit descriptions, or archive older classes.

### 4. Adding & Importing Students
Go to `/mentor/students` to add students individually or use **Import CSV/XLSX** to upload student lists in bulk.
*Required spreadsheet columns*: `Name`, `Phone`.

### 5. Viewing & Exporting Attendance Reports
Go to `/mentor/reports` to inspect total sessions, present count, absent count, and attendance percentages per student or class. Click **Export CSV** or **Export XLSX** for spreadsheet downloads.

---

## 🔄 Transferring Project Ownership to Mentor

1. **GitHub Transfer**: Go to GitHub Repository Settings -> General -> Transfer ownership -> Enter mentor's GitHub handle.
2. **Vercel Transfer**: Go to Vercel Project Settings -> General -> Transfer Project -> Select mentor's Vercel account.
3. **Neon PostgreSQL Transfer**: Go to Neon Project Settings -> Transfer project or invite mentor as workspace admin.

---

## 💾 Database Backup & Maintenance

Neon PostgreSQL automatically creates continuous automated backups and snapshots. To take a manual SQL dump:

```bash
pg_dump "postgresql://neondb_owner:password@ep-example.us-east-1.aws.neon.tech/neondb?sslmode=require" > backup.sql
```
