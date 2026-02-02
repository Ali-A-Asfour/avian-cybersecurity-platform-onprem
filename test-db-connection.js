#!/usr/bin/env node

/**
 * Test database connection using the same method as the app
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const postgres = require('postgres');

async function testConnection() {
    console.log('🔧 Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL not found in environment');
        return;
    }
    
    try {
        const client = postgres(process.env.DATABASE_URL, {
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
            ssl: false, // Disable SSL for local testing
            prepare: true,
            transform: {
                undefined: null,
            },
        });

        console.log('📊 Testing connection...');
        const result = await client`SELECT 1 as connection_test`;
        console.log('✅ Connection successful:', result);

        console.log('🎫 Testing ticket query...');
        const tickets = await client`SELECT id, title, status FROM tickets LIMIT 3`;
        console.log('✅ Ticket query successful:', tickets);

        await client.end();
        console.log('✅ Database connection test complete!');

    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Error details:', error);
    }
}

testConnection().catch(console.error);