/**
 * Script to fix ticket assignments on server to match server user ID
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

// Server user ID from the login response
const serverUserId = "679f8c1c-9493-4ba2-8314-7262f06243c5";
const serverTenantId = "577e0ffa-b27e-468f-9846-1146c7820659";

// Update closed tickets to be assigned to server user
let updatedCount = 0;
ticketsArray.forEach(([id, ticket]) => {
  if ((ticket.status === 'resolved' || ticket.status === 'closed')) {
    console.log(`🔧 Updating ticket ${id}: ${ticket.title}`);
    console.log(`   Old assigned_to: ${ticket.assigned_to}`);
    console.log(`   New assigned_to: ${serverUserId}`);
    console.log(`   Old tenant_id: ${ticket.tenant_id}`);
    console.log(`   New tenant_id: ${serverTenantId}`);
    
    ticket.assigned_to = serverUserId;
    ticket.tenant_id = serverTenantId;
    updatedCount++;
  }
});

// Save updated tickets
try {
  fs.writeFileSync(dataFile, JSON.stringify(ticketsArray, null, 2));
  console.log(`✅ Updated ${updatedCount} closed tickets for server`);
  console.log(`💾 Total tickets: ${ticketsArray.length}`);
} catch (error) {
  console.error('❌ Error saving tickets:', error);
}