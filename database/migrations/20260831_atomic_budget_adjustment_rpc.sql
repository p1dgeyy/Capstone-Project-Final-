-- =============================================================================
-- MIGRATION: 20260831_atomic_budget_adjustment_rpc.sql
-- Description:
--   Creates atomic `adjust_program_budget` database RPC function to eliminate
--   race conditions on budget modifications across programs and funds tables.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.adjust_program_budget(
  p_program_code TEXT,
  p_adjustment_amount NUMERIC,
  p_action TEXT DEFAULT 'add',
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fund RECORD;
  v_prog RECORD;
  v_cleaned_code TEXT;
  v_multiplier NUMERIC := 1;
  v_effective_delta NUMERIC;
  v_new_budget NUMERIC;
BEGIN
  IF p_adjustment_amount IS NULL OR p_adjustment_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid adjustment amount. Amount must be greater than zero.'
    );
  END IF;

  IF p_program_code IS NULL OR TRIM(p_program_code) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid program code. Program code cannot be empty.'
    );
  END IF;

  v_cleaned_code := UPPER(TRIM(p_program_code));
  
  IF LOWER(TRIM(COALESCE(p_action, 'add'))) IN ('subtract', 'decrease', 'deduct') THEN
    v_multiplier := -1;
  END IF;

  v_effective_delta := p_adjustment_amount * v_multiplier;

  -- 1. Atomic update on programs table
  UPDATE public.programs
  SET 
    budget = GREATEST(0, COALESCE(budget, 0) + v_effective_delta),
    updated_at = NOW()
  WHERE UPPER(TRIM(code)) = v_cleaned_code
     OR UPPER(TRIM(name)) ILIKE '%' || v_cleaned_code || '%'
  RETURNING * INTO v_prog;

  -- 2. Atomic update on funds table
  UPDATE public.funds
  SET 
    allocated_budget = GREATEST(0, COALESCE(allocated_budget, 0) + v_effective_delta),
    updated_at = NOW()
  WHERE UPPER(TRIM(program_code)) = v_cleaned_code
     OR UPPER(TRIM(program)) ILIKE '%' || v_cleaned_code || '%'
  RETURNING * INTO v_fund;

  IF v_prog IS NULL AND v_fund IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No matching program or fund record found for code: ' || v_cleaned_code
    );
  END IF;

  v_new_budget := COALESCE(v_fund.allocated_budget, v_prog.budget, 0);

  RETURN jsonb_build_object(
    'success', true,
    'new_budget', v_new_budget,
    'delta', v_effective_delta,
    'program_code', v_cleaned_code,
    'program', COALESCE(v_fund.program, v_prog.name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_program_budget(TEXT, NUMERIC, TEXT, TEXT) TO authenticated, anon, service_role;
