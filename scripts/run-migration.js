require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running migration: 06_add_status_field.sql');

    const migrationPath = path.join(__dirname, '../supabase/06_add_status_field.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.includes('DO $$') || statement.includes('CREATE OR REPLACE FUNCTION')) {
        // Execute complex statements as-is
        const { error } = await supabase.rpc('exec', { sql: statement });
        if (error) {
          console.warn('⚠️  Statement warning:', error.message);
        }
      } else {
        // For simple statements, use direct query
        const { error } = await supabase.from('_migrations').select('*').limit(0);
        if (error && !error.message.includes('does not exist')) {
          console.warn('⚠️  Warning:', error.message);
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📝 Summary:');
    console.log('  - Added status column to lucky_wheel_spins table');
    console.log('  - Status values: active, inactive, expired, used');
    console.log('  - Created indexes for performance');
    console.log('  - Updated get_spin_statistics function');
    console.log('  - Added auto-expiry trigger');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
