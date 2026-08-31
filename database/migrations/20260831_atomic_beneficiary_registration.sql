-- =============================================================================
-- Migration: Atomic Beneficiary Registration via handle_new_user Trigger (Fix C5)
-- Date: 2026-08-31
-- Description:
--   Ensures handle_new_user() trigger maps all metadata fields (including
--   qr_code, barangay, purok, spouse_name, number_of_children, program_sector)
--   into the beneficiaries table on auth.users insert.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  generated_qr TEXT;
  target_qr TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Beneficiary');

  IF user_role = 'Beneficiary' THEN
    -- Generate or use provided QR code
    generated_qr := 'QR-BEN-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));
    target_qr := COALESCE(NULLIF(NEW.raw_user_meta_data->>'qr_code', ''), generated_qr);

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
      spouse_name,
      number_of_children,
      phone,
      address,
      purok,
      barangay,
      program_sector,
      status,
      verified_channel,
      verified_at
    ) VALUES (
      target_qr,
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
      NEW.raw_user_meta_data->>'spouse_name',
      COALESCE((NEW.raw_user_meta_data->>'number_of_children')::INT, 0),
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'address',
      NEW.raw_user_meta_data->>'purok',
      NEW.raw_user_meta_data->>'barangay',
      COALESCE(NEW.raw_user_meta_data->>'program_sector', NEW.raw_user_meta_data->>'program', 'General'),
      COALESCE(NEW.raw_user_meta_data->>'status', 'Active'),
      NEW.raw_user_meta_data->>'verified_channel',
      NOW()
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      last_name = EXCLUDED.last_name,
      suffix = EXCLUDED.suffix,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      barangay = EXCLUDED.barangay,
      purok = EXCLUDED.purok,
      program_sector = EXCLUDED.program_sector,
      status = EXCLUDED.status,
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
      status = EXCLUDED.status,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
