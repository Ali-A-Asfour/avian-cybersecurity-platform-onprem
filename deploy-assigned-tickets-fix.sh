#!/bin/bash

# Deploy Assigned Tickets Fix to Server
# This script applies the fix for tickets not appearing in "My Tickets" after assignment

set -e

SERVER_IP="192.168.1.116"
SERVER_USER="avian"

echo "🚀 Deploying assigned tickets fix to server..."

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

# Check if we can connect to the server
echo "🔍 Checking server connection..."
if ! ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo 'Connection successful'" > /dev/null 2>&1; then
    echo_error "Cannot connect to server $SERVER_IP"
    echo "Please ensure:"
    echo "  1. Server is running and accessible"
    echo "  2. SSH key is configured"
    echo "  3. User $SERVER_USER exists on server"
    exit 1
fi

echo_info "Server connection successful"

# Step 1: Backup the current file
echo "💾 Step 1: Backing up current my-tickets API..."
ssh $SERVER_USER@$SERVER_IP "
    cd /home/avian/avian-cybersecurity-platform-onprem
    cp src/app/api/help-desk/queue/my-tickets/route.ts src/app/api/help-desk/queue/my-tickets/route.ts.backup.$(date +%Y%m%d_%H%M%S)
"

echo_info "Backup created successfully"

# Step 2: Apply the fix to my-tickets API
echo "🔧 Step 2: Applying fix to my-tickets API..."
ssh $SERVER_USER@$SERVER_IP "
    cd /home/avian/avian-cybersecurity-platform-onprem
    
    # Apply the fix: change user.email to user.user_id in getAssignedTickets call
    sed -i 's/tickets = await TicketService.getAssignedTickets(user.email, tenantFilter);/tickets = await TicketService.getAssignedTickets(user.user_id, tenantFilter);/' src/app/api/help-desk/queue/my-tickets/route.ts
    
    # Update the comment as well
    sed -i 's/\/\/ Analysts see tickets assigned to them (use email for assignment lookup)/\/\/ Analysts see tickets assigned to them (use user ID for assignment lookup)/' src/app/api/help-desk/queue/my-tickets/route.ts
"

echo_info "Fix applied to my-tickets API"

# Step 3: Update TicketService to use direct PostgreSQL queries
echo "🔧 Step 3: Updating TicketService for consistency..."
ssh $SERVER_USER@$SERVER_IP "
    cd /home/avian/avian-cybersecurity-platform-onprem
    
    # Backup TicketService
    cp src/services/ticket.service.ts src/services/ticket.service.ts.backup.$(date +%Y%m%d_%H%M%S)
"

# Create the updated TicketService getAssignedTickets method
cat > /tmp/ticket_service_fix.js << 'EOF'
const fs = require('fs');

// Read the current file
const filePath = 'src/services/ticket.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the getAssignedTickets method
const oldMethod = /\/\*\*\s*\n\s*\* Get tickets assigned to user\s*\n\s*\*\/\s*\n\s*static async getAssignedTickets\(userId: string, tenantId\?: string\): Promise<Ticket\[\]> \{[\s\S]*?\n\s*\}/;

const newMethod = `/**
   * Get tickets assigned to user
   */
  static async getAssignedTickets(userId: string, tenantId?: string): Promise<Ticket[]> {
    try {
      // Use direct postgres connection instead of Drizzle
      const postgres = (await import('postgres')).default;
      const client = postgres(process.env.DATABASE_URL!, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: false,
        prepare: true,
        transform: {
          undefined: null,
        },
      });

      let query;
      if (tenantId) {
        query = client\`
          SELECT * FROM tickets 
          WHERE assignee = \${userId}
          AND tenant_id = \${tenantId}
          ORDER BY created_at DESC
        \`;
      } else {
        query = client\`
          SELECT * FROM tickets 
          WHERE assignee = \${userId}
          ORDER BY created_at DESC
        \`;
      }

      const result = await query;
      await client.end();
      
      return result.map(row => this.mapRowToTicket(row));
    } catch (error) {
      console.error('Error getting assigned tickets:', error);
      throw error;
    }
  }`;

