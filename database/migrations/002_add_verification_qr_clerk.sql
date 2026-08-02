-- Migration 002: Clerk auth linkage, Resend OTP verification, and Beneficiary QR codes
-- Safe to run against an existing Railway MySQL database that was created from an
-- earlier version of database/schema.sql. Uses `ADD COLUMN IF NOT EXISTS`
-- (MySQL 8.0+ / Railway default) so it can be re-run without erroring.

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `clerk_user_id` VARCHAR(191) DEFAULT NULL UNIQUE AFTER `current_session_token`,
  ADD COLUMN IF NOT EXISTS `is_verified` BOOLEAN NOT NULL DEFAULT FALSE AFTER `clerk_user_id`,
  ADD COLUMN IF NOT EXISTS `email_otp_hash` VARCHAR(255) DEFAULT NULL AFTER `is_verified`,
  ADD COLUMN IF NOT EXISTS `email_otp_expires_at` DATETIME DEFAULT NULL AFTER `email_otp_hash`,
  ADD COLUMN IF NOT EXISTS `email_otp_attempts` INT NOT NULL DEFAULT 0 AFTER `email_otp_expires_at`,
  ADD COLUMN IF NOT EXISTS `verified_at` TIMESTAMP NULL DEFAULT NULL AFTER `email_otp_attempts`,
  ADD COLUMN IF NOT EXISTS `qr_code_token` VARCHAR(191) DEFAULT NULL UNIQUE AFTER `verified_at`,
  ADD COLUMN IF NOT EXISTS `qr_code_url` VARCHAR(500) DEFAULT NULL AFTER `qr_code_token`;

-- Backfill: staff/officer accounts created before this migration are treated as
-- already verified so existing logins are not broken. Only Beneficiary accounts
-- created going forward will be gated behind OTP confirmation.
UPDATE `users` SET `is_verified` = TRUE WHERE `role` != 'Beneficiary';

-- Existing Beneficiary rows (created before OTP gating existed) are grandfathered
-- in as verified too, since they were previously usable accounts. Remove this
-- line if you'd rather force everyone to re-verify.
UPDATE `users` SET `is_verified` = TRUE WHERE `role` = 'Beneficiary' AND `is_verified` = FALSE;

CREATE INDEX IF NOT EXISTS `idx_is_verified` ON `users` (`is_verified`);
CREATE INDEX IF NOT EXISTS `idx_clerk_user_id` ON `users` (`clerk_user_id`);
