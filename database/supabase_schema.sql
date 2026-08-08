-- =============================================================================
-- Capstone Project — Supabase (Postgres) Database Schema
-- Replaces the old MySQL/Railway schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
--
-- CHANGE: Beneficiaries are now in a separate table from staff.
--         Beneficiary PK = unique QR code (VARCHAR), auto-generated on signup.
-- =============================================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. STAFF PROFILES TABLE
-- Linked to Supabase auth.users via auth_id (UUID)
-- Stores admin, officer, and evaluator accounts ONLY
-- =============================================================================
CREATE TABLE IF NOT EXISTS staff_profiles (
  id BIGSERIAL PRIMARY KEY,
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL UNIQUE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')),

  -- Profile Details
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) DEFAULT NULL,
  last_name VARCHAR(100) NOT NULL,
  suffix VARCHAR(20) DEFAULT NULL,
  age INT NOT NULL DEFAULT 0,
  date_of_birth DATE DEFAULT NULL,
  sex VARCHAR(10) DEFAULT NULL CHECK (sex IN ('Male', 'Female')),
  nationality VARCHAR(50) DEFAULT 'Filipino',
  marital_status VARCHAR(20) DEFAULT NULL CHECK (marital_status IN ('Single', 'Married', 'Widowed', 'Divorced')),

  -- Contact Details
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  address TEXT DEFAULT NULL,

  -- Account Status
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Deactivated', 'Inactive')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_username ON staff_profiles(username);
CREATE INDEX IF NOT EXISTS idx_staff_auth_id ON staff_profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff_profiles(status);

-- =============================================================================
-- 2. BENEFICIARIES TABLE
-- Linked to Supabase auth.users via auth_id (UUID)
-- Primary Key = qr_code (auto-generated unique QR identifier)
-- =============================================================================
CREATE TABLE IF NOT EXISTS beneficiaries (
  qr_code VARCHAR(20) PRIMARY KEY,  -- e.g. 'QR-BEN-A3F8B201'
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL UNIQUE,

  -- Profile Details
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) DEFAULT NULL,
  last_name VARCHAR(100) NOT NULL,
  suffix VARCHAR(20) DEFAULT NULL,
  age INT NOT NULL DEFAULT 0,
  date_of_birth DATE DEFAULT NULL,
  sex VARCHAR(10) DEFAULT NULL CHECK (sex IN ('Male', 'Female')),
  nationality VARCHAR(50) DEFAULT 'Filipino',
  marital_status VARCHAR(20) DEFAULT NULL CHECK (marital_status IN ('Single', 'Married', 'Widowed', 'Divorced')),

  -- Contact Details
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  address TEXT DEFAULT NULL,

  -- Beneficiary Verification
  id_type VARCHAR(100) DEFAULT NULL,
  id_file_path VARCHAR(255) DEFAULT NULL,
  terms_agreed BOOLEAN DEFAULT FALSE,
  data_consent BOOLEAN DEFAULT FALSE,

  -- Account Status
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Deactivated', 'Inactive')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ben_auth_id ON beneficiaries(auth_id);
CREATE INDEX IF NOT EXISTS idx_ben_username ON beneficiaries(username);
CREATE INDEX IF NOT EXISTS idx_ben_status ON beneficiaries(status);
CREATE INDEX IF NOT EXISTS idx_ben_last_name ON beneficiaries(last_name);

