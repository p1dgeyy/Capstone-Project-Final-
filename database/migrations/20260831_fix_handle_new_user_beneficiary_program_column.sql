-- =============================================================================
-- MIGRATION: 20260831_fix_handle_new_user_beneficiary_program_column.sql
-- Description: Fixes `handle_new_user()` trigger function to insert into the 
--              correct `program` column on `public.beneficiaries` (was erroneously `program_sector`).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role VARCHAR(30);
  target_qr VARCHAR(20);
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Beneficiary');

  IF user_role = 'Beneficiary' THEN
    target_qr := COALESCE(
      NEW.raw_user_meta_data->>'qr_code',
      'QR-BEN-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 8))
    );

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
      program,
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
      COALESCE(NEW.raw_user_meta_data->>'program', NEW.raw_user_meta_data->>'program_sector', 'General'),
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
      program = EXCLUDED.program,
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
