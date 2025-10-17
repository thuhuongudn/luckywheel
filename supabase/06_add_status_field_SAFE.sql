-- ============================================================================
-- MIGRATION: Add status field to lucky_wheel_spins (SAFE VERSION)
-- Version: 1.2
-- Date: 2025-10-17
-- Description: Add status column with 4 states (active, inactive, expired, used)
-- This version is SAFE to run multiple times (idempotent)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add status column (if not exists)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lucky_wheel_spins'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE lucky_wheel_spins
        ADD COLUMN status TEXT DEFAULT 'active';

        RAISE NOTICE '✅ Added status column to lucky_wheel_spins';
    ELSE
        RAISE NOTICE 'ℹ️  Column status already exists in lucky_wheel_spins';
    END IF;
END $$;

-- Add constraint (safe - will skip if exists)
DO $$
BEGIN
    ALTER TABLE lucky_wheel_spins
    ADD CONSTRAINT lucky_wheel_spins_status_check
    CHECK (status IN ('active', 'inactive', 'expired', 'used'));
    RAISE NOTICE '✅ Added status constraint';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Status constraint already exists';
END $$;

-- ============================================================================
-- STEP 2: Add documentation
-- ============================================================================
COMMENT ON COLUMN lucky_wheel_spins.status IS 'Coupon status: active (available), inactive (deactivated), expired (past expiry date), used (redeemed)';

-- ============================================================================
-- STEP 3: Create indexes (IF NOT EXISTS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_spins_status
  ON lucky_wheel_spins(status);

CREATE INDEX IF NOT EXISTS idx_spins_campaign_status
  ON lucky_wheel_spins(campaign_id, status, created_at DESC);

RAISE NOTICE '✅ Created indexes';

-- ============================================================================
-- STEP 4: Create/Update Functions
-- ============================================================================

-- Function 1: Auto-update expired status
CREATE OR REPLACE FUNCTION auto_update_expired_status()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE lucky_wheel_spins
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Trigger function for auto-expiry
CREATE OR REPLACE FUNCTION check_expiry_on_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at < NOW() AND NEW.status = 'active' THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Statistics function
CREATE OR REPLACE FUNCTION get_spin_statistics(p_campaign_id TEXT)
RETURNS TABLE (
  total_spins BIGINT,
  active_count BIGINT,
  inactive_count BIGINT,
  expired_count BIGINT,
  used_count BIGINT,
  prize_20k_count BIGINT,
  prize_30k_count BIGINT,
  prize_50k_count BIGINT,
  prize_100k_count BIGINT,
  total_prize_value BIGINT,
  active_value BIGINT,
  used_value BIGINT,
  potential_value BIGINT,
  n8n_success_count BIGINT,
  n8n_failed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Total counts
    COUNT(*)::BIGINT as total_spins,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT as active_count,
    COUNT(*) FILTER (WHERE status = 'inactive')::BIGINT as inactive_count,
    COUNT(*) FILTER (WHERE status = 'expired')::BIGINT as expired_count,
    COUNT(*) FILTER (WHERE status = 'used')::BIGINT as used_count,

    -- Prize distribution
    COUNT(*) FILTER (WHERE prize = 20000)::BIGINT as prize_20k_count,
    COUNT(*) FILTER (WHERE prize = 30000)::BIGINT as prize_30k_count,
    COUNT(*) FILTER (WHERE prize = 50000)::BIGINT as prize_50k_count,
    COUNT(*) FILTER (WHERE prize = 100000)::BIGINT as prize_100k_count,

    -- Value calculations
    COALESCE(SUM(prize), 0)::BIGINT as total_prize_value,
    COALESCE(SUM(prize) FILTER (WHERE status = 'active'), 0)::BIGINT as active_value,
    COALESCE(SUM(prize) FILTER (WHERE status = 'used'), 0)::BIGINT as used_value,
    COALESCE(SUM(prize) FILTER (WHERE status IN ('active', 'used')), 0)::BIGINT as potential_value,

    -- N8N status
    COUNT(*) FILTER (WHERE n8n_sent = TRUE)::BIGINT as n8n_success_count,
    COUNT(*) FILTER (WHERE n8n_sent = FALSE)::BIGINT as n8n_failed_count
  FROM lucky_wheel_spins
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE '✅ Created/Updated functions';

-- ============================================================================
-- STEP 5: Create/Recreate Trigger (SAFE)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_check_expiry_before_update ON lucky_wheel_spins;

CREATE TRIGGER trigger_check_expiry_before_update
  BEFORE UPDATE ON lucky_wheel_spins
  FOR EACH ROW
  EXECUTE FUNCTION check_expiry_on_read();

RAISE NOTICE '✅ Created trigger';

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION auto_update_expired_status() TO service_role;
GRANT EXECUTE ON FUNCTION get_spin_statistics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spin_statistics(TEXT) TO service_role;

RAISE NOTICE '✅ Granted permissions';

-- ============================================================================
-- STEP 7: Initialize existing data (SAFE - only updates NULL values)
-- ============================================================================
DO $$
DECLARE
  active_updated INTEGER;
  expired_updated INTEGER;
BEGIN
  -- Set all existing active non-expired coupons to 'active'
  UPDATE lucky_wheel_spins
  SET status = 'active'
  WHERE status IS NULL
    AND expires_at > NOW();

  GET DIAGNOSTICS active_updated = ROW_COUNT;

  -- Set expired coupons to 'expired'
  UPDATE lucky_wheel_spins
  SET status = 'expired'
  WHERE status IS NULL
    AND expires_at <= NOW();

  GET DIAGNOSTICS expired_updated = ROW_COUNT;

  RAISE NOTICE '✅ Updated % active and % expired records', active_updated, expired_updated;
END $$;

-- ============================================================================
-- STEP 8: Verification
-- ============================================================================
DO $$
DECLARE
  total_count INTEGER;
  status_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM lucky_wheel_spins;
  SELECT COUNT(*) INTO status_count FROM lucky_wheel_spins WHERE status IS NOT NULL;

  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total records: %', total_count;
  RAISE NOTICE 'Records with status: %', status_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Run this to verify:';
  RAISE NOTICE 'SELECT status, COUNT(*) FROM lucky_wheel_spins GROUP BY status;';
  RAISE NOTICE '================================================';
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
