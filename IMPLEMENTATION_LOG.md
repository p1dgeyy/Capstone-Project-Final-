# Implementation Log — Auth Roles, QR Codes, Clerk + Resend

This documents every file added/modified for the registration, role-isolation,
QR-code, and Clerk+Resend refactor.

## 1. New files

| File | Purpose |
|---|---|
| `backend/lib/otp.js` | Generates/hashes/verifies 6-digit email OTP codes (bcrypt-hashed at rest, TTL + attempt limiting). |
| `backend/lib/resend.js` | Resend email client: `sendOtpEmail`, `sendWelcomeEmail`, `sendQrCodeEmail`. Logs to console instead of failing if `RESEND_API_KEY` is unset. |
| `backend/lib/qrcode.js` | Generates a Beneficiary's QR payload (opaque token, not raw DB id) and renders it as a base64 PNG data URL via the `qrcode` npm package. |
| `backend/lib/clerk.js` | Clerk Node SDK wrapper: creates the Clerk user at registration, links Clerk metadata to the MySQL row, verifies Clerk session JWTs. No-ops safely if `CLERK_SECRET_KEY` is unset. |
| `backend/lib/authMiddleware.js` | Shared `authenticateCaller` + `requireRole` middleware, extracted from `routes/users.js` so `users.js`, `routes/officers.js`, and `routes/beneficiaries.js` enforce identical rules. Accepts legacy `X-User-Id`/`X-Session-Token` headers **or** a Clerk `Authorization: Bearer` token. |
| `backend/routes/officers.js` | `GET /api/officers`, `GET /api/officers/:id` — staff-only roster, strictly `role IN (staff roles)`. |
| `backend/routes/beneficiaries.js` | `GET /api/beneficiaries`, `GET /api/beneficiaries/:id`, `GET /api/beneficiaries/:id/qr-code`, `GET /api/beneficiaries/lookup/:token` — strictly `role = 'Beneficiary'`. |
| `database/migrations/002_add_verification_qr_clerk.sql` | Idempotent `ALTER TABLE` for existing Railway databases (adds the columns below, backfills `is_verified = TRUE` for pre-existing rows so no one gets locked out). |
| `.env.example` | Documents every required env var, including the new Clerk/Resend/OTP ones. |

## 2. Modified files

| File | Change |
|---|---|
| `database/schema.sql` | Added columns to `users` (see schema table below). Fresh installs get the final shape directly. |
| `backend/routes/auth.js` | `POST /register`: creates a Clerk user (if configured) → inserts the MySQL row as `is_verified = 0` → sends an OTP via Resend. Added `POST /register/verify-otp` (confirms code, generates the QR code, flips `is_verified = 1`, sends welcome + QR emails) and `POST /register/resend-otp`. `POST /login` now blocks unverified Beneficiaries with `403 { requiresVerification: true }` and returns `qrCodeUrl` in the user payload. |
| `backend/server.js` | Mounted `/api/officers` and `/api/beneficiaries`. |
| `package.json` | Added `@clerk/backend`, `qrcode`, `resend`. |
| `frontend/beneficiary_register.html` | Registration no longer redirects straight to login — it opens an OTP modal (`otpModalOverlay`), posts to `/api/auth/register/verify-otp`, and supports resend via `/api/auth/register/resend-otp`. |
| `frontend/beneficiary.html` | Added a "My QR Code" nav item + section, included `api-config.js`/`session-manager.js`, and added `loadMyQrCode()` which calls `GET /api/beneficiaries/:id/qr-code` with `SessionManager.authHeaders()` and renders/downloads the PNG. |

## 3. Database schema additions (`users` table)

