# Capstone Project - Portal & Dashboard System

A clean, modern portal and administrative dashboard system built for the City of Koronadal. This project features secure portal logins for beneficiaries, PESO administrators/officers, CSWDO administrators/officers, and evaluators.

---

## 📂 Project Structure

The project has been restructured to separate front-end code and back-end/developer utilities cleanly:

```
Capstone-Project-Final-/
├── frontend/                     # Front-end user-facing files & dashboards
│   ├── assets/                   # Static assets & scripts
│   │   ├── js/                   # Consolidated client JavaScript modules
│   │   │   ├── api-config.js
│   │   │   ├── audit_nav.js
│   │   │   ├── beneficiary.js
│   │   │   ├── peso-safeguards.js
│   │   │   ├── peso_officer.js
│   │   │   ├── session-manager.js
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
├── backend/                      # Node.js/Express REST API server & routes
│   ├── lib/                      # Backend middleware & integrations
│   ├── middleware/               # Express safeguards & rate limiters
│   ├── routes/                   # API routes (programs, users, officers, etc.)
│   ├── scripts/                  # Backend test & verification scripts
│   ├── utils/                    # Utility functions (QR code generator, etc.)
│   ├── db.js                     # MySQL connection pool configuration
│   ├── migrate.js                # Database schema migration script
│   └── server.js                 # Express server entry point
├── database/                     # MySQL database schema & migration scripts
│   ├── migrations/               # Versioned SQL migration files
│   ├── schema.sql                # Complete database schema
│   └── seed.sql                  # Initial seed data
├── Dockerfile                    # Production Docker build container definition
├── nginx.conf                    # Nginx reverse proxy configuration
├── package.json                  # Node.js dependencies & scripts
├── start.sh                      # Production entrypoint script
└── README.md                     # Project documentation
```

---

## 🌐 Vercel Deployment & Routing

The project uses `vercel.json` at the root level to route URLs cleanly to the `frontend/` directory.

- **Clean URLs** are automatically enabled (e.g. accessing `/admin_login` serves `/frontend/admin_login.html`).
- **Assets** are correctly mapped (e.g. `/assets/...` resolves to `/frontend/assets/...`).
- **Fallbacks** are set up to handle relative path requests correctly without throwing 404 errors.

---

## 🔑 Login Credentials (Mock Database)

For testing purposes, the portal uses local mock accounts stored in `sessionStorage`:

### 🧑‍💼 Administrative / Officer Portal (`/admin_login`)
| Username | Password | Role | Redirect Page |
| :--- | :--- | :--- | :--- |
| `peso-admin` | `password123` | PESO Admin | `peso_admin.html` |
| `peso-officer` | `password123` | PESO Officer | `peso_officer.html` |
| `cswdo-admin` | `password123` | CSWDO Admin | `cswdo_admin.html` |
| `cswdo-officer` | `password123` | CSWDO Officer | `cswdo_officer.html` |
| `evaluator` | `password123` | Evaluator | `evaluator.html` |

### 👤 Beneficiary Portal (`/official_login`)
| Username | Password | Full Name |
| :--- | :--- | :--- |
| `juan_dela_cruz` | `Test1234` | Juan dela Cruz |
| `maria_santos` | `Sample5678` | Maria Santos |
| `pedro_reyes` | `DemoPass90` | Pedro Reyes |
