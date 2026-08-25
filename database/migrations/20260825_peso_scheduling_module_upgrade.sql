-- =============================================================================
-- MIGRATION: 20260825_peso_scheduling_module_upgrade.sql
-- Description:
--   Upgrades interview_schedules to support full PESO Activity & Slot Scheduling
--   (Assistance Distribution, Certificate Distribution, Others) with multi-day span,
--   minute duration, postponement logs, cancellation archives, and real-time syncing.
-- =============================================================================

-- 1. Add new columns to interview_schedules if not exists
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Assistance Activity Slot';
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Assistance Distribution';
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS category_other TEXT DEFAULT NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS end_time VARCHAR(50) DEFAULT NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS duration VARCHAR(50) DEFAULT '1 Hour';
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS batch_id BIGINT DEFAULT NULL REFERENCES batches(id) ON DELETE SET NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS location_other TEXT DEFAULT NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS recipient_count INT DEFAULT 0;

-- 2. Add postponement and cancellation audit log tracking columns
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS postponed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS postponed_by VARCHAR(100) DEFAULT NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS postponement_reason TEXT DEFAULT NULL;

ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(100) DEFAULT NULL;
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL;

-- 3. Allow group / batch-level schedule slots where individual beneficiary_qr is assigned later
ALTER TABLE interview_schedules ALTER COLUMN beneficiary_qr DROP NOT NULL;

-- 4. Update status check constraint to include 'Postponed' and 'Active'
ALTER TABLE interview_schedules DROP CONSTRAINT IF EXISTS interview_schedules_status_check;
ALTER TABLE interview_schedules ADD CONSTRAINT interview_schedules_status_check 
  CHECK (status IN ('Scheduled', 'Active', 'Postponed', 'Completed', 'Cancelled', 'Pending', 'Missed'));

-- 5. Indexes for fast calendar queries and status filtering
CREATE INDEX IF NOT EXISTS idx_int_category ON interview_schedules(category);
CREATE INDEX IF NOT EXISTS idx_int_batch ON interview_schedules(batch_id);
CREATE INDEX IF NOT EXISTS idx_int_officer ON interview_schedules(officer_id);

-- 6. RLS Policies for interview_schedules
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to interview_schedules" ON interview_schedules;
CREATE POLICY "Allow all access to interview_schedules" ON interview_schedules
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Realtime Publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE interview_schedules;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

