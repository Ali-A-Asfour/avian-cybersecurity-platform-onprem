#!/bin/bash

# Force Complete Container Rebuild
# This will completely rebuild the container from scratch

echo "🔧 Force rebuilding container from scratch..."

# Copy files to server first
echo "📁 Copying all necessary files..."
scp src/app/api/tickets/[id]/assign/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/tickets/[id]/assign/
scp src/lib/ticket-store.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/lib/

echo "✅ Files copied"
echo ""
echo "🚀 CRITICAL: Run these commands on your server EXACTLY in this order:"
echo ""
echo "ssh avian@192.168.1.116"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo ""
echo "# 1. Stop ALL containers"
echo "sudo docker-compose -f docker-compose.prod.yml down"
echo ""
echo "# 2. Remove ALL related images and containers"
echo "sudo docker system prune -f"
echo "sudo docker rmi \$(sudo docker images | grep avian | awk '{print \$3}') 2>/dev/null || true"
echo ""
echo "# 3. Verify files exist on server"
echo "ls -la src/app/api/tickets/[id]/assign/route.ts"
echo "ls -la src/lib/ticket-store.ts"
echo ""
echo "# 4. Build completely from scratch"
echo "sudo docker-compose -f docker-compose.prod.yml build --no-cache --pull"
echo ""
echo "# 5. Start containers"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "# 6. Wait for startup (30 seconds)"
echo "sleep 30"
echo ""
echo "# 7. Verify API works"
echo "curl -k 'https://localhost/api/tickets/test/assign' -X POST -H 'Content-Type: application/json' -d '{\"assignee\":\"test\"}'"
echo ""
echo "🎯 Expected result: Should return authentication error (NOT 404)"
echo ""
echo "If still 404, there might be a Next.js routing issue. Let me know the result!"