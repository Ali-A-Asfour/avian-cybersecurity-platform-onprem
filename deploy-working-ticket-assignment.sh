#!/bin/bash

# Deploy Working Ticket Assignment Solution
# Tested locally and confirmed working

echo "🎯 Deploying TESTED and WORKING ticket assignment solution..."

# 1. Create directory structure on server
echo "📁 Creating directory structure..."
ssh avian@192.168.1.116 "mkdir -p /home/avian/avian-cybersecurity-platform-onprem/src/app/api/tickets/assign"

# 2. Copy the working API endpoint
echo "📁 Copying working API endpoint..."
scp src/app/api/tickets/assign/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/tickets/assign/

# 3. Copy the updated frontend component
echo "📁 Copying updated frontend component..."
scp src/components/help-desk/UnassignedTicketQueue.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/help-desk/

# 4. Copy the ticket store (ensure it's up to date)
echo "📁 Copying ticket store..."
scp src/lib/ticket-store.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/lib/

# 5. Copy the test files for verification
echo "📁 Copying test files..."
scp test-ticket-assignment-local.js avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/
scp test-frontend-assignment.html avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/public/

echo "✅ All files deployed to server"
echo ""
echo "🚀 DEPLOYMENT STEPS (run on server):"
echo "ssh avian@192.168.1.116"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo ""
echo "# 1. Restart the app container"
echo "sudo docker-compose -f docker-compose.prod.yml restart app"
echo ""
echo "# 2. Wait for startup"
echo "sleep 15"
echo ""
echo "# 3. Test the API endpoint"
echo "curl -k 'https://localhost/api/tickets/assign' -X POST -H 'Content-Type: application/json' -d '{\"ticketId\":\"test\",\"assignee\":\"test\"}'"
echo ""
echo "# 4. Test with Node.js (if available)"
echo "node test-ticket-assignment-local.js"
echo ""
echo "# 5. Test in browser"
echo "echo 'Open https://192.168.1.116/test-frontend-assignment.html in browser'"
echo ""
echo "🎯 EXPECTED RESULTS:"
echo "✅ API should return authentication error (not 404)"
echo "✅ 'Assign to me' button should work in help desk"
echo "✅ Tickets should move from Unassigned to My Tickets"