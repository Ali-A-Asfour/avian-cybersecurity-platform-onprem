#!/usr/bin/env node

/**
 * Test the TicketService directly to see what's happening
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testTicketService() {
    console.log('🧪 Testing TicketService...');
    
    try {
        // Import the TicketService (this will be tricky since it's TypeScript)
        // Let's test the database query directly instead
        
        const postgres = require('postgres');
        const client = postgres(process.env.DATABASE_URL, {
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
            ssl: false,
            prepare: true,
            transform: {
                undefined: null,
            },
        });

        console.log('📊 Testing unassigned tickets query...');
        
        const result = await client`
          SELECT id, title, status, assigned_to, assignee, tenant_id, created_at
          FROM tickets 
          WHERE (assigned_to IS NULL OR assigned_to = '') 
          AND (assignee IS NULL OR assignee = '')
          AND status = 'new'
          ORDER BY created_at ASC
          LIMIT 10
        `;
        
        console.log(`✅ Found ${result.length} unassigned tickets:`);
        console.table(result);
        
        await client.end();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTicketService().catch(console.error);