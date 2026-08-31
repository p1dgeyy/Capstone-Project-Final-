-- =============================================================================
-- Migration: Add missing staff_profiles.active_session_id column
-- Date: 2026-08-31
-- Description:
--   database/supabase_schema.sql has always defined active_session_id on
--   staff_profiles (used by session-manager.js's touchActiveSession() to detect
--   a concurrent login on a second device), but no migration ever actually
--   created it on the live database -- only its sibling column,
--   current_session_id, was added (see 20260824_single_session_and_activity.sql).
--
--   Since the Round-2/Round-3 fix pass (R7) consolidated session-manager.js down
--   to a single touchActiveSession() definition, this is now the only code path,
--   and it runs on a 15-second heartbeat plus every tab focus/visibility change
--   on every staff portal page. Each call has been failing with a PostgREST 400
--   ("column staff_profiles.active_session_id does not exist") since that
--   consolidation shipped -- this migration is the fix.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_profiles' AND column_name = 'active_session_id'
  ) THEN
    ALTER TABLE staff_profiles ADD COLUMN active_session_id VARCHAR(100) DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_active_session ON staff_profiles(active_session_id);
