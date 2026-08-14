-- =============================================================================
-- Migration: 2026-08-13 — Fix frontend/backend schema gaps
-- Purely additive. Safe to run on an existing database: nothing is dropped,
-- renamed, or has its data altered. Re-runnable (IF NOT EXISTS / ON CONFLICT).
--
-- Fixes:
--   1. applications was missing amount_requested / amount_approved, which
--      cswdo_admin.html already reads/writes. Without these columns every
--      admin select() and update() against `applications` was failing.
--   2. cswdo_admin.html logs to a table called `activity_log` that never
--      existed (the schema only has `audit_logs`, with different columns).
--      Adding a real `activity_log` table matching what the frontend already
--      sends, instead of rewriting every call site.
--   3. programs only seeded 6 rows, but the beneficiary "Choose program..."
--      dropdown offers ~19 named programs. Anything not in this table can
--      never be inserted into applications.program_id. Adding the missing
--      ones with stable `code`s so the frontend can map dropdown text -> code.
--   4. applications.status CHECK constraint didn't allow 'Denied' or
--      'Released', but cswdo_admin.html's Deny and Release Funds actions
--      write exactly those values — every deny/release was hitting a
--      constraint violation. Widening the constraint (additive, no rows
--      changed).
--   5. cswdo_admin.html reads/writes a `funds` table (budget dashboard +
--      "Release Funds" balance tracking) that never existed. Adding it,
--      seeded for the three CSWDO programs it already knows how to display.
-- =============================================================================

-- 1. Amount columns applications needs for the officer/admin approval flow
ALTER TABLE applications ADD COLUMN IF NOT EXISTS amount_requested DECIMAL(10,2) DEFAULT 0;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(10,2) DEFAULT NULL;

-- 2. activity_log table (separate from audit_logs — matches cswdo_admin.html's
--    existing insert/select shape exactly, so no frontend rewrite is needed)
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  action_title VARCHAR(255) DEFAULT NULL,
  application_id VARCHAR(50) DEFAULT NULL,
  beneficiary_name VARCHAR(255) DEFAULT NULL,
  program VARCHAR(255) DEFAULT NULL,
  admin_id VARCHAR(50) DEFAULT NULL,
  details TEXT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'SUCCESS',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read activity log" ON activity_log;
CREATE POLICY "Staff can read activity log"
  ON activity_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can write activity log" ON activity_log;
CREATE POLICY "Staff can write activity log"
  ON activity_log FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles WHERE auth_id = auth.uid())
  );

-- 3. Fill in the programs referenced by the beneficiary "apply" dropdown
--    (frontend/beneficiary.html) that don't exist yet. Existing rows
--    (TUPAD, SPES, GIP, LIVELIHOOD, AICS, SLP) are left untouched.
INSERT INTO programs (code, name, description, agency, status) VALUES
  ('CKGIP',          'City of Koronadal Government Internship Program (CKGIP)', 'Internship placements within the city government for unemployed youth.', 'PESO', 'Active'),
  ('KEEP',           'Koronadal Emergency Employment Program (KEEP)', 'Short-term emergency employment for displaced local workers.', 'PESO', 'Active'),
  ('PFAS',           'Pangkabuhayan Financial Assistance (PFAS)', 'Seed-capital financial assistance for small livelihood ventures.', 'PESO', 'Active'),
  ('DILP',           'Support to DOLE Integrated Livelihood Program (DILP)', 'City co-implementation of DOLE''s integrated livelihood program.', 'PESO', 'Active'),
  ('ASSOC-FAC',      'Association Facilitation', 'Assistance forming and registering livelihood associations/cooperatives.', 'PESO', 'Active'),
  ('JOB-FAIR',       'Conduct of Job Fairs', 'Participation in city-organized job fairs and hiring events.', 'PESO', 'Active'),
  ('JOB-PORTAL',     'Development of Localized Job Portal', 'Access to the city''s localized online job matching portal.', 'PESO', 'Active'),
  ('SKILLS-TRAIN',   'Livelihood/Skills Training Program', 'Technical-vocational and livelihood skills training sessions.', 'PESO', 'Active'),
  ('OFW-FCD',        'OFW Family Circle Day', 'Support services and activities for families of OFWs.', 'PESO', 'Active'),
  ('PAROKYA',        'Support to Parokya ni OWN A Program', 'City co-implementation with partner community livelihood program.', 'PESO', 'Active'),
  ('ROFWS',          'Support to Returning OFWs Program (ROFWS)', 'Reintegration assistance for returning overseas Filipino workers.', 'PESO', 'Active'),
  ('JOB-PLACEMENT',  'Job Placement & Referral', 'Direct job placement and employer referral services.', 'PESO', 'Active'),
  ('SKILLS-VOUCHER', 'Skills Training Voucher', 'Vouchers covering enrollment fees for accredited skills training.', 'PESO', 'Active'),
  ('MEDICAL',        'Medical Assistance', 'Financial assistance for hospitalization and medical expenses.', 'CSWDO', 'Active'),
  ('BURIAL',         'Burial Assistance', 'Financial assistance for burial/funeral expenses.', 'CSWDO', 'Active'),
  ('FINANCIAL',      'Financial Assistance', 'General financial assistance for individuals/families in crisis.', 'CSWDO', 'Active')
