#!/bin/bash

echo "🔧 Fixing ticket comments, knowledge base, and closed tickets issues..."

# Copy the new comments API
echo "📁 Copying ticket comments API..."
scp -r src/app/api/tickets/[id]/comments/ avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/tickets/\[id\]/

# Copy the fixed knowledge base API
echo "📁 Copying fixed knowledge base API..."
scp src/app/api/help-desk/knowledge-base/route.ts avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/help-desk/knowledge-base/

# Copy the fixed My Tickets API
echo "📁 Copying fixed My Tickets API..."
scp src/app/api/help-desk/queue/my-tickets/route.ts avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/

echo "✅ All files copied to server"

echo ""
echo "🔄 Manual steps required on server:"
echo "1. SSH to server: ssh avian@192.168.1.116"
echo "2. Navigate to project: cd ~/avian-cybersecurity-platform-onprem"
echo "3. Stop containers: sudo docker-compose -f docker-compose.prod.yml down"
echo "4. Rebuild app: sudo docker-compose -f docker-compose.prod.yml build --no-cache app"
echo "5. Start containers: sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "Expected fixes:"
echo "✅ Ticket comments will work (currently returns empty array)"
echo "✅ Knowledge Base will load without crashing"
echo "✅ Closed tickets will be removed from 'My Tickets'"