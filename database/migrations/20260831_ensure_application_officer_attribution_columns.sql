-- Migration: Ensure officer attribution columns exist on applications table
-- Purpose: Ensure officer_id, officer_decision, officer_action_at, officer_notes, forwarded_by, batched_by exist in Supabase

ALTER TABLE applications ADD COLUMN IF NOT EXISTS officer_id BIGINT DEFAULT NULL REFERENCES staff_profiles(id) ON DELETE SET NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS officer_decision VARCHAR(50) DEFAULT 'None';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS officer_action_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS officer_notes TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS forwarded_by VARCHAR(255) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS batched_by VARCHAR(255) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS batched_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(255) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ DEFAULT NULL;
