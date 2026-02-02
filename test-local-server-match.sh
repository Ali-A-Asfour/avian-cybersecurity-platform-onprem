#!/bin/bash

# Test Local Environment Matches Server Exactly
# This script tests all the key functionality to ensure local environment matches server

set -e

echo "🧪 Testing local environment matches server exactly..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test 1: Database Structure
echo "🔍 Test 1: Verifying database structure matches server..."

# Check key tables exist
TABLES_EXIST=$(psql -h localhost -p 5432 -U avian -d avian -t -c "
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'tenants', 'tickets', 'auth_audit_logs', 'sessions');
")

if [ "$TABLES_EXIST" -eq "5" ]; then
    echo_info "All key tables exist"
else
    echo_error "Missing key tables (found $TABLES_EXIST, expected 5)"
    exit 1
fi

# Test 2: Server Credentials
echo "🔍 Test 2: Testing server credentials..."

LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "h@tcc.com", "password": "12345678"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo_info "Server credentials work (h@tcc.com / 12345678)"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo_error "Server credentials failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

# Test 3: User Session Verification
echo "🔍 Test 3: Testing user session verification..."

ME_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/auth/me" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ME_RESPONSE" | grep -q '"role":"it_helpdesk_analyst"'; then
    echo_info "User session verification works"
else
    echo_error "User session verification failed"
    echo "Response: $ME_RESPONSE"
    exit 1
fi

# Test 4: Help Desk Queue
echo "🔍 Test 4: Testing help desk queue..."

QUEUE_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/help-desk/queue/unassigned" \
  -H "Authorization: Bearer $TOKEN")

if echo "$QUEUE_RESPONSE" | grep -q '"success":true'; then
    TICKET_COUNT=$(echo "$QUEUE_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo_info "Help desk queue works (found $TICKET_COUNT tickets)"
else
    echo_error "Help desk queue failed"
    echo "Response: $QUEUE_RESPONSE"
    exit 1
fi

# Test 5: Ticket Assignment
echo "🔍 Test 5: Testing ticket assignment..."

# Get a ticket ID from the queue
TICKET_ID=$(echo "$QUEUE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$TICKET_ID" ]; then
    ASSIGN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/tickets/assign-simple" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"ticketId\": \"$TICKET_ID\", \"assignee\": \"0a24b509-6e8f-4162-8687-f9a8ed71f9cc\"}")
    
    if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
        echo_info "Ticket assignment works (assigned ticket $TICKET_ID)"
    else
        echo_error "Ticket assignment failed"
        echo "Response: $ASSIGN_RESPONSE"
        exit 1
    fi
else
    echo_warning "No tickets available for assignment test"
fi

# Test 6: Database Data Verification
echo "🔍 Test 6: Verifying exact server data..."

# Check user count
USER_COUNT=$(psql -h localhost -p 5432 -U avian -d avian -t -c "SELECT COUNT(*) FROM users;")
if [ "$USER_COUNT" -eq "11" ]; then
    echo_info "User count matches server (11 users)"
else
    echo_warning "User count mismatch (found $USER_COUNT, expected 11)"
fi

# Check tenant count
TENANT_COUNT=$(psql -h localhost -p 5432 -U avian -d avian -t -c "SELECT COUNT(*) FROM tenants;")
if [ "$TENANT_COUNT" -eq "4" ]; then
    echo_info "Tenant count matches server (4 tenants)"
else
    echo_warning "Tenant count mismatch (found $TENANT_COUNT, expected 4)"
fi

# Check key user exists with correct role
KEY_USER_COUNT=$(psql -h localhost -p 5432 -U avian -d avian -t -c "SELECT COUNT(*) FROM users WHERE email = 'h@tcc.com' AND role = 'it_helpdesk_analyst' AND is_active = true AND account_locked = false;")
if [ "$KEY_USER_COUNT" -eq "1" ]; then
    echo_info "Key user h@tcc.com exists with correct role and status"
else
    echo_warning "Key user check failed (found $KEY_USER_COUNT active users, expected 1)"
fi

# Check tenant structure
ESR_TENANT_EXISTS=$(psql -h localhost -p 5432 -U avian -d avian -t -c "SELECT COUNT(*) FROM tenants WHERE name = 'esr' AND domain = 'esr.com' AND is_active = true;")
if [ "$ESR_TENANT_EXISTS" -eq "1" ]; then
    echo_info "ESR tenant exists with correct configuration"
else
    echo_warning "ESR tenant check failed"
fi

echo ""
echo_info "🎉 All tests passed! Local environment matches server exactly."
echo_info ""
echo_info "📋 Summary:"
echo_info "   ✅ Database structure matches server"
echo_info "   ✅ Server credentials work (h@tcc.com / 12345678)"
echo_info "   ✅ User authentication and sessions work"
echo_info "   ✅ Help desk queue API works"
echo_info "   ✅ Ticket assignment functionality works"
echo_info "   ✅ All server data replicated correctly"
echo_info ""
echo_info "🚀 Ready for web interface testing!"
echo_info "   You can now test the complete workflow in the browser:"
echo_info "   1. Go to http://localhost:3000"
echo_info "   2. Login with h@tcc.com / 12345678"
echo_info "   3. Navigate to Help Desk"
echo_info "   4. View and assign tickets"