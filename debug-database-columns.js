// Debug Database Columns
// This script will help us see exactly what's happening with the database schema

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

async function debugDatabase() {
  try {
    // Connect to database
    const connectionString = process.env.DATABASE_URL || 'postgresql://avian:avian_dev_password@localhost:5432/avian?sslmode=disable';
    const sql = postgres(connectionString);
    const db = drizzle(sql);

    console.log('🔍 Checking database schema...');
    
    // Check actual column names in the database
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND (column_name LIKE '%mfa%' OR column_name LIKE '%ma_%')
      ORDER BY column_name;
    `;
    
    console.log('📋 MFA-related columns in users table:');
    result.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Check if we can describe the users table structure
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📋 Full users table structure:');
    tableInfo.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    await sql.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugDatabase();