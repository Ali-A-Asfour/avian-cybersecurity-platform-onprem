# Settings User Guide

## Accessing Settings

1. Click on your user avatar in the top-right corner
2. Select "Settings" from the dropdown menu
3. Or navigate directly to `/settings`

## Profile Settings

### Updating Your Profile

1. Navigate to the **Profile** tab
2. Update any of the following fields:
   - **Full Name**: Your display name across the platform
   - **Email Address**: Your primary email for communications
   - **Phone Number**: Optional contact number
   - **Timezone**: Select your local timezone for accurate timestamps
   - **Language**: Choose your preferred interface language
3. Click **Save Changes** to apply updates
4. You'll see a success message when changes are saved

### Changing Your Password

1. Navigate to the **Profile** tab
2. Scroll to the "Change Password" section
3. Enter your **Current Password**
4. Enter your **New Password** (minimum 8 characters)
5. Confirm your **New Password**
6. Click **Change Password**
7. You'll receive confirmation when the password is updated

**Password Requirements:**
- Minimum 8 characters
- Must match in both new password fields
- Current password must be correct

### Enabling Multi-Factor Authentication (MFA)

1. Navigate to the **Profile** tab
2. Scroll to the "Multi-Factor Authentication" section
3. Toggle the **Enable MFA** switch to ON
4. Follow the setup wizard (if applicable)
5. Your account now has an extra layer of security

**Benefits of MFA:**
- Enhanced account security
- Protection against unauthorized access
- Required for certain sensitive operations

## Notification Preferences

### Configuring Global Settings

1. Navigate to the **Notifications** tab
2. In the "Global Settings" section:
   - **Email Digest Frequency**: Choose how often to receive email summaries
     - Immediate: Get emails as events occur
     - Hourly: Receive a summary every hour
     - Daily: Get a daily digest
     - Weekly: Receive a weekly summary
   - **Quiet Hours**: Enable to pause notifications during specific times
     - Toggle ON to enable
     - Set Start Time (e.g., 22:00 for 10 PM)
     - Set End Time (e.g., 08:00 for 8 AM)

### Managing Notification Types

1. Navigate to the **Notifications** tab
2. Scroll to the "Notification Types" section
3. For each notification type, toggle channels:
   - **Email**: Receive notifications via email
   - **Push**: Get push notifications in the app
   - **SMS**: Receive text message alerts (if configured)

**Available Notification Types:**
- **Ticket Assignments**: When a ticket is assigned to you
- **Ticket Status Changes**: When ticket status updates
- **SLA Breaches**: When tickets breach SLA deadlines
- **High Severity Alerts**: Critical security alerts
- **Compliance Updates**: Framework and control changes
- **Escalations**: When tickets are escalated to you

4. Click **Save Preferences** to apply changes

## System Configuration

### Managing API Keys

#### Creating a New API Key

1. Navigate to the **System** tab
2. In the "API Keys" section, click **Create New Key**
3. Enter a descriptive name (e.g., "Production API Key")
4. Click **Create Key**
5. **IMPORTANT**: Copy the API key immediately
   - Click **Copy to Clipboard**
   - Store it securely
   - You won't be able to see it again
6. Click **Done** when finished

**API Key Best Practices:**
- Use descriptive names to identify purpose
- Create separate keys for different environments
- Rotate keys regularly
- Never share keys publicly
- Store keys securely (use environment variables)

#### Deleting an API Key

1. Navigate to the **System** tab
2. Find the API key you want to delete
3. Click the **Delete** button
4. Confirm the deletion in the dialog
5. The key is immediately revoked

**Warning**: Deleting an API key will break any integrations using that key.

### Managing Integrations

#### Enabling an Integration

1. Navigate to the **System** tab
2. Scroll to the "Integrations" section
3. Find the integration you want to enable
4. Toggle the switch to ON
5. The integration status will update to "connected"

**Available Integrations:**
- **Microsoft 365**: Identity provider integration
- **Slack**: Notification delivery
- **Jira**: Ticketing system integration
- **Splunk**: SIEM integration

#### Syncing an Integration

1. Navigate to the **System** tab
2. Find the integration you want to sync
3. Click the **Sync** button
4. Wait for the sync to complete
5. The "Last synced" timestamp will update

**When to Sync:**
- After making configuration changes
- When data appears out of date
- Troubleshooting integration issues
- Regular maintenance (weekly recommended)

#### Disabling an Integration

1. Navigate to the **System** tab
2. Find the integration you want to disable
3. Toggle the switch to OFF
4. The integration status will update to "disconnected"

**Note**: Disabling an integration stops data flow but preserves configuration.

## Demo Mode

### Enabling Demo Mode

1. Navigate to the **Demo Mode** tab
2. Toggle **Enable Demo Mode** to ON
3. A role switcher will appear in the interface
4. Use it to test different user roles and permissions

**Demo Mode Features:**
- Role switcher for testing
- Sample data for demonstration
- Safe environment for exploration
- No impact on production data

### Disabling Demo Mode

1. Navigate to the **Demo Mode** tab
2. Toggle **Enable Demo Mode** to OFF
3. The role switcher will be hidden
4. Return to normal operation mode

## Troubleshooting

### Changes Not Saving

**Problem**: Settings changes don't persist

**Solutions**:
1. Check your internet connection
2. Ensure you clicked the "Save" button
3. Look for error messages on the page
4. Try refreshing the page and re-entering changes
5. Clear browser cache and try again

### Password Change Failed

**Problem**: Unable to change password

**Solutions**:
1. Verify current password is correct
2. Ensure new password meets requirements (8+ characters)
3. Confirm new passwords match
4. Check for error messages
5. Contact support if issue persists

### API Key Not Working

**Problem**: API key returns authentication errors

**Solutions**:
1. Verify you copied the complete key
2. Check if key was deleted
3. Ensure key hasn't expired
4. Verify key has necessary permissions
5. Create a new key if needed

### Integration Not Syncing

**Problem**: Integration sync fails or shows errors

**Solutions**:
1. Check integration is enabled
2. Verify integration credentials are valid
3. Check integration service status
4. Review error messages in status
5. Try disabling and re-enabling integration
6. Contact support for persistent issues

## Security Best Practices

### Profile Security
- Use a strong, unique password
- Enable MFA for enhanced security
- Keep email address up to date
- Review account activity regularly
- Never share your credentials

### API Key Security
- Create separate keys for each application
- Use descriptive names for tracking
- Rotate keys regularly (every 90 days)
- Delete unused keys immediately
- Store keys in secure vaults
- Never commit keys to version control
- Use environment variables in code

### Notification Security
- Review notification preferences regularly
- Be cautious with SMS notifications (carrier security)
- Use quiet hours to prevent alert fatigue
- Verify email addresses are correct
- Report suspicious notifications immediately

## Support

If you need help with settings:
1. Check this user guide first
2. Review error messages carefully
3. Try the troubleshooting steps
4. Contact your system administrator
5. Submit a support ticket if needed

**Support Contact:**
- Email: support@example.com
- Help Desk: Available in the app
- Documentation: /docs
