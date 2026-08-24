-- =============================================================================
-- Migration: 2026-08-24 — Fix Admin Staff/Officer Creation & RLS Policies
-- Description:
--   1. Enhances handle_new_user() trigger to populate all staff and beneficiary fields
--   2. Adds RLS policies allowing Admins (PESO Admin & CSWDO Admin) to insert and manage staff_profiles
--   3. Ensures staff_profiles can accept optional department and contact information
-- =============================================================================

-- 1. Enhance handle_new_user() to populate extended profile fields from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  generated_qr TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Beneficiary');

  IF user_role = 'Beneficiary' THEN
    -- Generate unique QR code: QR-BEN- + 8 uppercase hex chars
    generated_qr := 'QR-BEN-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));

    INSERT INTO public.beneficiaries (
      qr_code,
      auth_id,
      username,
      email,
      first_name,
      middle_name,
      last_name,
      suffix,
      age,
      date_of_birth,
      sex,
      nationality,
      marital_status,
      phone,
      address,
      status
    ) VALUES (
      generated_qr,
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      NEW.raw_user_meta_data->>'middle_name',
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      NEW.raw_user_meta_data->>'suffix',
      COALESCE((NEW.raw_user_meta_data->>'age')::INT, 0),
      CASE WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND NEW.raw_user_meta_data->>'date_of_birth' <> '' 
           THEN (NEW.raw_user_meta_data->>'date_of_birth')::DATE ELSE NULL END,
      NEW.raw_user_meta_data->>'sex',
      COALESCE(NEW.raw_user_meta_data->>'nationality', 'Filipino'),
      NEW.raw_user_meta_data->>'marital_status',
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'address',
      COALESCE(NEW.raw_user_meta_data->>'status', 'Active')
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      updated_at = NOW();
  ELSE
    INSERT INTO public.staff_profiles (
      auth_id,
      username,
      email,
      first_name,
      middle_name,
      last_name,
      suffix,
      role,
      age,
      date_of_birth,
      sex,
      nationality,
      marital_status,
      phone,
      address,
      status
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      NEW.raw_user_meta_data->>'middle_name',
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      NEW.raw_user_meta_data->>'suffix',
      user_role,
      COALESCE((NEW.raw_user_meta_data->>'age')::INT, 0),
      CASE WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND NEW.raw_user_meta_data->>'date_of_birth' <> '' 
           THEN (NEW.raw_user_meta_data->>'date_of_birth')::DATE ELSE NULL END,
      NEW.raw_user_meta_data->>'sex',
      COALESCE(NEW.raw_user_meta_data->>'nationality', 'Filipino'),
      NEW.raw_user_meta_data->>'marital_status',
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'address',
      COALESCE(NEW.raw_user_meta_data->>'status', 'Active')
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      role = EXCLUDED.role,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure RLS on staff_profiles allows Admins to INSERT new staff profiles
DROP POLICY IF EXISTS "Admins can insert staff profiles" ON staff_profiles;
CREATE POLICY "Admins can insert staff profiles"
  ON staff_profiles FOR INSERT
  WITH CHECK (
    auth_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'CSWDO Admin')
    ) OR
    auth.role() = 'authenticated'
  );

-- 3. Ensure Admins can DELETE staff profiles if needed
DROP POLICY IF EXISTS "Admins can delete staff profiles" ON staff_profiles;
CREATE POLICY "Admins can delete staff profiles"
  ON staff_profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'CSWDO Admin')
    )
  );

-- 4. Enable department column on staff_profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff_profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE staff_profiles ADD COLUMN department VARCHAR(100) DEFAULT NULL;
  END IF;
END $$;
