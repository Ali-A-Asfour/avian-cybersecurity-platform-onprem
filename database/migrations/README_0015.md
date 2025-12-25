# Migration 0015: Firewall Licenses Table

## Overview
This migration creates the `firewall_licenses` table for tracking license expiration dates and generating alerts for expiring or expired licenses.

## Purpose
The licenses table stores:
- **License Expiry Dates**: Expiration dates for all security feature licenses
- **Support Expiry**: Support contract expiration date
- **License Warnings**: JSON array of warning messages for expiring/expired licenses
- **Timestamp**: When the license information was last updated

## Table Structure

### License Types Tracked
1. **IPS (Intrusion Prevention System)** - ips_expiry
2. **GAV (Gateway Anti-Virus)** - gav_expiry
3. **ATP (Advanced Threat Protection)** - atp_expiry
4. **Application Control** - app_control_expiry
5. **Content Filtering** - content_filter_expiry
6. **Support Contract** - support_expiry

### License Warnings
The `license_warnings` JSONB column stores an array of human-readable warning messages:
- Example: `["IPS expiring in 15 days", "GAV expired", "Support expiring in 10 days"]`
- Updated during polling based on expiry date calculations
- Used for quick dashboard display without date calculations

## Data Retention
- **Retention Period**: Latest record per device (historical records optional)
- **Update Frequency**: Updated during API polling when license information changes

## Indexes
- `idx_licenses_device`: Composite index on (device_id, timestamp DESC) for fast device queries
- `idx_licenses_timestamp`: Index on timestamp for time-based queries
- `idx_licenses_ips_expiry`: Partial index on ips_expiry (WHERE NOT NULL) for expiry queries
- `idx_licenses_gav_expiry`: Partial index on gav_expiry (WHERE NOT NULL) for expiry queries
- `idx_licenses_atp_expiry`: Partial index on atp_expiry (WHERE NOT NULL) for expiry queries
- `idx_licenses_app_control_expiry`: Partial index on app_control_expiry (WHERE NOT NULL)
- `idx_licenses_content_filter_expiry`: Partial index on content_filter_expiry (WHERE NOT NULL)
- `idx_licenses_support_expiry`: Partial index on support_expiry (WHERE NOT NULL)

## Constraints
- **Foreign Key**: device_id references firewall_devices(id) with CASCADE delete
- **NOT NULL**: device_id is required
- **Date Type**: All expiry columns are DATE type (nullable)
- **JSONB Default**: license_warnings defaults to empty array '[]'

## Usage in Application

### Polling Engine
The polling engine will:
1. Query SonicWall API endpoint: `GET /api/sonicos/licenses`
2. Extract expiry dates for each license type
3. Calculate days remaining for each license
4. Generate warning messages for licenses expiring within 30 days
5. Generate warning messages for expired licenses
6. Store/update license record with warnings array

### Alert Generation
Alerts are generated when:
- **License expiring within 30 days**: WARNING alert
  - Example: "IPS license expiring in 25 days"
- **License expired**: CRITICAL alert
  - Example: "Gateway Anti-Virus license expired"

### Dashboard Display
The license status panel displays:
- License name and expiry date
- Days remaining calculation
- Status badge:
  - Green: > 30 days remaining
  - Yellow: 1-30 days remaining (expiring soon)
  - Red: Expired (past expiry date)
- Warning messages from license_warnings array

## License Status Calculation

### Days Remaining
```typescript
const daysRemaining = Math.floor(
  (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
);
```

### Status Logic
- **Active**: daysRemaining > 30
- **Expiring**: 0 < daysRemaining <= 30
- **Expired**: daysRemaining <= 0

## Related Requirements
- **Requirement 5**: License Management
- **Requirement 5.1-5.4**: License expiry date retrieval
- **Requirement 5.5**: Warning alerts for licenses expiring within 30 days
- **Requirement 5.6**: Critical alerts for expired licenses
- **Requirement 5.7**: Display days remaining for each license
- **Requirement 7.5**: License API endpoint
- **Requirement 7.10**: License response field extraction

