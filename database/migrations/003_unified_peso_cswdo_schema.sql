-- Migration 003: Unified PESO-CSWDO Schema Enhancements
-- Idempotent database schema updates for PESO-CSWDO system modules

-- 1. Update `users` table
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `sms_otp_hash` VARCHAR(255) DEFAULT NULL AFTER `current_session_token`,
  ADD COLUMN IF NOT EXISTS `sms_otp_expires_at` DATETIME DEFAULT NULL AFTER `sms_otp_hash`,
  ADD COLUMN IF NOT EXISTS `sms_otp_attempts` INT DEFAULT 0 AFTER `sms_otp_expires_at`,
  ADD COLUMN IF NOT EXISTS `email_code_hash` VARCHAR(255) DEFAULT NULL AFTER `sms_otp_attempts`,
  ADD COLUMN IF NOT EXISTS `email_code_expires_at` DATETIME DEFAULT NULL AFTER `email_code_hash`,
  ADD COLUMN IF NOT EXISTS `email_code_attempts` INT DEFAULT 0 AFTER `email_code_expires_at`,
  ADD COLUMN IF NOT EXISTS `purok` VARCHAR(100) DEFAULT NULL AFTER `address`,
  ADD COLUMN IF NOT EXISTS `barangay` VARCHAR(100) DEFAULT NULL AFTER `purok`,
  ADD COLUMN IF NOT EXISTS `spouse_name` VARCHAR(150) DEFAULT NULL AFTER `marital_status`,
  ADD COLUMN IF NOT EXISTS `children_info` TEXT DEFAULT NULL AFTER `spouse_name`,
  ADD COLUMN IF NOT EXISTS `valid_id_file_path` VARCHAR(255) DEFAULT NULL AFTER `id_file_path`,
  ADD COLUMN IF NOT EXISTS `brgy_clearance_file_path` VARCHAR(255) DEFAULT NULL AFTER `valid_id_file_path`,
  ADD COLUMN IF NOT EXISTS `program_req_file_path` VARCHAR(255) DEFAULT NULL AFTER `brgy_clearance_file_path`,
  ADD COLUMN IF NOT EXISTS `medical_cert_file_path` VARCHAR(255) DEFAULT NULL AFTER `program_req_file_path`,
  ADD COLUMN IF NOT EXISTS `program_type` ENUM('PESO', 'CSWDO') DEFAULT 'PESO' AFTER `medical_cert_file_path`,
  ADD COLUMN IF NOT EXISTS `department` ENUM('PESO', 'CSWDO') DEFAULT 'PESO' AFTER `program_type`,
  ADD COLUMN IF NOT EXISTS `status` ENUM('Active', 'Deactivated', 'Pending') DEFAULT 'Active' AFTER `department`;

-- 2. Create `officers` table
CREATE TABLE IF NOT EXISTS `officers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) DEFAULT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `suffix` VARCHAR(20) DEFAULT NULL,
  `sex` ENUM('Male', 'Female') NOT NULL,
  `address` TEXT NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `role` ENUM('PESO Admin', 'PESO Officer', 'CSWDO Admin', 'CSWDO Officer', 'Evaluator') NOT NULL,
  `department` ENUM('PESO', 'CSWDO') NOT NULL,
  `status` ENUM('Active', 'Deactivated') DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_officer_username` (`username`),
  INDEX `idx_officer_dept` (`department`),
  INDEX `idx_officer_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Update `applications` table for document attachments and status
ALTER TABLE `applications`
  ADD COLUMN IF NOT EXISTS `program_type` ENUM('PESO', 'CSWDO') DEFAULT 'PESO' AFTER `program_id`,
  ADD COLUMN IF NOT EXISTS `valid_id_file_path` VARCHAR(255) DEFAULT NULL AFTER `documents_json`,
  ADD COLUMN IF NOT EXISTS `brgy_clearance_file_path` VARCHAR(255) DEFAULT NULL AFTER `valid_id_file_path`,
  ADD COLUMN IF NOT EXISTS `program_req_file_path` VARCHAR(255) DEFAULT NULL AFTER `brgy_clearance_file_path`,
  ADD COLUMN IF NOT EXISTS `medical_cert_file_path` VARCHAR(255) DEFAULT NULL AFTER `program_req_file_path`,
  ADD COLUMN IF NOT EXISTS `medical_assistance_type` VARCHAR(100) DEFAULT NULL AFTER `medical_cert_file_path`,
  ADD COLUMN IF NOT EXISTS `requested_amount` DECIMAL(10,2) DEFAULT NULL AFTER `medical_assistance_type`;

-- 4. Create `batches` and `batch_members` tables
CREATE TABLE IF NOT EXISTS `batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_name` VARCHAR(150) NOT NULL,
  `program_name` VARCHAR(150) NOT NULL,
  `department` ENUM('PESO', 'CSWDO') DEFAULT 'PESO',
  `created_by_officer_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `batch_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT NOT NULL,
  `application_id` INT NOT NULL,
  `beneficiary_id` INT NOT NULL,
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bm_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create `approved_assistance` table
CREATE TABLE IF NOT EXISTS `approved_assistance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_id` INT DEFAULT NULL,
  `beneficiary_id` INT NOT NULL,
  `beneficiary_name` VARCHAR(150) NOT NULL,
  `program_type` ENUM('PESO', 'CSWDO') NOT NULL,
  `assistance_type` VARCHAR(100) NOT NULL,
  `quantity_amount` VARCHAR(255) NOT NULL,
  `conditions` TEXT DEFAULT NULL,
  `approval_date` DATE NOT NULL,
  `officer_id` INT NOT NULL,
  `officer_name` VARCHAR(150) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Ensure `audit_logs` table structure
ALTER TABLE `audit_logs`
  ADD COLUMN IF NOT EXISTS `user_name` VARCHAR(100) DEFAULT NULL AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `user_role` VARCHAR(50) DEFAULT NULL AFTER `user_name`;
