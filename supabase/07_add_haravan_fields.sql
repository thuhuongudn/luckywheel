-- ============================================================================
-- MIGRATION: Add Haravan Discount Code fields
-- Version: 1.3
-- Date: 2025-10-17
-- Description: Add fields for Haravan API integration (discountId, is_promotion, etc.)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add Haravan fields
-- ============================================================================
DO $$
BEGIN
    -- Add discount_id (Haravan discount ID)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lucky_wheel_spins'
        AND column_name = 'discount_id'
    ) THEN
        ALTER TABLE lucky_wheel_spins
        ADD COLUMN discount_id BIGINT;

        RAISE NOTICE '✅ Added discount_id column';
    ELSE
        RAISE NOTICE 'ℹ️  Column discount_id already exists';
    END IF;

    -- Add is_promotion (Haravan promotion flag)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lucky_wheel_spins'
        AND column_name = 'is_promotion'
    ) THEN
        ALTER TABLE lucky_wheel_spins
        ADD COLUMN is_promotion BOOLEAN DEFAULT false;

        RAISE NOTICE '✅ Added is_promotion column';
    ELSE
        RAISE NOTICE 'ℹ️  Column is_promotion already exists';
    END IF;

    -- Add times_used (Haravan usage count)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lucky_wheel_spins'
        AND column_name = 'times_used'
    ) THEN
        ALTER TABLE lucky_wheel_spins
        ADD COLUMN times_used INTEGER DEFAULT 0;

        RAISE NOTICE '✅ Added times_used column';
    ELSE
        RAISE NOTICE 'ℹ️  Column times_used already exists';
    END IF;

    -- Add usage_limit (Haravan usage limit, always 1)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lucky_wheel_spins'
        AND column_name = 'usage_limit'
    ) THEN
        ALTER TABLE lucky_wheel_spins
        ADD COLUMN usage_limit INTEGER DEFAULT 1;

        RAISE NOTICE '✅ Added usage_limit column';
    ELSE
        RAISE NOTICE 'ℹ️  Column usage_limit already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add comments
-- ============================================================================
COMMENT ON COLUMN lucky_wheel_spins.discount_id IS 'Haravan discount ID from API';
COMMENT ON COLUMN lucky_wheel_spins.is_promotion IS 'Haravan promotion status (true = active in Haravan)';
COMMENT ON COLUMN lucky_wheel_spins.times_used IS 'Haravan discount usage count';
COMMENT ON COLUMN lucky_wheel_spins.usage_limit IS 'Haravan discount usage limit (always 1)';

-- ============================================================================
-- STEP 3: Create index for discount_id
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_spins_discount_id
  ON lucky_wheel_spins(discount_id)
  WHERE discount_id IS NOT NULL;

RAISE NOTICE '✅ Created index on discount_id';

-- ============================================================================
-- STEP 4: Update status constraint (remove 'inactive')
-- ============================================================================
DO $$
BEGIN
    -- Drop old constraint
    ALTER TABLE lucky_wheel_spins
    DROP CONSTRAINT IF EXISTS lucky_wheel_spins_status_check;

    -- Add new constraint (only 3 states: active, expired, used)
    ALTER TABLE lucky_wheel_spins
    ADD CONSTRAINT lucky_wheel_spins_status_check
    CHECK (status IN ('active', 'expired', 'used'));

    RAISE NOTICE '✅ Updated status constraint (removed inactive)';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE '⚠️  Constraint update warning: %', SQLERRM;
END $$;

-- ============================================================================
-- STEP 5: Update existing 'inactive' records to 'expired'
-- ============================================================================
UPDATE lucky_wheel_spins
SET status = 'expired'
WHERE status = 'inactive';

RAISE NOTICE '✅ Converted inactive records to expired';

-- ============================================================================
-- STEP 6: Create function to calculate status based on Haravan rules
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_haravan_status(
  p_is_promotion BOOLEAN,
  p_times_used INTEGER,
  p_usage_limit INTEGER
)
RETURNS TEXT AS $$
BEGIN
  -- Rule 1: If is_promotion = false => expired
  IF p_is_promotion = false THEN
    RETURN 'expired';
  END IF;

  -- Rule 2: If is_promotion = true AND times_used < usage_limit => active
  IF p_is_promotion = true AND p_times_used < p_usage_limit THEN
    RETURN 'active';
  END IF;

  -- Rule 3: If is_promotion = true AND times_used = usage_limit => used
  IF p_is_promotion = true AND p_times_used >= p_usage_limit THEN
    RETURN 'used';
  END IF;

  -- Default fallback
  RETURN 'expired';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION calculate_haravan_status(BOOLEAN, INTEGER, INTEGER) TO service_role;

RAISE NOTICE '✅ Created calculate_haravan_status function';

-- ============================================================================
-- STEP 7: Update get_spin_statistics to work with new status logic
-- ============================================================================
-- (No changes needed - function already handles dynamic status counts)

-- ============================================================================
-- STEP 8: Verification
-- ============================================================================
DO $$
DECLARE
  total_count INTEGER;
  discount_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM lucky_wheel_spins;
  SELECT COUNT(*) INTO discount_count FROM lucky_wheel_spins WHERE discount_id IS NOT NULL;

  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ HARAVAN MIGRATION COMPLETED';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total spins: %', total_count;
  RAISE NOTICE 'Spins with Haravan discount: %', discount_count;
  RAISE NOTICE '';
  RAISE NOTICE 'New fields added:';
  RAISE NOTICE '  - discount_id (BIGINT)';
  RAISE NOTICE '  - is_promotion (BOOLEAN)';
  RAISE NOTICE '  - times_used (INTEGER)';
  RAISE NOTICE '  - usage_limit (INTEGER)';
  RAISE NOTICE '';
  RAISE NOTICE 'Status constraint updated (removed inactive)';
  RAISE NOTICE 'Valid statuses: active, expired, used';
  RAISE NOTICE '================================================';
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
