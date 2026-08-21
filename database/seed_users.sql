-- =============================================================================
-- Seed Initial Users — Run in Supabase SQL Editor
-- =============================================================================
-- This script creates initial admin, officer, evaluator, and beneficiary
-- accounts directly in auth.users. The existing 'on_auth_user_created' trigger
-- will automatically create:
--   • staff_profiles rows for admin/officer/evaluator roles
--   • beneficiaries rows (with auto-generated qr_code) for beneficiary role
--
-- IMPORTANT:
--   1. Run this AFTER you have executed supabase_schema.sql
--   2. All users are created with the password: Capstone2026!
--      (Change these passwords after first login!)
--   3. Users are auto-confirmed (email_confirmed_at is set)
--
-- FIX (2026): auth.users does NOT have a plain unique constraint on email —
-- it uses a partial unique index (unique only where is_sso_user = false).
-- ON CONFLICT (email) can never match a partial index, which caused:
--   "ERROR: 42P10: there is no unique or exclusion constraint matching
--    the ON CONFLICT specification"
-- Fixed by using INSERT ... SELECT ... WHERE NOT EXISTS instead of
-- INSERT ... VALUES ... ON CONFLICT DO NOTHING. This is safe to re-run.
-- =============================================================================

-- Enable the pgcrypto extension (needed for gen_random_uuid and crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper: Insert a user into auth.users with metadata that the trigger will pick up
-- The handle_new_user trigger reads: username, first_name, last_name, role, age
-- For beneficiaries, it auto-generates a QR code (QR-BEN-XXXXXXXX)
-- For staff, it creates a staff_profiles row with the specified role
-- =============================================================================

DO $$
DECLARE
  default_password TEXT := 'Capstone2026!';
  ts TIMESTAMPTZ := NOW();
BEGIN

  -- =========================================================================
  -- 1. PESO Admin
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'peso.admin@gmail.com',
    crypt(default_password, gen_salt('bf')),
    ts, ts, ts,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'peso-admin',
      'first_name', 'John',
      'last_name', 'Doe',
      'role', 'PESO Admin',
      'age', 35
    ),
    'authenticated',
    'authenticated'
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'peso.admin@gmail.com'
  );

  -- =========================================================================
  -- 2. PESO Officer
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'peso.officer@gmail.com',
    crypt(default_password, gen_salt('bf')),
    ts, ts, ts,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'peso-officer',
      'first_name', 'Jane',
      'last_name', 'Smith',
      'role', 'PESO Officer',
      'age', 30
    ),
    'authenticated',
    'authenticated'
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'peso.officer@gmail.com'
  );

  -- =========================================================================
  -- 3. CSWDO Admin
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'cswdo.admin@gmail.com',
    crypt(default_password, gen_salt('bf')),
    ts, ts, ts,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'cswdo-admin',
      'first_name', 'Robert',
      'last_name', 'Johnson',
      'role', 'CSWDO Admin',
      'age', 40
    ),
    'authenticated',
    'authenticated'
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'cswdo.admin@gmail.com'
  );

  -- =========================================================================
  -- 4. CSWDO Officer
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'cswdo.officer@gmail.com',
    crypt(default_password, gen_salt('bf')),
    ts, ts, ts,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'cswdo-officer',
      'first_name', 'Mary',
      'last_name', 'Williams',
      'role', 'CSWDO Officer',
      'age', 28
    ),
    'authenticated',
    'authenticated'
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'cswdo.officer@gmail.com'
  );

  -- =========================================================================
  -- 5. Evaluator
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'evaluator@gmail.com',
    crypt(default_password, gen_salt('bf')),
    ts, ts, ts,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'evaluator',
      'first_name', 'Edward',
      'last_name', 'Davis',
      'role', 'Evaluator',
      'age', 32
    ),
    'authenticated',
    'authenticated'
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'evaluator@gmail.com'
  );

  -- =========================================================================
  -- 6. Test Beneficiary
  -- (trigger auto-generates qr_code like 'QR-BEN-A3F8B201')
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'beneficiary@gmail.com',
    crypt(default_password, gen_salt('bf')),
    ts, ts, ts,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', 'test-beneficiary',
      'first_name', 'Maria',
      'last_name', 'Santos',
      'role', 'Beneficiary',
      'age', 25
    ),
    'authenticated',
    'authenticated'
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'beneficiary@gmail.com'
  );

  RAISE NOTICE '✅ All initial users created successfully!';
  RAISE NOTICE 'Default password for all accounts: Capstone2026!';
  RAISE NOTICE 'Please change passwords after first login.';

END $$;

-- =============================================================================
-- Post-insert: Update additional profile fields
-- The trigger only sets basic fields — fill in the rest here.
--
-- Staff accounts → staff_profiles table
-- Beneficiary accounts → beneficiaries table
-- =============================================================================

-- PESO Admin — additional details
UPDATE staff_profiles SET
  middle_name = 'A.',
  suffix = NULL,
  sex = 'Male',
  phone = '0917-111-2222',
  address = 'City Hall Complex, Koronadal City'
WHERE username = 'peso-admin';

-- PESO Officer — additional details
UPDATE staff_profiles SET
  middle_name = 'B.',
  suffix = NULL,
  sex = 'Female',
  phone = '0918-222-3333',
  address = 'PESO Office, Koronadal City'
WHERE username = 'peso-officer';

-- CSWDO Admin — additional details
UPDATE staff_profiles SET
  middle_name = 'C.',
  suffix = 'Sr.',
  sex = 'Male',
  phone = '0919-333-4444',
  address = 'CSWDO Main Building, Koronadal City'
WHERE username = 'cswdo-admin';

-- CSWDO Officer — additional details
UPDATE staff_profiles SET
  middle_name = 'D.',
  suffix = NULL,
  sex = 'Female',
  phone = '0920-444-5555',
  address = 'CSWDO Annex, Koronadal City'
WHERE username = 'cswdo-officer';

-- Evaluator — additional details
UPDATE staff_profiles SET
  middle_name = 'E.',
  suffix = 'Jr.',
  sex = 'Male',
  phone = '0921-555-6666',
  address = 'City Hall Annex, Koronadal City'
WHERE username = 'evaluator';

-- Test Beneficiary — additional details (→ beneficiaries table)
UPDATE beneficiaries SET
  middle_name = 'F.',
  suffix = NULL,
  sex = 'Female',
  phone = '0922-666-7777',
  address = 'Brgy. Zone III, Koronadal City',
  nationality = 'Filipino',
  marital_status = 'Single',
  date_of_birth = '2001-03-15',
  id_type = 'PhilID',
  terms_agreed = TRUE,
  data_consent = TRUE
WHERE username = 'test-beneficiary';

-- =============================================================================
-- Verify: List all created staff and their profiles
-- =============================================================================
SELECT
  'STAFF' AS account_type,
  sp.username,
  sp.email,
  sp.role,
  sp.first_name || ' ' || sp.last_name AS full_name,
  sp.status,
  sp.auth_id::TEXT AS identifier
FROM staff_profiles sp

UNION ALL

SELECT
  'BENEFICIARY' AS account_type,
  b.username,
  b.email,
  'Beneficiary' AS role,
  b.first_name || ' ' || b.last_name AS full_name,
  b.status,
  b.qr_code AS identifier
FROM beneficiaries b

ORDER BY account_type, full_name;