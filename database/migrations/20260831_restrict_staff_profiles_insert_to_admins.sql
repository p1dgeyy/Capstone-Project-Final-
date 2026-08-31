-- =============================================================================
-- Migration: Restrict staff_profiles INSERT strictly to Verified Admins (Fix C2)
-- Date: 2026-08-31
-- Description:
--   Closes security vulnerability where arbitrary authenticated or anonymous
--   users could insert themselves as PESO Admin / CSWDO Admin.
--
-- Policy Permissions:
--   - INSERT on staff_profiles: ONLY permitted if public.is_admin_user(auth.uid()) is TRUE.
--   - Normal Beneficiaries (auth.role() = 'authenticated' without admin role): REJECTED.
--   - Anonymous requests (auth.uid() IS NULL): REJECTED.
--   - Automated trigger handle_new_user() runs as SECURITY DEFINER and continues
--     to provision legitimate accounts without requiring open client-side INSERT.
-- =============================================================================

-- Ensure helper function exists and is robust
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE auth_id = user_uid
    AND role IN ('PESO Admin', 'CSWDO Admin')
    AND status = 'Active'
  );
$$;

-- Drop existing permissive insert policies
DROP POLICY IF EXISTS "staff_profiles_insert_policy" ON public.staff_profiles;
DROP POLICY IF EXISTS "Allow staff profile creation on signup" ON public.staff_profiles;
DROP POLICY IF EXISTS "Admins can insert staff profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Allow insert staff_profiles" ON public.staff_profiles;

-- Create strict admin-only insert policy
CREATE POLICY "staff_profiles_insert_policy"
  ON public.staff_profiles FOR INSERT
  WITH CHECK (
    public.is_admin_user(auth.uid())
  );
