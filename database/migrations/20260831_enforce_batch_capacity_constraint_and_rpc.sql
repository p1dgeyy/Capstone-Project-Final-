-- =============================================================================
-- MIGRATION: 20260831_enforce_batch_capacity_constraint_and_rpc.sql
-- Description:
--   Enforces training-batch capacity limit at the database level:
--   1. Adds `current_count` column & `batches_capacity_ceiling_check` constraint.
--   2. Creates atomic `add_batch_members` RPC function that verifies capacity
--      under row-level lock (`FOR UPDATE`) and returns explicit "batch full" error.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ensure Table Structure & Constraints
-- -----------------------------------------------------------------------------
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS current_count INT NOT NULL DEFAULT 0;

-- Sync current_count with existing application assignments
UPDATE public.batches b
SET current_count = (
  SELECT COUNT(*) 
  FROM public.applications a 
  WHERE a.batch_id = b.id OR a.operational_batch_id = b.id
);

ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_capacity_ceiling_check;
ALTER TABLE public.batches ADD CONSTRAINT batches_capacity_ceiling_check CHECK (current_count <= capacity AND current_count >= 0);

-- -----------------------------------------------------------------------------
-- 2. Atomic Transactional Batch Member Assignment RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_batch_members(
  p_batch_id BIGINT,
  p_application_ids BIGINT[],
  p_officer_name TEXT DEFAULT 'PESO Officer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch RECORD;
  v_current_count INT;
  v_capacity INT;
  v_requested_count INT;
  v_new_total INT;
  v_now TIMESTAMPTZ := NOW();
  v_app_id BIGINT;
  v_added_count INT := 0;
BEGIN
  IF p_batch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Batch ID is required.');
  END IF;

  IF p_application_ids IS NULL OR array_length(p_application_ids, 1) IS NULL OR array_length(p_application_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No beneficiaries/applications selected.');
  END IF;

  v_requested_count := array_length(p_application_ids, 1);

  -- 1. Lock the batch row for update to prevent concurrent race conditions
  SELECT * INTO v_batch
  FROM public.batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Batch record not found for ID: ' || p_batch_id);
  END IF;

  -- 2. Count actual members currently assigned to this batch in applications table
  SELECT COUNT(*) INTO v_current_count
  FROM public.applications
  WHERE batch_id = p_batch_id OR operational_batch_id = p_batch_id;

  v_capacity := COALESCE(v_batch.capacity, 50);
  v_new_total := v_current_count + v_requested_count;

  -- 3. Enforce strict capacity limit
  IF v_new_total > v_capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'Batch Capacity Exceeded: Cannot add %s member(s) to "%s". Current membership is %s/%s (Available slots: %s).',
        v_requested_count,
        v_batch.name,
        v_current_count,
        v_capacity,
        GREATEST(0, v_capacity - v_current_count)
      ),
      'current_count', v_current_count,
      'capacity', v_capacity,
      'available_slots', GREATEST(0, v_capacity - v_current_count)
    );
  END IF;

  -- 4. Atomically assign applications to this batch
  FOREACH v_app_id IN ARRAY p_application_ids LOOP
    UPDATE public.applications
    SET 
      batch_id = p_batch_id,
      operational_batch_id = p_batch_id,
      operational_batch_name = v_batch.name,
      is_operational_batch = TRUE,
      batched_at = v_now,
      batched_by = COALESCE(p_officer_name, 'PESO Officer'),
      updated_at = v_now
    WHERE id = v_app_id;

    IF FOUND THEN
      v_added_count := v_added_count + 1;
    END IF;
  END LOOP;

  -- 5. Update batch current_count and updated_at
  UPDATE public.batches
  SET 
    current_count = v_current_count + v_added_count,
    updated_at = v_now
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'batch_name', v_batch.name,
    'added_count', v_added_count,
    'new_total', v_current_count + v_added_count,
    'capacity', v_capacity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_batch_members(BIGINT, BIGINT[], TEXT) TO authenticated, anon, service_role;
