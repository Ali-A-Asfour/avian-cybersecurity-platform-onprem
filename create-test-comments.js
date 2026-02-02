/**
 * Script to create test comments for existing closed tickets
 */

const fs = require('fs');
const path = require('path');

// Create comments data file
const dataFile = path.join(process.cwd(), '.comments-store.json');

// Test comments for the closed tickets
const testComments = [
  // Comments for ticket-closed-test-001 (Email Configuration Issue)
  [
    "comment-test-001-1",
    {
      "id": "comment-test-001-1",
      "ticket_id": "ticket-closed-test-001",
      "user_id": "679f8c1c-9493-4ba2-8314-7262f06243c5", // Server user ID
      "content": "I've checked the user's Outlook configuration and found the issue with the IMAP settings.",
      "is_internal": false,
      "created_at": "2026-01-27T16:00:00.000Z",
      "updated_at": "2026-01-27T16:00:00.000Z",
      "author_name": "h@tcc.com",
      "author_email": "h@tcc.com"
    }
  ],
  [
    "comment-test-001-2", 
    {
      "id": "comment-test-001-2",
      "ticket_id": "ticket-closed-test-001",
      "user_id": "679f8c1c-9493-4ba2-8314-7262f06243c5",
      "content": "**Ticket Resolved**\n\nUpdated the Outlook IMAP settings to use the correct server configuration. User can now access email successfully.",
      "is_internal": false,
      "created_at": "2026-01-28T14:30:00.000Z",
      "updated_at": "2026-01-28T14:30:00.000Z",
      "author_name": "h@tcc.com",
      "author_email": "h@tcc.com"
    }
  ],

  // Comments for ticket-closed-test-002 (Password Reset Request)
  [
    "comment-test-002-1",
    {
      "id": "comment-test-002-1", 
      "ticket_id": "ticket-closed-test-002",
      "user_id": "679f8c1c-9493-4ba2-8314-7262f06243c5",
      "content": "Verified user identity via phone call. Proceeding with password reset.",
      "is_internal": true,
      "created_at": "2026-01-27T17:00:00.000Z",
      "updated_at": "2026-01-27T17:00:00.000Z",
      "author_name": "h@tcc.com",
      "author_email": "h@tcc.com"
    }
  ],
  [
    "comment-test-002-2",
    {
      "id": "comment-test-002-2",
      "ticket_id": "ticket-closed-test-002", 
      "user_id": "679f8c1c-9493-4ba2-8314-7262f06243c5",
      "content": "**Ticket Resolved**\n\nPassword has been reset successfully. User confirmed they can log in with the new temporary password.",
      "is_internal": false,
      "created_at": "2026-01-29T14:45:00.000Z",
      "updated_at": "2026-01-29T14:45:00.000Z",
      "author_name": "h@tcc.com",
      "author_email": "h@tcc.com"
    }
  ],

  // Comments for ticket-closed-test-003 (Printer Connection Problem)
  [
    "comment-test-003-1",
    {
      "id": "comment-test-003-1",
      "ticket_id": "ticket-closed-test-003",
      "user_id": "679f8c1c-9493-4ba2-8314-7262f06243c5",
      "content": "Checked the printer status remotely. Print spooler service appears to be stuck.",
      "is_internal": false,
      "created_at": "2026-01-28T10:00:00.000Z",
      "updated_at": "2026-01-28T10:00:00.000Z",
      "author_name": "h@tcc.com",
      "author_email": "h@tcc.com"
    }
  ],
  [
    "comment-test-003-2",
    {
      "id": "comment-test-003-2",
      "ticket_id": "ticket-closed-test-003",
      "user_id": "679f8c1c-9493-4ba2-8314-7262f06243c5",
      "content": "Restarted the print spooler service on the server. Testing print functionality now.",
      "is_internal": false,
      "created_at": "2026-01-28T10:15:00.000Z",
      "updated_at": "2026-01-28T10:15:00.000Z",
      "author_name": "h@tcc.com",
      "author_email": "h@tcc.com"
    }
  ],
  [
    "comment-test-003-3",
    {
      "id": "comment-test-003-3",
      "ticket_id": "ticket-closed-test-003",
      "user_id": "679f8c1c-9493-4ba2-8314-7262f06243c5",
      "content": "**Ticket Resolved**\n\nPrint spooler service restart resolved the issue. Printer is now responding normally and test pages print successfully.",
      "is_internal": false,
      "created_at": "2026-01-29T14:50:00.000Z",
      "updated_at": "2026-01-29T14:50:00.000Z",
      "author_name": "h@tcc.com",
      "author_email": "h@tcc.com"
    }
  ]
];

// Save test comments
try {
  fs.writeFileSync(dataFile, JSON.stringify(testComments, null, 2));
  console.log(`✅ Created ${testComments.length} test comments`);
  console.log('📋 Comments created for tickets:');
  console.log('  - ticket-closed-test-001: 2 comments (1 troubleshooting + 1 resolution)');
  console.log('  - ticket-closed-test-002: 2 comments (1 internal + 1 resolution)');
  console.log('  - ticket-closed-test-003: 3 comments (2 troubleshooting + 1 resolution)');
} catch (error) {
  console.error('❌ Error creating test comments:', error);
}