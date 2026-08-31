-- =============================================================================
-- MIGRATION: 20260831_enforce_fund_budget_ceiling_constraint.sql
-- Description:
--   Adds real database-level CHECK constraints on `funds` table so `released_amount`
--   can never exceed `allocated_budget` or go negative.
--   Updates `release_fund_amount` RPC with pre-check and WHERE guardrails.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ensure Table Structure & Apply Constraints
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funds (
  id BIGSERIAL PRIMARY KEY,
  program VARCHAR(255) NOT NULL,
  program_code VARCHAR(20) NOT NULL UNIQUE,
  allocated_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  released_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_balance DECIMAL(12,2) GENERATED ALWAYS AS (allocated_budget - released_amount) STORED,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop constraint if exists before recreating
ALTER TABLE public.funds
  DROP CONSTRAINT IF EXISTS funds_released_amount_ceiling_check,
  DROP CONSTRAINT IF EXISTS funds_allocated_budget_positive_check;

-- Add database-level constraint
ALTER TABLE public.funds
  ADD CONSTRAINT funds_released_amount_ceiling_check 
    CHECK (released_amount <= allocated_budget AND released_amount >= 0),
  ADD CONSTRAINT funds_allocated_budget_positive_check 
    CHECK (allocated_budget >= 0);

-- -----------------------------------------------------------------------------
-- 2. Enhanced Atomic RPC with Database Budget Limit Guardrail
-- -----------------------------------------------------------------------------
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
  v_current_fund RECORD;
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

  -- 1. Select with row-level lock
  SELECT * INTO v_current_fund
  FROM public.funds
  WHERE UPPER(TRIM(program_code)) = v_cleaned_code
     OR UPPER(TRIM(program)) ILIKE '%' || v_cleaned_code || '%'
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No fund budget record found for program code: ' || v_cleaned_code
    );
  END IF;

  -- 2. Enforce strict database-level budget ceiling guard
  IF (v_current_fund.released_amount + p_amount) > v_current_fund.allocated_budget THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'Insufficient program budget: Requested release of ₱%s exceeds remaining balance of ₱%s (Allocated: ₱%s, Already Released: ₱%s).',
        to_char(p_amount, 'FM999,999,990.00'),
        to_char(GREATEST(0, v_current_fund.allocated_budget - v_current_fund.released_amount), 'FM999,999,990.00'),
        to_char(v_current_fund.allocated_budget, 'FM999,999,990.00'),
        to_char(v_current_fund.released_amount, 'FM999,999,990.00')
      )
    );
  END IF;

  -- 3. Atomic in-place increment with double-check guard
  UPDATE public.funds
  SET 
    released_amount = released_amount + p_amount,
    updated_at = NOW()
  WHERE id = v_current_fund.id
    AND (released_amount + p_amount <= allocated_budget)
  RETURNING * INTO v_fund;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Concurrent update prevented fund release due to budget ceiling limit.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', row_to_json(v_fund)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_fund_amount(TEXT, NUMERIC) TO authenticated, anon, service_role;
