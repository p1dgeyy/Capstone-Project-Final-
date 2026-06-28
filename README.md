# Capstone Project - Portal & Dashboard System

A clean, modern portal and administrative dashboard system built for the City of Koronadal. This project features secure portal logins for beneficiaries, PESO administrators/officers, CSWDO administrators/officers, and evaluators.

---

## 📂 Project Structure

The project has been restructured to separate front-end code and back-end/developer utilities cleanly:

```
Capstone-Project-Final-/
├── frontend/                     # All front-end user-facing files
│   ├── assets/                   # Image assets (seals, backgrounds)
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
│   └── evaluator.html            # Evaluator Dashboard
├── backend/                      # Non-frontend scripts and developer tools
│   └── scripts/
│       ├── clean.ps1
│       ├── replace.ps1
│       └── replace2.ps1
├── vercel.json                   # Vercel deployment routing configuration
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
