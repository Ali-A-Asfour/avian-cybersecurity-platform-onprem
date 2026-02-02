#!/usr/bin/env node

/**
 * Test ticket assignment with the actual local database schema
 */

const { Client } = require('pg');

async function testLocalAssignment() {
    console.log('🧪 Testing ticket assignment with local schema...');
    
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'avian',
        user: 'avian',
        password: 'avian_dev_password'
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Create a test user first
        console.log('👤 Creating test user...');
        const userResult = await client.query(`
            INSERT INTO users (tenant_id, email, first_name, last_name, role, password_hash, email_verified)
            VALUES ((SELECT id FROM tenants WHERE domain = 'test.com' LIMIT 1), 'test@test.com', 'Test', 'User', 'analyst', '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy', true)
            ON CONFLICT (email) DO UPDATE SET
                password_hash = '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy'
            RETURNING id, email
        `);
        
        const userId = userResult.rows[0]?.id || (await client.query("SELECT id FROM users WHERE email = 'test@test.com'")).rows[0]?.id;
        console.log('✅ Test user ready:', userId);

        // Create a test ticket with the correct schema
        const ticketId = 'test-assignment-' + Date.now();
        console.log(`📝 Creating test ticket: ${ticketId}`);
        
        await client.query(`
            INSERT INTO tickets (
                id, title, description, severity, contact_method, status, priority,
                created_by, tenant_id, category, requester, tags
            ) VALUES (
                $1, 'Test Assignment Ticket', 'Testing local assignment', 'medium', 'email', 'new', 'medium',
                $2, (SELECT id FROM tenants WHERE domain = 'test.com' LIMIT 1), 'it_support', 'test@example.com', '{}'
            )
        `, [ticketId, userId]);

        console.log('✅ Test ticket created');

        // Test assignment using the correct column name (assigned_to)
        console.log('🎯 Testing assignment...');
        const result = await client.query(`
            UPDATE tickets 
            SET assigned_to = $1, status = 'in_progress', updated_at = NOW() 
            WHERE id = $2 
            RETURNING id, title, status, assigned_to, updated_at
        `, [userId, ticketId]);

        if (result.rows.length > 0) {
            console.log('✅ Assignment successful!');
            console.log('Result:', result.rows[0]);
            
            // Test assignment using assignee column (if it exists)
            console.log('🔄 Testing with assignee column...');
            const result2 = await client.query(`
                UPDATE tickets 
                SET assignee = $1, status = 'in_progress', updated_at = NOW() 
                WHERE id = $2 
                RETURNING id, title, status, assignee, assigned_to, updated_at
            `, [userId, ticketId]);
            
            if (result2.rows.length > 0) {
                console.log('✅ Assignee column also works!');
                console.log('Result:', result2.rows[0]);
            }
            
        } else {
            console.log('❌ Assignment failed - no rows updated');
        }

        // Show current tickets
        console.log('\n📊 Current tickets:');
        const allTickets = await client.query(`
            SELECT id, title, status, assigned_to, assignee, requester, created_at
            FROM tickets 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.table(allTickets.rows);

        console.log('\n✅ Local database assignment test complete!');
        console.log('📋 Schema info:');
        console.log('- Uses assigned_to AND assignee columns');
        console.log('- Uses text[] for tags (not jsonb)');
        console.log('- Uses varchar IDs (not UUIDs)');
        console.log('- Uses varchar enums with check constraints');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 PostgreSQL is not running or not accessible.');
            console.log('Please start PostgreSQL first.');
        }
    } finally {
        await client.end();
    }
}

testLocalAssignment().catch(console.error);