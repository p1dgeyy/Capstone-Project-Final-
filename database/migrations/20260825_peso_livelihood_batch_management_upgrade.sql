-- =============================================================================
-- MIGRATION: 20260825_peso_livelihood_batch_management_upgrade.sql
-- Description: PESO Officer Livelihood Application Management & Batch Creation Upgrade
-- Features:
--   1. Ensures `batches` table schema supports program linkage, officer attribution, capacity, and status.
--   2. Ensures `applications.batch_id` foreign key and indexes exist.
--   3. Adds RLS policies for PESO officers/staff to create batches and assign approved applications.
--   4. Publishes `batches` and `applications` to supabase_realtime for live synchronization.
-- =============================================================================

-- 1. Ensure `batches` table exists with complete columns
CREATE TABLE IF NOT EXISTS batches (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  program_id BIGINT DEFAULT NULL REFERENCES programs(id) ON DELETE SET NULL,
  program_code VARCHAR(50) NOT NULL DEFAULT 'PESO',
  capacity INT NOT NULL DEFAULT 50,
  status VARCHAR(30) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'In Training', 'Completed', 'Archived', 'Cancelled')),
  notes TEXT DEFAULT NULL,
  created_by BIGINT DEFAULT NULL REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist in case table was created previously with fewer columns
ALTER TABLE batches ADD COLUMN IF NOT EXISTS program_id BIGINT DEFAULT NULL REFERENCES programs(id) ON DELETE SET NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS program_code VARCHAR(50) NOT NULL DEFAULT 'PESO';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 50;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'Active';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS created_by BIGINT DEFAULT NULL REFERENCES staff_profiles(id) ON DELETE SET NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Indexes for fast filtering & roster retrieval
CREATE INDEX IF NOT EXISTS idx_batches_program_code ON batches(program_code);
CREATE INDEX IF NOT EXISTS idx_batches_program_id ON batches(program_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_created_by ON batches(created_by);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at DESC);

-- 3. Ensure `applications.batch_id` column and index exist
ALTER TABLE applications ADD COLUMN IF NOT EXISTS batch_id BIGINT DEFAULT NULL REFERENCES batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_applications_batch_id ON applications(batch_id);

-- 4. Enable Row Level Security (RLS) on `batches`
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- Read policy: Staff and Beneficiaries can read batches
DROP POLICY IF EXISTS "Staff and beneficiaries can read batches" ON batches;
DROP POLICY IF EXISTS "Staff can read batches" ON batches;
CREATE POLICY "Staff and beneficiaries can read batches"
  ON batches FOR SELECT
  USING (true);

-- Insert policy: Staff can create batches
DROP POLICY IF EXISTS "Staff can create batches" ON batches;
CREATE POLICY "Staff can create batches"
  ON batches FOR INSERT
  WITH CHECK (true);

-- Update policy: Staff can update batches
DROP POLICY IF EXISTS "Staff can update batches" ON batches;
CREATE POLICY "Staff can update batches"
  ON batches FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Delete policy: Staff can delete or archive batches
DROP POLICY IF EXISTS "Staff can delete batches" ON batches;
CREATE POLICY "Staff can delete batches"
  ON batches FOR DELETE
  USING (true);

-- 5. Ensure `interview_schedules.batch_id` exists
ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS batch_id BIGINT DEFAULT NULL REFERENCES batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_interview_schedules_batch_id ON interview_schedules(batch_id);

-- 6. Realtime publication synchronization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'batches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE batches;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE applications;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'interview_schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE interview_schedules;
  END IF;
END $$;
