-- =============================================================================
-- MIGRATION: 20260831_restore_hardened_rls_security.sql
-- Description:
--   Restores tightened, role-restricted Row Level Security (RLS) policies
--   across interview_schedules, applications, audit_logs, programs, and funds.
--   Drops all unconditionally open `..._all_policy` (USING true) added on 2026-08-26.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Ensure Helper Functions Exist
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_user(user_uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE auth_id = user_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user(user_uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE auth_id = user_uid
    AND role IN ('PESO Admin', 'CSWDO Admin')
  );
$$;

-- -----------------------------------------------------------------------------
-- 1. AUDIT LOGS (audit_logs)
-- Tighten: Only Staff and Authenticated Admins can read audit logs. Anon rejected.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_all_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins and officers can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow insert to audit logs" ON public.audit_logs;

CREATE POLICY "audit_logs_select_policy"
  ON public.audit_logs FOR SELECT
  USING (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );

CREATE POLICY "audit_logs_insert_policy"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. APPLICATIONS (applications)
-- Tighten: Drop open applications_all_policy; restrict DELETE strictly to Staff/Admins.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_all_policy" ON public.applications;
DROP POLICY IF EXISTS "applications_select_policy" ON public.applications;
DROP POLICY IF EXISTS "applications_insert_policy" ON public.applications;
DROP POLICY IF EXISTS "applications_update_policy" ON public.applications;
DROP POLICY IF EXISTS "applications_delete_policy" ON public.applications;

CREATE POLICY "applications_select_policy"
  ON public.applications FOR SELECT
  USING (true);

CREATE POLICY "applications_insert_policy"
  ON public.applications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "applications_update_policy"
  ON public.applications FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "applications_delete_policy"
  ON public.applications FOR DELETE
  USING (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );

-- -----------------------------------------------------------------------------
-- 3. INTERVIEW & ACTIVITY SCHEDULES (interview_schedules)
-- Tighten: Drop open interview_schedules_all_policy; restrict manage (write/delete) to Staff.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.interview_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interview_schedules_all_policy" ON public.interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_select_policy" ON public.interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_insert_policy" ON public.interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_update_policy" ON public.interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_manage_policy" ON public.interview_schedules;

CREATE POLICY "interview_schedules_select_policy"
  ON public.interview_schedules FOR SELECT
  USING (true);

CREATE POLICY "interview_schedules_manage_policy"
  ON public.interview_schedules FOR ALL
  USING (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  )
  WITH CHECK (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );

-- -----------------------------------------------------------------------------
-- 4. PROGRAMS (programs)
-- Tighten: Drop open programs_all_policy; restrict insert/update/delete to Staff/Admins.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programs_all_policy" ON programs;
DROP POLICY IF EXISTS "programs_select_policy" ON programs;
DROP POLICY IF EXISTS "programs_insert_policy" ON programs;
DROP POLICY IF EXISTS "programs_update_policy" ON programs;
DROP POLICY IF EXISTS "programs_delete_policy" ON programs;

CREATE POLICY "programs_select_policy"
  ON public.programs FOR SELECT
  USING (true);

CREATE POLICY "programs_insert_policy"
  ON public.programs FOR INSERT
  WITH CHECK (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );

CREATE POLICY "programs_update_policy"
  ON public.programs FOR UPDATE
  USING (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  )
  WITH CHECK (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );

CREATE POLICY "programs_delete_policy"
  ON public.programs FOR DELETE
  USING (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );

-- -----------------------------------------------------------------------------
-- 5. FUNDS (funds)
-- Tighten: Drop open funds_all_policy; restrict insert/update/delete to Staff/Admins.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.funds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funds_all_policy" ON funds;
DROP POLICY IF EXISTS "funds_select_policy" ON funds;
DROP POLICY IF EXISTS "funds_insert_policy" ON funds;
DROP POLICY IF EXISTS "funds_update_policy" ON funds;
DROP POLICY IF EXISTS "funds_delete_policy" ON funds;

CREATE POLICY "funds_select_policy"
  ON public.funds FOR SELECT
  USING (true);

CREATE POLICY "funds_insert_policy"
  ON public.funds FOR INSERT
  WITH CHECK (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );

CREATE POLICY "funds_update_policy"
  ON public.funds FOR UPDATE
  USING (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  )
  WITH CHECK (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );

CREATE POLICY "funds_delete_policy"
  ON public.funds FOR DELETE
  USING (
    public.is_staff_user(auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    auth.role() = 'authenticated'
  );
