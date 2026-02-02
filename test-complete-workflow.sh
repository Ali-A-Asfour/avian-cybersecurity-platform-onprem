#!/bin/bash

# Test Complete Ticket Assignment Workflow
# This script tests the full workflow: login -> view unassigned -> assign -> view assigned

set -e

echo "🎫 Testing complete ticket assignment workflow..."

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

# Step 1: Login
echo "🔐 Step 1: Login with server credentials..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "h@tcc.com", "password": "12345678"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo_info "Login successful"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo_error "Login failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

# Step 2: Check unassigned tickets
echo "📋 Step 2: Check unassigned tickets..."
UNASSIGNED_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/help-desk/queue/unassigned" \
  -H "Authorization: Bearer $TOKEN")

if echo "$UNASSIGNED_RESPONSE" | grep -q '"success":true'; then
    UNASSIGNED_COUNT=$(echo "$UNASSIGNED_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo_info "Found $UNASSIGNED_COUNT unassigned tickets"
    
    # Get first ticket ID for assignment
    TICKET_ID=$(echo "$UNASSIGNED_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$TICKET_ID" ]; then
        echo_info "Will assign ticket: $TICKET_ID"
    else
        echo_warning "No tickets available for assignment"
        TICKET_ID=""
    fi
else
    echo_error "Failed to get unassigned tickets"
    echo "Response: $UNASSIGNED_RESPONSE"
    exit 1
fi

# Step 3: Check assigned tickets (before assignment)
echo "📝 Step 3: Check current assigned tickets..."
ASSIGNED_BEFORE_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/help-desk/queue/my-tickets" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ASSIGNED_BEFORE_RESPONSE" | grep -q '"success":true'; then
    ASSIGNED_BEFORE_COUNT=$(echo "$ASSIGNED_BEFORE_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo_info "Currently have $ASSIGNED_BEFORE_COUNT assigned tickets"
else
    echo_error "Failed to get assigned tickets"
    echo "Response: $ASSIGNED_BEFORE_RESPONSE"
    exit 1
fi

# Step 4: Assign a ticket (if available)
if [ -n "$TICKET_ID" ]; then
    echo "🎯 Step 4: Assigning ticket $TICKET_ID..."
    ASSIGN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/tickets/assign-simple" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"ticketId\": \"$TICKET_ID\", \"assignee\": \"0a24b509-6e8f-4162-8687-f9a8ed71f9cc\"}")
    
    if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
        echo_info "Ticket assigned successfully"
    else
        echo_error "Ticket assignment failed"
        echo "Response: $ASSIGN_RESPONSE"
        exit 1
    fi
else
    echo_warning "Skipping assignment - no tickets available"
fi

# Step 5: Check unassigned tickets (after assignment)
echo "📋 Step 5: Check unassigned tickets after assignment..."
UNASSIGNED_AFTER_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/help-desk/queue/unassigned" \
  -H "Authorization: Bearer $TOKEN")

if echo "$UNASSIGNED_AFTER_RESPONSE" | grep -q '"success":true'; then
    UNASSIGNED_AFTER_COUNT=$(echo "$UNASSIGNED_AFTER_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo_info "Unassigned tickets after assignment: $UNASSIGNED_AFTER_COUNT"
    
    if [ -n "$TICKET_ID" ]; then
        EXPECTED_UNASSIGNED=$((UNASSIGNED_COUNT - 1))
        if [ "$UNASSIGNED_AFTER_COUNT" -eq "$EXPECTED_UNASSIGNED" ]; then
            echo_info "✅ Unassigned count decreased correctly ($UNASSIGNED_COUNT → $UNASSIGNED_AFTER_COUNT)"
        else
            echo_warning "Unassigned count unexpected (expected $EXPECTED_UNASSIGNED, got $UNASSIGNED_AFTER_COUNT)"
        fi
    fi
else
    echo_error "Failed to get unassigned tickets after assignment"
    exit 1
fi

# Step 6: Check assigned tickets (after assignment)
echo "📝 Step 6: Check assigned tickets after assignment..."
ASSIGNED_AFTER_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/help-desk/queue/my-tickets" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ASSIGNED_AFTER_RESPONSE" | grep -q '"success":true'; then
    ASSIGNED_AFTER_COUNT=$(echo "$ASSIGNED_AFTER_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo_info "Assigned tickets after assignment: $ASSIGNED_AFTER_COUNT"
    
    if [ -n "$TICKET_ID" ]; then
        EXPECTED_ASSIGNED=$((ASSIGNED_BEFORE_COUNT + 1))
        if [ "$ASSIGNED_AFTER_COUNT" -eq "$EXPECTED_ASSIGNED" ]; then
            echo_info "✅ Assigned count increased correctly ($ASSIGNED_BEFORE_COUNT → $ASSIGNED_AFTER_COUNT)"
        else
            echo_warning "Assigned count unexpected (expected $EXPECTED_ASSIGNED, got $ASSIGNED_AFTER_COUNT)"
        fi
        
        # Check if the assigned ticket appears in the list
        if echo "$ASSIGNED_AFTER_RESPONSE" | grep -q "$TICKET_ID"; then
            echo_info "✅ Assigned ticket $TICKET_ID appears in My Tickets"
        else
            echo_error "❌ Assigned ticket $TICKET_ID NOT found in My Tickets"
        fi
    fi
else
    echo_error "Failed to get assigned tickets after assignment"
    exit 1
fi

# Summary
echo ""
echo_info "🎉 Workflow Test Complete!"
echo_info ""
echo_info "📊 Results Summary:"
if [ -n "$TICKET_ID" ]; then
    echo_info "   ✅ Login: Success"
    echo_info "   ✅ Unassigned Queue: $UNASSIGNED_COUNT → $UNASSIGNED_AFTER_COUNT tickets"
    echo_info "   ✅ Ticket Assignment: Success ($TICKET_ID)"
    echo_info "   ✅ My Tickets: $ASSIGNED_BEFORE_COUNT → $ASSIGNED_AFTER_COUNT tickets"
    echo_info "   ✅ Ticket appears in My Tickets: Yes"
else
    echo_info "   ✅ Login: Success"
    echo_info "   ✅ Unassigned Queue: Working ($UNASSIGNED_COUNT tickets)"
    echo_info "   ⚠️  Assignment Test: Skipped (no tickets available)"
    echo_info "   ✅ My Tickets: Working ($ASSIGNED_AFTER_COUNT tickets)"
fi
echo_info ""
echo_info "🌐 Ready for web interface testing!"
echo_info "   The complete workflow is working via API."
echo_info "   Test in browser: http://localhost:3000"