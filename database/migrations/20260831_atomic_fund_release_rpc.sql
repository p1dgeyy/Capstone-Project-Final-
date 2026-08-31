-- =============================================================================
-- MIGRATION: 20260831_atomic_fund_release_rpc.sql
-- Description:
--   Creates the atomic database RPC function `release_fund_amount` to eliminate
--   race conditions on `funds.released_amount` concurrent updates.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.release_fund_amount(
  p_program_code TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fund RECORD;
  v_cleaned_code TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid release amount. Amount must be greater than zero.'
    );
  END IF;

  IF p_program_code IS NULL OR TRIM(p_program_code) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid program code. Program code cannot be empty.'
    );
  END IF;

  v_cleaned_code := UPPER(TRIM(p_program_code));

  -- Atomic in-place increment with row-level lock
  UPDATE public.funds
  SET 
    released_amount = released_amount + p_amount,
    updated_at = NOW()
  WHERE UPPER(TRIM(program_code)) = v_cleaned_code
     OR UPPER(TRIM(program)) ILIKE '%' || v_cleaned_code || '%'
  RETURNING * INTO v_fund;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No fund record found for program code: ' || v_cleaned_code
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', row_to_json(v_fund)
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.release_fund_amount(TEXT, NUMERIC) TO authenticated, anon, service_role;
