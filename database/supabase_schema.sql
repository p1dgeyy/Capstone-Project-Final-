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

  -- Account Status & Session Tracking
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Deactivated', 'Inactive')),
  current_session_id VARCHAR(100) DEFAULT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_username ON staff_profiles(username);
CREATE INDEX IF NOT EXISTS idx_staff_auth_id ON staff_profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff_profiles(status);
CREATE INDEX IF NOT EXISTS idx_staff_session ON staff_profiles(current_session_id);

-- =============================================================================
-- 2. BENEFICIARIES TABLE
-- Linked to Supabase auth.users via auth_id (UUID)
-- Primary Key = qr_code (auto-generated unique QR identifier)
-- =============================================================================
CREATE TABLE IF NOT EXISTS beneficiaries (
  qr_code VARCHAR(20) PRIMARY KEY,  -- e.g. 'QR-BEN-A3F8B201'
  auth_id UUID DEFAULT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
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
  marital_status VARCHAR(20) DEFAULT NULL CHECK (marital_status IN ('Single', 'Married', 'Widowed', 'Divorced', 'Separated')),
  spouse_name VARCHAR(150) DEFAULT NULL,
  number_of_children INT DEFAULT 0,

  -- Address & Program Details
  purok VARCHAR(100) DEFAULT NULL,
  barangay VARCHAR(100) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  program VARCHAR(255) DEFAULT NULL,
  department VARCHAR(50) DEFAULT NULL,

  -- Contact Details
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,

  -- Beneficiary Verification
  verified_channel VARCHAR(20) DEFAULT 'EMAIL',
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  id_type VARCHAR(100) DEFAULT NULL,
  id_file_path VARCHAR(255) DEFAULT NULL,
  terms_agreed BOOLEAN DEFAULT FALSE,
  data_consent BOOLEAN DEFAULT FALSE,

  -- Account Status & Session Tracking
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Deactivated', 'Inactive')),
  current_session_id VARCHAR(100) DEFAULT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ben_auth_id ON beneficiaries(auth_id);
CREATE INDEX IF NOT EXISTS idx_ben_username ON beneficiaries(username);
CREATE INDEX IF NOT EXISTS idx_ben_status ON beneficiaries(status);
CREATE INDEX IF NOT EXISTS idx_ben_last_name ON beneficiaries(last_name);
CREATE INDEX IF NOT EXISTS idx_ben_session ON beneficiaries(current_session_id);

-- =============================================================================
-- 2.1 ACTIVE USER SESSIONS TABLE (Single Active Device Concurrency Control)
-- =============================================================================
CREATE TABLE IF NOT EXISTS active_user_sessions (
  user_id VARCHAR(100) PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  user_identifier VARCHAR(100),
  role VARCHAR(50),
  device_info TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_session_id ON active_user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity ON active_user_sessions(last_activity_at);

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
-- 9. INTERVIEW & ACTIVITY SCHEDULES TABLE
-- beneficiary_qr → beneficiaries(qr_code) (nullable for group / program level slots)
-- officer_id → staff_profiles(id)
-- batch_id → batches(id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS interview_schedules (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT DEFAULT NULL REFERENCES applications(id) ON DELETE SET NULL,
  beneficiary_qr VARCHAR(20) DEFAULT NULL REFERENCES beneficiaries(qr_code) ON DELETE CASCADE,
  program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  officer_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  batch_id BIGINT DEFAULT NULL REFERENCES batches(id) ON DELETE SET NULL,
  title VARCHAR(255) DEFAULT 'Assistance Activity Slot',
  category VARCHAR(50) DEFAULT 'Assistance Distribution',
  category_other TEXT DEFAULT NULL,
  interview_date DATE NOT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  interview_time VARCHAR(50) NOT NULL,
  start_time VARCHAR(50) DEFAULT NULL,
  end_time VARCHAR(50) DEFAULT NULL,
  duration VARCHAR(50) DEFAULT '2 Hours',
  venue_location VARCHAR(255) NOT NULL DEFAULT 'PESO Main Office - Multi-Purpose Hall',
  location_other TEXT DEFAULT NULL,
  recipient_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Active', 'Postponed', 'Completed', 'Cancelled', 'Pending', 'Missed')),
  attendance_status VARCHAR(20) DEFAULT 'Unmarked' CHECK (attendance_status IN ('Unmarked', 'Present', 'Absent')),
  remarks TEXT DEFAULT NULL,
  postponed_at TIMESTAMPTZ DEFAULT NULL,
  postponed_by VARCHAR(100) DEFAULT NULL,
  postponement_reason TEXT DEFAULT NULL,
  cancelled_at TIMESTAMPTZ DEFAULT NULL,
  cancelled_by VARCHAR(100) DEFAULT NULL,
  cancellation_reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_int_beneficiary ON interview_schedules(beneficiary_qr);
CREATE INDEX IF NOT EXISTS idx_int_date ON interview_schedules(interview_date);
CREATE INDEX IF NOT EXISTS idx_int_status ON interview_schedules(status);
CREATE INDEX IF NOT EXISTS idx_int_category ON interview_schedules(category);
CREATE INDEX IF NOT EXISTS idx_int_batch ON interview_schedules(batch_id);
CREATE INDEX IF NOT EXISTS idx_int_officer ON interview_schedules(officer_id);

-- =============================================================================
-- TRIGGER: Auto-create staff_profiles OR beneficiaries on Supabase auth signup
-- Branches based on the 'role' field in raw_user_meta_data
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
  first_nm TEXT;
  last_nm TEXT;
  user_age INT;
  generated_qr TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Beneficiary');
  user_name := COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1));
  first_nm := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  last_nm := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  user_age := COALESCE((NEW.raw_user_meta_data->>'age')::INT, 0);

  IF user_role = 'Beneficiary' THEN
    -- Check if record already exists by email or username
    IF EXISTS (SELECT 1 FROM public.beneficiaries WHERE email = NEW.email OR username = user_name) THEN
      UPDATE public.beneficiaries
      SET auth_id = NEW.id,
          username = COALESCE(user_name, username),
          first_name = CASE WHEN first_name IS NULL OR first_name = '' THEN first_nm ELSE first_name END,
          last_name = CASE WHEN last_name IS NULL OR last_name = '' THEN last_nm ELSE last_name END
      WHERE email = NEW.email OR username = user_name;
    ELSE
      generated_qr := 'QR-BEN-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));
      INSERT INTO public.beneficiaries (qr_code, auth_id, username, email, first_name, last_name, age, status)
      VALUES (generated_qr, NEW.id, user_name, NEW.email, first_nm, last_nm, user_age, 'Active');
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.staff_profiles WHERE email = NEW.email OR username = user_name) THEN
      UPDATE public.staff_profiles
      SET auth_id = NEW.id,
          username = COALESCE(user_name, username)
      WHERE email = NEW.email OR username = user_name;
    ELSE
      INSERT INTO public.staff_profiles (auth_id, username, email, first_name, last_name, role, age, status)
      VALUES (NEW.id, user_name, NEW.email, first_nm, last_nm, user_role, user_age, 'Active');
    END IF;
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

-- =============================================================================
-- SECURITY DEFINER HELPERS (Prevents Infinite RLS Recursion)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_staff_user(user_uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE auth_id = user_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user(user_uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE auth_id = user_uid
    AND role IN ('PESO Admin', 'CSWDO Admin')
  );
$$;

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

-- ---- staff_profiles policies (Non-Recursive) ----
DROP POLICY IF EXISTS "Staff can view own profile" ON staff_profiles;
DROP POLICY IF EXISTS "Staff can view all staff profiles" ON staff_profiles;
DROP POLICY IF EXISTS "Staff can update own profile" ON staff_profiles;
DROP POLICY IF EXISTS "Admins can update any staff profile" ON staff_profiles;
DROP POLICY IF EXISTS "Allow staff profile creation on signup" ON staff_profiles;

CREATE POLICY "Allow read staff_profiles"
  ON staff_profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow update staff_profiles"
  ON staff_profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert staff_profiles"
  ON staff_profiles FOR INSERT
  WITH CHECK (true);

-- ---- beneficiaries policies ----
DROP POLICY IF EXISTS "Allow public read beneficiaries" ON beneficiaries;
DROP POLICY IF EXISTS "Allow public update beneficiaries" ON beneficiaries;
DROP POLICY IF EXISTS "Allow public beneficiary signup insert" ON beneficiaries;
DROP POLICY IF EXISTS "Public can register as beneficiary" ON beneficiaries;
DROP POLICY IF EXISTS "Secure beneficiary read" ON beneficiaries;
DROP POLICY IF EXISTS "Secure beneficiary update" ON beneficiaries;

CREATE POLICY "Allow read beneficiaries"
  ON beneficiaries FOR SELECT
  USING (true);

CREATE POLICY "Allow update beneficiaries"
  ON beneficiaries FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert beneficiaries"
  ON beneficiaries FOR INSERT
  WITH CHECK (true);

-- ---- programs policies ----
DROP POLICY IF EXISTS "Anyone can view programs" ON programs;
DROP POLICY IF EXISTS "Admins can manage programs" ON programs;

CREATE POLICY "Anyone can view programs"
  ON programs FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage programs"
  ON programs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ---- applications policies (Non-Recursive) ----
DROP POLICY IF EXISTS "Beneficiaries view own applications" ON applications;
DROP POLICY IF EXISTS "Staff can view all applications" ON applications;
DROP POLICY IF EXISTS "Beneficiaries can create applications" ON applications;
DROP POLICY IF EXISTS "Staff can update applications" ON applications;

CREATE POLICY "Allow read applications"
  ON applications FOR SELECT
  USING (true);

CREATE POLICY "Allow insert applications"
  ON applications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update applications"
  ON applications FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ---- notifications policies (Non-Recursive) ----
DROP POLICY IF EXISTS "Staff view own notifications" ON notifications;
DROP POLICY IF EXISTS "Beneficiaries view own notifications" ON notifications;
DROP POLICY IF EXISTS "Staff update own notifications" ON notifications;
DROP POLICY IF EXISTS "Beneficiaries update own notifications" ON notifications;
DROP POLICY IF EXISTS "Staff can create notifications" ON notifications;

CREATE POLICY "Allow read notifications"
  ON notifications FOR SELECT
  USING (true);

CREATE POLICY "Allow insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update notifications"
  ON notifications FOR UPDATE
  USING (true)
  WITH CHECK (true);


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
-- REALTIME REPLICATION (SUPABASE REALTIME PUBLICATION)
-- =============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE beneficiaries;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE applications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE distributions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE interview_schedules;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE approved_assistance;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE programs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE funds;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE staff_profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE batches;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_user_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

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

