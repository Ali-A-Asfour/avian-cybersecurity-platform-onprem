# Sample SonicWall Alert Emails

This directory contains sample SonicWall alert emails for testing the Email Alert Listener.

## Email Format

Each email file represents a typical SonicWall alert email with:
- Subject line with alert type
- Body with severity, timestamp, device identifier, and message
- Realistic SonicWall formatting

## Alert Types Covered

1. **IPS Alerts** - Intrusion Prevention System alerts
2. **VPN Alerts** - VPN tunnel status changes
3. **License Alerts** - License expiration warnings
4. **WAN Alerts** - WAN interface status changes
5. **Interface Alerts** - Network interface status
6. **Resource Alerts** - CPU and memory warnings
7. **Security Alerts** - Gateway AV, Botnet, ATP, Malware
8. **General Alerts** - Miscellaneous security events

## Usage

These sample emails can be used for:
- Manual testing of the email parser
- Integration testing with IMAP servers
- Validation of alert creation logic
- Device matching verification

## File Naming Convention

- `{alert-type}-{severity}-{number}.eml` - Standard format
- Example: `ips-critical-01.eml`, `vpn-high-01.eml`
