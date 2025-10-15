-- ============================================================================
-- PRIZE CONFIGURATION & CAMPAIGN MANAGEMENT
-- Version: 1.0
-- Date: 2025-10-15
-- Description: Dynamic prize configuration for admin management
-- ============================================================================

-- ============================================================================
-- TABLE: campaigns
-- Purpose: Manage multiple campaigns with different prize configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  -- Primary Key
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id TEXT NOT NULL UNIQUE,  -- Human-readable ID (e.g., 'lucky-wheel-2025-10-14')

  -- Campaign Information
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  -- Configuration
  max_spins_per_phone INTEGER DEFAULT 1,
  require_name BOOLEAN DEFAULT TRUE,
  require_phone BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CHECK (end_date > start_date)
);

-- ============================================================================
-- TABLE: prize_configs
-- Purpose: Configure prizes with probabilities for each campaign
-- ============================================================================
CREATE TABLE IF NOT EXISTS prize_configs (
  -- Primary Key
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Links to campaign
  campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,

  -- Prize Information
  prize_value INTEGER NOT NULL CHECK (prize_value > 0),
  prize_label TEXT NOT NULL,           -- Display label (e.g., "20.000đ")
  prize_description TEXT,              -- Optional description

  -- Visual Configuration
  background_color TEXT DEFAULT '#ffb8b8',
  font_size TEXT DEFAULT '18px',
  font_color TEXT DEFAULT '#333333',

  -- Probability Configuration (Weight-based)
  weight INTEGER NOT NULL DEFAULT 100 CHECK (weight > 0),
  -- Higher weight = higher probability
  -- Example: Prize A (weight=50), Prize B (weight=30), Prize C (weight=20)
  --          → Probability: A=50%, B=30%, C=20%

  -- Stock Management (Optional)
  total_stock INTEGER,                 -- Total number of this prize available
  remaining_stock INTEGER,             -- Remaining prizes
  is_unlimited BOOLEAN DEFAULT TRUE,   -- If TRUE, ignore stock limits

  -- Display Order
  display_order INTEGER DEFAULT 0,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CHECK (
    (is_unlimited = TRUE AND remaining_stock IS NULL AND total_stock IS NULL)
    OR
    (is_unlimited = FALSE AND remaining_stock IS NOT NULL AND total_stock IS NOT NULL AND remaining_stock <= total_stock)
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_id ON campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_prize_configs_campaign ON prize_configs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_prize_configs_active ON prize_configs(is_active);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE campaigns IS 'Campaign management with date ranges and configuration';
COMMENT ON TABLE prize_configs IS 'Prize configuration with weight-based probability';
COMMENT ON COLUMN prize_configs.weight IS 'Probability weight. Higher weight = higher chance. Sum of all weights = 100%';
COMMENT ON COLUMN prize_configs.remaining_stock IS 'Decremented after each spin. NULL if is_unlimited=TRUE';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_configs ENABLE ROW LEVEL SECURITY;

-- Campaigns: Service role + Admins can manage
CREATE POLICY "Service role full access campaigns"
  ON campaigns FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage campaigns"
  ON campaigns FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid()
      AND (role = 'admin' OR (role = 'editor' AND can_manage_campaigns = TRUE))
      AND is_active = TRUE
    )
  );

CREATE POLICY "Viewers can view campaigns"
  ON campaigns FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid()
      AND is_active = TRUE
    )
  );

-- Prize Configs: Service role + Admins can manage
CREATE POLICY "Service role full access prize_configs"
  ON prize_configs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage prize configs"
  ON prize_configs FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid()
      AND (role = 'admin' OR (role = 'editor' AND can_manage_prizes = TRUE))
      AND is_active = TRUE
    )
  );

CREATE POLICY "Viewers can view prize configs"
  ON prize_configs FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid()
      AND is_active = TRUE
    )
  );

