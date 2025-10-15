-- ============================================================================
-- MIGRATION: Add phone_plain column for Zalo automation
-- Version: 1.1
-- Date: 2025-10-16
-- Purpose: Store raw phone number for N8N/Zalo automation workflows
-- ============================================================================

-- Add phone_plain column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lucky_wheel_spins'
        AND column_name = 'phone_plain'
    ) THEN
        ALTER TABLE lucky_wheel_spins
        ADD COLUMN phone_plain TEXT;

        RAISE NOTICE 'Added phone_plain column to lucky_wheel_spins';
    ELSE
        RAISE NOTICE 'Column phone_plain already exists, skipping...';
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN lucky_wheel_spins.phone_plain IS 'Raw phone number for automation workflows (Zalo). Service role access only via RLS.';

-- Create index for phone_plain (for N8N queries)
CREATE INDEX IF NOT EXISTS idx_spins_phone_plain
  ON lucky_wheel_spins(phone_plain)
  WHERE phone_plain IS NOT NULL;

-- ============================================================================
-- IMPORTANT SECURITY NOTE:
-- phone_plain is protected by RLS policies:
-- - Only service_role (backend) can read/write
-- - Frontend NEVER has access
-- - N8N workflows use backend API to fetch data
-- ============================================================================

-- Verify the migration
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'lucky_wheel_spins'
  AND column_name = 'phone_plain';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
