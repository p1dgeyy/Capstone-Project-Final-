-- =============================================================================
-- Migration: Secure OTP Verification RPC & Restrict Direct Table SELECT (Fix C3)
-- Date: 2026-08-31
-- Description:
--   1. Replaces open `otp_requests` SELECT policy so client cannot read `otp_hash` or `salt`.
--   2. Provides atomic `public.verify_otp_code()` SECURITY DEFINER RPC function
--      that verifies codes server-side against unique per-row salts.
--
-- Policy & Function Permissions:
--   - SELECT on otp_requests: Restricted to active PESO/CSWDO Admins (public.is_admin_user(auth.uid())).
--   - verify_otp_code(p_identifier, p_code, p_purpose): Callable by anon, authenticated, service_role.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Server-Side Secure OTP Verification RPC
CREATE OR REPLACE FUNCTION public.verify_otp_code(
  p_identifier TEXT,
  p_code TEXT,
  p_purpose TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_computed_hash TEXT;
  v_legacy_hash TEXT;
  v_matched BOOLEAN := false;
BEGIN
  -- Sanitize inputs
  IF p_identifier IS NULL OR p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN false;
  END IF;

  -- Select most recent active pending OTP record for this identifier
  SELECT * INTO v_rec
  FROM public.otp_requests
  WHERE LOWER(TRIM(identifier)) = LOWER(TRIM(p_identifier))
    AND status = 'PENDING'
    AND expiry > NOW()
    AND (p_purpose IS NULL OR purpose = p_purpose)
    AND attempts < max_attempts
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Compute SHA-256 with the row's specific salt
  BEGIN
    v_computed_hash := encode(digest(TRIM(p_code) || '_' || COALESCE(v_rec.salt, ''), 'sha256'), 'hex');
    v_legacy_hash := encode(digest(TRIM(p_code) || '_KORONADAL_SALT_2026', 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    v_computed_hash := NULL;
    v_legacy_hash := NULL;
  END;

  -- Verify match
  IF v_rec.otp_hash = TRIM(p_code)
     OR (v_computed_hash IS NOT NULL AND v_rec.otp_hash = v_computed_hash)
     OR (v_legacy_hash IS NOT NULL AND v_rec.otp_hash = v_legacy_hash) THEN
    v_matched := true;
  END IF;

  IF v_matched THEN
    UPDATE public.otp_requests
    SET status = 'USED',
        updated_at = NOW()
    WHERE id = v_rec.id;
    RETURN true;
  ELSE
    UPDATE public.otp_requests
    SET attempts = attempts + 1,
        status = CASE WHEN attempts + 1 >= max_attempts THEN 'BLOCKED' ELSE 'PENDING' END,
        updated_at = NOW()
    WHERE id = v_rec.id;
    RETURN false;
  END IF;
END;
$$;

-- Grant execution permission to public callers
GRANT EXECUTE ON FUNCTION public.verify_otp_code(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 2. Restrict Direct SELECT on otp_requests
ALTER TABLE IF EXISTS public.otp_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "otp_requests_select_policy" ON public.otp_requests;
DROP POLICY IF EXISTS "Admins can view OTP records" ON public.otp_requests;

CREATE POLICY "otp_requests_select_policy"
  ON public.otp_requests FOR SELECT
  USING (
    public.is_admin_user(auth.uid())
  );
