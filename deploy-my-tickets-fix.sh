#!/bin/bash

# Deploy My Tickets Fix to Server
# Fixes the getTicketsByUser method to use correct database columns

SERVER_IP="192.168.1.116"
SERVER_USER="avian"

echo "🚀 Deploying My Tickets fix to server..."

# Copy the fixed files to server
echo "📁 Copying fixed ticket service..."
scp src/services/ticket.service.ts $SERVER_USER@$SERVER_IP:~/avian-cybersecurity-platform-onprem/src/services/

echo "📁 Copying fixed My Tickets API..."
scp src/app/api/help-desk/queue/my-tickets/route.ts $SERVER_USER@$SERVER_IP:~/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/

# Execute the deployment on the server
echo "🔧 Executing fixes on server..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
    cd ~/avian-cybersecurity-platform-onprem
    
    echo "🔄 Rebuilding and restarting application..."
    sudo docker-compose -f docker-compose.prod.yml build --no-cache app
    sudo docker-compose -f docker-compose.prod.yml up -d
    
    echo "⏳ Waiting for services to start..."
    sleep 10
    
    echo "🏥 Checking service health..."
    sudo docker-compose -f docker-compose.prod.yml ps
    
    echo "📋 Checking application logs..."
    sudo docker-compose -f docker-compose.prod.yml logs app | tail -5
EOF

echo "✅ My Tickets fix deployment completed!"
echo ""
echo "🧪 To test the fix:"
echo "1. Login to https://192.168.1.116 with h@tcc.com / 12345678"
echo "2. Go to Help Desk → My Tickets"
echo "3. Verify that assigned tickets are now showing"
echo "4. Try assigning a new ticket from Unassigned queue"
echo "5. Verify it appears in My Tickets"