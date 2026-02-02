#!/bin/bash

# Deploy Tenant Switcher Fix
# This script removes the local tenant switcher from helpdesk page and makes the global header tenant switcher control both helpdesk and assets pages

echo "🚀 Deploying Tenant Switcher Fix..."

# Copy updated files to server
echo "📁 Copying updated files to server..."

# Copy Header component (updated to show tenant switcher for helpdesk analysts)
scp src/components/layout/Header.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/layout/Header.tsx

# Copy updated helpdesk page (removed local tenant switcher, uses global selection)
scp src/app/help-desk/page.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/help-desk/page.tsx

# Copy updated assets page (consistent with global tenant selection)
scp src/app/assets/page.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/assets/page.tsx

# Copy updated DemoContext (added currentTenant property)
scp src/contexts/DemoContext.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/contexts/DemoContext.tsx

# Copy updated DemoTenantSwitcher (updates global tenant state)
scp src/components/demo/TenantSwitcher.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/demo/TenantSwitcher.tsx

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

echo "🎉 Tenant Switcher Fix deployment complete!"
echo ""
echo "📋 Changes Applied:"
echo "  ✅ Removed tenant switcher from helpdesk page"
echo "  ✅ Updated header to show tenant switcher for helpdesk analysts"
echo "  ✅ Made global tenant selector control both helpdesk and assets pages"
echo "  ✅ Added currentTenant property to DemoContext"
echo "  ✅ Updated DemoTenantSwitcher to update global state"
echo ""
echo "🔗 Test the changes:"
echo "  1. Login as helpdesk analyst: helpdesk.analyst@company.com / admin123"
echo "  2. Use the tenant selector in the header (top right)"
echo "  3. Verify both helpdesk and assets pages reflect the selected tenant"
echo "  4. Confirm no tenant switcher appears on the helpdesk page itself"