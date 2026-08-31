-- =============================================================================
-- MIGRATION: 20260831_restore_batch_status_check_constraint.sql
-- Description: Restores strict CHECK constraint on `batches.status` column
-- Valid statuses: 'Active', 'Scheduled', 'In Training', 'Completed', 'Archived', 'Cancelled', 'Postponed'
-- =============================================================================

DO $$
BEGIN
  -- 1. Drop existing status check constraint if present
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'batches_status_check' 
      AND conrelid = 'public.batches'::regclass
  ) THEN
    ALTER TABLE public.batches DROP CONSTRAINT batches_status_check;
  END IF;

  -- 2. Normalize known variations in existing live data
  UPDATE public.batches
  SET status = CASE
    WHEN status ILIKE 'active' THEN 'Active'
    WHEN status ILIKE 'scheduled%' THEN 'Scheduled'
    WHEN status ILIKE '%training%' OR status ILIKE 'ongoing' THEN 'In Training'
    WHEN status ILIKE 'completed' THEN 'Completed'
    WHEN status ILIKE 'archived' THEN 'Archived'
    WHEN status ILIKE 'cancelled' OR status ILIKE 'canceled' THEN 'Cancelled'
    WHEN status ILIKE 'postponed' THEN 'Postponed'
    ELSE 'Active'
  END
  WHERE status IS NULL 
     OR status NOT IN ('Active', 'Scheduled', 'In Training', 'Completed', 'Archived', 'Cancelled', 'Postponed');

  -- 3. Add comprehensive batches_status_check constraint
  ALTER TABLE public.batches 
  ADD CONSTRAINT batches_status_check 
  CHECK (status IN ('Active', 'Scheduled', 'In Training', 'Completed', 'Archived', 'Cancelled', 'Postponed'));

END $$;

