# Migration 0014: Firewall Security Posture Table

## Overview
This migration creates the `firewall_security_posture` table for tracking security feature status and daily block counts from SonicWall firewalls.

## Purpose
The security posture table stores:
- **Security Feature Status**: Enabled/disabled state for IPS, GAV, DPI-SSL, ATP, Botnet Filter, Application Control, and Content Filtering
- **License Status**: Active, expiring (within 30 days), or expired for each licensed feature
- **Daily Block Counts**: Number of threats/blocks detected by each security feature today
- **Certificate Status**: DPI-SSL certificate validity status

## Table Structure

### Security Features Tracked
1. **IPS (Intrusion Prevention System)**
   - Enabled status
   - License status
   - Daily blocks count

2. **GAV (Gateway Anti-Virus)**
   - Enabled status
   - License status
   - Daily blocks count (malware)

3. **DPI-SSL (Deep Packet Inspection - SSL)**
   - Enabled status
   - Certificate status
   - Daily blocks count

4. **ATP (Advanced Threat Protection)**
   - Enabled status
   - License status
   - Daily verdicts count

5. **Botnet Filter**
   - Enabled status
   - Daily blocks count

6. **Application Control**
   - Enabled status
   - License status
   - Daily blocks count

7. **Content Filtering**
   - Enabled status
   - License status
   - Daily blocks count

## Data Retention
- **Retention Period**: 30 days for trending analysis
- **Update Frequency**: Updated when security posture changes or daily during polling

## Indexes
- `idx_security_posture_device`: Composite index on (device_id, timestamp DESC) for fast device queries
- `idx_security_posture_timestamp`: Index on timestamp for time-based queries

## Constraints
- **Foreign Key**: device_id references firewall_devices(id) with CASCADE delete
- **License Status**: Must be 'active', 'expiring', or 'expired' (or NULL)
- **Certificate Status**: Must be 'valid', 'expiring', or 'expired' (or NULL)
- **Counter Values**: All daily block/verdict counts must be >= 0

## Usage in Application

### Polling Engine
The polling engine will:
1. Query SonicWall API for security statistics
2. Extract enabled status from API response or infer from counter presence
3. Extract license status from license API endpoint
4. Store daily block counts from summary counters
5. Create/update posture record when changes detected

### Alert Generation
Alerts are generated when:
- Any security feature changes from enabled to disabled (CRITICAL)
- License status changes to 'expiring' (WARNING)
- License status changes to 'expired' (CRITICAL)

### Dashboard Display
The security posture panel displays:
- Feature status grid with green checkmarks (enabled) or red X (disabled)
- License expiry dates with warning badges
- Daily block counters for each feature
- Trend analysis over 7/30 days

## Related Requirements
- **Requirement 2.5**: Security feature status detection
- **Requirement 2.11**: Alert generation for disabled features
- **Requirement 4**: Security Posture Tracking
- **Requirement 7.11-7.17**: Security feature status inference from counters

## Related Design Components
- **Data Models**: firewall_security_posture schema
- **Polling Engine**: storeSecurityPosture() method
- **Alert Manager**: Feature disabled alert generation
- **Dashboard**: SecurityPosturePanel component

## Testing
See `test_0014.sql` for validation queries.

## Rollback
To rollback this migration:
```sql
DROP TABLE IF EXISTS "firewall_security_posture" CASCADE;
```

## Dependencies
- Requires migration 0012 (firewall_devices table)
- Required by polling engine implementation
- Required by security posture API endpoints
