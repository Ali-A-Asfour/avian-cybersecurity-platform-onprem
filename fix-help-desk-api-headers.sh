#!/bin/bash

# Fix Help Desk API Header Names
# The help-desk APIs were looking for 'x-selected-tenant' but we're sending 'x-selected-tenant-id'

echo "🔧 Fixing Help Desk API header names..."

# Copy fixed help-desk APIs
echo "📁 Copying fixed API files to server..."

scp src/app/api/help-desk/queue/my-tickets/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/route.ts

scp src/app/api/help-desk/queue/unassigned/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/unassigned/route.ts

echo "✅ Files copied successfully!"
echo ""
echo "🔄 Now rebuild the server:"
echo "  ssh avian@192.168.1.116"
echo "  ./rebuild-server.sh"
echo ""
echo "🎯 After rebuild, you should see tickets when switching to 'esr' tenant!"