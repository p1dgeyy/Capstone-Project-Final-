-- =============================================================================
-- OPTIONAL cleanup: phantom "Active" beneficiaries created by the OTP bug
-- Date: 2026-09-03
-- Run this AFTER applying 20260903_defer_beneficiary_provisioning_until_otp_verified.sql
--
-- Before this fix, every time anyone picked "Email" as their OTP delivery
-- channel during registration -- even if they never entered a code, closed
-- the tab, or the email genuinely was brand new -- a public.beneficiaries row
-- was silently created with status='Active', a random auto-generated
-- qr_code, and a blank name. Those rows are why some brand-new emails were
-- being rejected as "already registered".
--
-- STEP 1 -- run this SELECT first and read the results. Confirm every row
-- really does look like a stub (blank name, no real activity) before
-- deleting anything:
--
--   SELECT qr_code, email, username, first_name, last_name, status, created_at
--   FROM public.beneficiaries b
--   WHERE (b.first_name IS NULL OR b.first_name = '')
--     AND (b.last_name IS NULL OR b.last_name = '')
--     AND NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.beneficiary_qr = b.qr_code)
--     AND NOT EXISTS (SELECT 1 FROM public.interview_schedules i WHERE i.beneficiary_qr = b.qr_code)
--   ORDER BY b.created_at DESC;
--
-- STEP 2 -- only after reviewing that list, run the DELETE below. It is
-- scoped identically (blank first AND last name, no application or
-- interview_schedules history), so a beneficiary who ever actually applied
-- or was scheduled for anything can never be touched by it.
-- =============================================================================

DELETE FROM public.beneficiaries b
WHERE (b.first_name IS NULL OR b.first_name = '')
  AND (b.last_name IS NULL OR b.last_name = '')
  AND NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.beneficiary_qr = b.qr_code)
  AND NOT EXISTS (SELECT 1 FROM public.interview_schedules i WHERE i.beneficiary_qr = b.qr_code);
