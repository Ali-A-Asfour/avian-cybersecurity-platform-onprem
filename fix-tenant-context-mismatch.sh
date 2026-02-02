#!/bin/bash

# Fix Tenant Context Mismatch
# Help desk components were using TenantContext but tenant switching happens in DemoContext

echo "🔧 Fixing tenant context mismatch..."

# Copy the fixed components to server
echo "📁 Copying fixed help desk components..."
scp src/components/help-desk/UnassignedTicketQueue.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/help-desk/
scp src/components/help-desk/MyTicketsQueue.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/help-desk/

echo "✅ Files copied to server"
echo ""
echo "🚀 Next steps (run on server):"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml down"
echo "sudo docker-compose -f docker-compose.prod.yml build --no-cache app"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "🎯 Expected result: Tickets should now be filtered correctly by selected tenant"