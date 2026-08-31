-- =============================================================================
-- MIGRATION: 20260831_cleanup_legacy_uniqueness_function.sql
-- Description: Drops the obsolete and broken legacy overload of `check_identifier_uniqueness`
--              that incorrectly referenced `beneficiaries.id`.
--              Retains the working 5-parameter version that uses `beneficiaries.qr_code`.
-- =============================================================================

-- Drop broken legacy 4-parameter overload
DROP FUNCTION IF EXISTS public.check_identifier_uniqueness(TEXT, TEXT, BIGINT, BIGINT);
