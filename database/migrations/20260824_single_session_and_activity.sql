-- =============================================================================
-- Migration: Single Active Session Enforcement & Inactivity Tracking
-- Date: 2026-08-24
-- Description:
--   1. Adds current_session_id and last_activity_at to staff_profiles and beneficiaries
--   2. Creates active_user_sessions table for fast concurrent session management & Realtime
--   3. Enables Realtime replication for active session changes
-- =============================================================================

-- 1. Add session columns to staff_profiles if not existing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff_profiles' AND column_name = 'current_session_id'
  ) THEN
    ALTER TABLE staff_profiles ADD COLUMN current_session_id VARCHAR(100) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff_profiles' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE staff_profiles ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 2. Add session columns to beneficiaries if not existing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'beneficiaries' AND column_name = 'current_session_id'
  ) THEN
    ALTER TABLE beneficiaries ADD COLUMN current_session_id VARCHAR(100) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'beneficiaries' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE beneficiaries ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 3. Dedicated active_user_sessions Table for unified cross-role lookup
CREATE TABLE IF NOT EXISTS active_user_sessions (
  user_id VARCHAR(100) PRIMARY KEY, -- auth UUID, staff ID, or beneficiary QR code
  session_id VARCHAR(100) NOT NULL,
  user_identifier VARCHAR(100),       -- username or email
  role VARCHAR(50),
  device_info TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_session_id ON active_user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity ON active_user_sessions(last_activity_at);

-- 4. Enable Row Level Security (RLS) with permissive read/upsert for authenticated users
ALTER TABLE active_user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select on active_user_sessions" ON active_user_sessions;
CREATE POLICY "Allow select on active_user_sessions" ON active_user_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert/update on active_user_sessions" ON active_user_sessions;
CREATE POLICY "Allow insert/update on active_user_sessions" ON active_user_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Realtime on active_user_sessions (if publication exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_user_sessions;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;
