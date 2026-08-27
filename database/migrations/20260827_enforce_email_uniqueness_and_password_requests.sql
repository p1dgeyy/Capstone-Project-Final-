-- =============================================================================
-- Migration: Enforce Email Uniqueness & Officer Password Reset Requests Workflow
-- City Government of Koronadal — PESO & CSWDO Portals
-- Created: 2026-08-27
-- =============================================================================

-- Enable pgcrypto extension if not yet enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create Case-Insensitive Unique Indexes on Beneficiaries and Staff Profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_beneficiaries_email_lower
  ON public.beneficiaries (LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_staff_profiles_email_lower
  ON public.staff_profiles (LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

-- 2. Create Officer Password Reset Requests Table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id BIGSERIAL PRIMARY KEY,
  ticket_id VARCHAR(50) NOT NULL UNIQUE,
  staff_id BIGINT DEFAULT NULL REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  role VARCHAR(50) DEFAULT 'Officer',
  department VARCHAR(50) NOT NULL DEFAULT 'PESO' CHECK (department IN ('PESO', 'CSWDO')),
  reason TEXT DEFAULT 'Officer requested password reset via official login portal.',
  status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled')),
  admin_notes TEXT DEFAULT NULL,
  approved_by BIGINT DEFAULT NULL REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pwd_reset_email ON public.password_reset_requests(email);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_username ON public.password_reset_requests(username);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_dept ON public.password_reset_requests(department);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_created ON public.password_reset_requests(created_at DESC);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Policies for password_reset_requests
DROP POLICY IF EXISTS "password_reset_requests_select_policy" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_insert_policy" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_update_policy" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_delete_policy" ON public.password_reset_requests;

CREATE POLICY "password_reset_requests_select_policy"
  ON public.password_reset_requests FOR SELECT
  USING (true);

CREATE POLICY "password_reset_requests_insert_policy"
  ON public.password_reset_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "password_reset_requests_update_policy"
  ON public.password_reset_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "password_reset_requests_delete_policy"
  ON public.password_reset_requests FOR DELETE
  USING (true);

-- 3. Trigger for updated_at on password_reset_requests
DROP TRIGGER IF EXISTS set_updated_at_password_reset_requests ON public.password_reset_requests;
CREATE TRIGGER set_updated_at_password_reset_requests
  BEFORE UPDATE ON public.password_reset_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Central Database Function: Check Identifier Uniqueness across both tables
CREATE OR REPLACE FUNCTION public.check_identifier_uniqueness(
  p_username TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_exclude_qr_code TEXT DEFAULT NULL,
  p_exclude_staff_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username_clean TEXT := LOWER(TRIM(COALESCE(p_username, '')));
  v_email_clean TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_phone_clean TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_username_taken BOOLEAN := FALSE;
  v_email_taken BOOLEAN := FALSE;
  v_phone_taken BOOLEAN := FALSE;
  v_conflict_table TEXT := NULL;
  v_message TEXT := NULL;
BEGIN
  -- Check in beneficiaries
  IF v_email_clean <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.beneficiaries
      WHERE LOWER(TRIM(email)) = v_email_clean
      AND (p_exclude_qr_code IS NULL OR qr_code <> p_exclude_qr_code)
    ) THEN
      v_email_taken := TRUE;
      v_conflict_table := 'beneficiaries';
    END IF;
  END IF;

  IF v_username_clean <> '' AND NOT v_username_taken THEN
    IF EXISTS (
      SELECT 1 FROM public.beneficiaries
      WHERE LOWER(TRIM(username)) = v_username_clean
      AND (p_exclude_qr_code IS NULL OR qr_code <> p_exclude_qr_code)
    ) THEN
      v_username_taken := TRUE;
      v_conflict_table := 'beneficiaries';
    END IF;
  END IF;

  -- Check in staff_profiles
  IF v_email_clean <> '' AND NOT v_email_taken THEN
    IF EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE LOWER(TRIM(email)) = v_email_clean
      AND (p_exclude_staff_id IS NULL OR id <> p_exclude_staff_id)
    ) THEN
      v_email_taken := TRUE;
      v_conflict_table := 'staff_profiles';
    END IF;
  END IF;

  IF v_username_clean <> '' AND NOT v_username_taken THEN
    IF EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE LOWER(TRIM(username)) = v_username_clean
      AND (p_exclude_staff_id IS NULL OR id <> p_exclude_staff_id)
    ) THEN
      v_username_taken := TRUE;
      v_conflict_table := 'staff_profiles';
    END IF;
  END IF;

  -- Build user-friendly message
  IF v_email_taken AND v_username_taken THEN
    v_message := 'Both username and email address are already registered in the system.';
  ELSIF v_email_taken THEN
    v_message := 'This email address is already attached to an existing account. Each account must have a unique email address.';
  ELSIF v_username_taken THEN
    v_message := 'This username is already taken. Please choose another username.';
  END IF;

  RETURN jsonb_build_object(
    'isAvailable', (NOT v_username_taken AND NOT v_email_taken AND NOT v_phone_taken),
    'isUsernameTaken', v_username_taken,
    'isEmailTaken', v_email_taken,
    'isPhoneTaken', v_phone_taken,
    'message', v_message,
    'conflictTable', v_conflict_table
  );
END;
$$;

-- 5. Realtime Publication for password_reset_requests
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.password_reset_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
