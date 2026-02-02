#!/bin/bash

# Deploy tenant filtering fix for help desk queues
# This fixes the issue where cross-tenant users see tickets from all tenants instead of just the selected tenant

echo "🚀 Deploying tenant filtering fix to production server..."

# Copy the fixed API files
echo "📁 Copying updated help desk queue APIs to server..."
scp src/app/api/help-desk/queue/unassigned/route.ts src/app/api/help-desk/queue/my-tickets/route.ts avian@192.168.1.116:/tmp/

if [ $? -eq 0 ]; then
    echo "✅ Files copied successfully to /tmp/"
else
    echo "❌ Failed to copy files"
    exit 1
fi

echo ""
echo "🔧 Now moving files and rebuilding Docker container on server..."
echo "Please run these commands on the server (SSH into 192.168.1.116):"
echo ""
echo "# Move files to correct locations"
echo "sudo cp /tmp/route.ts /home/avian/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/unassigned/"
echo "sudo mv /tmp/route.ts /home/avian/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/"
echo ""
echo "# Rebuild container"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml down"
echo "sudo docker-compose -f docker-compose.prod.yml build --no-cache app"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "🎯 Expected Results After Deployment:"
echo "- ✅ Cross-tenant users (Security/Helpdesk Analysts) will only see tickets from selected tenant"
echo "- ✅ When switching tenants, ticket queues will update to show only that tenant's tickets"
echo "- ✅ Regular users will continue to see only their own tenant's tickets"
echo "- ✅ Proper tenant isolation in help desk queues"
echo ""
echo "🧪 Test Steps:"
echo "1. Login as helpdesk.analyst@company.com / admin123 (cross-tenant user)"
echo "2. Go to Help Desk"
echo "3. Switch to 'esr' tenant - should see ESR tickets"
echo "4. Switch to 'test' tenant - should see only test tenant tickets (none currently)"
echo "5. Verify tickets are properly filtered by selected tenant"
echo ""
echo "🔧 Technical Fixes Applied:"
echo "- Updated unassigned queue API to read 'x-selected-tenant' header"
echo "- Updated my-tickets queue API to read 'x-selected-tenant' header"
echo "- Cross-tenant users now see tickets filtered by selected tenant"
echo "- Regular users continue to see their own tenant's tickets"
echo "- Added comprehensive logging for debugging tenant filtering"
echo ""
echo "📊 Root Cause Fixed:"
echo "- Before: Cross-tenant users saw ALL tickets (tenantFilter = undefined)"
echo "- After: Cross-tenant users see only selected tenant's tickets"
echo "- Frontend already sends 'x-selected-tenant' header - backend now reads it"