#!/bin/bash

echo "🧪 Testing ticket assignment locally..."

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 -U avian > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running locally"
    echo "Please start PostgreSQL and create the database:"
    echo "  createdb -h localhost -U avian avian"
    echo "  psql -h localhost -U avian -d avian -f complete_schema.sql"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Setup test data
echo "📊 Setting up test data..."
node test-assignment-local.js

# Start the development server in background
echo "🚀 Starting development server..."
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

# Test the assignment API
echo "🧪 Testing assignment API..."
curl -X POST http://localhost:3000/api/tickets/assign-simple \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"ticketId": "test-ticket-2", "assignee": "test-user-123"}' \
  -v

echo -e "\n\n🎯 Test complete!"
echo "You can now test the web interface at: http://localhost:3000"
echo "Login with: test@test.com / password"

# Keep server running
echo "Press Ctrl+C to stop the server..."
wait $SERVER_PID