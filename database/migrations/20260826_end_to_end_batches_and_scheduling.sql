-- =============================================================================
-- MIGRATION: 20260826_end_to_end_batches_and_scheduling.sql
-- Description: Ensures complete schema compatibility, non-blocking RLS policies,
--              and Realtime subscriptions for the 4-Stage End-to-End Pipeline:
--              Officer Application Evaluation -> Admin Evaluation -> Officer Batches -> Scheduling.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BATCHES TABLE: Ensure all operational & scheduling columns exist
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batches (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  program_id BIGINT DEFAULT NULL REFERENCES programs(id) ON DELETE SET NULL,
  program_code VARCHAR(50) NOT NULL DEFAULT 'PESO',
  capacity INT NOT NULL DEFAULT 50,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  notes TEXT DEFAULT NULL,
  created_by BIGINT DEFAULT NULL REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure specific columns exist
ALTER TABLE batches ADD COLUMN IF NOT EXISTS program_id BIGINT DEFAULT NULL REFERENCES programs(id) ON DELETE SET NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS program_code VARCHAR(50) NOT NULL DEFAULT 'PESO';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 50;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'Active';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_operational BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) DEFAULT NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS event_date VARCHAR(50) DEFAULT NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS event_time VARCHAR(50) DEFAULT NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS venue VARCHAR(255) DEFAULT NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS scheduled_by VARCHAR(255) DEFAULT NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Drop any restrictive legacy status CHECK constraints on batches
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'batches'::regclass AND contype = 'c'
  ) LOOP
    EXECUTE 'ALTER TABLE batches DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. APPLICATIONS TABLE: Ensure operational batching & forwarding columns exist
-- -----------------------------------------------------------------------------
ALTER TABLE applications ADD COLUMN IF NOT EXISTS operational_batch_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS operational_batch_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_operational_batch BOOLEAN DEFAULT FALSE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS batched_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS batched_by VARCHAR(255) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS forwarded_by VARCHAR(255) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(255) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- -----------------------------------------------------------------------------
-- 3. NOTIFICATIONS TABLE: Ensure schema for beneficiary alerts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  beneficiary_qr VARCHAR(100) DEFAULT NULL,
  user_id BIGINT DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS beneficiary_qr VARCHAR(100) DEFAULT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Notification';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES: Conflict-Free & Non-Blocking
-- -----------------------------------------------------------------------------
-- Enable RLS on core tables
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;

-- Batches Policies (Select, Insert, Update, Delete)
DROP POLICY IF EXISTS "batches_select_policy" ON batches;
DROP POLICY IF EXISTS "batches_insert_policy" ON batches;
DROP POLICY IF EXISTS "batches_update_policy" ON batches;
DROP POLICY IF EXISTS "batches_delete_policy" ON batches;

CREATE POLICY "batches_select_policy" ON batches FOR SELECT USING (true);
CREATE POLICY "batches_insert_policy" ON batches FOR INSERT WITH CHECK (true);
CREATE POLICY "batches_update_policy" ON batches FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "batches_delete_policy" ON batches FOR DELETE USING (true);

-- Applications Policies
DROP POLICY IF EXISTS "applications_select_policy" ON applications;
DROP POLICY IF EXISTS "applications_insert_policy" ON applications;
DROP POLICY IF EXISTS "applications_update_policy" ON applications;
DROP POLICY IF EXISTS "applications_delete_policy" ON applications;

CREATE POLICY "applications_select_policy" ON applications FOR SELECT USING (true);
CREATE POLICY "applications_insert_policy" ON applications FOR INSERT WITH CHECK (true);
CREATE POLICY "applications_update_policy" ON applications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "applications_delete_policy" ON applications FOR DELETE USING (true);

-- Notifications Policies
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;

CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT USING (true);
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update_policy" ON notifications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "notifications_delete_policy" ON notifications FOR DELETE USING (true);

-- Interview Schedules Policies
DROP POLICY IF EXISTS "interview_schedules_select_policy" ON interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_insert_policy" ON interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_update_policy" ON interview_schedules;
DROP POLICY IF EXISTS "interview_schedules_delete_policy" ON interview_schedules;

CREATE POLICY "interview_schedules_select_policy" ON interview_schedules FOR SELECT USING (true);
CREATE POLICY "interview_schedules_insert_policy" ON interview_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "interview_schedules_update_policy" ON interview_schedules FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "interview_schedules_delete_policy" ON interview_schedules FOR DELETE USING (true);

-- -----------------------------------------------------------------------------
-- 5. REALTIME PUBLICATION: Live Subscriptions for All Portals
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'batches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE batches;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'applications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE applications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'interview_schedules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE interview_schedules;
  END IF;
END $$;
