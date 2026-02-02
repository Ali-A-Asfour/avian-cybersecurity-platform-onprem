#!/bin/bash

# Fix Help Desk Header Mismatch
# The components were sending 'x-selected-tenant' but API expects 'x-selected-tenant-id'

echo "🔧 Fixing help desk header mismatch..."

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
echo "🎯 Expected result: Help desk tickets should now be visible when ESR tenant is selected"