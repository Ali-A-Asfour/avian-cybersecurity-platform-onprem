// Test Database-based Ticket Assignment
const fetch = require('node-fetch');

async function testDatabaseTicketAssignment() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('🧪 Testing Database-based Ticket Assignment...\n');
    
    // Step 1: Test login to get a token
    console.log('1. Testing login...');
    try {
        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@avian.local',
                password: 'admin123'
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('   Login response:', loginData.success ? '✅ Success' : '❌ Failed');
        
        if (!loginData.success) {
            console.log('   Error:', loginData.error);
            return;
        }
        
        const token = loginData.token;
        console.log('   Token received:', token ? '✅ Yes' : '❌ No');
        
        // Step 2: Test unassigned tickets API
        console.log('\n2. Testing unassigned tickets API...');
        const unassignedResponse = await fetch(`${baseUrl}/api/help-desk/queue/unassigned`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'x-selected-tenant-id': '1f9656a9-1d4a-4ebf-94db-45427789ba24' // Default tenant
            }
        });
        
        const unassignedData = await unassignedResponse.json();
        console.log('   Unassigned tickets response:', unassignedData.success ? '✅ Success' : '❌ Failed');
        console.log('   Tickets found:', unassignedData.data?.tickets?.length || 0);
        
        if (unassignedData.data?.tickets?.length > 0) {
            const testTicket = unassignedData.data.tickets[0];
            console.log('   Test ticket ID:', testTicket.id);
            
            // Step 3: Test ticket assignment with database
            console.log('\n3. Testing ticket assignment with database...');
            const assignResponse = await fetch(`${baseUrl}/api/tickets/assign`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-selected-tenant-id': '1f9656a9-1d4a-4ebf-94db-45427789ba24'
                },
                body: JSON.stringify({
                    ticketId: testTicket.id,
                    assignee: 'c8dc5000-5240-41be-b0d0-d1ae6d71f852' // admin user ID
                })
            });
            
            const assignData = await assignResponse.json();
            console.log('   Assignment response:', assignData.success ? '✅ Success' : '❌ Failed');
            
            if (assignData.success) {
                console.log('   ✅ Ticket assigned successfully!');
                console.log('   📋 New status:', assignData.data.ticket.status);
                console.log('   👤 Assigned to:', assignData.data.ticket.assigned_to);
                
                // Step 4: Test my tickets API
                console.log('\n4. Testing my tickets API...');
                const myTicketsResponse = await fetch(`${baseUrl}/api/help-desk/queue/my-tickets`, {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'x-selected-tenant-id': '1f9656a9-1d4a-4ebf-94db-45427789ba24'
                    }
                });
                
                const myTicketsData = await myTicketsResponse.json();
                console.log('   My tickets response:', myTicketsData.success ? '✅ Success' : '❌ Failed');
                console.log('   My tickets found:', myTicketsData.data?.tickets?.length || 0);
                
                // Check if our assigned ticket appears in my tickets
                const assignedTicket = myTicketsData.data?.tickets?.find(t => t.id === testTicket.id);
                console.log('   Assigned ticket in my tickets:', assignedTicket ? '✅ Yes' : '❌ No');
                
            } else {
                console.log('   ❌ Assignment failed:', assignData.error);
            }
        } else {
            console.log('   ⚠️ No unassigned tickets found to test with');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testDatabaseTicketAssignment();