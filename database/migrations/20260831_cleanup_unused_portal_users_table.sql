-- =============================================================================
-- MIGRATION: 20260831_cleanup_unused_portal_users_table.sql
-- Description: Drops the obsolete and unused legacy `portal_users` table.
--              Authentication and identity management are handled strictly by 
--              `public.beneficiaries`, `public.staff_profiles`, and Supabase `auth.users`.
-- =============================================================================

DROP TABLE IF EXISTS public.portal_users CASCADE;
