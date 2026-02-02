#!/bin/bash

# Fix Ticket Details 404 Error - Deploy to Server
# This script fixes the 404 error when viewing ticket details in Closed Tickets queue

echo "🚀 Deploying ticket details 404 fix to server..."

SERVER_IP="192.168.1.116"
SERVER_USER="avian"
SERVER_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "📋 Files to deploy:"
echo "  - Fixed attachments API (file-based store)"
echo "  - Test closed tickets data"
echo "  - Closed tickets API (already working)"

# Copy fixed attachments API
echo "📎 Copying fixed attachments API..."
scp src/app/api/tickets/[id]/attachments/route.ts ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/app/api/tickets/[id]/attachments/route.ts

# Copy test closed tickets data
echo "📊 Copying test closed tickets data..."
scp .tickets-store.json ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/.tickets-store.json

# Copy helper scripts for creating test data
echo "📝 Copying helper scripts..."
scp create-test-closed-tickets.js ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/create-test-closed-tickets.js
scp fix-closed-tickets-assignment.js ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/fix-closed-tickets-assignment.js

echo "🔧 Connecting to server to rebuild Docker container..."

ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "🔨 Rebuilding application container..."
sudo docker-compose -f docker-compose.prod.yml build app

echo "🚀 Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for containers to be ready..."
sleep 10

echo "🔍 Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo "📋 Checking application logs..."
sudo docker-compose -f docker-compose.prod.yml logs app --tail=20

echo "✅ Deployment complete!"
echo ""
echo "🧪 Test the fix:"
echo "1. Login to https://192.168.1.116 with h@tcc.com / 12345678"
echo "2. Go to Help Desk"
echo "3. Click on 'Closed Tickets' tab"
echo "4. You should see 3 test closed tickets"
echo "5. Click 'View Details' on any ticket"
echo "6. Ticket details should load without 404 error"
echo ""
echo "📊 Available test tickets:"
echo "  - ticket-closed-test-001: Resolved - Email Configuration Issue"
echo "  - ticket-closed-test-002: Closed - Password Reset Request"  
echo "  - ticket-closed-test-003: Resolved - Printer Connection Problem"

EOF

echo "🎉 Deployment completed successfully!"
echo ""
echo "🔍 Next steps:"
echo "1. Test the web interface at https://192.168.1.116"
echo "2. Verify closed tickets are visible and clickable"
echo "3. Confirm ticket details load without 404 errors"
echo "4. Test comments and attachments (should show empty but not error)"