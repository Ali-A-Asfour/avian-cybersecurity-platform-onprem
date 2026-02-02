#!/bin/bash

# Fix Tenant Switching and Ticket Visibility Issues
# This script fixes the tenant switching functionality and ensures tickets are visible across tenants

echo "🚀 Fixing Tenant Switching and Ticket Visibility..."

# Copy updated files to server
echo "📁 Copying updated files to server..."

# Copy updated DemoTenantSwitcher (fixed switching logic)
scp src/components/demo/TenantSwitcher.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/demo/TenantSwitcher.tsx

# Copy updated tenant middleware (supports cross-tenant users)
scp src/middleware/tenant.middleware.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/middleware/tenant.middleware.ts

# Copy updated API client (sends tenant ID in headers)
scp src/lib/api-client.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/lib/api-client.ts

# Copy updated DemoContext (sets global tenant ID)
scp src/contexts/DemoContext.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/contexts/DemoContext.tsx

echo "✅ Files copied successfully!"

# Rebuild Docker container
echo "🔄 Rebuilding Docker container..."
ssh avian@192.168.1.116 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

# Stop containers
sudo docker-compose -f docker-compose.prod.yml down

# Rebuild with no cache to ensure changes are applied
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d

echo "✅ Container rebuilt and started!"

# Check container status
echo "📊 Container status:"
sudo docker-compose -f docker-compose.prod.yml ps
EOF

echo "🎉 Tenant Switching and Ticket Visibility Fix deployment complete!"
echo ""
echo "📋 Changes Applied:"
echo "  ✅ Fixed tenant switching - no more page refresh, proper context update"
echo "  ✅ Updated tenant middleware to support cross-tenant users"
echo "  ✅ Updated API client to send selected tenant ID in headers"
echo "  ✅ Updated DemoContext to set global tenant ID for API calls"
echo "  ✅ Fixed ticket visibility across different tenants"
echo ""
echo "🔗 Test the changes:"
echo "  1. Login as helpdesk analyst: helpdesk.analyst@company.com / admin123"
echo "  2. Use the tenant selector in the header - should not refresh page"
echo "  3. Switch between different tenants (esr, test, Default Organization)"
echo "  4. Create a ticket in one tenant, switch to another, then back - ticket should be visible"
echo "  5. Verify both helpdesk and assets pages reflect the selected tenant"