## Related Design Components
- **Data Models**: firewall_licenses schema
- **Polling Engine**: License tracking implementation (Task 3.6)
- **Alert Manager**: License expiry alert generation
- **Dashboard**: License status display component
- **API Layer**: GET /api/firewall/licenses/:deviceId endpoint

## Testing
See `test_0015.sql` for validation queries.

### Test Coverage
- Table and column existence
- Foreign key constraint and cascade delete
- Index creation (primary and expiry date indexes)
- Data type validation (DATE for expiry columns)
- JSONB operations for license_warnings
- Default values (timestamp, license_warnings)
- Insert and query operations

## Rollback
To rollback this migration:
```sql
DROP TABLE IF EXISTS "firewall_licenses" CASCADE;
```

## Dependencies
- **Requires**: Migration 0012 (firewall_devices table)
- **Required by**: 
  - Polling engine license tracking (Task 3.6)
  - License API endpoints (Task 8.3)
  - Dashboard license display components

## Example Data

### Sample License Record
```sql
INSERT INTO firewall_licenses (
    device_id,
    ips_expiry,
    gav_expiry,
    atp_expiry,
    app_control_expiry,
    content_filter_expiry,
    support_expiry,
    license_warnings
) VALUES (
    'device-uuid-here',
    '2025-12-31',  -- IPS expires in ~1 year
    '2025-02-15',  -- GAV expires in ~2 months
    '2026-06-30',  -- ATP expires in ~1.5 years
    '2025-01-20',  -- App Control expires in ~1 month (WARNING)
    '2024-11-30',  -- Content Filter expired (CRITICAL)
    '2025-12-31',  -- Support expires in ~1 year
    '["Application Control expiring in 25 days", "Content Filter expired"]'::jsonb
);
```

### Query Examples

#### Get licenses expiring within 30 days
```sql
SELECT 
    d.model,
    d.serial_number,
    l.ips_expiry,
    l.gav_expiry,
    l.atp_expiry,
    l.app_control_expiry,
    l.content_filter_expiry,
    l.support_expiry,
    l.license_warnings
FROM firewall_licenses l
JOIN firewall_devices d ON l.device_id = d.id
WHERE 
    l.ips_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    OR l.gav_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    OR l.atp_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    OR l.app_control_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    OR l.content_filter_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    OR l.support_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
```

#### Get expired licenses
```sql
SELECT 
    d.model,
    d.serial_number,
    CASE 
        WHEN l.ips_expiry < CURRENT_DATE THEN 'IPS'
        WHEN l.gav_expiry < CURRENT_DATE THEN 'GAV'
        WHEN l.atp_expiry < CURRENT_DATE THEN 'ATP'
        WHEN l.app_control_expiry < CURRENT_DATE THEN 'Application Control'
        WHEN l.content_filter_expiry < CURRENT_DATE THEN 'Content Filter'
        WHEN l.support_expiry < CURRENT_DATE THEN 'Support'
    END AS expired_license
FROM firewall_licenses l
JOIN firewall_devices d ON l.device_id = d.id
WHERE 
    l.ips_expiry < CURRENT_DATE
    OR l.gav_expiry < CURRENT_DATE
    OR l.atp_expiry < CURRENT_DATE
    OR l.app_control_expiry < CURRENT_DATE
    OR l.content_filter_expiry < CURRENT_DATE
    OR l.support_expiry < CURRENT_DATE;
```

## Notes
- All expiry date columns are nullable to handle cases where specific licenses may not be present
- The license_warnings JSONB array provides pre-calculated warning messages for efficient dashboard rendering
- Partial indexes on expiry dates (WHERE NOT NULL) optimize queries for expiring licenses
- Foreign key CASCADE delete ensures license records are removed when devices are deleted
