#!/bin/bash

# Run this script on the server to remove the My Tickets and Create Ticket buttons
# SSH into 192.168.1.116 and run this script

echo "🔧 Removing My Tickets and Create Ticket buttons from dashboard..."

# Move file to correct location
echo "📁 Moving dashboard file to correct location..."
sudo cp /tmp/dashboard-page.tsx /home/avian/avian-cybersecurity-platform-onprem/src/app/dashboard/page.tsx

echo "✅ File moved successfully"

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
echo "3. Go to dashboard"
echo "4. Verify NO 'My Tickets' and 'Create Ticket' buttons in top right corner"
echo "5. Verify 'My Open Tickets' section still shows your created tickets"
echo "6. Verify you can still create tickets using the main 'Create New Ticket' button"