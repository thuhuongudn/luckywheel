-- ============================================================================
-- LUCKY WHEEL DATABASE SCHEMA
-- Version: 1.0
-- Date: 2025-10-15
-- Description: Complete database schema for Lucky Wheel MVP
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: lucky_wheel_spins
-- Purpose: Store all spin results and prevent duplicate spins per phone
-- ============================================================================
CREATE TABLE IF NOT EXISTS lucky_wheel_spins (
  -- Primary Key
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Campaign Information
  campaign_id TEXT NOT NULL,

  -- User Information (Hashed for Security)
  phone_hash TEXT NOT NULL,           -- SHA256(phone + pepper) - for duplicate check
  phone_masked TEXT,                  -- 091***8417 - for admin view only
  phone_plain TEXT,                   -- Raw phone for automation workflows (service role access only)
  customer_name TEXT,                 -- Customer name from form

  -- Prize Information
  prize INTEGER NOT NULL CHECK (prize IN (20000, 30000, 50000, 100000)),
  coupon_code TEXT NOT NULL UNIQUE,   -- Generated coupon code (e.g., ABC123)

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- N8N Integration Status
  n8n_sent BOOLEAN DEFAULT FALSE,
  n8n_sent_at TIMESTAMPTZ,
  n8n_response JSONB,                 -- Store N8N response for debugging
  n8n_error TEXT,
  n8n_retry_count INTEGER DEFAULT 0,

  -- Constraints
  CONSTRAINT unique_phone_per_campaign UNIQUE(campaign_id, phone_hash)
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Fast lookup for duplicate check (most frequent query)
CREATE INDEX IF NOT EXISTS idx_spins_phone_hash
  ON lucky_wheel_spins(phone_hash);

-- Fast lookup by campaign + created_at (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_spins_campaign_created
  ON lucky_wheel_spins(campaign_id, created_at DESC);

-- Fast lookup for coupon code verification
CREATE INDEX IF NOT EXISTS idx_spins_coupon_code
  ON lucky_wheel_spins(coupon_code);

-- Fast lookup for N8N retry jobs
CREATE INDEX IF NOT EXISTS idx_spins_n8n_failed
  ON lucky_wheel_spins(n8n_sent, n8n_retry_count)
  WHERE n8n_sent = FALSE;

-- ============================================================================
-- COMMENTS for Documentation
-- ============================================================================
COMMENT ON TABLE lucky_wheel_spins IS 'Stores all lucky wheel spin results with phone hash for duplicate prevention';
COMMENT ON COLUMN lucky_wheel_spins.phone_hash IS 'SHA256(phone + SECRET_PEPPER) - never store raw phone numbers';
COMMENT ON COLUMN lucky_wheel_spins.phone_masked IS 'Masked phone for admin view (091***8417)';
COMMENT ON COLUMN lucky_wheel_spins.phone_plain IS 'Raw phone number stored securely for automation workflows';
COMMENT ON COLUMN lucky_wheel_spins.n8n_sent IS 'Whether Zalo message was successfully sent via N8N';
COMMENT ON COLUMN lucky_wheel_spins.n8n_retry_count IS 'Number of retry attempts if N8N failed';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Purpose: Prevent unauthorized access to customer data
-- ============================================================================

-- Enable RLS
ALTER TABLE lucky_wheel_spins ENABLE ROW LEVEL SECURITY;

-- Policy 1: Service Role (Backend) has full access
CREATE POLICY "Service role has full access"
  ON lucky_wheel_spins
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy 2: Authenticated admins can view all records (for dashboard)
CREATE POLICY "Admins can view all spins"
  ON lucky_wheel_spins
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy 3: No public access (frontend never reads directly from DB)
CREATE POLICY "No public access"
  ON lucky_wheel_spins
  FOR ALL
  USING (false);

-- ============================================================================
-- FUNCTION: Get spin statistics
-- Purpose: Provide aggregated stats for admin dashboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_spin_statistics(p_campaign_id TEXT)
RETURNS TABLE (
  total_spins BIGINT,
  prize_20k_count BIGINT,
  prize_30k_count BIGINT,
  prize_50k_count BIGINT,
  prize_100k_count BIGINT,
  total_prize_value BIGINT,
  n8n_success_count BIGINT,
  n8n_failed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_spins,
    COUNT(*) FILTER (WHERE prize = 20000)::BIGINT as prize_20k_count,
    COUNT(*) FILTER (WHERE prize = 30000)::BIGINT as prize_30k_count,
    COUNT(*) FILTER (WHERE prize = 50000)::BIGINT as prize_50k_count,
    COUNT(*) FILTER (WHERE prize = 100000)::BIGINT as prize_100k_count,
    COALESCE(SUM(prize), 0)::BIGINT as total_prize_value,
    COUNT(*) FILTER (WHERE n8n_sent = TRUE)::BIGINT as n8n_success_count,
    COUNT(*) FILTER (WHERE n8n_sent = FALSE)::BIGINT as n8n_failed_count
  FROM lucky_wheel_spins
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_spin_statistics(TEXT) TO authenticated;

-- ============================================================================
-- FUNCTION: Cleanup old campaigns
-- Purpose: Archive or delete spins older than 90 days
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_spins(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM lucky_wheel_spins
  WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Update n8n_sent_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_n8n_sent_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.n8n_sent = TRUE AND OLD.n8n_sent = FALSE THEN
    NEW.n8n_sent_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_n8n_sent_timestamp
  BEFORE UPDATE ON lucky_wheel_spins
  FOR EACH ROW
  EXECUTE FUNCTION update_n8n_sent_timestamp();

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
