#!/bin/bash

# Deploy Simple Ticket Assignment Fix
# Uses a simpler API endpoint without dynamic routes

echo "🔧 Deploying simple ticket assignment fix..."

# Create the assign directory on server
ssh avian@192.168.1.116 "mkdir -p /home/avian/avian-cybersecurity-platform-onprem/src/app/api/tickets/assign"

# Copy the simplified API endpoint
echo "📁 Copying simplified API endpoint..."
scp src/app/api/tickets/assign/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/tickets/assign/

# Copy the updated component
echo "📁 Copying updated component..."
scp src/components/help-desk/UnassignedTicketQueue.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/help-desk/

echo "✅ Files copied to server"
echo ""
echo "🚀 Simple restart (run on server):"
echo "ssh avian@192.168.1.116"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml restart app"
echo ""
echo "# Test the new API endpoint"
echo "curl -k 'https://localhost/api/tickets/assign' -X POST -H 'Content-Type: application/json' -d '{\"ticketId\":\"test\",\"assignee\":\"test\"}'"
echo ""
echo "🎯 Expected: Authentication error (not 404)"