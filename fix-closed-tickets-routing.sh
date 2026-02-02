#!/bin/bash

# Fix Closed Tickets Routing and Read-Only View
# This script fixes the routing issue and makes closed tickets read-only

echo "🚀 Deploying closed tickets routing fix to server..."

SERVER_IP="192.168.1.116"
SERVER_USER="avian"
SERVER_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "📋 Files to deploy:"
echo "  - Fixed ClosedTicketsQueue routing (/help-desk/tickets/[id])"
echo "  - Read-only ticket details page for closed tickets"
echo "  - Read-only TicketTimeline component"

# Copy fixed components
echo "🔧 Copying fixed ClosedTicketsQueue component..."
scp src/components/help-desk/ClosedTicketsQueue.tsx ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/components/help-desk/ClosedTicketsQueue.tsx

echo "📄 Copying fixed ticket details page..."
scp "src/app/help-desk/tickets/[id]/page.tsx" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/app/help-desk/tickets/[id]/page.tsx"

echo "💬 Copying fixed TicketTimeline component..."
scp src/components/help-desk/TicketTimeline.tsx ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/components/help-desk/TicketTimeline.tsx

echo "🔧 Connecting to server to rebuild Docker container..."

ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "🔨 Rebuilding application container..."
sudo docker-compose -f docker-compose.prod.yml build app

echo "🚀 Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for containers to be ready..."
sleep 15

echo "🔍 Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo "✅ Deployment complete!"
echo ""
echo "🧪 Test the fix:"
echo "1. Login to https://192.168.1.116 with h@tcc.com / 12345678"
echo "2. Go to Help Desk → Closed Tickets tab"
echo "3. You should see closed tickets (if any exist)"
echo "4. Click 'View' on any ticket"
echo "5. Ticket details should open in new tab without 404 error"
echo "6. Ticket should be read-only (no actions, no comment form)"

EOF

echo "🎉 Deployment completed successfully!"
echo ""
echo "🔍 Changes made:"
echo "✅ Fixed routing: /tickets/[id] → /help-desk/tickets/[id]"
echo "✅ Closed tickets are now read-only"
echo "✅ Hidden ticket actions for resolved/closed tickets"
echo "✅ Hidden comment form for resolved/closed tickets"
echo "✅ Added read-only notice for closed tickets"