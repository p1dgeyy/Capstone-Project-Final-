-- =============================================================================
-- PESO ADMIN PORTAL COMPLETE MODULE ENHANCEMENT & RLS CONSOLIDATION
-- Migration: 20260826_peso_admin_complete_module_fix.sql
-- Description:
--   1. Adds deactivation tracking to `programs` (deactivated_at, deactivated_by, deactivation_reason).
--   2. Adds postponement and cancellation tracking to `interview_schedules`.
--   3. Adds evaluation rejection and officer decision tracking to `applications`.
--   4. Consolidates open/permissive RLS policies across all admin tables to prevent silent write blocks.
--   5. Enables Supabase Realtime replication on all key tables.
-- =============================================================================

-- 1. PROGRAMS TABLE ENHANCEMENTS
ALTER TABLE IF EXISTS programs 
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- 2. INTERVIEW SCHEDULES TABLE ENHANCEMENTS
ALTER TABLE IF EXISTS interview_schedules
  ADD COLUMN IF NOT EXISTS postponed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS postponed_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postponement_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS recipient_count INT DEFAULT 0;

-- 3. APPLICATIONS TABLE ENHANCEMENTS
ALTER TABLE IF EXISTS applications
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejection_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

-- 4. CONSOLIDATE ROW LEVEL SECURITY (RLS) POLICIES
-- Ensure PESO Admins and Officers can perform SELECT, INSERT, UPDATE, DELETE seamlessly

-- Table: programs
ALTER TABLE IF EXISTS programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "programs_all_policy" ON programs;
DROP POLICY IF EXISTS "programs_select_policy" ON programs;
DROP POLICY IF EXISTS "programs_insert_policy" ON programs;
DROP POLICY IF EXISTS "programs_update_policy" ON programs;
DROP POLICY IF EXISTS "programs_delete_policy" ON programs;

CREATE POLICY "programs_select_policy" ON programs FOR SELECT USING (true);
CREATE POLICY "programs_all_policy" ON programs FOR ALL USING (true) WITH CHECK (true);

-- Table: interview_schedules
ALTER TABLE IF EXISTS interview_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interview_schedules_all_policy" ON interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_select_policy" ON interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_insert_policy" ON interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_update_policy" ON interview_schedules;

CREATE POLICY "interview_schedules_select_policy" ON interview_schedules FOR SELECT USING (true);
CREATE POLICY "interview_schedules_all_policy" ON interview_schedules FOR ALL USING (true) WITH CHECK (true);

-- Table: applications
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "applications_all_policy" ON applications;
DROP POLICY IF EXISTS "applications_select_policy" ON applications;

CREATE POLICY "applications_select_policy" ON applications FOR SELECT USING (true);
CREATE POLICY "applications_all_policy" ON applications FOR ALL USING (true) WITH CHECK (true);

-- Table: funds
ALTER TABLE IF EXISTS funds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "funds_all_policy" ON funds;
DROP POLICY IF EXISTS "funds_select_policy" ON funds;

CREATE POLICY "funds_select_policy" ON funds FOR SELECT USING (true);
CREATE POLICY "funds_all_policy" ON funds FOR ALL USING (true) WITH CHECK (true);

-- Table: notifications
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_all_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;

CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT USING (true);
CREATE POLICY "notifications_all_policy" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- Table: audit_logs
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_all_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;

CREATE POLICY "audit_logs_select_policy" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "audit_logs_all_policy" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- Table: active_user_sessions
ALTER TABLE IF EXISTS active_user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "active_user_sessions_all_policy" ON active_user_sessions;
DROP POLICY IF EXISTS "active_user_sessions_select_policy" ON active_user_sessions;

CREATE POLICY "active_user_sessions_select_policy" ON active_user_sessions FOR SELECT USING (true);
CREATE POLICY "active_user_sessions_all_policy" ON active_user_sessions FOR ALL USING (true) WITH CHECK (true);

-- 5. SUPABASE REALTIME REPLICATION PUBLICATION (SAFE IDEMPOTENT BLOCK)
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['programs', 'interview_schedules', 'applications', 'funds', 'notifications', 'audit_logs', 'active_user_sessions'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY tbls LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION 
        WHEN duplicate_object THEN NULL;
        WHEN undefined_table THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;
