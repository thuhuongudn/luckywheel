-- ============================================================================
-- MIGRATION: Add expires_at column to lucky_wheel_spins
-- Purpose : Track coupon expiration for each spin result (+7 days default)
-- Date    : 2025-10-16
-- ============================================================================

ALTER TABLE lucky_wheel_spins
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill existing records with a 7-day offset from spin time
UPDATE lucky_wheel_spins
SET expires_at = created_at + INTERVAL '7 days'
WHERE expires_at IS NULL;

COMMENT ON COLUMN lucky_wheel_spins.expires_at IS 'Absolute expiration timestamp for the issued coupon code (defaults to created_at + 7 days).';
