/**
 * Script to create test knowledge base articles
 */

const fs = require('fs');
const path = require('path');

// Create knowledge base data file
const dataFile = path.join(process.cwd(), '.knowledge-base-store.json');

// Server user and tenant IDs
const serverUserId = "679f8c1c-9493-4ba2-8314-7262f06243c5";
const serverTenantId = "577e0ffa-b27e-468f-9846-1146c7820659";

// Test knowledge base articles
const testArticles = [
  [
    "kb-email-config-001",
    {
      "id": "kb-email-config-001",
      "title": "Solution: Email Configuration Issues in Outlook",
      "content": "## Problem\n\nUsers unable to access email due to incorrect IMAP settings in Outlook.\n\n## Solution\n\n1. Open Outlook and go to File > Account Settings\n2. Select the email account and click Change\n3. Update IMAP server settings:\n   - Incoming server: mail.company.com\n   - Port: 993\n   - Encryption: SSL/TLS\n4. Update SMTP settings:\n   - Outgoing server: smtp.company.com\n   - Port: 587\n   - Encryption: STARTTLS\n5. Test account settings and save\n\n## Additional Notes\n\nEnsure firewall allows connections to mail servers on specified ports.",
      "category": "email",
      "tags": ["outlook", "email", "imap", "configuration"],
      "status": "approved",
      "created_at": "2026-01-28T15:00:00.000Z",
      "updated_at": "2026-01-28T15:00:00.000Z",
      "created_by": serverUserId,
      "tenant_id": serverTenantId,
      "ticket_id": "ticket-closed-test-001",
      "resolution": "Updated the Outlook IMAP settings to use the correct server configuration. User can now access email successfully.",
      "views": 15,
      "helpful_votes": 8,
      "not_helpful_votes": 1
    }
  ],
  [
    "kb-password-reset-002",
    {
      "id": "kb-password-reset-002", 
      "title": "How to Reset Domain Account Passwords",
      "content": "## Problem\n\nUser needs domain account password reset due to forgotten password or account lockout.\n\n## Solution\n\n### For Help Desk Staff:\n\n1. **Verify User Identity**\n   - Confirm user's full name and employee ID\n   - Verify via phone call to registered number\n   - Check photo ID if in person\n\n2. **Reset Password**\n   - Open Active Directory Users and Computers\n   - Locate user account\n   - Right-click > Reset Password\n   - Generate temporary password\n   - Require password change at next logon\n\n3. **Communicate New Password**\n   - Provide temporary password securely\n   - Instruct user to change password immediately\n   - Verify user can log in successfully\n\n### Security Notes\n\n- Always verify identity before resetting passwords\n- Use secure communication methods\n- Document the reset in ticket system\n- Follow company password policy requirements",
      "category": "security",
      "tags": ["password", "reset", "active-directory", "security"],
      "status": "approved",
      "created_at": "2026-01-29T10:00:00.000Z",
      "updated_at": "2026-01-29T10:00:00.000Z",
      "created_by": serverUserId,
      "tenant_id": serverTenantId,
      "ticket_id": "ticket-closed-test-002",
      "resolution": "Password has been reset successfully. User confirmed they can log in with the new temporary password.",
      "views": 23,
      "helpful_votes": 12,
      "not_helpful_votes": 0
    }
  ],
  [
    "kb-printer-issues-003",
    {
      "id": "kb-printer-issues-003",
      "title": "Troubleshooting Network Printer Connection Problems",
      "content": "## Problem\n\nNetwork printers not responding or showing offline status.\n\n## Common Causes\n\n1. **Print Spooler Service Issues**\n2. **Network Connectivity Problems**\n3. **Driver Conflicts**\n4. **Queue Blockages**\n\n## Solution Steps\n\n### Step 1: Check Print Spooler Service\n\n1. Open Services (services.msc)\n2. Locate \"Print Spooler\" service\n3. If stopped, right-click and select Start\n4. If running but problematic, restart the service\n\n### Step 2: Clear Print Queue\n\n1. Stop Print Spooler service\n2. Navigate to C:\\Windows\\System32\\spool\\PRINTERS\n3. Delete all files in the folder\n4. Restart Print Spooler service\n\n### Step 3: Network Connectivity\n\n1. Ping printer IP address\n2. Check network cable connections\n3. Verify printer is on correct VLAN\n4. Test from different workstation\n\n### Step 4: Driver Issues\n\n1. Update printer drivers\n2. Remove and reinstall printer\n3. Use generic PCL drivers if needed\n\n## Prevention\n\n- Regular print spooler service monitoring\n- Keep printer drivers updated\n- Monitor print queue sizes\n- Implement printer health checks",
      "category": "hardware",
      "tags": ["printer", "network", "spooler", "troubleshooting"],
      "status": "approved",
      "created_at": "2026-01-29T11:00:00.000Z",
      "updated_at": "2026-01-29T11:00:00.000Z",
      "created_by": serverUserId,
      "tenant_id": serverTenantId,
      "ticket_id": "ticket-closed-test-003",
      "resolution": "Print spooler service restart resolved the issue. Printer is now responding normally and test pages print successfully.",
      "views": 31,
      "helpful_votes": 18,
      "not_helpful_votes": 2
    }
  ],
  [
    "kb-vpn-setup-004",
    {
      "id": "kb-vpn-setup-004",
      "title": "VPN Setup Guide for Remote Workers",
      "content": "## Problem\n\nRemote workers need secure access to company resources via VPN connection.\n\n## Solution\n\n### Windows VPN Setup\n\n1. **Download VPN Client**\n   - Install company-approved VPN client\n   - Obtain configuration file from IT\n\n2. **Configure Connection**\n   - Import configuration file\n   - Enter provided credentials\n   - Test connection\n\n3. **Verify Access**\n   - Connect to VPN\n   - Test access to internal resources\n   - Verify IP address shows company range\n\n### Troubleshooting Common Issues\n\n- **Connection Timeouts**: Check firewall settings\n- **Authentication Failures**: Verify credentials\n- **DNS Issues**: Configure DNS servers\n- **Speed Problems**: Check bandwidth and server load\n\n### Security Best Practices\n\n- Always disconnect when not needed\n- Use strong authentication\n- Keep VPN client updated\n- Report connection issues immediately",
      "category": "network",
      "tags": ["vpn", "remote-access", "security", "setup"],
      "status": "approved",
      "created_at": "2026-01-29T12:00:00.000Z",
      "updated_at": "2026-01-29T12:00:00.000Z",
      "created_by": serverUserId,
      "tenant_id": serverTenantId,
      "views": 45,
      "helpful_votes": 22,
      "not_helpful_votes": 3
    }
  ],
  [
    "kb-software-install-005",
    {
      "id": "kb-software-install-005",
      "title": "Standard Software Installation Procedures",
      "content": "## Problem\n\nUsers need approved software installed on their workstations.\n\n## Pre-Installation Checklist\n\n1. **Verify Software Approval**\n   - Check approved software list\n   - Confirm licensing availability\n   - Validate business justification\n\n2. **System Requirements**\n   - Check hardware compatibility\n   - Verify OS version support\n   - Ensure sufficient disk space\n\n## Installation Process\n\n### Standard Applications\n\n1. Use Software Center (SCCM)\n2. Select approved application\n3. Click Install\n4. Monitor installation progress\n5. Verify successful installation\n\n### Custom Software\n\n1. Obtain installation media\n2. Run as administrator\n3. Follow installation wizard\n4. Configure application settings\n5. Test functionality\n\n## Post-Installation\n\n- Update software to latest version\n- Configure user preferences\n- Document installation in asset management\n- Provide user training if needed\n\n## Common Issues\n\n- **Permission Errors**: Run as administrator\n- **Compatibility Issues**: Check system requirements\n- **License Errors**: Verify license availability\n- **Installation Failures**: Check logs and retry",
      "category": "software",
      "tags": ["installation", "software", "sccm", "procedures"],
      "status": "approved",
      "created_at": "2026-01-29T13:00:00.000Z",
      "updated_at": "2026-01-29T13:00:00.000Z",
      "created_by": serverUserId,
      "tenant_id": serverTenantId,
      "views": 28,
      "helpful_votes": 15,
      "not_helpful_votes": 1
    }
  ]
];

// Save test articles
try {
  fs.writeFileSync(dataFile, JSON.stringify(testArticles, null, 2));
  console.log(`✅ Created ${testArticles.length} test knowledge base articles`);
  console.log('📚 Articles created:');
  testArticles.forEach(([id, article]) => {
    console.log(`  - ${article.title} (${article.category})`);
  });
  console.log(`📊 Total views: ${testArticles.reduce((sum, [, article]) => sum + article.views, 0)}`);
  console.log(`👍 Total helpful votes: ${testArticles.reduce((sum, [, article]) => sum + article.helpful_votes, 0)}`);
} catch (error) {
  console.error('❌ Error creating test knowledge base articles:', error);
}