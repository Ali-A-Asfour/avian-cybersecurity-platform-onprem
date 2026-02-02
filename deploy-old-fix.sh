#!/bin/bash

# Deploy Old Fix - File-Based Ticket Store Approach
# This applies the exact fix that was documented in the deployment troubleshooting log

SERVER_IP="192.168.1.116"
SERVER_USER="avian"

echo "🚀 Deploying OLD FIX - File-based ticket store approach..."

# Copy the fixed files to server
echo "📁 Copying My Tickets API (file-based)..."
scp src/app/api/help-desk/queue/my-tickets/route.ts $SERVER_USER@$SERVER_IP:~/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/

echo "📁 Copying Assignment API (file-based)..."
scp src/app/api/tickets/assign-simple/route.ts $SERVER_USER@$SERVER_IP:~/avian-cybersecurity-platform-onprem/src/app/api/tickets/

echo "📁 Copying Ticket Store (with file persistence)..."
scp src/lib/ticket-store.ts $SERVER_USER@$SERVER_IP:~/avian-cybersecurity-platform-onprem/src/lib/

# Execute the deployment on the server
echo "🔧 Executing deployment on server..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
    cd ~/avian-cybersecurity-platform-onprem
    
    echo "🔄 Rebuilding and restarting application..."
    sudo docker-compose -f docker-compose.prod.yml down
    sudo docker-compose -f docker-compose.prod.yml build --no-cache app
    sudo docker-compose -f docker-compose.prod.yml up -d
    
    echo "⏳ Waiting for services to start..."
    sleep 15
    
    echo "🏥 Checking service health..."
    sudo docker-compose -f docker-compose.prod.yml ps
EOF

echo "✅ Old fix deployment completed!"
echo ""
echo "🧪 To test the fix:"
echo "1. Login to https://192.168.1.116 with h@tcc.com / 12345678"
echo "2. Create a test ticket"
echo "3. Go to Help Desk → Unassigned Tickets"
echo "4. Click 'Assign to me' on a ticket"
echo "5. Go to Help Desk → My Tickets"
echo "6. Verify the assigned ticket appears"
echo ""
echo "📋 What this fix does:"
echo "- Uses file-based ticket store (.tickets-store.json) for persistence"
echo "- Fixes My Tickets API to show assigned tickets for analysts"
echo "- Fixes assignment API to use file-based storage"
echo "- Allows cross-tenant users to see tickets from all tenants"