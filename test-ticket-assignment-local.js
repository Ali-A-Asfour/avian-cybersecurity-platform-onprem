// Test Ticket Assignment Locally
const fetch = require('node-fetch');

async function testTicketAssignment() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('🧪 Testing Ticket Assignment Flow Locally...\n');
    
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
        
        // Step 2: Test ticket assignment with token
        console.log('\n2. Testing ticket assignment...');
        const assignResponse = await fetch(`${baseUrl}/api/tickets/assign`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ticketId: 'ticket-1769537116736-z2jn4c84v',
                assignee: 'c8dc5000-5240-41be-b0d0-d1ae6d71f852' // admin user ID
            })
        });
        
        const assignData = await assignResponse.json();
        console.log('   Assignment response:', assignData.success ? '✅ Success' : '❌ Failed');
        console.log('   Full response:', JSON.stringify(assignData, null, 2));
        
        // Step 3: Test without token (should fail)
        console.log('\n3. Testing without token (should fail)...');
        const noTokenResponse = await fetch(`${baseUrl}/api/tickets/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketId: 'ticket-1769537116736-z2jn4c84v',
                assignee: 'test-user'
            })
        });
        
        const noTokenData = await noTokenResponse.json();
        console.log('   No token response:', noTokenData.success ? '❌ Unexpected success' : '✅ Correctly failed');
        console.log('   Error:', noTokenData.error?.message);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testTicketAssignment();