/**
 * Script to create test closed/resolved tickets for testing
 */

const fs = require('fs');
const path = require('path');

// Load existing tickets
const dataFile = path.join(process.cwd(), '.tickets-store.json');
let ticketsArray = [];

try {
  if (fs.existsSync(dataFile)) {
    const data = fs.readFileSync(dataFile, 'utf8');
    ticketsArray = JSON.parse(data);
    console.log(`📂 Loaded ${ticketsArray.length} existing tickets`);
  }
} catch (error) {
  console.error('Error loading existing tickets:', error);
}

// Create test closed tickets
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

const closedTickets = [
  [
    "ticket-closed-test-001",
    {
      "id": "ticket-closed-test-001",
      "title": "Resolved - Email Configuration Issue",
      "description": "User unable to access email. Issue was resolved by updating Outlook settings.",
      "severity": "medium",
      "contactMethod": "email",
      "status": "resolved",
      "priority": "medium",
      "created_at": twoDaysAgo.toISOString(),
      "created_by": "user-test-001",
      "assigned_to": "40c747b5-c1ab-458f-a5e1-12c972b29f3a", // h@tcc.com user ID
      "tenant_id": "85cfd918-8558-4baa-9534-25454aea76a8", // ESR tenant
      "category": "it_support",
      "requester_email": "user@esr.com",
      "tags": ["email", "outlook"],
      "updated_at": yesterday.toISOString(),
      "queue_position_updated_at": twoDaysAgo.toISOString(),
      "requester": "user@esr.com"
    }
  ],
  [
    "ticket-closed-test-002", 
    {
      "id": "ticket-closed-test-002",
      "title": "Closed - Password Reset Request",
      "description": "User requested password reset for domain account. Reset completed successfully.",
      "severity": "low",
      "contactMethod": "phone",
      "phoneNumber": "+1-555-0123",
      "status": "closed",
      "priority": "low",
      "created_at": twoDaysAgo.toISOString(),
      "created_by": "user-test-002",
      "assigned_to": "40c747b5-c1ab-458f-a5e1-12c972b29f3a", // h@tcc.com user ID
      "tenant_id": "85cfd918-8558-4baa-9534-25454aea76a8", // ESR tenant
      "category": "it_support",
      "requester_email": "user2@esr.com",
      "tags": ["password", "reset"],
      "updated_at": now.toISOString(),
      "queue_position_updated_at": twoDaysAgo.toISOString(),
      "requester": "user2@esr.com"
    }
  ],
  [
    "ticket-closed-test-003",
    {
      "id": "ticket-closed-test-003", 
      "title": "Resolved - Printer Connection Problem",
      "description": "Network printer not responding. Issue resolved by restarting print spooler service.",
      "severity": "medium",
      "contactMethod": "email",
      "status": "resolved",
      "priority": "medium", 
      "created_at": yesterday.toISOString(),
      "created_by": "user-test-003",
      "assigned_to": "40c747b5-c1ab-458f-a5e1-12c972b29f3a", // h@tcc.com user ID
      "tenant_id": "85cfd918-8558-4baa-9534-25454aea76a8", // ESR tenant
      "category": "it_support",
      "requester_email": "user3@esr.com",
      "tags": ["printer", "network"],
      "updated_at": now.toISOString(),
      "queue_position_updated_at": yesterday.toISOString(),
      "requester": "user3@esr.com",
      "device_name": "PRINTER-LAB-01"
    }
  ]
];

// Add closed tickets to existing tickets
ticketsArray.push(...closedTickets);

// Save updated tickets
try {
  fs.writeFileSync(dataFile, JSON.stringify(ticketsArray, null, 2));
  console.log(`✅ Added ${closedTickets.length} closed tickets`);
  console.log(`💾 Total tickets now: ${ticketsArray.length}`);
  console.log('📋 Closed ticket IDs:');
  closedTickets.forEach(([id, ticket]) => {
    console.log(`  - ${id}: ${ticket.title} (${ticket.status})`);
  });
} catch (error) {
  console.error('❌ Error saving tickets:', error);
}