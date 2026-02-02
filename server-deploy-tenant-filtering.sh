#!/bin/bash

# Run this script on the server to deploy tenant filtering fixes
# SSH into 192.168.1.116 and run this script

echo "🔧 Deploying tenant filtering fixes on server..."

# Move files to correct locations
echo "📁 Moving API files to correct locations..."
sudo cp /tmp/unassigned-route.ts /home/avian/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/unassigned/route.ts
sudo cp /tmp/my-tickets-route.ts /home/avian/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/route.ts

echo "✅ Files moved successfully"

# Change to project directory
cd /home/avian/avian-cybersecurity-platform-onprem

# Rebuild container
echo "🏗️ Rebuilding Docker container..."
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml build --no-cache app
sudo docker-compose -f docker-compose.prod.yml up -d

echo "✅ Container rebuild complete!"
echo ""
echo "🧪 Test the fix:"
echo "1. Login as helpdesk.analyst@company.com / admin123"
echo "2. Go to Help Desk"
echo "3. Switch to 'esr' tenant - should see ESR tickets"
echo "4. Switch to 'test' tenant - should see NO tickets (empty)"
echo "5. Verify proper tenant isolation"
echo ""
echo "🎯 Expected Behavior:"
echo "- When managing 'esr': See tickets from ESR tenant only"
echo "- When managing 'test': See tickets from test tenant only (none currently)"
echo "- Tenant switcher should properly filter tickets by selected tenant"