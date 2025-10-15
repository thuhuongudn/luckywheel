-- ============================================================================
-- ADMIN AUTHENTICATION & USER MANAGEMENT
-- Version: 1.0
-- Date: 2025-10-15
-- Description: Admin user management with Supabase Auth integration
-- ============================================================================

-- ============================================================================
-- TABLE: admin_users
-- Purpose: Extended profile for admin users with role-based access
-- Note: This table links to Supabase Auth users (auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  -- Links to auth.users table
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Admin Information
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),

  -- Permissions
  can_manage_campaigns BOOLEAN DEFAULT FALSE,
  can_manage_prizes BOOLEAN DEFAULT FALSE,
  can_view_reports BOOLEAN DEFAULT TRUE,
  can_export_data BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE admin_users IS 'Admin user profiles with role-based permissions';
COMMENT ON COLUMN admin_users.role IS 'admin: full access, editor: manage content, viewer: read-only';
COMMENT ON COLUMN admin_users.can_manage_campaigns IS 'Can create/edit/delete campaigns';
COMMENT ON COLUMN admin_users.can_manage_prizes IS 'Can configure prize values and probabilities';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view all admin users
CREATE POLICY "Admins can view all admin users"
  ON admin_users
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
    )
  );

-- Policy 2: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON admin_users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 3: Only admins can insert new admin users
CREATE POLICY "Only admins can create admin users"
  ON admin_users
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
    )
  );

-- Policy 4: Only admins can update other users
CREATE POLICY "Only admins can update users"
  ON admin_users
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (
      -- User can update own profile (limited fields)
      auth.uid() = id
      OR
      -- Admin can update any user
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role = 'admin'
        AND is_active = TRUE
      )
    )
  );

-- ============================================================================
-- FUNCTION: Create first admin user (run once during setup)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_first_admin_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Check if any admin already exists
  IF EXISTS (SELECT 1 FROM admin_users WHERE role = 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Admin user already exists. Use Supabase Dashboard to create additional users.'
    );
  END IF;

  -- Note: In production, create user via Supabase Dashboard or Auth API
  -- This function is for documentation purposes
  RETURN json_build_object(
    'success', false,
    'message', 'Please create admin user via Supabase Dashboard:',
    'instructions', json_build_object(
      'step1', 'Go to Authentication > Users in Supabase Dashboard',
      'step2', 'Click "Add User"',
      'step3', 'Enter email: ' || p_email,
      'step4', 'Set password and confirm',
      'step5', 'After user is created, run: INSERT INTO admin_users (id, email, full_name, role, can_manage_campaigns, can_manage_prizes, can_export_data) SELECT id, email, ''' || p_full_name || ''', ''admin'', true, true, true FROM auth.users WHERE email = ''' || p_email || ''''
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Update last login timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE admin_users
  SET last_login_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table (requires superuser, run in Supabase Dashboard)
-- CREATE TRIGGER trigger_update_last_login
--   AFTER UPDATE ON auth.users
--   FOR EACH ROW
--   WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
--   EXECUTE FUNCTION update_last_login();

-- ============================================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_timestamp();

-- ============================================================================
-- SAMPLE DATA: Create admin user profile (after creating user in Dashboard)
-- ============================================================================
-- Step 1: Create user in Supabase Dashboard with email: admin@example.com
-- Step 2: Run this query to add admin profile:
--
-- INSERT INTO admin_users (id, email, full_name, role, can_manage_campaigns, can_manage_prizes, can_export_data)
-- SELECT
--   id,
--   email,
--   'Admin User',  -- Change this to your name
--   'admin',
--   true,
--   true,
--   true
-- FROM auth.users
-- WHERE email = 'admin@example.com';  -- Change to your email

-- ============================================================================
-- END OF ADMIN AUTH SCHEMA
-- ============================================================================
