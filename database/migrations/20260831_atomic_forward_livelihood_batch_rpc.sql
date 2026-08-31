-- =============================================================================
-- MIGRATION: 20260831_atomic_forward_livelihood_batch_rpc.sql
-- Description:
--   Creates atomic server-side RPC `forward_livelihood_batch_to_admin` to create/reuse
--   a batch and assign applications transactionally in a single atomic database operation.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.forward_livelihood_batch_to_admin(
  p_group_label TEXT,
  p_program_code TEXT,
  p_officer_id BIGINT,
  p_officer_name TEXT,
  p_application_ids BIGINT[],
  p_batch_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_id BIGINT := p_batch_id;
  v_batch RECORD;
  v_updated_count INT := 0;
  v_prog_id BIGINT;
BEGIN
  -- 1. Resolve program_id if possible
  SELECT id INTO v_prog_id
  FROM public.programs
  WHERE UPPER(TRIM(code)) = UPPER(TRIM(COALESCE(p_program_code, 'PESO')))
  LIMIT 1;

  -- 2. If batch_id not passed, check if a batch with this group_label already exists from this officer
  IF v_batch_id IS NULL THEN
    SELECT id INTO v_batch_id
    FROM public.batches
    WHERE name = p_group_label
      AND created_by = p_officer_id
      AND created_at >= (NOW() - INTERVAL '5 minutes')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 3. Create batch row if not existing
  IF v_batch_id IS NULL THEN
    INSERT INTO public.batches (
      name,
      program_id,
      program_code,
      capacity,
      current_count,
      status,
      is_operational,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      p_group_label,
      v_prog_id,
      COALESCE(p_program_code, 'PESO'),
      GREATEST(50, COALESCE(array_length(p_application_ids, 1), 1)),
      COALESCE(array_length(p_application_ids, 1), 0),
      'Active',
      true,
      p_officer_id,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_batch_id;
  END IF;

  SELECT * INTO v_batch FROM public.batches WHERE id = v_batch_id;

  -- 4. Update applications transactionally
  IF p_application_ids IS NOT NULL AND array_length(p_application_ids, 1) > 0 THEN
    UPDATE public.applications
    SET
      status = 'Officer Approved',
      batch_id = v_batch_id,
      forwarded_by = COALESCE(p_officer_name, 'PESO Officer'),
      forwarded_at = NOW(),
      officer_id = p_officer_id,
      officer_decision = 'Approved',
      officer_action_at = NOW(),
      updated_at = NOW()
    WHERE id = ANY(p_application_ids);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'batch', row_to_json(v_batch),
    'updated_count', v_updated_count
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.forward_livelihood_batch_to_admin(TEXT, TEXT, BIGINT, TEXT, BIGINT[], BIGINT) TO authenticated, anon, service_role;
