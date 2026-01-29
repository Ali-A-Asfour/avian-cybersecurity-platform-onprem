#!/bin/bash

echo "🔄 Syncing local environment to match server (192.168.1.116)..."

# Create backup of current local state
echo "📦 Creating backup of current local state..."
mkdir -p .backup/$(date +%Y%m%d_%H%M%S)
cp -r src/app/api/tickets/ .backup/$(date +%Y%m%d_%H%M%S)/tickets_api_backup/
cp -r src/app/api/help-desk/ .backup/$(date +%Y%m%d_%H%M%S)/help_desk_api_backup/
cp -r src/components/help-desk/ .backup/$(date +%Y%m%d_%H%M%S)/help_desk_components_backup/
cp -r src/lib/ .backup/$(date +%Y%m%d_%H%M%S)/lib_backup/

echo "✅ Backup created in .backup/$(date +%Y%m%d_%H%M%S)/"

# Sync API endpoints from server
echo "📥 Pulling API endpoints from server..."

# Tickets APIs
echo "  📁 Syncing tickets APIs..."
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/tickets/route.ts src/app/api/tickets/
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/tickets/assign-simple/route.ts src/app/api/tickets/assign-simple/
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/tickets/assign-direct/route.ts src/app/api/tickets/assign-direct/

# Help Desk APIs
echo "  📁 Syncing help-desk APIs..."
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/my-tickets/route.ts src/app/api/help-desk/queue/my-tickets/
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/unassigned/route.ts src/app/api/help-desk/queue/unassigned/

# Components
echo "  📁 Syncing components..."
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/components/help-desk/UnassignedTicketQueue.tsx src/components/help-desk/
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/components/demo/TenantSwitcher.tsx src/components/demo/

# Library files
echo "  📁 Syncing library files..."
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/lib/ticket-store.ts src/lib/

# Sync server's ticket data
echo "📊 Syncing server's ticket data..."
scp avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/.tickets-store.json ./

echo "✅ Local environment synced with server!"
echo ""
echo "📋 Files synced:"
echo "  ✅ src/app/api/tickets/route.ts"
echo "  ✅ src/app/api/tickets/assign-simple/route.ts" 
echo "  ✅ src/app/api/tickets/assign-direct/route.ts"
echo "  ✅ src/app/api/help-desk/queue/my-tickets/route.ts"
echo "  ✅ src/app/api/help-desk/queue/unassigned/route.ts"
echo "  ✅ src/components/help-desk/UnassignedTicketQueue.tsx"
echo "  ✅ src/components/demo/TenantSwitcher.tsx"
echo "  ✅ src/lib/ticket-store.ts"
echo "  ✅ .tickets-store.json (server's ticket data)"
echo ""
echo "🧪 Test locally:"
echo "1. npm run dev"
echo "2. Navigate to http://localhost:3000"
echo "3. Login with h@tcc.com / admin123"
echo "4. Test ticket assignment functionality"