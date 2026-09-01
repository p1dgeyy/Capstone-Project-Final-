-- =============================================================================
-- Migration: Allow authenticated uploads to the beneficiary-documents bucket
-- Date: 2026-09-01
-- Description:
--   The 'beneficiary-documents' Storage bucket existed but had 0 policies on
--   storage.objects, so the frontend's upload calls (added in this change,
--   replacing base64-in-JSONB document storage -- see documents_json usage
--   in frontend/beneficiary.html) would fail with a permission error and
--   silently fall back to embedding files as base64 text in the database
--   again, which is the exact Supabase egress problem this migration exists
--   to actually fix.
--
--   Beneficiaries authenticate via real Supabase Auth (supabaseClient.auth.
--   signInWithPassword in beneficiary-login.js), so their uploads carry the
--   'authenticated' role -- this grants that role INSERT and SELECT on
--   objects in this bucket only. The bucket's own "Public" flag already
--   serves reads via public URLs without going through this policy; SELECT
--   is included here so authenticated API reads (e.g. listing) also work.
--
--   No UPDATE/DELETE grant: uploads use upsert:false with a unique
--   timestamped path per file, so documents are never overwritten or
--   removed by a beneficiary through this policy.
-- =============================================================================

DROP POLICY IF EXISTS "beneficiary_documents_authenticated_insert" ON storage.objects;
CREATE POLICY "beneficiary_documents_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'beneficiary-documents');

DROP POLICY IF EXISTS "beneficiary_documents_authenticated_select" ON storage.objects;
CREATE POLICY "beneficiary_documents_authenticated_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'beneficiary-documents');
