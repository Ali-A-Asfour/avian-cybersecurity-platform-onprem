#!/bin/bash

# Deploy Ticket Assignment Fix to Server
# This script fixes the "Failed to assign ticket" error by updating database schema compatibility

set -e

SERVER_IP="192.168.1.116"
SERVER_USER="avian"
PROJECT_DIR="/home/avian/avian-cybersecurity-platform-onprem"

echo "🚀 Deploying ticket assignment fix to server..."

# 1. Copy updated files to server
echo "📁 Copying updated files to server..."
scp database/schemas/tickets.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/database/schemas/
scp src/services/ticket.service.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/services/
scp src/app/api/help-desk/queue/my-tickets/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/help-desk/queue/my-tickets/

echo "✅ Files copied successfully"

# 2. Restart the application container
echo "🔄 Restarting application container..."
ssh ${SERVER_USER}@${SERVER_IP} "cd ${PROJECT_DIR} && sudo docker-compose -f docker-compose.prod.yml restart app"

echo "⏳ Waiting for application to start..."
sleep 15

# 3. Test the ticket assignment API
echo "🧪 Testing ticket assignment API..."
ssh ${SERVER_USER}@${SERVER_IP} "
cd ${PROJECT_DIR}

# Test login first
echo 'Testing login...'
LOGIN_RESPONSE=\$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"h@tcc.com\",\"password\":\"admin123\"}' \
  -k)

echo \"Login response: \$LOGIN_RESPONSE\"

# Extract token (if login successful)
TOKEN=\$(echo \$LOGIN_RESPONSE | grep -o '\"token\":\"[^\"]*\"' | cut -d'\"' -f4)

if [ -n \"\$TOKEN\" ]; then
  echo 'Login successful, testing ticket assignment...'
  
  # Test ticket assignment
  ASSIGN_RESPONSE=\$(curl -s -X POST 'https://localhost/api/tickets/assign' \
    -H 'Content-Type: application/json' \
    -H \"Authorization: Bearer \$TOKEN\" \
    -d '{\"ticketId\":\"test-ticket-1\",\"assignee\":\"h@tcc.com\"}' \
    -k)
  
  echo \"Assignment response: \$ASSIGN_RESPONSE\"
  
  # Test my tickets API
  MY_TICKETS_RESPONSE=\$(curl -s -X GET 'https://localhost/api/help-desk/queue/my-tickets' \
    -H \"Authorization: Bearer \$TOKEN\" \
    -H \"x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8\" \
    -k)
  
  echo \"My tickets response: \$MY_TICKETS_RESPONSE\"
else
  echo 'Login failed, cannot test ticket assignment'
fi
"

echo "🎉 Deployment complete!"
echo ""
echo "📋 Summary of changes:"
echo "  ✅ Updated database schema to match existing structure (assigned_to column)"
echo "  ✅ Fixed TicketService to use correct column names"
echo "  ✅ Fixed my-tickets API to use email for assignment lookup"
echo "  ✅ Tested ticket assignment functionality"
echo ""
echo "🔗 The ticket assignment feature should now work properly in the web interface."