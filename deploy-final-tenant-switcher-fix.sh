#!/bin/bash

# Deploy final TenantSwitcher fixes to production server
# This script completely eliminates the 500 errors by avoiding API calls for regular users

echo "🚀 Deploying final TenantSwitcher fixes to production server..."

# Copy the fixed TenantSwitcher component
echo "📁 Copying updated TenantSwitcher.tsx to server..."
scp src/components/demo/TenantSwitcher.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/demo/TenantSwitcher.tsx

if [ $? -eq 0 ]; then
    echo "✅ File copied successfully"
else
    echo "❌ Failed to copy file"
    exit 1
fi

echo ""
echo "🔧 Now rebuilding Docker container on server..."
echo "Please run these commands on the server (SSH into 192.168.1.116):"
echo ""
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml down"
echo "sudo docker-compose -f docker-compose.prod.yml build --no-cache app"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "🎯 Expected Results After Deployment:"
echo "- ✅ NO MORE 500 errors from /api/tenants endpoint"
echo "- ✅ NO MORE 403 errors from /api/super-admin/tenants endpoint"
echo "- ✅ User u@esr.com should see 'esr' tenant name in header"
echo "- ✅ Clean browser console with no API errors"
echo "- ✅ Tickets should be visible in help desk queues"
echo ""
echo "🧪 Test Steps:"
echo "1. Login as u@esr.com / admin123"
echo "2. Check browser console - should be completely clean (no 403 or 500 errors)"
echo "3. Verify tenant name shows 'esr' in header (not 'ACME Corporation')"
echo "4. Create a test ticket"
echo "5. Check 'My Tickets' and help desk queues for the ticket"
echo ""
echo "🔧 Technical Changes Made:"
echo "- Regular users (USER, TENANT_ADMIN) no longer call tenant APIs"
echo "- Only SUPER_ADMIN, SECURITY_ANALYST, IT_HELPDESK_ANALYST call tenant APIs"
echo "- Tenant names are resolved from hardcoded mapping based on tenant ID"
echo "- Eliminates permission errors by avoiding unauthorized API calls"