ON CONFLICT (code) DO NOTHING;

-- 4. Widen the applications.status CHECK constraint to include the values
--    the admin dashboard actually sets ('Denied', 'Released'), alongside the
--    existing ones. No existing rows are touched.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN (
  'Pending', 'Pending Requirements', 'Under Review', 'Interview Scheduled',
  'Training Scheduled', 'Officer Approved', 'Officer Denied',
  'Approved', 'Denied', 'Rejected', 'Released', 'Completed'
));

-- 5. funds table — powers the CSWDO admin "Fund Utilization" dashboard and
--    the balance decrement in executeReleaseFunds(). program_code is kept
--    aligned with programs.code (e.g. 'MEDICAL') so the release flow's
--    lookup by program code actually finds a matching row.
CREATE TABLE IF NOT EXISTS funds (
  id BIGSERIAL PRIMARY KEY,
  program VARCHAR(255) NOT NULL,
  program_code VARCHAR(20) NOT NULL UNIQUE,
  allocated_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  released_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_balance DECIMAL(12,2) GENERATED ALWAYS AS (allocated_budget - released_amount) STORED,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read funds" ON funds;
CREATE POLICY "Staff can read funds"
  ON funds FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can update funds" ON funds;
CREATE POLICY "Staff can update funds"
  ON funds FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE auth_id = auth.uid())
  );

INSERT INTO funds (program, program_code, allocated_budget, released_amount) VALUES
  ('Medical Assistance', 'MEDICAL', 500000.00, 0),
  ('Financial Assistance', 'FINANCIAL', 500000.00, 0),
  ('Burial Assistance', 'BURIAL', 300000.00, 0)
ON CONFLICT (program_code) DO NOTHING;

-- 6. batches table — powers peso_officer.html's "Create Batch" / "Assign to
--    Batch" workflow (grouping approved livelihood applications for
--    training/disbursement rollout). Didn't exist before; that whole feature
--    was 100% dead buttons with no backing table at all.
CREATE TABLE IF NOT EXISTS batches (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  program_code VARCHAR(20) NOT NULL,
  capacity INT NOT NULL DEFAULT 50,
  created_by BIGINT DEFAULT NULL REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_program ON batches(program_code);

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read batches" ON batches;
CREATE POLICY "Staff can read batches"
  ON batches FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff_profiles WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can create batches" ON batches;
CREATE POLICY "Staff can create batches"
  ON batches FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles WHERE auth_id = auth.uid())
  );

-- Applications can optionally belong to a batch once approved & assigned.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS batch_id BIGINT DEFAULT NULL REFERENCES batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_app_batch ON applications(batch_id);
