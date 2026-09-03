-- =============================================================================
-- Migration: Stop provisioning beneficiary/staff accounts before OTP verification
-- Date: 2026-09-03
-- Description:
--   Bug report: "the beneficiary gets registered regardless of if he got
--   confirmed by the OTP or not", and separately, brand-new emails were being
--   rejected as "already registered" while trying to send an OTP.
--
--   Root cause: frontend/assets/js/otp-auth.js's sendEmailCode() (shared by
--   both the beneficiary self-registration page and the officer's walk-in
--   registration form) calls
--     supabaseClient.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
--   purely to get Supabase to deliver the verification email. shouldCreateUser:
--   true makes Supabase Auth create a real (unconfirmed) auth.users row for a
--   brand-new email THE MOMENT the user picks "Email" as their verification
--   channel -- before any code is ever entered. That row change fires this
--   database's on_auth_user_created / handle_new_user() trigger, which (with
--   no profile data yet available, since signInWithOtp never passes
--   options.data) immediately inserted a public.beneficiaries row with
--   status = 'Active', a random auto-generated qr_code, blank name fields,
--   and the real email -- i.e. a live "Active" beneficiary record from a
--   single click, with no OTP ever confirmed. That phantom row then also
--   permanently occupies the email, so a later attempt (even by the same
--   person, with what they consider "a brand new email") fails
--   checkIdentifierAvailability()'s uniqueness check with "already registered".
--
--   This migration does NOT touch the email-delivery call itself (it is the
--   only real, working delivery channel this app has right now -- the JS-side
--   fallback gateway, ExternalGateway.sendEmail() in system-notifications.js,
--   only logs and writes an audit row, it never actually sends mail -- so
--   disabling shouldCreateUser would silently break OTP delivery entirely).
--   Instead this defers the actual account provisioning: the trigger now only
--   writes a beneficiaries/staff_profiles row once real profile data is
--   present (first_name is non-blank), which only happens once the app's own
--   handleVerifyActiveOtp() / officer walk-in flow calls
--   supabase.auth.signUp({ ..., options: { data: { first_name, ... } } })
--   AFTER the entered OTP has actually been verified. The bare
--   signInWithOtp() stub (empty metadata) is now a no-op for this trigger,
--   so it can no longer create a phantom "Active" beneficiary by itself.
--
--   The trigger is widened from AFTER INSERT to also fire on UPDATE of
--   raw_user_meta_data/email_confirmed_at: depending on Supabase Auth's
--   internal handling, the later signUp() call for an email that already has
--   an unconfirmed auth.users row (from the earlier signInWithOtp stub) may
--   update that existing row rather than insert a new one -- either way, the
--   first time real profile data (first_name) actually lands on the row,
--   this trigger now provisions the beneficiaries/staff_profiles record.
--   Scoping to just those two columns (instead of a bare AFTER UPDATE) means
--   ordinary logins/session/token refreshes, which touch auth.users but not
--   these columns, do not re-run this trigger on every request.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role VARCHAR(30);
  target_qr VARCHAR(20);
  has_profile_data BOOLEAN;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Beneficiary');

  -- Guard: signInWithOtp({shouldCreateUser:true}) creates/touches an
  -- auth.users row purely to send the verification email, with NO profile
  -- metadata attached. Only actually provision a beneficiaries/staff_profiles
  -- row once the app's real registration call has supplied a first_name --
  -- that only happens after the user's OTP has been verified. Without this
  -- guard, simply requesting a code created a live "Active" account.
  has_profile_data := (NEW.raw_user_meta_data->>'first_name' IS NOT NULL
                        AND NEW.raw_user_meta_data->>'first_name' <> '');

  IF NOT has_profile_data THEN
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF raw_user_meta_data, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