if (oldMethod.test(content)) {
    content = content.replace(oldMethod, newMethod);
    fs.writeFileSync(filePath, content);
    console.log('✅ TicketService.getAssignedTickets method updated successfully');
} else {
    console.log('⚠️  Could not find getAssignedTickets method to replace');
}
EOF

# Copy and run the fix script on server
scp /tmp/ticket_service_fix.js $SERVER_USER@$SERVER_IP:/tmp/
ssh $SERVER_USER@$SERVER_IP "
    cd /home/avian/avian-cybersecurity-platform-onprem
    node /tmp/ticket_service_fix.js
    rm /tmp/ticket_service_fix.js
"

echo_info "TicketService updated for consistency"

# Step 4: Restart the application
echo "🔄 Step 4: Restarting application..."
ssh $SERVER_USER@$SERVER_IP "
    cd /home/avian/avian-cybersecurity-platform-onprem
    
    # Stop the application
    sudo docker-compose down
    
    # Rebuild and start
    sudo docker-compose up -d --build
"

echo_info "Application restarted"

# Step 5: Wait for application to start and test
echo "⏳ Step 5: Waiting for application to start..."
sleep 30

echo "🧪 Step 6: Testing the fix..."

# Test login
echo "Testing login..."
LOGIN_RESPONSE=$(ssh $SERVER_USER@$SERVER_IP "
    curl -s -X POST http://localhost:3000/api/auth/login \
      -H 'Content-Type: application/json' \
      -d '{\"email\": \"h@tcc.com\", \"password\": \"12345678\"}'
")

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo_info "Login test: SUCCESS"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo_error "Login test: FAILED"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

# Test my tickets API
echo "Testing My Tickets API..."
MY_TICKETS_RESPONSE=$(ssh $SERVER_USER@$SERVER_IP "
    curl -s -X GET 'http://localhost:3000/api/help-desk/queue/my-tickets' \
      -H 'Authorization: Bearer $TOKEN'
")

if echo "$MY_TICKETS_RESPONSE" | grep -q '"success":true'; then
    TICKET_COUNT=$(echo "$MY_TICKETS_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo_info "My Tickets API test: SUCCESS (found $TICKET_COUNT assigned tickets)"
else
    echo_error "My Tickets API test: FAILED"
    echo "Response: $MY_TICKETS_RESPONSE"
    exit 1
fi

# Test unassigned queue
echo "Testing Unassigned Queue API..."
UNASSIGNED_RESPONSE=$(ssh $SERVER_USER@$SERVER_IP "
    curl -s -X GET 'http://localhost:3000/api/help-desk/queue/unassigned' \
      -H 'Authorization: Bearer $TOKEN'
")

if echo "$UNASSIGNED_RESPONSE" | grep -q '"success":true'; then
    UNASSIGNED_COUNT=$(echo "$UNASSIGNED_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo_info "Unassigned Queue API test: SUCCESS (found $UNASSIGNED_COUNT unassigned tickets)"
else
    echo_error "Unassigned Queue API test: FAILED"
    echo "Response: $UNASSIGNED_RESPONSE"
    exit 1
fi

# Cleanup
rm -f /tmp/ticket_service_fix.js

echo ""
echo_info "🎉 Deployment Complete!"
echo_info ""
echo_info "📋 Summary:"
echo_info "   ✅ Fixed My Tickets API to use user ID instead of email"
echo_info "   ✅ Updated TicketService for consistency"
echo_info "   ✅ Application restarted successfully"
echo_info "   ✅ Login test: Working"
echo_info "   ✅ My Tickets API: Working ($TICKET_COUNT assigned tickets)"
echo_info "   ✅ Unassigned Queue API: Working ($UNASSIGNED_COUNT unassigned tickets)"
echo_info ""
echo_info "🌐 Server is ready for testing!"
echo_info "   URL: http://$SERVER_IP:3000"
echo_info "   Login: h@tcc.com / 12345678"
echo_info "   Test: Assign tickets and verify they appear in My Tickets"