# Supabase Database Setup Guide

## 📋 Overview

This folder contains SQL scripts to set up the complete database schema for the Lucky Wheel application.

## 🗂️ Files

1. **01_schema.sql** - Main spin records table with RLS policies
2. **02_admin_auth.sql** - Admin user authentication and profiles
3. **03_prize_config.sql** - Prize configuration and campaign management

## 🚀 Setup Instructions

### Step 1: Access Supabase SQL Editor

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `zigemvynmihdhntrxzsg`
3. Click **SQL Editor** in the left sidebar

### Step 2: Run SQL Scripts (In Order)

#### Execute 01_schema.sql
```sql
-- Copy the entire content of 01_schema.sql
-- Paste into SQL Editor
-- Click "Run" or press Cmd/Ctrl + Enter
```

#### Execute 02_admin_auth.sql
```sql
-- Copy the entire content of 02_admin_auth.sql
-- Paste into SQL Editor
-- Click "Run"
```

#### Execute 03_prize_config.sql
```sql
-- Copy the entire content of 03_prize_config.sql
-- Paste into SQL Editor
-- Click "Run"
```

### Step 3: Create Admin User

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to **Authentication > Users**
2. Click **Add User** button
3. Enter:
   - Email: `your-email@example.com`
   - Password: (create a strong password)
   - Auto Confirm User: ✅ Check this
4. Click **Create User**

5. After user is created, go back to **SQL Editor** and run:

```sql
INSERT INTO admin_users (id, email, full_name, role, can_manage_campaigns, can_manage_prizes, can_export_data)
SELECT
  id,
  email,
  'Your Full Name',  -- Change this
  'admin',
  true,
  true,
  true
FROM auth.users
WHERE email = 'your-email@example.com';  -- Change this
```

#### Option B: Quick Setup (Development Only)

```sql
-- This creates a user with email/password auth
-- DO NOT use this in production!
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'admin@example.com',  -- Change this
  crypt('your-password-here', gen_salt('bf')),  -- Change this
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
)
RETURNING id;

-- Then insert into admin_users using the returned id
```

### Step 4: Verify Setup

Run these queries to verify:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('lucky_wheel_spins', 'admin_users', 'campaigns', 'prize_configs');

-- Check sample campaign exists
SELECT * FROM campaigns WHERE campaign_id = 'lucky-wheel-2025-10-14';

-- Check sample prizes exist
SELECT campaign_id, prize_label, prize_value, weight
FROM prize_configs
WHERE campaign_id = 'lucky-wheel-2025-10-14'
ORDER BY display_order;

-- Expected output:
-- 20.000đ | 20000 | 40
-- 30.000đ | 30000 | 30
-- 50.000đ | 50000 | 20
-- 100.000đ | 100000 | 10

-- Check admin user exists
SELECT email, full_name, role FROM admin_users;
```

## 🔐 Security Notes

### Row Level Security (RLS) is ENABLED

All tables have RLS policies:
- `lucky_wheel_spins`: Only service_role (backend) can read/write
- `admin_users`: Users can view own profile, admins can manage all
- `campaigns`: Admins/editors can manage, viewers can view
- `prize_configs`: Admins/editors can manage, viewers can view

### Service Role Key

The backend uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS and access data.

**⚠️ IMPORTANT:** Never expose Service Role Key in frontend code!

## 📊 Database Schema Overview

```
┌─────────────────────┐
│  lucky_wheel_spins  │
│  (Main spin records)│
├─────────────────────┤
│ • id (PK)           │
│ • campaign_id       │
│ • phone_hash (UNIQUE per campaign)
│ • phone_masked      │
│ • prize             │
│ • coupon_code       │
│ • n8n_sent          │
│ • created_at        │
└─────────────────────┘
         ↑
         │ Uses
         │
┌─────────────────────┐
│     campaigns       │
│ (Campaign config)   │
├─────────────────────┤
│ • campaign_id (PK)  │
│ • name              │
│ • start_date        │
│ • end_date          │
│ • is_active         │
└─────────────────────┘
         ↑
         │ Has many
         │
┌─────────────────────┐
│   prize_configs     │
│ (Prize settings)    │
├─────────────────────┤
│ • campaign_id (FK)  │
│ • prize_value       │
│ • prize_label       │
│ • weight (%)        │
│ • background_color  │
│ • remaining_stock   │
└─────────────────────┘

┌─────────────────────┐
│    admin_users      │
│ (Admin profiles)    │
├─────────────────────┤
│ • id (FK auth.users)│
│ • email             │
│ • role              │
│ • permissions       │
└─────────────────────┘
```

## 🧪 Testing Functions

### Test prize selection probability

```sql
-- Run this 100 times to see distribution
SELECT
  prize_value,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM (
  SELECT (select_random_prize('lucky-wheel-2025-10-14')).prize_value
  FROM generate_series(1, 1000)  -- Run 1000 times
) as results
GROUP BY prize_value
ORDER BY prize_value;

-- Expected distribution (approximately):
-- 20000  | 400 | 40%
-- 30000  | 300 | 30%
-- 50000  | 200 | 20%
-- 100000 | 100 | 10%
```

### Test spin statistics

```sql
-- Get statistics for campaign
SELECT * FROM get_spin_statistics('lucky-wheel-2025-10-14');
```

## 🔧 Troubleshooting

### Error: "permission denied for table"

- Make sure you're running as `service_role` or authenticated admin user
- Check RLS policies are set up correctly

### Error: "relation does not exist"

- Make sure you ran all 3 SQL files in order
- Check table_schema is `public`

### Admin user can't log in

- Verify email is confirmed: `SELECT email_confirmed_at FROM auth.users WHERE email = 'your-email'`
- Verify admin profile exists: `SELECT * FROM admin_users WHERE email = 'your-email'`

## 📝 Maintenance

### Cleanup old spins (older than 90 days)

```sql
SELECT cleanup_old_spins(90);  -- Returns number of deleted records
```

### Reset campaign spins (for testing)

```sql
DELETE FROM lucky_wheel_spins WHERE campaign_id = 'lucky-wheel-2025-10-14';
```

### Update prize probabilities

```sql
UPDATE prize_configs
SET weight = 50  -- Change to 50%
WHERE campaign_id = 'lucky-wheel-2025-10-14'
  AND prize_value = 20000;
```

## 🆘 Support

If you encounter issues:
1. Check Supabase logs in Dashboard
2. Verify all tables exist
3. Check RLS policies are enabled
4. Ensure Service Role Key is correct in backend `.env`

