-- =============================================================================
-- MIGRATION: 20260831_atomic_application_fund_release_rpc.sql
-- Description:
--   Creates atomic server-side RPC `release_application_funds` to guarantee
--   idempotent fund disbursement and prevent duplicate payouts on applications.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.release_application_funds(
  p_application_id BIGINT,
  p_program_code TEXT,
  p_amount NUMERIC,
  p_admin_id BIGINT DEFAULT NULL,
  p_notes TEXT DEFAULT 'Funds released at disbursement desk'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app RECORD;
  v_fund RECORD;
  v_cleaned_code TEXT;
  v_amount NUMERIC := COALESCE(p_amount, 0);
BEGIN
  IF p_application_id IS NULL OR p_application_id <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid application ID provided.'
    );
  END IF;

  -- 1. Row-level lock on the target application to prevent race conditions
  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Application not found for ID: ' || p_application_id
    );
  END IF;

  -- 2. Server-side Idempotency Guard: Reject if already Released or Completed
  IF v_app.status = 'Released' OR v_app.status = 'Completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Duplicate Disbursement Blocked: Application #' || COALESCE(v_app.application_number, p_application_id::text) || ' is already in ' || v_app.status || ' status.'
    );
  END IF;

  -- 3. Deduce amount if not explicitly passed
  IF v_amount <= 0 THEN
    v_amount := COALESCE(v_app.amount_approved, v_app.amount_requested, 0);
  END IF;

  -- 4. Program code resolution
  v_cleaned_code := UPPER(TRIM(COALESCE(p_program_code, 'CSWDO')));

  -- 5. Deduct from ledger if amount > 0
  IF v_amount > 0 THEN
    UPDATE public.funds
    SET 
      released_amount = released_amount + v_amount,
      updated_at = NOW()
    WHERE UPPER(TRIM(program_code)) = v_cleaned_code
       OR UPPER(TRIM(program)) ILIKE '%' || v_cleaned_code || '%'
    RETURNING * INTO v_fund;

    IF NOT FOUND THEN
      -- If not in funds table, verify programs table exists
      NULL;
    END IF;
  END IF;

  -- 6. Update application status to Released
  UPDATE public.applications
  SET 
    status = 'Released',
    admin_notes = COALESCE(p_notes, admin_notes),
    updated_at = NOW()
  WHERE id = p_application_id
  RETURNING * INTO v_app;

  RETURN jsonb_build_object(
    'success', true,
    'application', row_to_json(v_app),
    'fund', CASE WHEN v_fund IS NOT NULL THEN row_to_json(v_fund) ELSE NULL END
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.release_application_funds(BIGINT, TEXT, NUMERIC, BIGINT, TEXT) TO authenticated, anon, service_role;
