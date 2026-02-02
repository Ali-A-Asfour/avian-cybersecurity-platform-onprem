#!/bin/bash

echo "🔧 Debugging ticket assignment issue..."

# Step 1: Test database connection
echo "1️⃣ Testing database connection..."
node test-assignment-simple.js

echo -e "\n2️⃣ Starting development server..."
# Start the development server in background
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

echo -e "\n3️⃣ Testing API endpoints..."

# Test the test endpoint first (no auth)
echo "🧪 Testing /api/test-assignment (no auth required)..."
curl -X GET http://localhost:3000/api/test-assignment \
  -H "Content-Type: application/json" \
  -s | jq '.' || echo "Failed to get test tickets"

echo -e "\n🎯 Testing assignment via test endpoint..."
curl -X POST http://localhost:3000/api/test-assignment \
  -H "Content-Type: application/json" \
  -d '{"ticketId": "test-ticket-1", "assignee": "test-user-123"}' \
  -s | jq '.' || echo "Failed to assign via test endpoint"

echo -e "\n🔐 Testing assignment via main endpoint (with auth)..."
curl -X POST http://localhost:3000/api/tickets/assign-simple \
  -H "Content-Type: application/json" \
  -d '{"ticketId": "test-ticket-2", "assignee": "test-user-123"}' \
  -s | jq '.' || echo "Failed to assign via main endpoint"

echo -e "\n4️⃣ Checking database after tests..."
node -e "
const { Client } = require('pg');
const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'avian',
    user: 'avian',
    password: 'avian_dev_password'
});

client.connect().then(() => {
    return client.query('SELECT id, title, status, assignee FROM tickets ORDER BY updated_at DESC LIMIT 5');
}).then(result => {
    console.log('📊 Current ticket status:');
    console.table(result.rows);
    client.end();
}).catch(err => {
    console.error('Database error:', err.message);
    client.end();
});
"

echo -e "\n✅ Debug complete!"
echo "🌐 You can now test the web interface at: http://localhost:3000"
echo "📧 Login with: test@test.com / password"
echo ""
echo "Press Ctrl+C to stop the server..."
wait $SERVER_PID