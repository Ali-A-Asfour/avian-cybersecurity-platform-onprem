#!/bin/bash

# Deploy Debug Version for Tenant Switching
# This adds console logging to help debug the tenant switching issue

echo "🔍 Deploying debug version for tenant switching..."

# Copy updated files with debugging
echo "📁 Copying debug files to server..."

# Copy tickets API with debugging
scp src/app/api/tickets/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/tickets/route.ts

# Copy tenant middleware with debugging
scp src/middleware/tenant.middleware.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/middleware/tenant.middleware.ts

# Copy API client with debugging
scp src/lib/api-client.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/lib/api-client.ts

echo "✅ Debug files copied successfully!"
echo ""
echo "🔄 Now run the rebuild script on the server:"
echo "  ssh avian@192.168.1.116"
echo "  ./rebuild-server.sh"
echo ""
echo "🔍 After rebuild, check browser console and server logs for debug output:"
echo "  - Browser console: Look for 🌐 API Client and 🏢 Tenant middleware logs"
echo "  - Server logs: sudo docker-compose -f docker-compose.prod.yml logs app"