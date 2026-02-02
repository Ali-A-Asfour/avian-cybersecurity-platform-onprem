#!/usr/bin/env node

/**
 * Simple test to verify ticket assignment works locally
 */

const { Client } = require('pg');

async function testAssignment() {
    console.log('🧪 Testing ticket assignment locally...');
    
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

        // Create a simple test ticket
        const ticketId = 'simple-test-' + Date.now();
        const userId = 'test-user-123';
        
        console.log(`📝 Creating test ticket: ${ticketId}`);
        await client.query(`
            INSERT INTO tickets (id, tenant_id, requester, title, description, severity, priority, status, tags, category)
            VALUES ($1, 'test-tenant-123', 'test@example.com', 'Simple Test Ticket', 'Testing assignment', 'medium', 'medium', 'new', '[]', 'it_support')
        `, [ticketId]);

        // Test the assignment query directly
        console.log(`🎯 Testing assignment query...`);
        const result = await client.query(`
            UPDATE tickets 
            SET assignee = $1, status = 'in_progress', updated_at = NOW() 
            WHERE id = $2 
            RETURNING id, title, status, assignee, updated_at
        `, [userId, ticketId]);

        if (result.rows.length > 0) {
            console.log('✅ Assignment successful!');
            console.log('Result:', result.rows[0]);
            
            // Verify the assignment
            const verify = await client.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
            console.log('🔍 Verification:', {
                id: verify.rows[0].id,
                title: verify.rows[0].title,
                status: verify.rows[0].status,
                assignee: verify.rows[0].assignee,
                updated_at: verify.rows[0].updated_at
            });
            
            console.log('\n✅ Database assignment works correctly!');
            console.log('The issue is likely in the API or authentication layer.');
            
        } else {
            console.log('❌ Assignment failed - no rows updated');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 PostgreSQL is not running or not accessible.');
            console.log('Please start PostgreSQL and run: ./setup-local-test.sh');
        }
    } finally {
        await client.end();
    }
}

testAssignment().catch(console.error);