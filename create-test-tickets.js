#!/usr/bin/env node

/**
 * Create real test tickets for assignment testing
 */

const { Client } = require('pg');

async function createTestTickets() {
    console.log('🎫 Creating test tickets for assignment...');
    
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

        // Get a tenant ID to use
        const tenantResult = await client.query('SELECT id FROM tenants LIMIT 1');
        const tenantId = tenantResult.rows[0]?.id;
        
        if (!tenantId) {
            console.log('❌ No tenant found, creating one...');
            await client.query(`
                INSERT INTO tenants (id, name, domain) 
                VALUES (gen_random_uuid(), 'Test Company', 'testcompany.com')
            `);
            const newTenantResult = await client.query('SELECT id FROM tenants WHERE domain = \'testcompany.com\'');
            tenantId = newTenantResult.rows[0].id;
        }

        console.log('📋 Using tenant ID:', tenantId);

        // Create multiple test tickets
        const tickets = [
            {
                title: 'Password Reset Request',
                description: 'User cannot access their account and needs password reset',
                severity: 'medium',
                priority: 'high',
                category: 'it_support',
                requester: 'john.doe@testcompany.com'
            },
            {
                title: 'Network Connectivity Issue',
                description: 'Unable to connect to company VPN from home office',
                severity: 'high',
                priority: 'high',
                category: 'network_issue',
                requester: 'jane.smith@testcompany.com'
            },
            {
                title: 'Software Installation Request',
                description: 'Need Adobe Creative Suite installed on workstation',
                severity: 'low',
                priority: 'medium',
                category: 'software_issue',
                requester: 'mike.wilson@testcompany.com'
            },
            {
                title: 'Email Not Working',
                description: 'Outlook keeps crashing when trying to send emails',
                severity: 'medium',
                priority: 'medium',
                category: 'it_support',
                requester: 'sarah.johnson@testcompany.com'
            },
            {
                title: 'Printer Setup Help',
                description: 'New printer installed but cannot print from laptop',
                severity: 'low',
                priority: 'low',
                category: 'hardware_issue',
                requester: 'david.brown@testcompany.com'
            },
            {
                title: 'Security Alert Investigation',
                description: 'Suspicious login attempts detected on user account',
                severity: 'critical',
                priority: 'urgent',
                category: 'security_incident',
                requester: 'security@testcompany.com'
            }
        ];

        console.log('📝 Creating tickets...');
        
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            const result = await client.query(`
                INSERT INTO tickets (
                    id, tenant_id, requester, title, description, 
                    severity, priority, status, category, tags,
                    contact_method, created_by
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'new', $7, '{}', 'email', $2
                ) RETURNING id, title
            `, [
                tenantId,
                ticket.requester,
                ticket.title,
                ticket.description,
                ticket.severity,
                ticket.priority,
                ticket.category
            ]);
            
            console.log(`✅ Created: ${result.rows[0].title} (ID: ${result.rows[0].id})`);
        }

        // Show all unassigned tickets
        console.log('\n📊 Current unassigned tickets:');
        const unassignedResult = await client.query(`
            SELECT id, title, severity, priority, status, requester
            FROM tickets 
            WHERE (assigned_to IS NULL OR assigned_to = '') 
            AND (assignee IS NULL OR assignee = '')
            AND status = 'new'
            ORDER BY 
                CASE priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                created_at ASC
            LIMIT 10
        `);
        
        console.table(unassignedResult.rows);
        
        console.log(`\n✅ Created ${tickets.length} test tickets!`);
        console.log('🎯 You can now test ticket assignment in the web interface');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

createTestTickets().catch(console.error);