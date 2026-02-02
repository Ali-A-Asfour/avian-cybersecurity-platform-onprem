# Email Alert Listener

## Overview

The `EmailAlertListener` class listens for SonicWall alert emails via IMAP and creates alert records in the AVIAN platform. It implements email parsing, device matching, and duplicate detection.

## Requirements

Implements Requirements 11.1-11.10 from the SonicWall Firewall Integration specification.

## Features

- **IMAP Email Monitoring**: Connects to email inbox and checks for new emails every 5 minutes
- **Email Parsing**: Extracts alert type, severity, timestamp, and device identifier from email content
- **Device Matching**: Matches device identifiers (serial number, IP, hostname) to registered devices
- **Duplicate Detection**: Prevents duplicate alerts using AlertManager's deduplication logic
- **Alert Creation**: Creates alert records with source="email" for tracking

## Usage

```typescript
import { EmailAlertListener } from './email-alert-listener';

// Configure email connection
const config = {
    host: 'imap.example.com',
    port: 993,
    user: 'alerts@example.com',
    password: 'password',
    tls: true,
};

// Create listener
const listener = new EmailAlertListener(config);

// Start listening
await listener.start();

// Stop listening
await listener.stop();
```

## Email Parsing

### Alert Type Detection (Requirement 11.2)

The listener extracts alert types from email subjects using pattern matching:

- `IPS Alert` → `ips_alert`
- `VPN Down` → `vpn_down`
- `License Expiring` → `license_expiring`
- `WAN Down` → `wan_down`
- `Interface Down` → `interface_down`
- `High CPU` → `high_cpu`
- `High Memory` → `high_memory`
- `Gateway AV` → `gav_alert`
- `Malware` → `malware_detected`
- `Botnet` → `botnet_alert`
- `ATP` → `atp_alert`
- `Intrusion` → `ips_alert`
- `Security Alert` → `security_alert`

### Severity Extraction (Requirement 11.3)

Severity is extracted from email body text:

- `critical`, `emergency` → `critical`
- `high`, `urgent` → `high`
- `medium`, `warning` → `medium`
- `low` → `low`
- Default → `info`

### Device Identifier Extraction (Requirement 11.5)

The listener attempts to extract device identifiers in this order:

1. **Serial Number**: 12+ character alphanumeric string (e.g., `C0EAE4XXXXXX`)
2. **IP Address**: Standard IPv4 format (e.g., `192.168.1.1`)
3. **Hostname**: Extracted from patterns like `hostname: firewall-01`

### Device Matching (Requirements 11.6-11.7)

Device identifiers are matched to registered devices by:

1. Serial number (exact match)
2. Management IP (exact match)
3. Hostname (stored in model field)

If no match is found, the alert is logged and skipped (can be configured to create with `device_id=null` for manual review).

## Duplicate Detection (Requirement 11.10)

The listener uses AlertManager's deduplication logic to prevent duplicate alerts:

- Same `alert_type` + `device_id` + `severity` within 5 minutes = duplicate
- Leverages Redis-based deduplication with TTL

## Email Processing Flow

1. **Connect to IMAP**: Establish connection to email server
2. **Fetch Unread Emails**: Search for unread emails in INBOX
3. **Filter SonicWall Emails**: Check if email is from SonicWall sender
4. **Parse Email**: Extract alert type, severity, timestamp, device identifier
5. **Match Device**: Resolve device identifier to device_id
6. **Check Duplicate**: Use AlertManager deduplication
7. **Create Alert**: Create alert record with source="email"
8. **Mark Processed**: Mark email as read (logged for now)

## Configuration

### Environment Variables

```bash
# Email configuration
EMAIL_HOST=imap.example.com
EMAIL_PORT=993
EMAIL_USER=alerts@example.com
EMAIL_PASSWORD=your-password
EMAIL_TLS=true
```

### Check Interval

The listener checks for new emails every 5 minutes by default. This can be adjusted by modifying `CHECK_INTERVAL_MS` in the class.

## Error Handling

- **IMAP Connection Errors**: Logged and retried on next check interval
- **Email Parsing Errors**: Logged and skipped, processing continues
- **Device Matching Failures**: Alert logged, email skipped
- **Alert Creation Errors**: Logged and thrown for visibility

## Integration with AlertManager

The EmailAlertListener integrates with AlertManager for:

- **Alert Creation**: Uses `AlertManager.createAlert()` with source="email"
- **Deduplication**: Uses `AlertManager.deduplicateAlert()` to prevent duplicates
- **Tenant Isolation**: Ensures alerts are associated with correct tenant

## Testing

See `src/lib/__tests__/email-alert-listener.test.ts` for unit tests covering:

- Email parsing (alert type, severity, device identifier)
- Device matching logic
- Duplicate detection
- Alert creation from emails
- Error handling

## Future Enhancements

- **Email Folder Management**: Move processed emails to "Processed" folder
- **Email Marking**: Mark emails as read using IMAP commands
- **Advanced Parsing**: Support more email formats and patterns
- **Attachment Processing**: Parse attachments for additional context
- **Multi-Sender Support**: Support alerts from multiple firewall vendors

## Related Components

- `AlertManager`: Handles alert creation and deduplication
- `PollingEngine`: Creates alerts from API polling
- `firewallDevices`: Device registry for matching
- `firewallAlerts`: Alert storage table

## Requirements Mapping

| Requirement | Description | Implementation |
|-------------|-------------|----------------|
| 11.1 | IMAP email retrieval | `fetchUnreadEmails()`, 5-minute check interval |
| 11.2 | Extract alert type from subject | `extractAlertType()` with pattern matching |
| 11.3 | Extract severity from body | `extractSeverity()` with keyword matching |
| 11.4 | Extract timestamp | Uses email date header |
| 11.5 | Extract device identifier | `extractDeviceIdentifier()` for serial/IP/hostname |
| 11.6 | Match device identifier | `matchDevice()` with serial/IP/hostname lookup |
| 11.7 | Handle unmatched devices | Logged and skipped (configurable) |
| 11.8 | Set source="email" | Alert created with `source: 'email'` |
| 11.9 | Mark email as processed | `markEmailAsProcessed()` (logged for now) |
| 11.10 | Duplicate detection | Uses AlertManager deduplication |
