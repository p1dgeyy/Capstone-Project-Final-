-- =============================================================================
-- MIGRATION: 20260831_add_beneficiary_photo_and_documents_columns.sql
-- Description: Adds id_photo_url and documents_json to public.beneficiaries 
--              so clean database setups match the live production schema.
-- =============================================================================

ALTER TABLE public.beneficiaries 
ADD COLUMN IF NOT EXISTS id_photo_url TEXT DEFAULT NULL;

ALTER TABLE public.beneficiaries 
ADD COLUMN IF NOT EXISTS documents_json JSONB DEFAULT '[]'::jsonb;
