-- ============================================================================
-- FIX: Add unique constraint for phone_plain to prevent duplicate spins
-- Issue: SECRET_PEPPER mismatch between environments caused phone_hash to differ
-- Solution: Use phone_plain for duplicate check instead of phone_hash
-- Date: 2025-10-18
-- ============================================================================

-- Step 1: Remove duplicate records (keep the earliest one for each phone)
-- This is a one-time cleanup
DELETE FROM lucky_wheel_spins
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY campaign_id, phone_plain
             ORDER BY created_at ASC
           ) as rn
    FROM lucky_wheel_spins
    WHERE phone_plain IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Step 2: Add unique constraint on phone_plain
-- This ensures one phone can only spin once per campaign
ALTER TABLE lucky_wheel_spins
ADD CONSTRAINT unique_phone_plain_per_campaign
UNIQUE(campaign_id, phone_plain);

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_spins_phone_plain
  ON lucky_wheel_spins(phone_plain, campaign_id);

-- Step 4: Add comment for documentation
COMMENT ON CONSTRAINT unique_phone_plain_per_campaign ON lucky_wheel_spins IS
  'Ensures one phone number can only spin once per campaign. Uses phone_plain instead of phone_hash to prevent SECRET_PEPPER mismatch issues across environments.';

-- ============================================================================
-- NOTES:
-- - Keep phone_hash constraint as backup (don't drop it)
-- - Database check now uses phone_plain instead of phone_hash
-- - This fix ensures duplicate check works regardless of SECRET_PEPPER value
-- ============================================================================