-- =============================================================================
-- 3. PROGRAMS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS programs (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  agency VARCHAR(10) NOT NULL CHECK (agency IN ('PESO', 'CSWDO')),
  status VARCHAR(10) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_agency ON programs(agency);
CREATE INDEX IF NOT EXISTS idx_program_status ON programs(status);

-- =============================================================================
-- 4. APPLICATIONS TABLE
-- beneficiary_qr → beneficiaries(qr_code)
-- officer_id / admin_id → staff_profiles(id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  application_number VARCHAR(50) NOT NULL UNIQUE,
  beneficiary_qr VARCHAR(20) NOT NULL REFERENCES beneficiaries(qr_code) ON DELETE CASCADE,
  program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  date_applied DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'Pending' CHECK (status IN (
    'Pending', 'Pending Requirements', 'Under Review', 'Interview Scheduled',
    'Training Scheduled', 'Officer Approved', 'Officer Denied',
    'Approved', 'Rejected', 'Completed'
  )),
  progress_percent INT DEFAULT 0,
  remarks TEXT DEFAULT NULL,
  officer_decision VARCHAR(30) DEFAULT 'None' CHECK (officer_decision IN ('Approved', 'Denied', 'Pending Requirements', 'None')),
  officer_id BIGINT DEFAULT NULL REFERENCES staff_profiles(id),
  officer_notes TEXT DEFAULT NULL,
  officer_action_at TIMESTAMPTZ DEFAULT NULL,
  admin_id BIGINT DEFAULT NULL REFERENCES staff_profiles(id),
  admin_notes TEXT DEFAULT NULL,
  documents_json JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_number ON applications(application_number);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_app_beneficiary ON applications(beneficiary_qr);

-- =============================================================================
-- 5. NOTIFICATIONS TABLE
-- Dual FK: exactly one of staff_user_id or beneficiary_qr must be set
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  staff_user_id BIGINT DEFAULT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  beneficiary_qr VARCHAR(20) DEFAULT NULL REFERENCES beneficiaries(qr_code) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Exactly one recipient must be specified
  CONSTRAINT chk_notif_recipient CHECK (
    (staff_user_id IS NOT NULL AND beneficiary_qr IS NULL) OR
    (staff_user_id IS NULL AND beneficiary_qr IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notif_staff ON notifications(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_beneficiary ON notifications(beneficiary_qr);
CREATE INDEX IF NOT EXISTS idx_notif_unread_staff ON notifications(staff_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_unread_ben ON notifications(beneficiary_qr, is_read);

-- =============================================================================
-- 6. DISTRIBUTIONS TABLE
-- References applications (no direct user FK needed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS distributions (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  distribution_date DATE NOT NULL,
  distribution_time VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Claimed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dist_date ON distributions(distribution_date);
CREATE INDEX IF NOT EXISTS idx_dist_status ON distributions(status);

-- =============================================================================
-- 7. AUDIT LOGS TABLE
-- Dual FK: exactly one of staff_user_id or beneficiary_qr must be set
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  staff_user_id BIGINT DEFAULT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  beneficiary_qr VARCHAR(20) DEFAULT NULL REFERENCES beneficiaries(qr_code) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) DEFAULT 'application',
  entity_id BIGINT DEFAULT NULL,
  details TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Exactly one actor must be specified
  CONSTRAINT chk_audit_actor CHECK (
    (staff_user_id IS NOT NULL AND beneficiary_qr IS NULL) OR
    (staff_user_id IS NULL AND beneficiary_qr IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_audit_staff ON audit_logs(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_beneficiary ON audit_logs(beneficiary_qr);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- =============================================================================
-- 7b. CSWDO FUNDS TABLE (Aggregated Program Allocations & Balances)
-- =============================================================================
CREATE TABLE IF NOT EXISTS funds (
  id BIGSERIAL PRIMARY KEY,
  program VARCHAR(100) NOT NULL UNIQUE,
  program_code VARCHAR(20) NOT NULL,
  allocated_budget DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  released_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  remaining_balance DECIMAL(12,2) GENERATED ALWAYS AS (allocated_budget - released_amount) STORED,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funds_program ON funds(program);

-- =============================================================================
-- 7c. CSWDO ACTIVITY LOG TABLE (Action Audit Trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  action_title VARCHAR(255) DEFAULT NULL,
  application_id VARCHAR(50) DEFAULT NULL,
  beneficiary_name VARCHAR(255) DEFAULT NULL,
  program VARCHAR(100) DEFAULT NULL,
  admin_id VARCHAR(50) NOT NULL,
  details TEXT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'SUCCESS',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_app ON activity_log(application_id);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);

-- =============================================================================
-- 7d. CSWDO OFFICERS TABLE (Officer Accounts & Department Assignments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS officers (
  id BIGSERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) DEFAULT NULL,
  last_name VARCHAR(100) NOT NULL,
  suffix VARCHAR(20) DEFAULT 'N/A',
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'CSWDO Officer' CHECK (role IN ('CSWDO Officer', 'CSWDO Admin')),
  gender VARCHAR(10) DEFAULT 'Female' CHECK (gender IN ('Male', 'Female')),
  address TEXT DEFAULT NULL,
  contact_number VARCHAR(30) DEFAULT NULL,
  department VARCHAR(50) NOT NULL CHECK (department IN ('Medical', 'Financial', 'Burial', 'CSWDO')),
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Deactivated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_officer_username ON officers(username);
CREATE INDEX IF NOT EXISTS idx_officer_email ON officers(email);
CREATE INDEX IF NOT EXISTS idx_officer_dept ON officers(department);
CREATE INDEX IF NOT EXISTS idx_officer_status ON officers(status);

-- =============================================================================
-- 8. APPROVED ASSISTANCE TABLE
-- beneficiary_qr → beneficiaries(qr_code)
-- officer_id → staff_profiles(id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS approved_assistance (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT DEFAULT NULL REFERENCES applications(id) ON DELETE SET NULL,
  beneficiary_qr VARCHAR(20) NOT NULL REFERENCES beneficiaries(qr_code) ON DELETE CASCADE,
  program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  assistance_type VARCHAR(100) NOT NULL,
  quantity_amount VARCHAR(255) NOT NULL,
  conditions TEXT DEFAULT NULL,
  approval_date DATE NOT NULL,
  officer_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ast_beneficiary ON approved_assistance(beneficiary_qr);
CREATE INDEX IF NOT EXISTS idx_ast_program ON approved_assistance(program_id);
CREATE INDEX IF NOT EXISTS idx_ast_date ON approved_assistance(approval_date);

-- =============================================================================
-- 9. INTERVIEW SCHEDULES TABLE
-- beneficiary_qr → beneficiaries(qr_code)
-- officer_id → staff_profiles(id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS interview_schedules (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT DEFAULT NULL REFERENCES applications(id) ON DELETE SET NULL,
  beneficiary_qr VARCHAR(20) NOT NULL REFERENCES beneficiaries(qr_code) ON DELETE CASCADE,
  program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  officer_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  interview_date DATE NOT NULL,
  interview_time VARCHAR(50) NOT NULL,
  venue_location VARCHAR(255) NOT NULL DEFAULT 'PESO Main Office - Interview Room A',
  status VARCHAR(20) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Pending', 'Completed', 'Missed', 'Cancelled')),
  attendance_status VARCHAR(20) DEFAULT 'Unmarked' CHECK (attendance_status IN ('Unmarked', 'Present', 'Absent')),
  remarks TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_int_beneficiary ON interview_schedules(beneficiary_qr);
CREATE INDEX IF NOT EXISTS idx_int_date ON interview_schedules(interview_date);
CREATE INDEX IF NOT EXISTS idx_int_status ON interview_schedules(status);

-- =============================================================================
-- 10. ATTENDANCE TABLE (Daily Interview Attendance & Monitoring)
-- =============================================================================
CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  interview_id BIGINT NOT NULL REFERENCES interview_schedules(id) ON DELETE CASCADE,
  officer_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  presence_flag VARCHAR(20) NOT NULL CHECK (presence_flag IN ('Present', 'Absent', 'Unmarked')),
  remarks TEXT DEFAULT NULL,
  justification TEXT DEFAULT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_interview ON attendance(interview_id);
CREATE INDEX IF NOT EXISTS idx_att_officer ON attendance(officer_id);
CREATE INDEX IF NOT EXISTS idx_att_flag ON attendance(presence_flag);

-- =============================================================================
-- TRIGGER: Auto-create staff_profiles OR beneficiaries on Supabase auth signup
-- Branches based on the 'role' field in raw_user_meta_data
-- =============================================================================
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

    INSERT INTO public.beneficiaries (qr_code, auth_id, username, email, first_name, last_name, age)
    VALUES (
      generated_qr,
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE((NEW.raw_user_meta_data->>'age')::INT, 0)
    );
  ELSE
    INSERT INTO public.staff_profiles (auth_id, username, email, first_name, last_name, role, age)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      user_role,
      COALESCE((NEW.raw_user_meta_data->>'age')::INT, 0)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_staff_profiles ON staff_profiles;
CREATE TRIGGER set_updated_at_staff_profiles
  BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_beneficiaries ON beneficiaries;
CREATE TRIGGER set_updated_at_beneficiaries
  BEFORE UPDATE ON beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_programs ON programs;
CREATE TRIGGER set_updated_at_programs
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_applications ON applications;
CREATE TRIGGER set_updated_at_applications
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_interviews ON interview_schedules;
CREATE TRIGGER set_updated_at_interviews
  BEFORE UPDATE ON interview_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_assistance ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;

-- ---- staff_profiles policies ----

-- Staff can read their own profile
CREATE POLICY "Staff can view own profile"
  ON staff_profiles FOR SELECT
  USING (auth_id = auth.uid());

-- Staff/Admin can view all staff profiles
CREATE POLICY "Staff can view all staff profiles"
  ON staff_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- Staff can update their own profile
CREATE POLICY "Staff can update own profile"
  ON staff_profiles FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Admins can update any staff profile
CREATE POLICY "Admins can update any staff profile"
  ON staff_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'CSWDO Admin')
    )
  );

-- Allow staff profile creation on signup (via trigger, uses SECURITY DEFINER)
CREATE POLICY "Allow staff profile creation on signup"
  ON staff_profiles FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- ---- beneficiaries policies ----

-- Beneficiaries can view their own profile
CREATE POLICY "Beneficiary can view own profile"
  ON beneficiaries FOR SELECT
  USING (auth_id = auth.uid());

-- Staff can view all beneficiary profiles
CREATE POLICY "Staff can view all beneficiaries"
  ON beneficiaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- Beneficiaries can update their own profile
CREATE POLICY "Beneficiary can update own profile"
  ON beneficiaries FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Staff (officers/admins) can update beneficiary profiles
CREATE POLICY "Staff can update beneficiary profiles"
  ON beneficiaries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer')
    )
  );

-- Allow beneficiary profile creation on signup (via trigger, uses SECURITY DEFINER)
CREATE POLICY "Allow beneficiary creation on signup"
  ON beneficiaries FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- ---- programs policies ----

-- Everyone can read programs
CREATE POLICY "Anyone can view programs"
  ON programs FOR SELECT
  USING (true);

-- Only admins can manage programs
CREATE POLICY "Admins can manage programs"
  ON programs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'CSWDO Admin')
    )
  );

-- ---- applications policies ----

-- Beneficiaries can view their own applications
CREATE POLICY "Beneficiaries view own applications"
  ON applications FOR SELECT
  USING (
    beneficiary_qr IN (
      SELECT qr_code FROM beneficiaries WHERE auth_id = auth.uid()
    )
  );

-- Staff can view all applications
CREATE POLICY "Staff can view all applications"
  ON applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- Beneficiaries can create applications
CREATE POLICY "Beneficiaries can create applications"
  ON applications FOR INSERT
  WITH CHECK (
    beneficiary_qr IN (
      SELECT qr_code FROM beneficiaries WHERE auth_id = auth.uid()
    )
  );

-- Staff can update applications
CREATE POLICY "Staff can update applications"
  ON applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- ---- notifications policies ----

-- Staff can view their own notifications
CREATE POLICY "Staff view own notifications"
  ON notifications FOR SELECT
  USING (
    staff_user_id IN (
      SELECT id FROM staff_profiles WHERE auth_id = auth.uid()
    )
  );

-- Beneficiaries can view their own notifications
CREATE POLICY "Beneficiaries view own notifications"
  ON notifications FOR SELECT
  USING (
    beneficiary_qr IN (
      SELECT qr_code FROM beneficiaries WHERE auth_id = auth.uid()
    )
  );

-- Staff can update (mark as read) their own notifications
CREATE POLICY "Staff update own notifications"
  ON notifications FOR UPDATE
  USING (
    staff_user_id IN (
      SELECT id FROM staff_profiles WHERE auth_id = auth.uid()
    )
  );

-- Beneficiaries can update (mark as read) their own notifications
CREATE POLICY "Beneficiaries update own notifications"
  ON notifications FOR UPDATE
  USING (
    beneficiary_qr IN (
      SELECT qr_code FROM beneficiaries WHERE auth_id = auth.uid()
    )
  );

-- Staff can create notifications for any user
CREATE POLICY "Staff can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- ---- distributions policies ----

-- Beneficiaries can view distributions for their applications
CREATE POLICY "Beneficiaries view own distributions"
  ON distributions FOR SELECT
  USING (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN beneficiaries b ON a.beneficiary_qr = b.qr_code
      WHERE b.auth_id = auth.uid()
    )
  );

-- Staff can view and manage all distributions
CREATE POLICY "Staff can manage distributions"
  ON distributions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer')
    )
  );

-- ---- audit_logs policies ----

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'CSWDO Admin')
    )
  );

-- Staff can create audit log entries
CREATE POLICY "Staff can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- ---- approved_assistance policies ----

-- Beneficiaries can view their own approved assistance
CREATE POLICY "Beneficiaries view own assistance"
  ON approved_assistance FOR SELECT
  USING (
    beneficiary_qr IN (
      SELECT qr_code FROM beneficiaries WHERE auth_id = auth.uid()
    )
  );

-- Staff can manage approved assistance
CREATE POLICY "Staff can manage assistance"
  ON approved_assistance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer')
    )
  );

