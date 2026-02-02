#!/bin/bash

# Fix Ticket Assignment API
# Create missing /api/tickets/[id]/assign endpoint

echo "🔧 Fixing ticket assignment API..."

# Create the API directory structure on server
echo "📁 Creating API directory structure..."
ssh avian@192.168.1.116 "mkdir -p /home/avian/avian-cybersecurity-platform-onprem/src/app/api/tickets/[id]/assign"

# Copy the new API endpoint to server
echo "📁 Copying ticket assignment API..."
scp src/app/api/tickets/[id]/assign/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/tickets/[id]/assign/

echo "✅ Files copied to server"
echo ""
echo "🚀 Next steps (run on server):"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml down"
echo "sudo docker-compose -f docker-compose.prod.yml build --no-cache app"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "🎯 Expected result: 'Assign to me' button should work correctly"