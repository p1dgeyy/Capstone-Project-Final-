-- =============================================================================
-- Migration: Dual Verification Users Table & Schema
-- City Government of Koronadal — PESO & CSWDO Portal
-- Created: 2026-08-10
--
-- Features:
-- 1. email (VARCHAR 255, UNIQUE, NOT NULL)
-- 2. password (VARCHAR 255, NOT NULL) -- Hashed with Bcrypt
-- 3. phone_number (VARCHAR 50, UNIQUE, NOT NULL)
-- 4. email_code_hash (VARCHAR 255, NULLABLE) -- Salted/Hashed 4-digit code
-- 5. email_code_expiry (TIMESTAMPTZ / DATETIME, NULLABLE) -- 5-min lifespan
-- 6. phone_otp_hash (VARCHAR 255, NULLABLE) -- Salted/Hashed 6-digit OTP
-- 7. phone_otp_expiry (TIMESTAMPTZ / DATETIME, NULLABLE) -- 5-min lifespan
-- 8. email_status (ENUM / VARCHAR: 'unverified', 'verified')
-- 9. phone_status (ENUM / VARCHAR: 'unverified', 'verified')
-- =============================================================================

-- =============================================================================
-- 1. PostgreSQL / Supabase Schema Definition
-- =============================================================================

CREATE TABLE IF NOT EXISTS portal_users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL UNIQUE,
  email_code_hash VARCHAR(255) DEFAULT NULL,
  email_code_expiry TIMESTAMPTZ DEFAULT NULL,
  phone_otp_hash VARCHAR(255) DEFAULT NULL,
  phone_otp_expiry TIMESTAMPTZ DEFAULT NULL,
  email_status VARCHAR(20) NOT NULL DEFAULT 'unverified' CHECK (email_status IN ('unverified', 'verified')),
  phone_status VARCHAR(20) NOT NULL DEFAULT 'unverified' CHECK (phone_status IN ('unverified', 'verified')),
  role VARCHAR(50) NOT NULL DEFAULT 'Beneficiary',
  first_name VARCHAR(100) DEFAULT NULL,
  last_name VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter existing tables if upgrading
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_users' AND column_name = 'email_status') THEN
    ALTER TABLE portal_users ADD COLUMN email_status VARCHAR(20) NOT NULL DEFAULT 'unverified' CHECK (email_status IN ('unverified', 'verified'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_users' AND column_name = 'phone_status') THEN
    ALTER TABLE portal_users ADD COLUMN phone_status VARCHAR(20) NOT NULL DEFAULT 'unverified' CHECK (phone_status IN ('unverified', 'verified'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_users' AND column_name = 'email_code_hash') THEN
    ALTER TABLE portal_users ADD COLUMN email_code_hash VARCHAR(255) DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_users' AND column_name = 'email_code_expiry') THEN
    ALTER TABLE portal_users ADD COLUMN email_code_expiry TIMESTAMPTZ DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_users' AND column_name = 'phone_otp_hash') THEN
    ALTER TABLE portal_users ADD COLUMN phone_otp_hash VARCHAR(255) DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_users' AND column_name = 'phone_otp_expiry') THEN
    ALTER TABLE portal_users ADD COLUMN phone_otp_expiry TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Indexes for rapid lookup during verification
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);
CREATE INDEX IF NOT EXISTS idx_portal_users_phone ON portal_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_portal_users_statuses ON portal_users(email_status, phone_status);

-- =============================================================================
-- 2. MySQL Compatible Schema Definition (Reference)
-- =============================================================================
/*
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `phone_number` VARCHAR(50) NOT NULL UNIQUE,
  `email_code_hash` VARCHAR(255) DEFAULT NULL,
  `email_code_expiry` DATETIME DEFAULT NULL,
  `phone_otp_hash` VARCHAR(255) DEFAULT NULL,
  `phone_otp_expiry` DATETIME DEFAULT NULL,
  `email_status` ENUM('unverified', 'verified') NOT NULL DEFAULT 'unverified',
  `phone_status` ENUM('unverified', 'verified') NOT NULL DEFAULT 'unverified',
  `role` VARCHAR(50) NOT NULL DEFAULT 'Beneficiary',
  `first_name` VARCHAR(100) DEFAULT NULL,
  `last_name` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_phone` (`phone_number`),
  INDEX `idx_users_status` (`email_status`, `phone_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
*/
