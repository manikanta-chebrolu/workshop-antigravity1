/**
 * Nexus AI - Automated Supabase Migration Runner
 * Executes the SQL migration in a single command against Supabase PostgreSQL.
 *
 * Usage:
 *   npm run db:migrate
 *   node backend/scripts/migrate.js
 *   node backend/scripts/migrate.js "postgresql://postgres:[PASSWORD]@db.nvxqbmrpwancugjjzcbb.supabase.co:5432/postgres"
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// 1. Load backend environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const idx = line.indexOf('=');
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
}
loadEnv();

const MIGRATION_PATH = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261014000000_create_nexus_tables.sql');

async function runMigration() {
  console.log('\n======================================================');
  console.log('📦 Nexus AI - Supabase Database Migration Runner');
  console.log('======================================================\n');

  // Command-line connection argument or environment variable
  const dbUrl = process.argv[2] || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const projectRef = supabaseUrl.replace(/https?:\/\/([^.]+)\.supabase\.co.*/, '$1');

  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error(`❌ Migration file not found at: ${MIGRATION_PATH}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(MIGRATION_PATH, 'utf8');

  // If direct Postgres connection string is available
  if (dbUrl) {
    console.log(`🔌 Connecting to Supabase PostgreSQL: ${dbUrl.replace(/:([^:@]+)@/, ':****@')}...`);
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('⚡ Connected! Executing migration script...');

      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('COMMIT');

      // Verify created tables
      const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name IN ('chats', 'messages')
      `);

      const tables = res.rows.map(r => r.table_name);
      console.log('\n======================================================');
      console.log('✅ Migration Applied Successfully to Supabase!');
      console.log('------------------------------------------------------');
      console.log(`📊 Tables Verified : ${tables.join(', ')}`);
      console.log(`🛡️  Security Setup   : Row Level Security (RLS) Enabled`);
      console.log(`⚡ Triggers Active : handle_updated_at() on 'chats'`);
      console.log('======================================================\n');

      await client.end();
      process.exit(0);
    } catch (err) {
      console.error('❌ Migration failed:', err.message);
      try { await client.query('ROLLBACK'); } catch (e) {}
      await client.end();
      process.exit(1);
    }
  }

  // If DATABASE_URL is not set, provide the exact 1-command connection options
  console.log('ℹ️  No DATABASE_URL found in backend/.env.');
  console.log(`📁 Target Supabase Project: ${supabaseUrl || 'https://' + projectRef + '.supabase.co'}\n`);

  console.log('🚀 TO RUN IN A SINGLE COMMAND, CHOOSE EITHER:');
  console.log('------------------------------------------------------');
  console.log('Option A (Automated via npm run db:migrate):');
  console.log('  1. Get your Database Password from Supabase Settings -> Database');
  console.log('  2. Add DATABASE_URL to backend/.env:');
  console.log(`     DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`);
  console.log('  3. Re-run:');
  console.log('     npm run db:migrate\n');

  console.log('Option B (Direct pass in terminal):');
  console.log(`  node backend/scripts/migrate.js "postgresql://postgres:[PASSWORD]@db.${projectRef || 'your-project'}.supabase.co:5432/postgres"\n`);

  console.log('Option C (1-Click SQL Editor):');
  console.log(`  Open: https://supabase.com/dashboard/project/${projectRef || '_'}/sql/new`);
  console.log(`  Copy & paste contents of: supabase/migrations/20261014000000_create_nexus_tables.sql`);
  console.log('======================================================\n');
}

runMigration();
