---
trigger: always_on
---

# Bug-fix safety guardrails

These apply to every fix in the 01–04 fix-plan files, for the whole duration of this cleanup. This project's own CHANGES.md shows the same mistakes happening twice (a modal fix got undone, a security fix got reopened by a later migration) — these rules exist specifically to stop that from happening a third time.

1. Scope check before every edit. Before changing any function, table, or column, search the ENTIRE `frontend/` tree (not just the file you're already in) for every other place that reads or writes the same name. List what you found before making the change. Several bugs in this codebase exist because a field was renamed or fixed in one place and left stale in another.

2. One fix at a time. Make one change (or one tightly-related pair of changes), then stop and describe how to manually verify it, before starting the next item. Do not batch multiple unrelated fixes into one edit pass.

3. Never touch UI/modal code you weren't asked to fix. Do not modify `assets/js/system-notifications.js`'s overlay height/scroll handling, `auth-guard.js`'s modal-backdrop watchdog, or the `bootstrap.Modal.getOrCreateInstance(...)` pattern used in `beneficiary.html`, `beneficiary_register.html`, `peso_admin.html`, and `peso_officer.html`, unless the task explicitly names one of these files. These already fixed a real "screen darkens and becomes unclickable" bug — touching them as a side effect of an unrelated fix risks bringing it back.

4. Database changes are additive only, in new migration files. Never edit an existing file under `database/migrations/`. Every schema/RLS change goes in a new file named `database/migrations/<YYYYMMDD>_<short-description>.sql`. Never delete, rename, or blanket-loop-drop an existing constraint or policy without immediately creating its replacement in the same file. Never add a permissive `FOR ALL USING (true)` policy on a table that already has a narrower policy — Postgres OR's multiple permissive policies together, so the open one silently wins and quietly cancels the narrow one. This exact mistake already happened once in this project (a security fix from one migration was undone by a `USING (true)` policy added the next day).

5. Don't rename or drop columns/tables in place. If a column's name or type needs to change, add the new one, backfill/migrate any data, update all call sites, and only remove the old one as its own separate, later, explicitly-approved step — never in the same change as the fix that needed it.

6. Preserve existing user-facing wording except where the fix specifically requires it. If a fix turns a fake "Success" message into a real error state, reuse the app's existing `showSystemNotification(...)` error pattern rather than introducing a new UI style, alert mechanism, or layout.

7. Never touch login/session plumbing beyond what's asked. Don't change anything in `assets/js/supabase-config.js`'s client-initialization code, or the shape of `active_user_sessions`, outside of a task that explicitly targets session handling — a mistake here can invalidate every currently logged-in user at once.

8. `peso_admin.html` currently loads two separate, competing copies of the admin app (`assets/js/peso-admin/*.js` and the older `assets/js/peso_admin.js`). Do not merge, delete, or "clean up" either one as a side effect of a different fix. That's its own dedicated item later in the plan, with its own verification steps, because of how large its blast radius is.

9. Don't upgrade dependency versions (Bootstrap, `@supabase/supabase-js`, Prisma, etc.) as part of a bug fix unless a task explicitly says to.

10. Work on a branch, not directly on `main`. Commit after each individual fix with a message naming which finding it addresses (e.g. `fix: stop CSWDO release from silently skipping fund deduction`), so any regression can be isolated and reverted without losing the other completed fixes.

11. SQL/RLS changes touch real citizen data. If a staging Supabase project is available, apply and test migrations there first. If not, at minimum read the new policy/constraint back out loud (state which roles can now do what) before applying it to the live project, and note that in the commit message.

12. Definition of done for every item: state which file(s) changed, what you'd click through in the app to confirm it (which page, which button, what you'd expect to see in the Supabase table afterward), and confirm no browser console errors appear during that click-through. Don't mark an item finished without this.
