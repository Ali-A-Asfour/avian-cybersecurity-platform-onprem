#!/usr/bin/env node

/**
 * Simple test script to verify API implementations
 * Run with: node test-api-implementation.js
 */

const { SonicWallAPIClient } = require('./src/lib/sonicwall/api-client');
const { EnvironmentGraphClient } = require('./src/lib/defender/graph-client');

async function testSonicWallAPI() {
  console.log('🔥 Testing SonicWall API Client...');
  
  try {
    // Test with dummy credentials (will fail but should not crash)
    const client = new SonicWallAPIClient({
      baseUrl: 'https://192.168.1.1',
      username: 'admin',
      password: 'password',
      timeout: 5000
    });

    console.log('✅ SonicWall API Client created successfully');
    
    // Test connection (expected to fail with dummy credentials)
    const connected = await client.testConnection();
    console.log(`🔗 Connection test result: ${connected ? 'SUCCESS' : 'FAILED (expected with dummy credentials)'}`);
    
  } catch (error) {
    console.log(`❌ SonicWall API test failed: ${error.message}`);
  }
}

async function testMicrosoftGraphAPI() {
  console.log('\n🛡️  Testing Microsoft Graph API Client...');
  
  try {
    // Test with environment variables (will fail if not configured)
    const client = new EnvironmentGraphClient();
    console.log('✅ Microsoft Graph API Client created successfully');
    
    // Test connection (expected to fail without proper credentials)
    const connected = await client.testConnection();
    console.log(`🔗 Connection test result: ${connected ? 'SUCCESS' : 'FAILED (expected without proper credentials)'}`);
    
  } catch (error) {
    console.log(`❌ Microsoft Graph API test failed: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting API Implementation Tests\n');
  
  await testSonicWallAPI();
  await testMicrosoftGraphAPI();
  
  console.log('\n✨ API Implementation Tests Complete');
  console.log('\nNext Steps:');
  console.log('1. Configure real SonicWall device credentials in environment');
  console.log('2. Configure Microsoft Azure App Registration credentials');
  console.log('3. Test with real devices and credentials');
  console.log('4. Set up database and run migrations');
  console.log('5. Test API endpoints with Postman or curl');
}

main().catch(console.error);