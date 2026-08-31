-- =============================================================================
-- MIGRATION: 20260831_link_operational_batches_by_id.sql
-- Description:
--   Normalizes operational batch assignments across `applications` and `batches`:
--   1. Converts legacy name strings in `applications.operational_batch_id` into
--      real integer `batches.id` references.
--   2. Synchronizes `applications.batch_id` with `applications.operational_batch_id`.
--   3. Adds performance indexes on batch relational columns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Normalize Legacy Batch String Identifiers to Database IDs
-- -----------------------------------------------------------------------------
-- If operational_batch_id contains a batch name instead of an integer ID, update it
UPDATE public.applications a
SET 
  operational_batch_id = b.id::TEXT,
  batch_id = COALESCE(a.batch_id, b.id)
FROM public.batches b
WHERE a.operational_batch_id = b.name
  AND a.operational_batch_id !~ '^[0-9]+$';

-- Ensure batch_id is set whenever operational_batch_id is a valid integer
UPDATE public.applications
SET batch_id = operational_batch_id::BIGINT
WHERE operational_batch_id IS NOT NULL 
  AND operational_batch_id ~ '^[0-9]+$'
  AND batch_id IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Create Relational Indexes for Fast Batch Filtering
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_applications_batch_id ON public.applications(batch_id);
CREATE INDEX IF NOT EXISTS idx_applications_operational_batch_id ON public.applications(operational_batch_id);
CREATE INDEX IF NOT EXISTS idx_applications_is_operational_batch ON public.applications(is_operational_batch);
