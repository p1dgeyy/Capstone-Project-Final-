# Capstone Project - PESO/CSWDO Portal & Dashboard System

A modern portal and administrative dashboard system built for the City of Koronadal. This project features secure portal logins for beneficiaries, PESO administrators/officers, CSWDO administrators/officers, and evaluators.

**Backend:** [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS)
**Frontend:** Vanilla HTML/CSS/JS deployed on Vercel
**Auth:** Supabase Auth (email + password)

---

## 📂 Project Structure

```
Capstone-Project-Final-/
├── frontend/                     # Front-end user-facing files & dashboards
│   ├── assets/                   # Static assets & scripts
│   │   ├── js/                   # Client JavaScript modules
│   │   │   ├── supabase-config.js  # Supabase client initialization
│   │   │   ├── auth-guard.js       # Route protection hook
│   │   │   ├── session-manager.js  # Session management (Supabase Auth)
│   │   │   ├── audit_nav.js
│   │   │   ├── beneficiary.js
│   │   │   ├── peso-safeguards.js
│   │   │   ├── peso_officer.js
│   │   │   └── system-notifications.js
│   │   ├── city_of_koronadal.jpeg
│   │   └── koronadalseal.png
│   ├── index.html                # Main entry point (redirects to official_login)
│   ├── official_login.html       # Portal Login for Beneficiaries
│   ├── admin_login.html          # Portal Login for Admins & Staff
│   ├── beneficiary.html          # Beneficiary Dashboard
│   ├── beneficiary_register.html # Beneficiary Registration Form
│   ├── peso_officer.html         # PESO Officer Dashboard
│   ├── peso_admin.html           # PESO Admin Dashboard
│   ├── cswdo_officer.html        # CSWDO Officer Dashboard
│   ├── cswdo_admin.html          # CSWDO Admin Dashboard
│   ├── evaluator.html            # Evaluator Dashboard
│   └── vercel.json               # Vercel deployment routing configuration
├── database/
│   └── supabase_schema.sql       # PostgreSQL schema + Row Level Security policies
├── package.json                  # Project metadata & Supabase dependency
└── README.md                     # Project documentation
```

---

## 🔧 Setup & Environment Variables

### Supabase
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run `database/supabase_schema.sql` in the Supabase SQL Editor to create all tables and RLS policies.
3. Set these environment variables in **Vercel** (or your `.env` file):

| Variable | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase project URL (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key |

> **Note:** These keys are used client-side. Security is enforced via Supabase **Row Level Security (RLS)** policies, not by hiding the anon key.

### Vercel
- The `frontend/` directory is deployed to Vercel.
- `vercel.json` handles SPA-style routing (all paths → `index.html`).

---

## 🌐 Authentication

The system uses **Supabase Auth** for authentication:

- **Login:** `supabaseClient.auth.signInWithPassword({ email, password })`
- **Registration:** `supabaseClient.auth.signUp({ email, password, options: { data: { ... } } })`
- **Session:** Managed by Supabase JS client; access tokens are stored automatically.
- **Route Protection:** `auth-guard.js` checks for an active session and redirects unauthenticated users.

### User Roles
| Role | Portal | Dashboard |
| :--- | :--- | :--- |
| PESO Admin | `/admin_login` | `peso_admin.html` |
| PESO Officer | `/admin_login` | `peso_officer.html` |
| CSWDO Admin | `/admin_login` | `cswdo_admin.html` |
| CSWDO Officer | `/admin_login` | `cswdo_officer.html` |
| Evaluator | `/admin_login` | `evaluator.html` |
| Beneficiary | `/official_login` | `beneficiary.html` |

---

## 🗄️ Database Schema

The database uses **PostgreSQL** via Supabase with the following core tables:

- `users_profile` — User accounts (linked to Supabase Auth via `auth_id`)
- `programs` — PESO/CSWDO assistance programs
- `applications` — Beneficiary applications with officer/admin evaluation workflow
- `interview_schedules` — Interview scheduling with attendance tracking
- `audit_logs` — System-wide audit trail
- `approved_assistance` — Approved assistance records
- `notifications` — SMS/notification dispatch logs

All tables have **Row Level Security (RLS)** enabled.

---

## 💻 Running the Localhost Server (Testing)

You can run the localhost server using either of the methods below:

### Option 1: Quick Start with Node.js (Zero-Setup)
1. Double-click `start-server.bat` (on Windows), or run:
   ```bash
   npm start
   # or
   npm run dev
   # or
   node server.js
   ```
2. Open your browser at **[http://localhost:3000](http://localhost:3000)**.

### Option 2: Containerized with Docker (Nginx)
1. Ensure Docker Desktop is running.
2. Launch the container using Docker Compose:
   ```bash
   docker compose up -d
   ```
3. Open your browser at **[http://localhost:3000](http://localhost:3000)**.
4. To stop the container:
   ```bash
   docker compose down
   ```

