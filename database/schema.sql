-- Capstone Project MySQL Database Schema (Refactored)
-- Designed for deployment on Railway
-- Split architecture: officers + beneficiaries (QR code primary key)

-- 1. OFFICERS TABLE
-- Holds staff/admin metadata (PESO, CSWDO, Evaluator roles)
CREATE TABLE IF NOT EXISTS `officers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator') NOT NULL,

  -- Profile Details
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) DEFAULT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `suffix` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `phone` VARCHAR(20) DEFAULT 'N/A',
  `department` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',

  -- Session Management (single-session enforcement)
  `current_session_token` VARCHAR(128) DEFAULT NULL,

  -- Metadata
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_off_role` (`role`),
  INDEX `idx_off_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BENEFICIARIES TABLE
-- Holds beneficiary metadata. QR code ID is the primary unique digital identifier.
CREATE TABLE IF NOT EXISTS `beneficiaries` (
  `qr_code_id` VARCHAR(100) NOT NULL,
  `id` INT AUTO_INCREMENT UNIQUE,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'Beneficiary',
  `status` ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',

  -- Profile Details
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) DEFAULT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `suffix` VARCHAR(20) DEFAULT NULL,
  `age` INT NOT NULL,
  `date_of_birth` DATE NOT NULL,
  `sex` ENUM('Male', 'Female') NOT NULL,
  `nationality` VARCHAR(50) DEFAULT 'Filipino',
  `marital_status` ENUM('Single', 'Married', 'Widowed', 'Divorced') NOT NULL,

  -- Contact Details
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NOT NULL,
  `address` TEXT NOT NULL,

  -- Beneficiary Verifications
  `id_type` VARCHAR(100) DEFAULT NULL,
  `id_file_path` VARCHAR(255) DEFAULT NULL,
  `terms_agreed` BOOLEAN DEFAULT FALSE,
  `data_consent` BOOLEAN DEFAULT FALSE,

  -- Session Management (single-session enforcement)
  `current_session_token` VARCHAR(128) DEFAULT NULL,

  -- Email Verification (OTP flow)
  `is_verified` BOOLEAN DEFAULT FALSE,
  `email_otp` VARCHAR(6) DEFAULT NULL,
  `email_otp_expires_at` TIMESTAMP NULL DEFAULT NULL,

  -- QR Code Image (base64 data URL, auto-generated on verification)
  `qr_code_data` TEXT DEFAULT NULL,

  -- Metadata
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`qr_code_id`),
  INDEX `idx_ben_id` (`id`),
  INDEX `idx_ben_username` (`username`),
  INDEX `idx_ben_verified` (`is_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. PROGRAMS TABLE
-- Details of the livelihood and internship assistance programs
CREATE TABLE IF NOT EXISTS `programs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `agency` ENUM('PESO', 'CSWDO') NOT NULL,
  `status` ENUM('Active', 'Inactive') DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_agency` (`agency`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. APPLICATIONS TABLE
-- Stores applications made by beneficiaries to specific programs
CREATE TABLE IF NOT EXISTS `applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_number` VARCHAR(50) NOT NULL UNIQUE,
  `beneficiary_id` INT NOT NULL,
  `program_id` INT NOT NULL,
  `date_applied` DATE NOT NULL,
  `status` ENUM('Pending', 'Pending Requirements', 'Under Review', 'Interview Scheduled', 'Training Scheduled', 'Officer Approved', 'Officer Denied', 'Approved', 'Rejected', 'Completed') DEFAULT 'Pending',
  `progress_percent` INT DEFAULT 0,
  `remarks` TEXT DEFAULT NULL,
  `officer_decision` ENUM('Approved', 'Denied', 'Pending Requirements', 'None') DEFAULT 'None',
  `officer_id` INT DEFAULT NULL,
  `officer_notes` TEXT DEFAULT NULL,
  `officer_action_at` TIMESTAMP NULL DEFAULT NULL,
  `admin_id` INT DEFAULT NULL,
  `admin_notes` TEXT DEFAULT NULL,
  `documents_json` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT `fk_app_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_app_program` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE,
  INDEX `idx_app_number` (`application_number`),
  INDEX `idx_app_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. NOTIFICATIONS TABLE
-- Notifications for all portal users (officers and beneficiaries)
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `user_type` ENUM('officer', 'beneficiary') NOT NULL DEFAULT 'beneficiary',
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_notif_user` (`user_id`, `user_type`),
  INDEX `idx_notif_unread` (`user_id`, `user_type`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. DISTRIBUTIONS TABLE
-- Tracks release of cash assistance and aid payouts
CREATE TABLE IF NOT EXISTS `distributions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_id` INT NOT NULL,
  `distribution_date` DATE NOT NULL,
  `distribution_time` VARCHAR(100) NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `status` ENUM('Pending', 'Confirmed', 'Claimed') DEFAULT 'Pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT `fk_dist_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  INDEX `idx_dist_date` (`distribution_date`),
  INDEX `idx_dist_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. AUDIT LOGS TABLE
-- Tracks officer and administrator actions for governance and accountability
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `user_type` ENUM('officer', 'beneficiary') NOT NULL DEFAULT 'officer',
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) DEFAULT 'application',
  `entity_id` INT DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_audit_user` (`user_id`, `user_type`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_entity` (`entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. APPROVED ASSISTANCE TABLE
-- Records approved aid details
CREATE TABLE IF NOT EXISTS `approved_assistance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_id` INT DEFAULT NULL,
  `beneficiary_id` INT NOT NULL,
  `program_id` INT NOT NULL,
  `assistance_type` VARCHAR(100) NOT NULL,
  `quantity_amount` VARCHAR(255) NOT NULL,
  `conditions` TEXT DEFAULT NULL,
  `status` ENUM('Pending', 'Disbursed', 'Released', 'Completed', 'Cancelled') DEFAULT 'Completed',
  `approval_date` DATE NOT NULL,
  `officer_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT `fk_ast_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ast_program` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ast_officer` FOREIGN KEY (`officer_id`) REFERENCES `officers` (`id`) ON DELETE CASCADE,
  INDEX `idx_ast_beneficiary` (`beneficiary_id`),
  INDEX `idx_ast_program` (`program_id`),
  INDEX `idx_ast_date` (`approval_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. INTERVIEW SCHEDULES TABLE
-- Stores assigned interview schedules, attendance tracking, and completion statuses
CREATE TABLE IF NOT EXISTS `interview_schedules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_id` INT DEFAULT NULL,
  `beneficiary_id` INT NOT NULL,
  `program_id` INT NOT NULL,
  `officer_id` INT NOT NULL,
  `interview_date` DATE NOT NULL,
  `interview_time` VARCHAR(50) NOT NULL,
  `venue_location` VARCHAR(255) NOT NULL DEFAULT 'PESO Main Office - Interview Room A',
  `status` ENUM('Scheduled', 'Pending', 'Completed', 'Missed', 'Cancelled') DEFAULT 'Scheduled',
  `attendance_status` ENUM('Unmarked', 'Present', 'Absent') DEFAULT 'Unmarked',
  `remarks` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT `fk_int_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_int_program` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_int_officer` FOREIGN KEY (`officer_id`) REFERENCES `officers` (`id`) ON DELETE CASCADE,
  INDEX `idx_int_beneficiary` (`beneficiary_id`),
  INDEX `idx_int_date` (`interview_date`),
  INDEX `idx_int_status` (`status`),
  INDEX `idx_int_attendance` (`attendance_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
