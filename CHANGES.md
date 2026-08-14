# Fix pass — 2026-08-13/14

## 0. SYSTEM-WIDE BUG: "clicking any button darkens the screen and it becomes untouchable"
Root cause: `assets/js/system-notifications.js` globally overrides `window.alert()` (used **everywhere** — hundreds of call sites across every page, including most of the messages this fix pass itself added) to show a custom full-screen dark overlay instead of the native browser alert.

The overlay's card had no height limit. On a long message + a normal-height browser window, the card centered itself taller than the viewport — so its own OK/Cancel buttons rendered **above or below the visible screen**. You'd see the dark backdrop (the "darkens a bit") with nothing clickable anywhere on it (the "untouchable"), because the only interactive element was off-screen.

Fixed in `assets/js/system-notifications.js`:
- The dialog card now has `max-height: calc(100vh - 2.5rem)` with internal scrolling on the message body, so the header and OK/Cancel buttons are **always** on-screen and reachable regardless of message length.
- Any existing overlay is removed before a new one is shown, so rapid/duplicate alert calls can't stack into a compounding, unrecoverable dark screen.
- Added Escape-key and click-outside-the-card dismissal as a safety net.

This was purely a CSS/JS fix inside one shared file — no visual design changes anywhere else, and no HTML touched.

## 0.5. A SECOND, SEPARATE "darkens and becomes untouchable" bug (modal double-trigger)
After the fix above, the same symptom was still happening on specific buttons (e.g. "Create New Officer Account", reported "everywhere" across peso_admin.html's tabs). Different root cause, same visible symptom:

The "Create New Officer Account" button had **both** `data-bs-toggle="modal" data-bs-target="#newOfficerModal"` *and* `onclick="openNewOfficerModal()"` (which also opens the same modal). Both fire on one click. Bootstrap's own declarative handler and the onclick handler end up racing to show/toggle the same modal — a well-known Bootstrap footgun that leaves an orphaned `.modal-backdrop` in the DOM with no actual modal above it: a dark, unclickable, unclosable overlay. Because this system keeps everything on one page per role (tabs switch via JS, not full page reloads), that stuck backdrop then covers *every* tab you switch to afterward until a hard refresh — which is exactly why it looked like "everywhere."

Fixed:
- Removed the redundant `data-bs-toggle`/`data-bs-target` from that button (the `onclick` handler already opens the modal correctly, and also resets the form first).
- Standardized every `new bootstrap.Modal(el).show()` call across `beneficiary.html`, `beneficiary_register.html`, `peso_admin.html`, and `peso_officer.html` to `bootstrap.Modal.getOrCreateInstance(el).show()` — this is idempotent, so even if something calls it twice it reuses the same instance instead of creating a second, orphan-prone one.
- Added a small watchdog to `assets/js/auth-guard.js` (shared by all 4 of those pages) that automatically removes any `.modal-backdrop` left in the DOM when no modal is actually open — a self-healing safety net for this entire class of bug, regardless of what specifically triggers it. Runs after every modal close, shortly after any click, and every few seconds as a fallback. It only ever cleans up backdrops that shouldn't be there; it doesn't change how modals look or behave normally.

Note: `cswdo_admin.html`, `cswdo_officer.html`, and `evaluator.html` don't use real Bootstrap modals (they use a custom `openModal()`/`closeModal()` overlay system instead), so this particular bug class doesn't apply to them — if the darkening still shows up there, it's more likely the alert-overlay issue from section 0, or something page-specific worth sending a screenshot of.

## 0.6. Re-verification pass (peso_admin still darkening + peso_officer real error)
Went back through with two new screenshots: peso_officer showed a real, working error dialog ("Could not load applications" — that dialog itself was rendering *correctly*, i.e. section 0's fix held), and peso_admin showed the old darkened/stuck symptom again with no visible dialog.

**Verified, not just re-patched:**
- Confirmed zero remaining `data-bs-toggle="modal"` attributes anywhere in the codebase (searched all 11 HTML files) — the double-trigger bug class from 0.5 cannot recur via that mechanism.
- Confirmed every `new bootstrap.Modal(...)` in the 4 pages that use real Bootstrap modals was actually converted to the safe `getOrCreateInstance` pattern (checked file-by-file, not just trusted the earlier commit).
- Confirmed the backdrop watchdog and the overlay height/scroll fix are both present and unmodified in the current `auth-guard.js` / `system-notifications.js`.
- Traced every button visible in the peso_admin screenshot (New Program, Upload Ordinance, Details, Edit, the Active/Inactive toggle switches) through their actual current handler code — the toggle switches go through `showSystemNotification`'s confirm/cancel path, which was part of the same file fixed in section 0.

**Found and fixed two real remaining issues:**
1. **`peso_officer.html`'s "Could not load applications" was a genuine bug, not a UI glitch** — `loadEvaluationListFromSupabase()` unconditionally joined the new `batches` table. If `database/migrations/20260813_fix_frontend_schema_gaps.sql` hasn't been run on your Supabase project yet, that join fails and the *entire* evaluation queue refused to load, throwing this error. Fixed: it now tries the full query first, and if that specific join fails, automatically retries without it — so applications still load (just without batch names) instead of the whole page treating it as unrecoverable. It also warns you specifically if this happens, so you know to run the migration.
2. **The watchdog's "is a modal actually open" check was slightly loose** (matched on CSS class alone). Tightened it to also require Bootstrap's inline `display:block`, which is a more precise signature and rules out any theoretical false-positive from an unrelated component reusing the `.show` class. Also sped up the periodic safety sweep from every 3s to every 1.5s, made it run once immediately on page load (catches a backdrop stuck over from a *previous* broken page state, e.g. before this fix was deployed), and added `console.warn` logging whenever it actually removes something — so if this ever recurs, DevTools console will show exactly when and confirm whether the fix is even running.

**If peso_admin still darkens after this:** the code itself has been traced end-to-end and I can't find a remaining cause in it. The most likely explanation at that point is the browser serving a cached copy of the old JS — please hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) or test in a fresh incognito window, and confirm in the Vercel dashboard that the deployment picked up the latest commit. If it still happens after a confirmed-fresh load, open the browser console (F12) when it happens — the new logging will show whether the watchdog even ran, which pinpoints whether this is a caching issue or a genuinely new bug.

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

