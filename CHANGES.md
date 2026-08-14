# Fix pass — 2026-08-13/14

## 1. Run this first: `database/migrations/20260813_fix_frontend_schema_gaps.sql`
Purely additive (IF NOT EXISTS / ON CONFLICT everywhere) — safe on your live DB, doesn't touch existing rows. Paste it into the Supabase SQL editor. Adds:
- `applications.amount_requested` / `amount_approved` — cswdo_admin.html already reads/writes these; they didn't exist, so every admin `select()`/`update()` on applications was failing.
- `activity_log` table — cswdo_admin.html logs here, but only `audit_logs` (different columns) existed.
- 16 missing rows in `programs` — the beneficiary "Choose program" dropdown offers ~19 options, only 6 existed as real program rows, so most submissions had nothing to link `program_id` to.
- Widened `applications.status` CHECK constraint to allow `'Denied'` and `'Released'`, which the admin Deny/Release-Funds actions actually write (was hitting a constraint violation).
- `funds` table — powers the CSWDO "Fund Utilization" dashboard and the balance decrement on fund release; didn't exist at all.

## 2. Code fixes
- **`frontend/beneficiary.html`** — `submitApplication()` now actually does `supabaseClient.from('applications').insert(...)` (previously 100% local mock data, nothing was ever saved). Added `PROGRAM_CODE_MAP` to resolve the dropdown text to a real `programs.id`. Also fixed the interview-schedule fetch, which was filtering on a nonexistent `beneficiary_id` column instead of `beneficiary_qr` (silently failed → always showed mock interviews).
- **`frontend/cswdo_admin.html`** — Fixed `FUND_DISPLAY_META` keys (`MED`/`FIN`/`BUR`) that didn't match the actual `program_code` values used elsewhere in the same file (`MEDICAL`/`FINANCIAL`/`BURIAL`), so the fund-release balance update was silently never matching a row.
- **`frontend/evaluator.html`** — Implemented 9 dead buttons that had no backing JS function at all (`calculateEditAge`, `openApplicantTracking`, `quickActionAddBeneficiary`, `searchByApplicantId`, `submitApplicationDecision`, `downloadQRCode`, `changeCalendarMonth`, `changeCalendarYear`).
- **`frontend/peso_admin.html`** — Implemented `filterAssignPrograms()` (search box + status filter on the Programs table did nothing before).

## 3. Confirmed working, unchanged
- Beneficiary registration → `auth.signUp()` + trigger-created `beneficiaries`/`staff_profiles` row: real.
- PESO officer interview scheduling → real insert into `interview_schedules`.
- CSWDO officer approve/deny → real update on `applications` (this already worked once applications could actually exist).

## 4. Known gaps NOT fixed in this pass — needs a dedicated follow-up
`frontend/peso_officer.html` has **18 buttons with zero backing implementation** (not typos — the functions were never written): `executeQrScanLookup`, `exportAssistanceCSV`, `filterAssistanceTable`, `filterEvaluationQueue`, `openAuditModal`, `openBatchAssignModal`, `openCreateBatchModal`, `openIntakeModal`, `openQrScannerModal`, `openRecordAssistanceModal`, `previewBenPhoto`, `printAssistanceReport`, `resetEvalFilters`, `submitAssistanceRecord`, `submitBatchAssignment`, `submitCreateBatch`, `submitIntakeApplication`, `validateIntakeFileInput`.

These involve real feature work (camera-based QR scanning, batch/slot assignment logic, intake form validation) rather than quick wiring fixes, so I didn't want to guess field names/logic blind on a system handling real applicant records. Happy to do a proper pass on these next — same approach as the evaluator.html fixes (read each modal's actual fields first, then implement against them).

## 4. `frontend/peso_officer.html` — all 18 dead buttons implemented + a critical hidden bug fixed
All 18 previously-empty handlers now have real implementations, and where a matching Supabase table exists, they read/write real data instead of local mock arrays:

- **`logOfficerAction` — was called in 11 places but never defined anywhere.** Every approve/deny/pending decision, interview update, attendance marking, schedule-interview, and beneficiary registration action was silently throwing a `ReferenceError` partway through — the data would change but the modal never closed and no confirmation ever showed. This is now implemented (writes to a local session log + a best-effort real insert into `audit_logs`).
- **Evaluation queue (`evaluationList`)** now loads real applications from Supabase (`applications` joined to `beneficiaries`/`programs`, filtered to PESO-agency programs) instead of 2 hardcoded rows. Approve / Deny / Set-Pending now write real updates back to `applications.status` / `officer_decision` / `officer_notes`. `filterEvaluationQueue()` / `resetEvalFilters()` implemented.
- **Walk-in Intake** (`openIntakeModal`, `validateIntakeFileInput`, `submitIntakeApplication`) — real file-type/size validation, and a real `applications` insert **when the walk-in applicant already has a registered beneficiary account** (see the important caveat below).
- **Batches** — new `batches` table (added in the migration) + `applications.batch_id`. `openCreateBatchModal`/`submitCreateBatch` insert real batch rows; `openBatchAssignModal`/`submitBatchAssignment` write real `batch_id` updates onto approved applications.
- **Approved Assistance** (`openRecordAssistanceModal`, `submitAssistanceRecord`) now inserts into the real `approved_assistance` table (this table existed in your schema but nothing was using it before). `renderAssistanceRecordsTable`, `filterAssistanceTable`, `exportAssistanceCSV` (real CSV download), and `printAssistanceReport` (uses the print stylesheet that was already in the file, just never triggered) are all implemented.
- **QR Scanner** (`openQrScannerModal`, `executeQrScanLookup`) and **global search** (`handleGlobalSearch`) now actually look up and route to the matching beneficiary/application record instead of doing nothing.
- **Audit Logs** (`openAuditModal`, `renderAuditLogs`) now pulls real rows from `audit_logs` when available.
- `previewBenPhoto` — real 2x2 photo preview via `FileReader` (client-side only, no Supabase needed).

### Important architectural limitation found (not something I could safely patch around)
`beneficiaries.auth_id` is `NOT NULL UNIQUE REFERENCES auth.users(id)` — every beneficiary row **must** correspond to a real Supabase Auth account. That's fine for online self-registration, but it means an officer **cannot create a brand-new beneficiary record from a walk-in intake form** without also creating a new Auth user, which requires Supabase's service-role admin API — not something that's safe to call from browser-side JS with the anon key.

So `submitIntakeApplication` and `submitAssistanceRecord` do the safe, correct thing: they look up an **existing** registered beneficiary by name and link to their real account. If no match is found, the officer gets a clear explanation (not a silent failure or a fake success) and the record is kept local-only for reference. If your team wants true walk-in registration (no prior online signup), that needs a small Supabase Edge Function running with the service-role key to create the Auth user + beneficiary row together — happy to build that next if you want it.

`beneficiariesList` itself (the main PESO officer beneficiary directory/registration tab) is still local mock data for the same reason — registering a beneficiary from that page has the identical auth-account constraint.

### Also fixed while in here
- `formatCurrency` in `beneficiary.html` — called when rendering upcoming distributions, never defined, would have thrown.

