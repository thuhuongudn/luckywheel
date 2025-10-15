/**
 * Supabase Client Configuration
 * Purpose: Initialize Supabase client with Service Role Key for backend operations
 */

const { createClient } = require('@supabase/supabase-js');

// Validate environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

/**
 * Create Supabase client with Service Role Key
 * This bypasses Row Level Security (RLS) and has full database access
 * ⚠️ NEVER expose this client to frontend!
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

// Test connection on startup
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('campaign_id')
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection test failed:', error.message);
      console.error('   Make sure you have run the SQL setup scripts!');
      return false;
    }

    console.log('✅ Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
    return false;
  }
}

module.exports = {
  supabase,
  testConnection
};
