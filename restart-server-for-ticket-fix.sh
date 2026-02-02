#!/bin/bash

# Script to restart the server application to pick up ticket data changes
# Run this on the server: sudo bash restart-server-for-ticket-fix.sh

echo "🔄 Restarting AVIAN application to pick up ticket data changes..."

cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping application container..."
sudo docker-compose -f docker-compose.prod.yml stop app

echo "⏳ Waiting 5 seconds..."
sleep 5

echo "🚀 Starting application container..."
sudo docker-compose -f docker-compose.prod.yml start app

echo "⏳ Waiting 10 seconds for startup..."
sleep 10

echo "🔍 Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps app

echo "📋 Checking application logs..."
sudo docker-compose -f docker-compose.prod.yml logs app --tail=10

echo "✅ Restart complete!"
echo ""
echo "🧪 Test the fix:"
echo "1. Login to https://192.168.1.116 with h@tcc.com / 12345678"
echo "2. Go to Help Desk → Closed Tickets tab"
echo "3. You should see 3 closed tickets"
echo "4. Click 'View Details' on any ticket"
echo "5. Ticket details should load without 404 error"