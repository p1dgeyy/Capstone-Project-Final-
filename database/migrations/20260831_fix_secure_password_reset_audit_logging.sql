-- =============================================================================
-- MIGRATION: 20260831_fix_secure_password_reset_audit_logging.sql
-- Description:
--   Updates `reset_user_password` RPC to correctly attribute password reset audit
--   logs to beneficiary_qr or staff_user_id, adhering strictly to chk_audit_actor
--   and BIGINT entity_id constraints.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reset_user_password(
  p_email TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_pw TEXT;
  v_staff_id BIGINT;
  v_ben_qr TEXT;
  v_ben_id BIGINT;
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required for password reset.';
  END IF;

  IF p_new_password IS NULL OR LENGTH(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  -- 1. Find user in auth.users by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user account found with email: %', p_email;
  END IF;

  -- 2. Generate encrypted password hash using pgcrypto extension
  v_encrypted_pw := crypt(p_new_password, gen_salt('bf', 10));

  -- 3. Update auth.users password directly
  UPDATE auth.users
  SET encrypted_password = v_encrypted_pw,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 4. Update timestamps and look up staff / beneficiary record for audit attribution
  SELECT id INTO v_staff_id
  FROM public.staff_profiles
  WHERE auth_id = v_user_id OR LOWER(TRIM(email)) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_staff_id IS NOT NULL THEN
    UPDATE public.staff_profiles
    SET updated_at = NOW()
    WHERE id = v_staff_id;
  END IF;

  SELECT id, qr_code INTO v_ben_id, v_ben_qr
  FROM public.beneficiaries
  WHERE auth_id = v_user_id OR LOWER(TRIM(email)) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_ben_id IS NOT NULL THEN
    UPDATE public.beneficiaries
    SET updated_at = NOW()
    WHERE id = v_ben_id;
  END IF;

  -- 5. Mark all previous OTPs for this user as EXPIRED so they cannot be reused
  UPDATE public.otp_requests
  SET status = 'EXPIRED',
      updated_at = NOW()
  WHERE LOWER(TRIM(identifier)) = LOWER(TRIM(p_email))
    AND status IN ('PENDING', 'USED');

  -- 6. Insert audit log compliant with chk_audit_actor constraint and BIGINT entity_id
  IF v_ben_qr IS NOT NULL THEN
    INSERT INTO public.audit_logs (beneficiary_qr, action, entity_type, entity_id, details)
    VALUES (
      v_ben_qr,
      'PASSWORD_RESET_SUCCESS',
      'beneficiary',
      v_ben_id,
      'Password reset successfully completed for account ' || LOWER(TRIM(p_email))
    );
  ELSIF v_staff_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (staff_user_id, action, entity_type, entity_id, details)
    VALUES (
      v_staff_id,
      'PASSWORD_RESET_SUCCESS',
      'staff_profile',
      v_staff_id,
      'Password reset successfully completed for staff account ' || LOWER(TRIM(p_email))
    );
  END IF;

  RETURN true;
END;
$$;

-- Grant execution to public / anon callers
GRANT EXECUTE ON FUNCTION public.reset_user_password(TEXT, TEXT) TO anon, authenticated, service_role;
