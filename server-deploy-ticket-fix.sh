#!/bin/bash

# Run this script on the server to deploy the ticket visibility fixes
# SSH into 192.168.1.116 and run this script

echo "🔧 Deploying ticket visibility fixes on server..."

# Move files to correct locations
echo "📁 Moving files to correct locations..."
sudo cp /tmp/TenantSwitcher.tsx /home/avian/avian-cybersecurity-platform-onprem/src/components/demo/
sudo cp /tmp/UserDashboard.tsx /home/avian/avian-cybersecurity-platform-onprem/src/components/dashboard/
sudo cp /tmp/ticket-store.ts /home/avian/avian-cybersecurity-platform-onprem/src/lib/
sudo cp /tmp/route.ts /home/avian/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/

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
echo "1. Open https://192.168.1.116 in browser"
echo "2. Login as u@esr.com / admin123"
echo "3. Check browser console (F12) - should be clean"
echo "4. Verify tenant name shows 'esr' in header"
echo "5. Create a test ticket"
echo "6. Go to dashboard - ticket should appear in 'My Open Tickets'"
echo "7. Go to help desk - ticket should appear in 'My Tickets' tab"