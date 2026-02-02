#!/usr/bin/env node

/**
 * Local ticket assignment test script
 * This script sets up test data and tests the assignment functionality locally
 */

const { Client } = require('pg');

async function setupLocalTest() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'avian',
        user: 'avian',
        password: 'avian_dev_password'
    });

    try {
        await client.connect();
        console.log('✅ Connected to local database');

        // Create test user if not exists
        const userResult = await client.query(`
            INSERT INTO users (id, email, password_hash, name, role, tenant_id, email_verified, created_at, updated_at)
            VALUES (
                'test-user-123',
                'test@test.com',
                '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy',
                'Test User',
                'it_helpdesk_analyst',
                'test-tenant-123',
                true,
                NOW(),
                NOW()
            )
            ON CONFLICT (email) DO UPDATE SET
                password_hash = '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy',
                name = 'Test User',
                role = 'it_helpdesk_analyst'
            RETURNING id, email, name, role
        `);
        console.log('✅ Test user ready:', userResult.rows[0]);

        // Create test tickets
        const ticketResult = await client.query(`
            INSERT INTO tickets (id, tenant_id, requester, title, description, severity, priority, status, tags, category, created_at, updated_at)
            VALUES 
                ('test-ticket-1', 'test-tenant-123', 'user@company.com', 'Test Assignment Ticket 1', 'This is a test ticket for assignment', 'medium', 'medium', 'new', '[]', 'it_support', NOW(), NOW()),
                ('test-ticket-2', 'test-tenant-123', 'user2@company.com', 'Test Assignment Ticket 2', 'Another test ticket', 'high', 'high', 'new', '[]', 'hardware_issue', NOW(), NOW()),
                ('test-ticket-3', 'test-tenant-123', 'user3@company.com', 'Test Assignment Ticket 3', 'Third test ticket', 'low', 'low', 'new', '[]', 'general_request', NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                status = 'new',
                assignee = NULL,
                updated_at = NOW()
            RETURNING id, title, status, assignee
        `);
        console.log('✅ Test tickets created:', ticketResult.rows);

        // Test assignment
        console.log('\n🧪 Testing ticket assignment...');
        const assignResult = await client.query(`
            UPDATE tickets 
            SET assignee = $1, status = 'in_progress', updated_at = NOW() 
            WHERE id = $2 
            RETURNING id, title, status, assignee, updated_at
        `, ['test-user-123', 'test-ticket-1']);

        if (assignResult.rows.length > 0) {
            console.log('✅ Assignment successful:', assignResult.rows[0]);
        } else {
            console.log('❌ Assignment failed - no rows updated');
        }

        // Verify assignment
        const verifyResult = await client.query(`
            SELECT id, title, status, assignee, requester, created_at, updated_at
            FROM tickets 
            WHERE id = 'test-ticket-1'
        `);
        console.log('🔍 Verification:', verifyResult.rows[0]);

        console.log('\n📊 Current tickets status:');
        const allTickets = await client.query(`
            SELECT id, title, status, assignee, requester
            FROM tickets 
            WHERE tenant_id = 'test-tenant-123'
            ORDER BY created_at DESC
        `);
        console.table(allTickets.rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Details:', error);
    } finally {
        await client.end();
    }
}

// Run the test
setupLocalTest().catch(console.error);