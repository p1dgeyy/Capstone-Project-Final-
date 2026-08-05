-- =============================================================================
-- Capstone Project — Supabase (Postgres) Database Schema
-- Replaces the old MySQL/Railway schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. USERS PROFILE TABLE
-- Linked to Supabase auth.users via auth_id (UUID)
-- Stores role, personal info, and beneficiary verification data
-- =============================================================================
CREATE TABLE IF NOT EXISTS users_profile (
  id BIGSERIAL PRIMARY KEY,
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL UNIQUE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('Beneficiary', 'PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')),

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

  -- Beneficiary Verifications
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
CREATE INDEX IF NOT EXISTS idx_profile_role ON users_profile(role);
CREATE INDEX IF NOT EXISTS idx_profile_username ON users_profile(username);
CREATE INDEX IF NOT EXISTS idx_profile_auth_id ON users_profile(auth_id);
CREATE INDEX IF NOT EXISTS idx_profile_status ON users_profile(status);

-- =============================================================================
-- 2. PROGRAMS TABLE
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
-- 3. APPLICATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  application_number VARCHAR(50) NOT NULL UNIQUE,
  beneficiary_id BIGINT NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
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
  officer_id BIGINT DEFAULT NULL REFERENCES users_profile(id),
  officer_notes TEXT DEFAULT NULL,
  officer_action_at TIMESTAMPTZ DEFAULT NULL,
  admin_id BIGINT DEFAULT NULL REFERENCES users_profile(id),
  admin_notes TEXT DEFAULT NULL,
  documents_json JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_number ON applications(application_number);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_app_beneficiary ON applications(beneficiary_id);

-- =============================================================================
-- 4. NOTIFICATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read);

-- =============================================================================
-- 5. DISTRIBUTIONS TABLE
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
-- 6. AUDIT LOGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) DEFAULT 'application',
  entity_id BIGINT DEFAULT NULL,
  details TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- =============================================================================
-- 7. APPROVED ASSISTANCE TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS approved_assistance (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT DEFAULT NULL REFERENCES applications(id) ON DELETE SET NULL,
  beneficiary_id BIGINT NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  assistance_type VARCHAR(100) NOT NULL,
  quantity_amount VARCHAR(255) NOT NULL,
  conditions TEXT DEFAULT NULL,
  approval_date DATE NOT NULL,
  officer_id BIGINT NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ast_beneficiary ON approved_assistance(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_ast_program ON approved_assistance(program_id);
CREATE INDEX IF NOT EXISTS idx_ast_date ON approved_assistance(approval_date);

-- =============================================================================
-- 8. INTERVIEW SCHEDULES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS interview_schedules (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT DEFAULT NULL REFERENCES applications(id) ON DELETE SET NULL,
  beneficiary_id BIGINT NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  officer_id BIGINT NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  interview_date DATE NOT NULL,
  interview_time VARCHAR(50) NOT NULL,
  venue_location VARCHAR(255) NOT NULL DEFAULT 'PESO Main Office - Interview Room A',
  status VARCHAR(20) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Pending', 'Completed', 'Missed', 'Cancelled')),
  attendance_status VARCHAR(20) DEFAULT 'Unmarked' CHECK (attendance_status IN ('Unmarked', 'Present', 'Absent')),
  remarks TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_int_beneficiary ON interview_schedules(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_int_date ON interview_schedules(interview_date);
CREATE INDEX IF NOT EXISTS idx_int_status ON interview_schedules(status);

-- =============================================================================
-- TRIGGER: Auto-create users_profile on Supabase auth.users sign-up
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (auth_id, username, email, first_name, last_name, role, age)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Beneficiary'),
    COALESCE((NEW.raw_user_meta_data->>'age')::INT, 0)
  );
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

DROP TRIGGER IF EXISTS set_updated_at_users_profile ON users_profile;
CREATE TRIGGER set_updated_at_users_profile
  BEFORE UPDATE ON users_profile
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
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_assistance ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;

-- ---- users_profile policies ----

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON users_profile FOR SELECT
  USING (auth_id = auth.uid());

-- Staff/Admin can view all profiles
CREATE POLICY "Staff can view all profiles"
  ON users_profile FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- Users can update their own profile (but not role)
CREATE POLICY "Users can update own profile"
  ON users_profile FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON users_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'CSWDO Admin')
    )
  );

-- Allow inserts during registration (via trigger, uses SECURITY DEFINER)
CREATE POLICY "Allow profile creation on signup"
  ON users_profile FOR INSERT
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
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'CSWDO Admin')
    )
  );

-- ---- applications policies ----

-- Beneficiaries can view their own applications
CREATE POLICY "Beneficiaries view own applications"
  ON applications FOR SELECT
  USING (
    beneficiary_id IN (
      SELECT id FROM users_profile WHERE auth_id = auth.uid()
    )
  );

-- Staff can view all applications
CREATE POLICY "Staff can view all applications"
  ON applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- Beneficiaries can create applications
CREATE POLICY "Beneficiaries can create applications"
  ON applications FOR INSERT
  WITH CHECK (
    beneficiary_id IN (
      SELECT id FROM users_profile WHERE auth_id = auth.uid()
    )
  );

-- Staff can update applications
CREATE POLICY "Staff can update applications"
  ON applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- ---- notifications policies ----

-- Users can view their own notifications
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users_profile WHERE auth_id = auth.uid()
    )
  );

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users_profile WHERE auth_id = auth.uid()
    )
  );

-- Staff can create notifications for any user
CREATE POLICY "Staff can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- ---- distributions policies ----

-- Beneficiaries can view distributions for their applications
CREATE POLICY "Beneficiaries view own distributions"
  ON distributions FOR SELECT
  USING (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN users_profile up ON a.beneficiary_id = up.id
      WHERE up.auth_id = auth.uid()
    )
  );

-- Staff can view and manage all distributions
CREATE POLICY "Staff can manage distributions"
  ON distributions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer')
    )
  );

-- ---- audit_logs policies ----

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'CSWDO Admin')
    )
  );

-- Staff can create audit log entries
CREATE POLICY "Staff can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
    )
  );

-- ---- approved_assistance policies ----

-- Beneficiaries can view their own approved assistance
CREATE POLICY "Beneficiaries view own assistance"
  ON approved_assistance FOR SELECT
  USING (
    beneficiary_id IN (
      SELECT id FROM users_profile WHERE auth_id = auth.uid()
    )
  );

-- Staff can manage approved assistance
CREATE POLICY "Staff can manage assistance"
  ON approved_assistance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer')
    )
  );

-- ---- interview_schedules policies ----

-- Beneficiaries can view their own interviews
CREATE POLICY "Beneficiaries view own interviews"
  ON interview_schedules FOR SELECT
  USING (
    beneficiary_id IN (
      SELECT id FROM users_profile WHERE auth_id = auth.uid()
    )
  );

-- Staff can manage all interviews
CREATE POLICY "Staff can manage interviews"
  ON interview_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users_profile up
      WHERE up.auth_id = auth.uid()
      AND up.role IN ('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator')
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
