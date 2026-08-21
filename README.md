# City of Koronadal - Integrated PESO & CSWDO Livelihood and Social Welfare Portal System

[![Vercel Deployment](https://img.shields.io/badge/Deployment-Vercel-black?style=flat&logo=vercel)](https://vercel.com)
[![Backend: Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com)
[![Architecture: Modular JS](https://img.shields.io/badge/Frontend-Modular%20JS%20Suite-F7DF1E?style=flat&logo=javascript)](https://developer.mozilla.org)
[![Compliance: Data Privacy Act](https://img.shields.io/badge/Compliance-RA%2010173%20(Data%20Privacy)-blue?style=flat)](https://privacy.gov.ph)

A centralized, responsive, and secure administrative portal and dashboard system engineered for the **City Government of Koronadal**. The system manages social welfare services, employment facilitation, and livelihood programs across the **Public Employment Service Office (PESO)** and the **City Social Welfare and Development Office (CSWDO)**.

---

## 🚀 Key Features & Architectural Upgrades

### 1. Zero-Flicker Route Guard & Role-Based Access Control (RBAC)
- **Zero Auth Flicker Shield:** CSS class injection (`html.auth-pending`) hides DOM elements at parse-time until Supabase session verification resolves, completely eliminating unauthorized layout flashes.
- **Strict Role-Based Routing:**
  - `peso_admin.html` strictly allows `PESO Admin`.
  - `peso_officer.html` strictly allows `PESO Officer`.
  - `cswdo_admin.html` strictly allows `CSWDO Admin`.
  - `cswdo_officer.html` strictly allows `CSWDO Officer`.
  - Cross-role attempts are intercepted and routed to the user's dedicated dashboard with status alerts.
- **Dual-Storage Session Purge:** Centralized session invalidation via `session-manager.js` thoroughly clears `sessionStorage`, `localStorage`, and Supabase cached JWT tokens on logout or token expiry.

### 2. Modular Domain-Driven Script Suite (`frontend/assets/js/peso/`)
The PESO client architecture has been refactored from legacy monolithic scripts into decoupled, domain-specific modules:

| Module | File | Core Responsibilities |
| :--- | :--- | :--- |
| **Authentication & Profile** | `peso-auth.js` | Session validation, role guardrails (`isAdmin`, `isOfficer`), and department isolation. |
| **Live Metrics & Trends** | `peso-dashboard.js` | Real-time KPI computations, Chart.js trend visualizations, and immutable activity feed. |
| **Programs & Assignments** | `peso-programs.js` | Program catalog, 3-level assignment drilldown, active beneficiary deactivation safeguard, and read-only archive with permanent delete. |
| **Evaluations & Cases** | `peso-evaluations.js` | 3-level evaluation queue, strictly read-only case file inspection modal, document previews, and mandatory denial remarks validation. |
| **Scheduling & Calendar** | `peso-scheduling.js` | Calendar/list views, past-date booking restriction, time-slot/venue conflict detection, cancelled activity red labels, and certificate recipient auto-pull. |
| **Funds & Disbursals** | `peso-funds.js` | Live fund balances, budget progress bars, &ge;85% threshold alerts, admin-only disbursement authorization, and disbursement logs. |
| **System Reports Engine** | `peso-reports.js` | Multi-module query builder, date-range filtering, UTF-8 BOM CSV exporter, printable official summary views, and export audit logging. |
| **Officer Portal Controller** | `peso-officer.js` | Officer-managed beneficiary intake, email & SMS OTP verification, dynamic QR generation & printing, interview attendance, and livelihood batches. |
| **Admin Master Controller** | `peso-admin.js` | 9-Tab master navigation switcher, safe modal controller with backdrop watchdog, officer directory RBAC, and immutable audit trail viewer. |

### 3. Data Privacy & Compliance Safeguards
- **Data Privacy Act (RA 10173):** Sensitive contact numbers are masked (e.g., `09XX-***-XXXX`) across all tables, modal inspection cards, and export views.
- **Read-Only Inspection Modals:** All case files, schedule inspections, and ordinance references are strictly view-only.
- **Active Beneficiary Deactivation Safeguard:** Programs with active beneficiaries block deactivation until beneficiaries are completed or transferred.
- **Conflict Validation:** Blocks creating appointments in past dates and validates venue/time-slot overlapping conflicts.
- **Dual OTP Intake:** Beneficiary registration includes Gmail verification code and SMS OTP verification before enrollment is finalized.
- **Immutable Audit Trail:** All critical operations (Create, Update, Activate, Deactivate, Cancel, Archive, Delete, Disburse, Export) are logged with timestamp and user identity.

---

## 📂 Project Directory Structure

```
Capstone-Project-Final-/
├── frontend/                          # Client-side web application
│   ├── assets/                        # Static assets, CSS, images, and JavaScript
│   │   ├── css/                       # Unified CSS styling & component stylesheets
│   │   │   ├── unified-overlays.css   # Modals, toasts, and overlay styling
│   │   │   ├── peso-admin.css         # PESO Admin layout and component styles
│   │   │   └── portal-login.css       # Unified login styles
│   │   ├── js/                        # Core system & client JavaScript modules
│   │   │   ├── peso/                  # Modular PESO JavaScript Suite (NEW)
│   │   │   │   ├── peso-auth.js       # Auth & role checking
│   │   │   │   ├── peso-dashboard.js  # Dashboard KPIs & Chart.js visualizer
│   │   │   │   ├── peso-programs.js   # Program catalog & assignment drilldown
│   │   │   │   ├── peso-evaluations.js# Evaluation queue & read-only case modal
│   │   │   │   ├── peso-scheduling.js # Calendar & scheduling conflict checker
│   │   │   │   ├── peso-funds.js      # Budget tracker & disbursement guardrail
│   │   │   │   ├── peso-reports.js    # Report generator & UTF-8 CSV exporter
│   │   │   │   ├── peso-officer.js    # Officer portal master controller
│   │   │   │   └── peso-admin.js      # Admin portal master controller
│   │   │   ├── auth-guard.js          # Zero-flicker route guard & RBAC enforcement
│   │   │   ├── session-manager.js     # Multi-storage session management
│   │   │   ├── otp-auth.js            # Dual-factor Email & SMS OTP verification
│   │   │   ├── qr-scanner-controller.js# Html5Qrcode camera scanner modal
│   │   │   ├── system-notifications.js# Toast & system notification engine
│   │   │   ├── supabase-config.js     # Supabase client initialization
│   │   │   └── supabase-data.js       # DataService API & realtime manager
│   │   └── city_of_koronadal.jpeg     # Official LGU assets
│   ├── admin_login.html               # Staff & Administrator Login Portal
│   ├── official_login.html            # Beneficiary Citizen Login Portal
│   ├── peso_admin.html                # PESO Administrator Portal (9 Modules)
│   ├── peso_officer.html              # PESO Officer Portal
│   ├── cswdo_admin.html               # CSWDO Administrator Portal
│   ├── cswdo_officer.html             # CSWDO Officer Portal
│   ├── beneficiary.html               # Citizen Beneficiary Portal
│   ├── index.html                     # Root redirector
│   └── vercel.json                    # Vercel deployment routing configuration
├── database/
│   ├── supabase_schema.sql            # Core PostgreSQL schema & RLS policies
│   └── seed_users.sql                 # Seed administrative and test accounts
├── server.js                          # Local development HTTP server
├── package.json                       # Project configuration & dependencies
└── README.md                          # Comprehensive project documentation
```

---

## 🔐 Portal Access Matrix

| Role | Access URL | Target Dashboard | Permitted Actions |
| :--- | :--- | :--- | :--- |
| **PESO Admin** | `/admin_login.html` | `peso_admin.html` | Program CRUD, Budget Allocation, Officer Accounts, Ordinance Uploads, System Reports. |
| **PESO Officer** | `/admin_login.html` | `peso_officer.html` | Beneficiary Intake, OTP Verification, QR Issuance, Daily Interviews, Application Evaluation. |
| **CSWDO Admin** | `/admin_login.html` | `cswdo_admin.html` | CSWDO Program & Case Management, Budget Adjustments, Reports. |
| **CSWDO Officer** | `/admin_login.html` | `cswdo_officer.html` | Social Welfare Intake, Home Visits, Assistance Grants. |
| **Beneficiary** | `/official_login.html` | `beneficiary.html` | View Assistance Status, Digital QR ID, Appointment Schedules. |

---

## 🛠️ Local Development & Setup

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher recommended)
- A [Supabase](https://supabase.com) project with PostgreSQL database

### 1. Clone & Install
```bash
git clone https://github.com/p1dgeyy/Capstone-Project-Final-.git
cd Capstone-Project-Final-
npm install
```

### 2. Configure Supabase Environment
Update `frontend/assets/js/supabase-config.js` with your project URL and public anon key:
```javascript
window.SUPABASE_URL = "https://your-project.supabase.co";
window.SUPABASE_ANON_KEY = "your-public-anon-key";
```

### 3. Run Locally
```bash
# Option A: Start with Node.js
npm start
# or
node server.js

# Option B: Docker Container
docker compose up -d
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📜 Compliance & Quality Assurance
- **Data Privacy Act of 2012 (RA 10173):** Contact information masking, secure role segregation, and immutable operational audit trail.
- **Ordinance Alignment:** System tracks appropriation ordinances enacted by the Sangguniang Panlungsod of Koronadal.
- **Zero Broken References:** All inline actions and submodules are linked through clean namespaced APIs.