| Column | Type | Purpose |
|---|---|---|
| `clerk_user_id` | `VARCHAR(191) UNIQUE` | Links the MySQL row to its Clerk account. |
| `is_verified` | `BOOLEAN DEFAULT FALSE` | Gate — a Beneficiary cannot log in until this is `TRUE`. Staff rows default to `TRUE` (admin-created). |
| `email_otp_hash` | `VARCHAR(255)` | bcrypt hash of the current OTP (never stored in plaintext). |
| `email_otp_expires_at` | `DATETIME` | OTP TTL (default 10 min, `OTP_TTL_MINUTES`). |
| `email_otp_attempts` | `INT DEFAULT 0` | Rate-limits guesses (default max 5, `OTP_MAX_ATTEMPTS`). |
| `verified_at` | `TIMESTAMP NULL` | Audit trail for when verification completed. |
| `qr_code_token` | `VARCHAR(191) UNIQUE` | Opaque token embedded in the QR code; used for officer scan-to-lookup without exposing the raw user id. |
| `qr_code_url` | `VARCHAR(500)` | Base64 PNG data URL of the generated QR code. |

Run `database/migrations/002_add_verification_qr_clerk.sql` against your existing
Railway database, or re-run `npm run migrate` / apply `schema.sql` fresh for a
new environment.

## 4. API routes — added or changed

| Method & Path | Status | Notes |
|---|---|---|
| `POST /api/auth/register` | Changed | Now Clerk+OTP-gated; returns `requiresVerification: true` instead of a final success. |
| `POST /api/auth/register/verify-otp` | **New** | Confirms the code, generates the QR code, activates the account. |
| `POST /api/auth/register/resend-otp` | **New** | Re-issues a code for a still-unverified account. |
| `POST /api/auth/login` | Changed | Blocks unverified Beneficiaries; returns `qrCodeUrl`. |
| `GET /api/officers` | **New** | Staff-only, strictly staff roles. |
| `GET /api/officers/:id` | **New** | Self or Admin only. |
| `GET /api/beneficiaries` | **New** | Staff-only, strictly `role = 'Beneficiary'`. |
| `GET /api/beneficiaries/:id` | **New** | Self or staff only. |
| `GET /api/beneficiaries/:id/qr-code` | **New** | Self or staff only — powers the portal's QR display. |
| `GET /api/beneficiaries/lookup/:token` | **New** | Staff-only — resolves a scanned QR code to a profile. |

`GET /api/users` (existing, role-filterable) is left untouched for backward
compatibility with any code that still calls it, but new frontend work should
prefer the dedicated `/api/officers` and `/api/beneficiaries` endpoints going
forward, per the role-isolation requirement.

## 5. Design notes / things you should decide before deploying

- **Clerk + Resend division of labor**: Clerk owns credential storage and
  session issuance (and can also send its own verification emails through
  its dashboard settings). Resend is used here specifically for *your*
  branded OTP email, the welcome email, and the QR code delivery — the
  emails Clerk doesn't customize out of the box. If you'd rather have Clerk's
  own hosted OTP flow be the *only* verification step (no separate DB-side
  OTP), that's a valid alternative design — say so and I'll simplify
  `auth.js` to just listen for a Clerk webhook (`user.created` /
  `email.verified`) instead of running a parallel OTP table.
- **Clerk is optional at runtime**: every Clerk call is wrapped so the app
  keeps working with the legacy bcrypt/session-token flow if
  `CLERK_SECRET_KEY` isn't set. This was necessary because I don't have your
  live Clerk/Resend credentials to test against — you'll want to do a real
  end-to-end registration test once your `.env` is filled in.
- **QR code storage**: QR codes are stored as base64 data URLs directly in
  `qr_code_url` (no file storage/CDN needed). If you'd rather store them as
  files (e.g. for the `id_file_path`-style pattern already used for ID
  uploads), that's a small change to `backend/lib/qrcode.js`.
- **Admin dashboards** (`peso_admin.html`, `cswdo_admin.html`,
  `peso_officer.html`, `cswdo_officer.html`) were **not** rewired to call the
  new `/api/officers` / `/api/beneficiaries` endpoints — those dashboards are
  currently driven by `localStorage` mock data for most tabs, which is a
  separate, larger effort than this auth/QR refactor. The endpoints are
  ready to consume (see the fetch pattern in `beneficiary.html`'s
  `loadMyQrCode()`); let me know if you want the admin roster tabs wired up
  next.
