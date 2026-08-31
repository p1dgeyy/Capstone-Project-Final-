-- =============================================================================
-- Migration: Out-of-Band Password Reset RPC (Fix C4)
-- Date: 2026-08-31
-- Description:
--   Enables secure, out-of-band password updates for unauthenticated users
--   who have successfully verified their 6-digit OTP code.
--
-- Policy & Function Permissions:
--   - reset_user_password(p_email, p_new_password): Callable by anon, authenticated.
--   - Enforces OTP verification check (status = 'USED' within 15 minutes) before
--     updating auth.users.encrypted_password with bcrypt (gen_salt('bf')).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.reset_user_password(
  p_email TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_otp_verified BOOLEAN := false;
BEGIN
  -- Input validations
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required for password reset.';
  END IF;

  IF p_new_password IS NULL OR LENGTH(TRIM(p_new_password)) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long.';
  END IF;

  -- 1. Check if user exists in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user account found matching the provided email.';
  END IF;

  -- 2. Verify that a valid OTP verification occurred in the last 15 minutes
  SELECT EXISTS (
    SELECT 1 FROM public.otp_requests
    WHERE LOWER(TRIM(identifier)) = LOWER(TRIM(p_email))
      AND purpose IN ('PASSWORD_RESET', 'EMAIL_VERIFICATION', '2FA_LOGIN')
      AND status = 'USED'
      AND updated_at >= NOW() - INTERVAL '15 minutes'
  ) INTO v_otp_verified;

  IF NOT v_otp_verified THEN
    RAISE EXCEPTION 'OTP verification required or session has expired. Please request a new verification code.';
  END IF;

  -- 3. Update auth.users password using bcrypt
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 4. Update timestamps in application profile tables
  UPDATE public.beneficiaries
  SET updated_at = NOW()
  WHERE auth_id = v_user_id OR LOWER(TRIM(email)) = LOWER(TRIM(p_email));

  UPDATE public.staff_profiles
  SET updated_at = NOW()
  WHERE auth_id = v_user_id OR LOWER(TRIM(email)) = LOWER(TRIM(p_email));

  -- 5. Mark all previous OTPs for this user as EXPIRED so they cannot be reused
  UPDATE public.otp_requests
  SET status = 'EXPIRED',
      updated_at = NOW()
  WHERE LOWER(TRIM(identifier)) = LOWER(TRIM(p_email))
    AND status IN ('PENDING', 'USED');

  -- 6. Insert audit log if audit_logs table exists
  BEGIN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
    VALUES (
      'PASSWORD_RESET_SUCCESS',
      'auth_user',
      v_user_id::TEXT,
      'Password reset successfully completed for account ' || LOWER(TRIM(p_email))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN true;
END;
$$;

-- Grant execution to public / anon callers
GRANT EXECUTE ON FUNCTION public.reset_user_password(TEXT, TEXT) TO anon, authenticated, service_role;
