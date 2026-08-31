-- =============================================================================
-- MIGRATION: 20260831_restore_batch_status_check_constraint.sql
-- Description: Restores strict CHECK constraint on `batches.status` column
-- Valid statuses: 'Active', 'Scheduled', 'In Training', 'Completed', 'Archived', 'Cancelled', 'Postponed'
-- =============================================================================

DO $$
BEGIN
  -- Normalize any legacy/inconsistent batch status casing or whitespace
  UPDATE public.batches
  SET status = 'Active'
  WHERE status IS NULL OR TRIM(status) = '';

  -- Drop existing status check constraint if present
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'batches_status_check' 
      AND conrelid = 'public.batches'::regclass
  ) THEN
    ALTER TABLE public.batches DROP CONSTRAINT batches_status_check;
  END IF;

  -- Add comprehensive batches_status_check constraint
  ALTER TABLE public.batches 
  ADD CONSTRAINT batches_status_check 
  CHECK (status IN ('Active', 'Scheduled', 'In Training', 'Completed', 'Archived', 'Cancelled', 'Postponed'));

END $$;
