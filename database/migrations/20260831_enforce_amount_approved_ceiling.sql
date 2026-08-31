-- Migration: Enforce amount_approved ceiling constraint on applications table
-- Purpose: Prevent corrupted payloads or rogue values from approving excessive grant amounts
-- Ceiling: ₱500,000.00 (Standard statutory maximum for single-grant municipal social amelioration assistance)

DO $$
BEGIN
    -- 1. Drop existing constraint if it exists to allow idempotent re-runs
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'applications' AND constraint_name = 'chk_applications_amount_approved_ceiling'
    ) THEN
        ALTER TABLE applications DROP CONSTRAINT chk_applications_amount_approved_ceiling;
    END IF;

    -- 2. Add CHECK constraint on amount_approved
    -- Allows NULL (when application is not yet approved or pending evaluation)
    -- If provided, requires: 0 <= amount_approved <= 500000.00
    ALTER TABLE applications
    ADD CONSTRAINT chk_applications_amount_approved_ceiling
    CHECK (
        amount_approved IS NULL OR (amount_approved >= 0.00 AND amount_approved <= 500000.00)
    );
END $$;
