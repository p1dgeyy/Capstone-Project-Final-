-- Capstone Project MySQL Seed Data (Refactored)
-- Split into officers and beneficiaries tables with QR code IDs

-- Disable foreign key checks to make seeding repeatable/safe
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `distributions`;
TRUNCATE TABLE `notifications`;
TRUNCATE TABLE `applications`;
TRUNCATE TABLE `programs`;
TRUNCATE TABLE `interview_schedules`;
TRUNCATE TABLE `approved_assistance`;
TRUNCATE TABLE `audit_logs`;
TRUNCATE TABLE `beneficiaries`;
TRUNCATE TABLE `officers`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. SEED OFFICERS (Staff & Administrators)
-- Password values stored here as mock plaintext — migrate.js will bcrypt-hash them
INSERT INTO `officers`
  (`id`, `username`, `password`, `role`, `first_name`, `middle_name`, `last_name`, `suffix`, `email`, `phone`, `department`, `status`)
VALUES
  (1, 'peso-admin',    'password123', 'PESO Admin',    'John',   'A.', 'Doe',      NULL, 'peso.admin@koronadal.gov.ph',    '0917-123-4567', 'PESO',  'Active'),
  (2, 'peso-officer',  'password123', 'PESO Officer',  'Jane',   'B.', 'Smith',    NULL, 'peso.officer@koronadal.gov.ph',  '0917-123-4568', 'PESO',  'Active'),
  (3, 'cswdo-admin',   'password123', 'CSWDO Admin',   'Robert', 'C.', 'Johnson',  NULL, 'cswdo.admin@koronadal.gov.ph',   '0918-987-6543', 'CSWDO', 'Active'),
  (4, 'cswdo-officer', 'password123', 'CSWDO Officer', 'Mary',   'D.', 'Williams', NULL, 'cswdo.officer@koronadal.gov.ph', '0918-987-6544', 'CSWDO', 'Active'),
  (5, 'evaluator',     'password123', 'Evaluator',     'Edward', 'E.', 'Davis',    NULL, 'evaluator@koronadal.gov.ph',     '0919-444-5555', 'PESO',  'Active');

-- 2. SEED BENEFICIARIES (with QR code IDs)
INSERT INTO `beneficiaries`
  (`qr_code_id`, `id`, `username`, `password`, `role`, `status`, `first_name`, `middle_name`, `last_name`, `suffix`,
   `age`, `date_of_birth`, `sex`, `nationality`, `marital_status`,
   `email`, `phone`, `address`, `id_type`, `id_file_path`, `terms_agreed`, `data_consent`, `is_verified`)
VALUES
  ('BEN-seed-0006-juan-dela-cruz',  6, 'juan_dela_cruz', 'Test1234',   'Beneficiary', 'Active', 'Juan',  'Santos', 'Dela Cruz', NULL, 29, '1997-04-12', 'Male',   'Filipino', 'Single',  'juan.delacruz@email.com',  '0905-111-2222', 'Block 5, Lot 12, Barangay Zone IV, Koronadal City',   'philid',          'philid_juan.pdf',          TRUE, TRUE, TRUE),
  ('BEN-seed-0007-maria-santos',    7, 'maria_santos',   'Sample5678', 'Beneficiary', 'Active', 'Maria', 'Cruz',   'Santos',    NULL, 21, '2005-06-15', 'Female', 'Filipino', 'Single',  'maria.santos@email.com',   '0906-333-4444', 'Purok Maligaya, Barangay Zone III, Koronadal City',    'school_id',       'schoolid_maria.png',       TRUE, TRUE, TRUE),
  ('BEN-seed-0008-pedro-reyes',     8, 'pedro_reyes',    'DemoPass90', 'Beneficiary', 'Active', 'Pedro', 'Gomez',  'Reyes',     NULL, 45, '1981-12-01', 'Male',   'Filipino', 'Married', 'pedro.reyes@email.com',    '0907-555-6666', 'Purok Sunflower, Barangay Zone I, Koronadal City',     'drivers_license', 'drivers_license_pedro.jpg', TRUE, TRUE, TRUE);

-- 3. SEED PROGRAMS
INSERT INTO `programs`
  (`id`, `code`, `name`, `description`, `agency`, `status`)
VALUES
  (1, 'LIVELIHOOD',  'Livelihood Assistance Program',                                              'Financial or asset grants to establish or support micro-enterprises.',            'CSWDO', 'Active'),
  (2, 'CKGIP',       'City of Koronadal Government Internship Program',                            'Internship opportunities for youth within the local government units.',           'PESO',  'Active'),
  (3, 'KEEP',        'Koronadal Emergency Employment Program',                                     'Short-term emergency jobs for displaced or underemployed individuals.',           'PESO',  'Active'),
  (4, 'TUPAD',       'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers',              'DOLE supported community-based emergency employment program.',                   'PESO',  'Active'),
  (5, 'PFAS',        'Pangkabuhayan Financial Assistance',                                         'Special livelihood grants for individual entrepreneurs and micro-businesses.',    'PESO',  'Active'),
  (6, 'DILP',        'DOLE Integrated Livelihood Program',                                         'Integrated livelihood aid for informal economy workers.',                         'PESO',  'Active'),
  (7, 'SPES',        'Special Program for Employment of Students',                                 'Summer employment support for students to support their education.',              'PESO',  'Active'),
  (8, 'CRISIS_AID',  'Crisis Financial Assistance',                                                'Emergency financial aid for individuals in crisis situations.',                   'CSWDO', 'Active');

-- 4. SEED APPLICATIONS
INSERT INTO `applications`
  (`id`, `application_number`, `beneficiary_id`, `program_id`, `date_applied`, `status`, `progress_percent`, `remarks`)
VALUES
  (1, 'SPES-2026-0045',  7, 7, '2026-02-10', 'Approved', 100, 'All requirements complete. Approved for summer release.'),
  (2, 'PESO-2026-0812',  7, 4, '2026-03-20', 'Pending',   20, 'Please submit your Barangay Clearance.'),
  (3, 'CSWDO-2026-0290', 8, 8, '2026-03-02', 'Approved', 100, 'Crisis grant approved. Financial package generated.');

-- 5. SEED NOTIFICATIONS
INSERT INTO `notifications`
  (`id`, `user_id`, `user_type`, `title`, `message`, `is_read`)
VALUES
  (1, 7, 'beneficiary', 'Application Approved',  'Your SPES summer application (SPES-2026-0045) has been approved.',          FALSE),
  (2, 7, 'beneficiary', 'Missing Document',      'Please submit your Barangay Clearance for your TUPAD application.',        FALSE),
  (3, 7, 'beneficiary', 'Training Scheduled',    'Livelihood skills training is scheduled on April 15, 2026.',               TRUE),
  (4, 8, 'beneficiary', 'Interview Scheduled',   'Your interview for CSWDO financial verification is set on March 28.',      FALSE),
  (5, 8, 'beneficiary', 'Approved Assistance',   'Your CSWDO crisis aid (CSWDO-2026-0290) has been approved.',               FALSE);

-- 6. SEED DISTRIBUTIONS
INSERT INTO `distributions`
  (`id`, `application_id`, `distribution_date`, `distribution_time`, `location`, `amount`, `status`)
VALUES
  (1, 1, '2026-04-20', '9:00 AM - 4:00 PM',  'CSWDO Office, Koronadal City',               5000.00, 'Confirmed'),
  (2, 3, '2026-04-22', '10:00 AM - 3:00 PM', 'Barangay Zone I Hall, Koronadal City',        3000.00, 'Confirmed');
