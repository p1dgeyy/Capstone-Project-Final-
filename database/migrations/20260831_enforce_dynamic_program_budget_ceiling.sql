-- =============================================================================
-- MIGRATION: 20260831_enforce_dynamic_program_budget_ceiling.sql
-- Description:
--   Creates a dynamic database trigger `trg_check_application_approved_budget`
--   that validates `amount_approved` against the actual remaining budget
--   (allocated_budget - released_amount) of the specific assistance program.
-- =============================================================================

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
BEGIN
  -- Only validate when an approved amount is assigned and status is Approved/Released
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

        -- If application was already released, allow without double counting
        IF TG_OP = 'UPDATE' AND OLD.status = 'Released' AND OLD.amount_approved = NEW.amount_approved THEN
          RETURN NEW;
        END IF;

        -- 3. Reject if approved amount exceeds remaining program budget
        IF NEW.amount_approved > v_remaining THEN
          RAISE EXCEPTION 'Budget Limit Exceeded: Approved amount (₱%) exceeds remaining available budget (₱%) for program %.',
            TO_CHAR(NEW.amount_approved, 'FM999,999,990.00'),
            TO_CHAR(v_remaining, 'FM999,999,990.00'),
            v_prog_code;
        END IF;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Create or replace trigger on applications table
DROP TRIGGER IF EXISTS trg_check_application_approved_budget ON public.applications;

CREATE TRIGGER trg_check_application_approved_budget
  BEFORE INSERT OR UPDATE OF amount_approved, status, program_id
  ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_application_approved_budget();
