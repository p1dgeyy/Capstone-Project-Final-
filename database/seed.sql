-- Capstone Project MySQL Seed Data
-- Designed to match the mock accounts and data from README.md and dashboard files

USE `capstone_db`;

-- Disable foreign key checks to make seeding repeatable/safe
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `distributions`;
TRUNCATE TABLE `notifications`;
TRUNCATE TABLE `applications`;
TRUNCATE TABLE `programs`;
TRUNCATE TABLE `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. SEED USERS
-- Password values stored here as mock plaintext or standard representations matching README
INSERT INTO `users` 
  (`id`, `username`, `password`, `role`, `first_name`, `middle_name`, `last_name`, `suffix`, `age`, `date_of_birth`, `sex`, `nationality`, `marital_status`, `email`, `phone`, `address`, `id_type`, `id_file_path`, `terms_agreed`, `data_consent`) 
VALUES
  -- Staff & Administrators
  (1, 'peso-admin', 'password123', 'PESO Admin', 'John', 'A.', 'Doe', NULL, 40, '1986-05-15', 'Male', 'Filipino', 'Married', 'peso.admin@koronadal.gov.ph', '0917-123-4567', 'PESO Office, City Hall, Koronadal', NULL, NULL, TRUE, TRUE),
  (2, 'peso-officer', 'password123', 'PESO Officer', 'Jane', 'B.', 'Smith', NULL, 32, '1994-08-20', 'Female', 'Filipino', 'Single', 'peso.officer@koronadal.gov.ph', '0917-123-4568', 'PESO Office, City Hall, Koronadal', NULL, NULL, TRUE, TRUE),
  (3, 'cswdo-admin', 'password123', 'CSWDO Admin', 'Robert', 'C.', 'Johnson', NULL, 45, '1981-11-10', 'Male', 'Filipino', 'Married', 'cswdo.admin@koronadal.gov.ph', '0918-987-6543', 'CSWDO Office, City Hall, Koronadal', NULL, NULL, TRUE, TRUE),
  (4, 'cswdo-officer', 'password123', 'CSWDO Officer', 'Mary', 'D.', 'Williams', NULL, 28, '1998-02-28', 'Female', 'Filipino', 'Single', 'cswdo.officer@koronadal.gov.ph', '0918-987-6544', 'CSWDO Office, City Hall, Koronadal', NULL, NULL, TRUE, TRUE),
  (5, 'evaluator', 'password123', 'Evaluator', 'Edward', 'E.', 'Davis', NULL, 38, '1988-09-05', 'Male', 'Filipino', 'Married', 'evaluator@koronadal.gov.ph', '0919-444-5555', 'Evaluation Dept, City Hall, Koronadal', NULL, NULL, TRUE, TRUE),
  
  -- Beneficiaries
  (6, 'juan_dela_cruz', 'Test1234', 'Beneficiary', 'Juan', 'Santos', 'Dela Cruz', NULL, 29, '1997-04-12', 'Male', 'Filipino', 'Single', 'juan.delacruz@email.com', '0905-111-2222', 'Block 5, Lot 12, Barangay Zone IV, Koronadal City', 'philid', 'philid_juan.pdf', TRUE, TRUE),
  (7, 'maria_santos', 'Sample5678', 'Beneficiary', 'Maria', 'Cruz', 'Santos', NULL, 21, '2005-06-15', 'Female', 'Filipino', 'Single', 'maria.santos@email.com', '0906-333-4444', 'Purok Maligaya, Barangay Zone III, Koronadal City', 'school_id', 'schoolid_maria.png', TRUE, TRUE),
  (8, 'pedro_reyes', 'DemoPass90', 'Beneficiary', 'Pedro', 'Gomez', 'Reyes', NULL, 45, '1981-12-01', 'Male', 'Filipino', 'Married', 'pedro.reyes@email.com', '0907-555-6666', 'Purok Sunflower, Barangay Zone I, Koronadal City', 'drivers_license', 'drivers_license_pedro.jpg', TRUE, TRUE);

-- 2. SEED PROGRAMS
INSERT INTO `programs` 
  (`id`, `code`, `name`, `description`, `agency`, `status`) 
VALUES
  (1, 'LIVELIHOOD', 'Livelihood Assistance Program', 'Financial or asset grants to establish or support micro-enterprises.', 'CSWDO', 'Active'),
  (2, 'CKGIP', 'City of Koronadal Government Internship Program', 'Internship opportunities for youth within the local government units.', 'PESO', 'Active'),
  (3, 'KEEP', 'Koronadal Emergency Employment Program', 'Short-term emergency jobs for displaced or underemployed individuals.', 'PESO', 'Active'),
  (4, 'TUPAD', 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers', 'DOLE supported community-based emergency employment program.', 'PESO', 'Active'),
  (5, 'PFAS', 'Pangkabuhayan Financial Assistance', 'Special livelihood grants for individual entrepreneurs and micro-businesses.', 'PESO', 'Active'),
  (6, 'DILP', 'DOLE Integrated Livelihood Program', 'Integrated livelihood aid for informal economy workers.', 'PESO', 'Active'),
  (7, 'SPES', 'Special Program for Employment of Students', 'Summer employment support for students to support their education.', 'PESO', 'Active'),
  (8, 'CRISIS_AID', 'Crisis Financial Assistance', 'Emergency financial aid for individuals in crisis situations (medical, burial, transportation).', 'CSWDO', 'Active');

-- 3. SEED APPLICATIONS
-- Matches current state shown on beneficiary dashboards
INSERT INTO `applications` 
  (`id`, `application_number`, `beneficiary_id`, `program_id`, `date_applied`, `status`, `progress_percent`, `remarks`) 
VALUES
  -- Maria Santos Applications
  (1, 'SPES-2026-0045', 7, 7, '2026-02-10', 'Approved', 100, 'All requirements complete. Approved for summer release.'),
  (2, 'PESO-2026-0812', 7, 4, '2026-03-20', 'Pending', 20, 'Please submit your Barangay Clearance.'),
  
  -- Pedro Reyes Applications
  (3, 'CSWDO-2026-0290', 8, 8, '2026-03-02', 'Approved', 100, 'Crisis grant approved. Financial package generated.');

-- 4. SEED NOTIFICATIONS
INSERT INTO `notifications` 
  (`id`, `user_id`, `title`, `message`, `is_read`) 
VALUES
  -- Maria Santos Notifications
  (1, 7, 'Application Approved', 'Your SPES summer application (SPES-2026-0045) has been approved. Check details in Distribution.', FALSE),
  (2, 7, 'Missing Document', 'Please submit your Barangay Clearance for your TUPAD application.', FALSE),
  (3, 7, 'Training Scheduled', 'Livelihood skills training is scheduled on April 15, 2026 at the PESO Training Hall.', TRUE),
  
  -- Pedro Reyes Notifications
  (4, 8, 'Interview Scheduled', 'Your interview for CSWDO financial verification is set on March 28, 2026.', FALSE),
  (5, 8, 'Approved Assistance', 'Your CSWDO crisis aid (CSWDO-2026-0290) has been approved. Please check details in Distribution.', FALSE);

-- 5. SEED DISTRIBUTIONS
INSERT INTO `distributions` 
  (`id`, `application_id`, `distribution_date`, `distribution_time`, `location`, `amount`, `status`) 
VALUES
  -- Maria Santos (TUPAD/SPES release)
  (1, 1, '2026-04-20', '9:00 AM - 4:00 PM', 'CSWDO Office, Koronadal City', 5000.00, 'Confirmed'),
  
  -- Pedro Reyes (Crisis Aid release)
  (2, 3, '2026-04-22', '10:00 AM - 3:00 PM', 'Barangay Zone I Hall, Koronadal City', 3000.00, 'Confirmed');
