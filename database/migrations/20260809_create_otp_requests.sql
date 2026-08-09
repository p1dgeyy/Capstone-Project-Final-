-- =============================================================================
-- Migration: Create OTP Requests Table
-- City Government of Koronadal — PESO & CSWDO Portal
-- Created: 2026-08-09
-- =============================================================================

-- 1. PostgreSQL / Supabase Schema Definition
CREATE TABLE IF NOT EXISTS otp_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(100) DEFAULT NULL,
  identifier VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT '2FA_LOGIN' CHECK (purpose IN ('2FA_LOGIN', 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PHONE_VERIFICATION', 'BENEFICIARY_REGISTRATION')),
  channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL', 'SMS')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  expiry TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'USED', 'EXPIRED', 'BLOCKED')),
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for high-performance lookup and expiration maintenance
CREATE INDEX IF NOT EXISTS idx_otp_identifier_purpose ON otp_requests(identifier, purpose, status);
CREATE INDEX IF NOT EXISTS idx_otp_expiry ON otp_requests(expiry);
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_status ON otp_requests(status);

-- Enable RLS for Supabase
ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;

-- Staff/Admins can read OTP audit logs
CREATE POLICY "Admins can view OTP records"
  ON otp_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.auth_id = auth.uid()
      AND sp.role IN ('PESO Admin', 'CSWDO Admin')
    )
  );

-- =============================================================================
-- 2. MySQL Compatible Schema Definition (Reference)
-- =============================================================================
/*
CREATE TABLE IF NOT EXISTS `otp_requests` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` VARCHAR(100) DEFAULT NULL,
  `identifier` VARCHAR(255) NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `salt` VARCHAR(64) NOT NULL,
  `purpose` ENUM('2FA_LOGIN', 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PHONE_VERIFICATION', 'BENEFICIARY_REGISTRATION') NOT NULL DEFAULT '2FA_LOGIN',
  `channel` ENUM('EMAIL', 'SMS') NOT NULL DEFAULT 'EMAIL',
  `attempts` INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 3,
  `expiry` DATETIME NOT NULL,
  `status` ENUM('PENDING', 'USED', 'EXPIRED', 'BLOCKED') NOT NULL DEFAULT 'PENDING',
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_otp_identifier` (`identifier`, `purpose`, `status`),
  INDEX `idx_otp_expiry` (`expiry`),
  INDEX `idx_otp_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
*/
