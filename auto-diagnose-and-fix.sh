#!/bin/bash

# Automated Server Diagnosis and Fix
# Date: January 25, 2026
# Purpose: Automatically diagnose and fix server issues without manual intervention

echo "🔧 Starting automated server diagnosis and fix..."

# Function to run commands on server without interactive sudo
run_server_command() {
    local cmd="$1"
    echo "Running: $cmd"
    ssh -o StrictHostKeyChecking=no avian@192.168.1.115 "$cmd" 2>/dev/null || echo "Command failed or requires sudo"
}

# Function to test API endpoint
test_api() {
    local endpoint="$1"
    local description="$2"
    echo -n "Testing $description: "
    local status=$(curl -k -s "$endpoint" -H "Authorization: Bearer $TOKEN" -w "%{http_code}" -o /dev/null)
    if [ "$status" = "200" ]; then
        echo "✅ Working ($status)"
        return 0
    else
        echo "❌ Failed ($status)"
        return 1
    fi
}

echo ""
echo "📋 Step 1: Getting fresh authentication token..."
TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Failed to get auth token, trying tadmin account..."
    TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"tadmin@test.com","password":"admin123"}' | jq -r '.token' 2>/dev/null)
fi

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Cannot get authentication token. Server may be completely down."
    exit 1
fi

echo "✅ Got authentication token"

echo ""
echo "📋 Step 2: Testing API endpoints to identify failures..."

# Test working endpoints
test_api "https://192.168.1.115/api/auth/me" "Authentication endpoint"
test_api "https://192.168.1.115/api/users" "Users endpoint"

# Test failing endpoints
test_api "https://192.168.1.115/api/dashboard/widgets" "Dashboard widgets"
test_api "https://192.168.1.115/api/tickets?limit=1" "Tickets endpoint"

echo ""
echo "📋 Step 3: Checking server container status..."
run_server_command "cd /home/avian/avian-cybersecurity-platform-onprem && docker-compose -f docker-compose.prod.yml ps --format table"

echo ""
echo "📋 Step 4: Checking for obvious issues..."

# Check if containers are running
echo "Checking if containers are accessible..."
container_check=$(run_server_command "cd /home/avian/avian-cybersecurity-platform-onprem && docker-compose -f docker-compose.prod.yml ps --services --filter status=running")
echo "Running services: $container_check"

echo ""
echo "📋 Step 5: Attempting automated fix..."

echo "🔄 Restarting services without sudo (using docker-compose directly)..."
run_server_command "cd /home/avian/avian-cybersecurity-platform-onprem && docker-compose -f docker-compose.prod.yml restart"

echo ""
echo "⏳ Waiting 30 seconds for services to stabilize..."
sleep 30

echo ""
echo "📋 Step 6: Re-testing endpoints after restart..."

# Get fresh token after restart
echo "Getting fresh token after restart..."
TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"tadmin@test.com","password":"admin123"}' | jq -r '.token' 2>/dev/null)
fi

# Re-test endpoints
test_api "https://192.168.1.115/api/dashboard/widgets" "Dashboard widgets (after restart)"
test_api "https://192.168.1.115/api/tickets?limit=1" "Tickets endpoint (after restart)"

echo ""
echo "📋 Step 7: Testing RSC requests..."
echo -n "Testing RSC request: "
rsc_status=$(curl -k -s "https://192.168.1.115/dashboard?_rsc=test" -w "%{http_code}" -o /dev/null)
if [ "$rsc_status" = "200" ]; then
    echo "✅ Working ($rsc_status)"
else
    echo "❌ Failed ($rsc_status)"
fi

echo ""
echo "📋 Step 8: Final diagnosis..."

# Check if the main issues are resolved
dashboard_ok=$(test_api "https://192.168.1.115/api/dashboard/widgets" "Dashboard" >/dev/null 2>&1 && echo "true" || echo "false")
tickets_ok=$(test_api "https://192.168.1.115/api/tickets?limit=1" "Tickets" >/dev/null 2>&1 && echo "true" || echo "false")

if [ "$dashboard_ok" = "true" ] && [ "$tickets_ok" = "true" ]; then
    echo "🎉 SUCCESS: All API endpoints are now working!"
    echo "✅ Dashboard widgets: Working"
    echo "✅ Tickets API: Working"
    echo "✅ Team members page should now be accessible"
    echo ""
    echo "🧪 Test the platform:"
    echo "1. Navigate to: https://192.168.1.115"
    echo "2. Login with: admin@avian.local / admin123"
    echo "3. Try accessing Team Members page"
    echo "4. Check that dashboard loads properly"
else
    echo "⚠️  PARTIAL SUCCESS: Some issues remain"
    echo "Dashboard API: $dashboard_ok"
    echo "Tickets API: $tickets_ok"
    echo ""
    echo "🔧 Additional steps needed:"
    if [ "$dashboard_ok" = "false" ]; then
        echo "- Dashboard widgets API still failing"
    fi
    if [ "$tickets_ok" = "false" ]; then
        echo "- Tickets API still failing"
    fi
    echo ""
    echo "💡 This suggests database schema issues that need manual intervention:"
    echo "ssh avian@192.168.1.115"
    echo "cd /home/avian/avian-cybersecurity-platform-onprem"
    echo "sudo docker-compose -f docker-compose.prod.yml logs --tail=50 app"
fi

echo ""
echo "✅ Automated diagnosis and fix attempt completed!"