-- ---- interview_schedules policies ----

-- Beneficiaries can view their own interviews
CREATE POLICY "Beneficiaries view own interviews"
  ON interview_schedules FOR SELECT
  USING (
    beneficiary_qr IN (
      SELECT qr_code FROM beneficiaries WHERE auth_id = auth.uid()
    )
  );

-- Staff can manage all interviews
CREATE POLICY "Staff can manage interviews"
  ON interview_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- =============================================================================
-- SEED DATA: Default Programs
-- =============================================================================
INSERT INTO programs (code, name, description, agency, status) VALUES
  ('TUPAD', 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers', 'Emergency employment program providing temporary wage-based work.', 'PESO', 'Active'),
  ('SPES', 'Special Program for Employment of Students', 'Provides employment to poor but deserving students during summer/Christmas vacation.', 'PESO', 'Active'),
  ('GIP', 'Government Internship Program', 'Internship opportunities in government agencies for unemployed youth.', 'PESO', 'Active'),
  ('LIVELIHOOD', 'Livelihood Assistance Program', 'Provides livelihood starter kits and seed capital to qualified beneficiaries.', 'PESO', 'Active'),
  ('AICS', 'Assistance to Individuals in Crisis Situation', 'Financial or material assistance to individuals in crisis situations.', 'CSWDO', 'Active'),
  ('SLP', 'Sustainable Livelihood Program', 'Helps poor families become self-sufficient through micro-enterprise development.', 'CSWDO', 'Active')
ON CONFLICT (code) DO NOTHING;
