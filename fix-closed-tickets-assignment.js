/**
 * Script to fix the assigned_to field in closed tickets to match current user
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
  process.exit(1);
}

// Current user ID from the login response
const currentUserId = "0a24b509-6e8f-4162-8687-f9a8ed71f9cc";

// Update closed tickets to be assigned to current user
let updatedCount = 0;
ticketsArray.forEach(([id, ticket]) => {
  if ((ticket.status === 'resolved' || ticket.status === 'closed') && ticket.assigned_to !== currentUserId) {
    console.log(`🔧 Updating ticket ${id}: ${ticket.title}`);
    console.log(`   Old assigned_to: ${ticket.assigned_to}`);
    console.log(`   New assigned_to: ${currentUserId}`);
    ticket.assigned_to = currentUserId;
    updatedCount++;
  }
});

// Save updated tickets
try {
  fs.writeFileSync(dataFile, JSON.stringify(ticketsArray, null, 2));
  console.log(`✅ Updated ${updatedCount} closed tickets`);
  console.log(`💾 Total tickets: ${ticketsArray.length}`);
} catch (error) {
  console.error('❌ Error saving tickets:', error);
}