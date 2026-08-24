-- =============================================================================
-- Migration: Enforce Username and Email Uniqueness Across Portals
-- City Government of Koronadal — PESO & CSWDO Portals
-- Created: 2026-08-24
-- =============================================================================

-- 1. Create Case-Insensitive Unique Indexes on Beneficiaries
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_beneficiaries_username_lower
  ON beneficiaries (LOWER(TRIM(username)))
  WHERE username IS NOT NULL AND TRIM(username) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_beneficiaries_email_lower
  ON beneficiaries (LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

-- 2. Create Case-Insensitive Unique Indexes on Staff Profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_staff_profiles_username_lower
  ON staff_profiles (LOWER(TRIM(username)))
  WHERE username IS NOT NULL AND TRIM(username) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_staff_profiles_email_lower
  ON staff_profiles (LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

-- 3. Database Function: Check Identifier Uniqueness across both tables
CREATE OR REPLACE FUNCTION check_identifier_uniqueness(
  p_username TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_exclude_beneficiary_id BIGINT DEFAULT NULL,
  p_exclude_staff_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username_clean TEXT := LOWER(TRIM(COALESCE(p_username, '')));
  v_email_clean TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_username_taken BOOLEAN := FALSE;
  v_email_taken BOOLEAN := FALSE;
  v_conflict_table TEXT := NULL;
  v_message TEXT := NULL;
BEGIN
  -- Check username in beneficiaries
  IF v_username_clean <> '' THEN
    IF EXISTS (
      SELECT 1 FROM beneficiaries
      WHERE LOWER(TRIM(username)) = v_username_clean
      AND (p_exclude_beneficiary_id IS NULL OR id <> p_exclude_beneficiary_id)
    ) THEN
      v_username_taken := TRUE;
      v_conflict_table := 'beneficiaries';
    END IF;

    IF NOT v_username_taken AND EXISTS (
      SELECT 1 FROM staff_profiles
      WHERE LOWER(TRIM(username)) = v_username_clean
      AND (p_exclude_staff_id IS NULL OR id <> p_exclude_staff_id)
    ) THEN
      v_username_taken := TRUE;
      v_conflict_table := 'staff_profiles';
    END IF;
  END IF;

  -- Check email in beneficiaries
  IF v_email_clean <> '' THEN
    IF EXISTS (
      SELECT 1 FROM beneficiaries
      WHERE LOWER(TRIM(email)) = v_email_clean
      AND (p_exclude_beneficiary_id IS NULL OR id <> p_exclude_beneficiary_id)
    ) THEN
      v_email_taken := TRUE;
      v_conflict_table := 'beneficiaries';
    END IF;

    IF NOT v_email_taken AND EXISTS (
      SELECT 1 FROM staff_profiles
      WHERE LOWER(TRIM(email)) = v_email_clean
      AND (p_exclude_staff_id IS NULL OR id <> p_exclude_staff_id)
    ) THEN
      v_email_taken := TRUE;
      v_conflict_table := 'staff_profiles';
    END IF;
  END IF;

  IF v_username_taken AND v_email_taken THEN
    v_message := 'Both username and email are already in use.';
  ELSIF v_username_taken THEN
    v_message := 'Username is already taken. Please choose another username.';
  ELSIF v_email_taken THEN
    v_message := 'Email address is already registered in the system.';
  END IF;

  RETURN jsonb_build_object(
    'isAvailable', (NOT v_username_taken AND NOT v_email_taken),
    'isUsernameTaken', v_username_taken,
    'isEmailTaken', v_email_taken,
    'message', v_message,
    'conflictTable', v_conflict_table
  );
END;
$$;
