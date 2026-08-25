-- =============================================================================
-- MIGRATION: 20260824_realtime_and_activity_audit_sync.sql
-- Description:
--   1. Ensures activity_log and audit_logs tables exist with proper RLS policies
--   2. Adds all active operational tables to supabase_realtime publication for
--      instant live updates across Admin, Officer, and Beneficiary dashboards
-- =============================================================================

-- 1. Ensure activity_log table exists
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  action_title VARCHAR(255) DEFAULT NULL,
  application_id VARCHAR(50) DEFAULT NULL,
  beneficiary_name VARCHAR(255) DEFAULT NULL,
  program VARCHAR(255) DEFAULT NULL,
  admin_id VARCHAR(50) DEFAULT NULL,
  details TEXT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'SUCCESS',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users / staff to read activity log
DROP POLICY IF EXISTS "Staff and authenticated users can read activity log" ON activity_log;
CREATE POLICY "Staff and authenticated users can read activity log"
  ON activity_log FOR SELECT
  USING (true);

-- Allow authenticated users / staff to insert activity log
DROP POLICY IF EXISTS "Allow insert to activity log" ON activity_log;
CREATE POLICY "Allow insert to activity log"
  ON activity_log FOR INSERT
  WITH CHECK (true);

-- 2. Audit logs RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and officers can view audit logs" ON audit_logs;
CREATE POLICY "Admins and officers can view audit logs"
  ON audit_logs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert to audit logs" ON audit_logs;
CREATE POLICY "Allow insert to audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- 3. Add all operational tables to Supabase Realtime Publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE beneficiaries;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE applications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE programs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE funds;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE staff_profiles;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE distributions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE interview_schedules;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE approved_assistance;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE batches;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE active_user_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