-- ============================================================================
-- FUNCTION: Get active prize configuration for frontend
-- ============================================================================
CREATE OR REPLACE FUNCTION get_active_prizes(p_campaign_id TEXT)
RETURNS TABLE (
  prize_value INTEGER,
  prize_label TEXT,
  background_color TEXT,
  font_size TEXT,
  font_color TEXT,
  weight INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.prize_value,
    pc.prize_label,
    pc.background_color,
    pc.font_size,
    pc.font_color,
    pc.weight
  FROM prize_configs pc
  JOIN campaigns c ON c.campaign_id = pc.campaign_id
  WHERE pc.campaign_id = p_campaign_id
    AND pc.is_active = TRUE
    AND c.is_active = TRUE
    AND NOW() BETWEEN c.start_date AND c.end_date
    AND (pc.is_unlimited = TRUE OR pc.remaining_stock > 0)
  ORDER BY pc.display_order, pc.prize_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role (backend will call this)
GRANT EXECUTE ON FUNCTION get_active_prizes(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_active_prizes(TEXT) TO authenticated;

-- ============================================================================
-- FUNCTION: Select random prize based on weight
-- ============================================================================
CREATE OR REPLACE FUNCTION select_random_prize(p_campaign_id TEXT)
RETURNS TABLE (
  prize_id UUID,
  prize_value INTEGER,
  prize_label TEXT
) AS $$
DECLARE
  v_total_weight INTEGER;
  v_random_number INTEGER;
  v_cumulative_weight INTEGER := 0;
  v_result RECORD;
BEGIN
  -- Calculate total weight of all active prizes
  SELECT COALESCE(SUM(weight), 0) INTO v_total_weight
  FROM prize_configs pc
  JOIN campaigns c ON c.campaign_id = pc.campaign_id
  WHERE pc.campaign_id = p_campaign_id
    AND pc.is_active = TRUE
    AND c.is_active = TRUE
    AND NOW() BETWEEN c.start_date AND c.end_date
    AND (pc.is_unlimited = TRUE OR pc.remaining_stock > 0);

  -- If no prizes available, return NULL
  IF v_total_weight = 0 THEN
    RETURN;
  END IF;

  -- Generate random number between 1 and total_weight
  v_random_number := floor(random() * v_total_weight)::INTEGER + 1;

  -- Select prize based on cumulative weight
  FOR v_result IN
    SELECT
      pc.id,
      pc.prize_value,
      pc.prize_label,
      pc.weight
    FROM prize_configs pc
    JOIN campaigns c ON c.campaign_id = pc.campaign_id
    WHERE pc.campaign_id = p_campaign_id
      AND pc.is_active = TRUE
      AND c.is_active = TRUE
      AND NOW() BETWEEN c.start_date AND c.end_date
      AND (pc.is_unlimited = TRUE OR pc.remaining_stock > 0)
    ORDER BY pc.display_order, pc.prize_value
  LOOP
    v_cumulative_weight := v_cumulative_weight + v_result.weight;

    IF v_random_number <= v_cumulative_weight THEN
      -- Decrement stock if not unlimited
      UPDATE prize_configs
      SET remaining_stock = remaining_stock - 1
      WHERE id = v_result.id
        AND is_unlimited = FALSE;

      RETURN QUERY SELECT v_result.id, v_result.prize_value, v_result.prize_label;
      RETURN;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION select_random_prize(TEXT) TO service_role;

-- ============================================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================================
CREATE TRIGGER trigger_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_prize_configs_updated_at
  BEFORE UPDATE ON prize_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_timestamp();

-- ============================================================================
-- SAMPLE DATA: Default campaign and prizes
-- ============================================================================
INSERT INTO campaigns (campaign_id, name, description, start_date, end_date, is_active, max_spins_per_phone)
VALUES (
  'lucky-wheel-2025-10-14',
  'Lucky Wheel October 2025',
  'Vòng quay may mắn tháng 10/2025',
  '2025-10-01 00:00:00+07',
  '2025-10-31 23:59:59+07',
  TRUE,
  1
) ON CONFLICT (campaign_id) DO NOTHING;

-- Insert default prizes with probability distribution
INSERT INTO prize_configs (campaign_id, prize_value, prize_label, background_color, weight, display_order, is_unlimited)
VALUES
  ('lucky-wheel-2025-10-14', 20000, '20.000đ', '#ffb8b8', 40, 1, TRUE),  -- 40% chance
  ('lucky-wheel-2025-10-14', 30000, '30.000đ', '#ffd88d', 30, 2, TRUE),  -- 30% chance
  ('lucky-wheel-2025-10-14', 50000, '50.000đ', '#b8e6b8', 20, 3, TRUE),  -- 20% chance
  ('lucky-wheel-2025-10-14', 100000, '100.000đ', '#ffc6ff', 10, 4, TRUE) -- 10% chance
ON CONFLICT DO NOTHING;

-- ============================================================================
-- END OF PRIZE CONFIG SCHEMA
-- ============================================================================
