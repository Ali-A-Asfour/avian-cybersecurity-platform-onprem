// Test User Creation with Raw SQL
// This will help us bypass any ORM issues and test direct database insertion

const postgres = require('postgres');
const bcrypt = require('bcryptjs');

async function testUserCreation() {
  try {
    // Connect to server database
    const sql = postgres('postgresql://avian:avian_password@192.168.1.116:5432/avian?sslmode=disable');
    
    console.log('🔍 Testing user creation on server...');
    
    // First, check what columns exist
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY column_name;
    `;
    
    console.log('📋 Available columns:');
    columns.forEach(col => console.log(`  - ${col.column_name}`));
    
    // Hash password
    const passwordHash = await bcrypt.hash('admin123', 12);
    
    // Try to insert a user with minimal required fields
    console.log('\n🧪 Attempting to insert test user...');
    
    const result = await sql`
      INSERT INTO users (
        tenant_id, 
        email, 
        first_name, 
        last_name, 
        role, 
        password_hash,
        email_verified,
        is_active
      ) VALUES (
        '85cfd918-8558-4baa-9534-25454aea76a8',
        'test.raw.sql@test.com',
        'Test',
        'User',
        'security_analyst',
        ${passwordHash},
        true,
        true
      ) RETURNING id, email, role;
    `;
    
    console.log('✅ User created successfully:', result[0]);
    
    await sql.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testUserCreation();