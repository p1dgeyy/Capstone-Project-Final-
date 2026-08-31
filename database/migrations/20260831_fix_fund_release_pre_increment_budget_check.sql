-- =============================================================================
-- MIGRATION: 20260831_fix_fund_release_pre_increment_budget_check.sql
-- Description:
--   1. Updates `release_application_funds` RPC to validate remaining budget
--      BEFORE incrementing `funds.released_amount` under a row-level lock.
--   2. Updates `check_application_approved_budget` trigger to correctly compute
--      pre-release available budget when transitioning an application to 'Released',
--      preventing false rejection of valid releases exceeding 50% remaining balance.
-- =============================================================================

-- 1. Updated trigger function: check_application_approved_budget
CREATE OR REPLACE FUNCTION public.check_application_approved_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prog_code TEXT;
  v_allocated NUMERIC := 0;
  v_released NUMERIC := 0;
  v_remaining NUMERIC := 0;
  v_available NUMERIC := 0;
BEGIN
  -- Only validate when an approved amount is assigned and status is Approved or Released
  IF NEW.amount_approved IS NOT NULL AND NEW.amount_approved > 0 AND (NEW.status IN ('Approved', 'Released')) THEN
    
    -- 1. Look up program code from programs table
    IF NEW.program_id IS NOT NULL THEN
      SELECT code INTO v_prog_code
      FROM public.programs
      WHERE id = NEW.program_id;
    END IF;

    IF v_prog_code IS NOT NULL AND TRIM(v_prog_code) <> '' THEN
      -- 2. Look up allocated budget and released amount from funds table
      SELECT allocated_budget, released_amount
      INTO v_allocated, v_released
      FROM public.funds
      WHERE UPPER(TRIM(program_code)) = UPPER(TRIM(v_prog_code))
         OR UPPER(TRIM(program)) ILIKE '%' || UPPER(TRIM(v_prog_code)) || '%'
      LIMIT 1;

      IF FOUND AND v_allocated > 0 THEN
        v_remaining := v_allocated - v_released;

        -- If application was already released with unchanged amount, allow
        IF TG_OP = 'UPDATE' AND OLD.status = 'Released' AND OLD.amount_approved = NEW.amount_approved THEN
          RETURN NEW;
        END IF;

        -- When transitioning to 'Released', released_amount has either already been incremented
        -- in the same release transaction or will be immediately. Check that total released amount
        -- does not exceed allocated budget.
        IF NEW.status = 'Released' THEN
          IF v_released > v_allocated THEN
            RAISE EXCEPTION 'Budget Limit Exceeded: Total released funds (₱%) would exceed allocated budget (₱%) for program %.',
              TO_CHAR(v_released, 'FM999,999,990.00'),
              TO_CHAR(v_allocated, 'FM999,999,990.00'),
              v_prog_code;
          END IF;
        ELSE
          -- For 'Approved' status (committing grant before release)
          v_available := v_remaining;
          IF NEW.amount_approved > v_available THEN
            RAISE EXCEPTION 'Budget Limit Exceeded: Approved amount (₱%) exceeds remaining available budget (₱%) for program %.',
              TO_CHAR(NEW.amount_approved, 'FM999,999,990.00'),
              TO_CHAR(v_available, 'FM999,999,990.00'),
              v_prog_code;
          END IF;
        END IF;

      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS trg_check_application_approved_budget ON public.applications;

CREATE TRIGGER trg_check_application_approved_budget
  BEFORE INSERT OR UPDATE OF amount_approved, status, program_id
  ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_application_approved_budget();

-- 2. Updated RPC: release_application_funds
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
  v_avail_balance NUMERIC;
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

  -- 5. Lock fund row and check available budget BEFORE incrementing released_amount
  IF v_amount > 0 THEN
    SELECT * INTO v_fund
    FROM public.funds
    WHERE UPPER(TRIM(program_code)) = v_cleaned_code
       OR UPPER(TRIM(program)) ILIKE '%' || v_cleaned_code || '%'
    FOR UPDATE;

    IF FOUND THEN
      v_avail_balance := v_fund.allocated_budget - v_fund.released_amount;
      IF v_amount > v_avail_balance THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Budget Limit Exceeded: Disbursement amount (₱' || TO_CHAR(v_amount, 'FM999,999,990.00') || ') exceeds remaining available budget (₱' || TO_CHAR(v_avail_balance, 'FM999,999,990.00') || ') for program ' || v_cleaned_code || '.'
        );
      END IF;

      UPDATE public.funds
      SET 
        released_amount = released_amount + v_amount,
        updated_at = NOW()
      WHERE id = v_fund.id
      RETURNING * INTO v_fund;
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
