# Migration 0018: Firewall Alerts Table

## Purpose
Creates the `firewall_alerts` table for storing alerts generated from SonicWall API polling and email sources. This table supports the Alert Management System requirements (Requirement 12) and Email Alert Listener requirements (Requirement 11).

## Schema Overview

### Table: firewall_alerts
Stores alerts with the following key features:
- **Multi-source alerts**: Supports alerts from both API polling and email listening
- **Tenant isolation**: All alerts are associated with a tenant for proper access control
- **Device association**: Links alerts to specific firewall devices (nullable for unmatched email alerts)
- **Acknowledgment tracking**: Records who acknowledged an alert and when
- **Rich metadata**: Stores additional context in JSONB format

### Columns
- `id` (uuid, PK): Unique alert identifier
- `tenant_id` (uuid, NOT NULL, FK): Reference to tenant (cascade delete)
- `device_id` (uuid, nullable, FK): Reference to firewall device (cascade delete)
- `alert_type` (varchar(100), NOT NULL): Type of alert (e.g., ips_counter_increase, wan_down, vpn_down, license_expired, feature_disabled, config_risk)
- `severity` (varchar(20), NOT NULL): Alert severity (critical, high, medium, low, info)
- `message` (text, NOT NULL): Human-readable alert message
- `source` (varchar(20), NOT NULL): Alert source (api or email)
- `metadata` (jsonb, default '{}'): Additional context (e.g., counter values, device identifiers)
- `acknowledged` (boolean, default false): Whether alert has been acknowledged
- `acknowledged_by` (uuid, nullable, FK): User who acknowledged the alert (set null on user delete)
- `acknowledged_at` (timestamp, nullable): When the alert was acknowledged
- `created_at` (timestamp, default NOW()): When the alert was created

### Indexes
Performance-optimized indexes for common query patterns:
- `idx_alerts_tenant`: Composite index on (tenant_id, created_at DESC) for tenant-filtered queries
- `idx_alerts_device`: Composite index on (device_id, created_at DESC) for device-specific alerts
- `idx_alerts_severity`: Index on severity for filtering by alert priority
- `idx_alerts_acknowledged`: Index on acknowledged status for filtering
- `idx_alerts_alert_type`: Index on alert_type for filtering by type
- `idx_alerts_source`: Index on source for filtering by origin
- `idx_alerts_created_at`: Index on created_at for time-based queries

### Constraints
- **Foreign Keys**:
  - `tenant_id` → `tenants(id)` ON DELETE CASCADE
  - `device_id` → `firewall_devices(id)` ON DELETE CASCADE
  - `acknowledged_by` → `users(id)` ON DELETE SET NULL
  
- **Check Constraints**:
  - `check_severity_valid`: Ensures severity is one of: critical, high, medium, low, info
  - `check_source_valid`: Ensures source is either 'api' or 'email'
  - `check_acknowledged_consistency`: Ensures that when acknowledged=true, both acknowledged_by and acknowledged_at must be set

## Alert Types
Common alert types include:
- `ips_counter_increase`: IPS block counter increased
- `gav_counter_increase`: Gateway AV block counter increased
- `atp_counter_increase`: ATP verdict counter increased
- `wan_down`: WAN interface went down
- `wan_up`: WAN interface came back up
- `vpn_down`: VPN tunnel went down
- `vpn_up`: VPN tunnel came back up
- `license_expiring`: License expiring within 30 days
- `license_expired`: License has expired
- `feature_disabled`: Security feature was disabled
- `cpu_high`: CPU usage exceeded threshold (80%)
- `ram_high`: RAM usage exceeded threshold (90%)
- `config_risk`: Configuration risk detected
- `alert_storm`: Too many alerts in short time period

## Metadata Examples

### Counter Increase Alert
```json
{
  "counter_name": "ips_blocks",
  "previous_value": 100,
  "new_value": 150,
  "delta": 50
}
```

### Status Change Alert
```json
{
  "interface": "X0",
  "previous_status": "up",
  "new_status": "down"
}
```

### Email Alert (Unmatched Device)
```json
{
  "email_subject": "SonicWall Alert: IPS Detection",
  "device_identifier": "192.168.1.1",
  "email_timestamp": "2024-01-15T10:30:00Z",
  "needs_manual_review": true
}
```

### License Alert
```json
{
  "license_type": "IPS",
  "expiry_date": "2024-02-15",
  "days_remaining": 15
}
```

## Data Retention
- **Retention Period**: 90 days
- **Cleanup**: Automated cleanup job should delete alerts older than 90 days
- **Implementation**: Add to daily maintenance cron job

## Usage Patterns

### Creating an Alert
```sql
INSERT INTO firewall_alerts (
    tenant_id, 
    device_id, 
    alert_type, 
    severity, 
    message, 
    source, 
    metadata
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    '987fcdeb-51a2-43f7-9876-543210fedcba',
    'ips_counter_increase',
    'medium',
    'IPS blocks increased from 100 to 150',
    'api',
    '{"counter_name": "ips_blocks", "previous_value": 100, "new_value": 150, "delta": 50}'::jsonb
);
```

### Querying Alerts by Tenant
```sql
SELECT * FROM firewall_alerts
WHERE tenant_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at DESC
LIMIT 50;
```

### Filtering by Severity
```sql
SELECT * FROM firewall_alerts
WHERE tenant_id = '123e4567-e89b-12d3-a456-426614174000'
  AND severity IN ('critical', 'high')
  AND acknowledged = false
ORDER BY created_at DESC;
```

### Acknowledging an Alert
```sql
UPDATE firewall_alerts
SET 
    acknowledged = true,
    acknowledged_by = '456e7890-e89b-12d3-a456-426614174111',
    acknowledged_at = NOW()
WHERE id = '789abcde-f012-3456-7890-abcdef123456'
  AND tenant_id = '123e4567-e89b-12d3-a456-426614174000';
```

### Querying Unmatched Email Alerts
```sql
SELECT * FROM firewall_alerts
WHERE source = 'email'
  AND device_id IS NULL
  AND tenant_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at DESC;
```

## Integration Points

### Polling Engine
The polling engine creates alerts when:
- Counters increase (IPS, GAV, ATP, Botnet blocks)
- Status changes (WAN up/down, VPN up/down)
- Security features are disabled
- Resource thresholds exceeded (CPU > 80%, RAM > 90%)

### Email Alert Listener
The email listener creates alerts when:
- SonicWall alert emails are received
- Email parsing succeeds
- Device matching is attempted (may be null if no match)

### Alert Manager
The AlertManager service:
- Deduplicates alerts (same type + device + severity within 2 minutes)
- Detects alert storms (> 10 alerts in 5 minutes)
- Provides filtering and querying capabilities
- Handles acknowledgment workflow

## Dependencies
- Requires `tenants` table (from initial schema)
- Requires `users` table (from initial schema)
- Requires `firewall_devices` table (from migration 0012)

## Rollback
To rollback this migration:
```sql
DROP TABLE IF EXISTS firewall_alerts CASCADE;
```

## Testing
See `test_0018.sql` for validation queries.

## Related Requirements
- **Requirement 2**: API Polling Engine (alert generation from polling)
- **Requirement 11**: Email Alert Listener (alert creation from emails)
- **Requirement 12**: Alert Management System (storage, deduplication, acknowledgment)
- **Requirement 15**: AVIAN API Endpoints (alert querying and acknowledgment)
- **Requirement 17**: Multi-Tenant Isolation (tenant-based access control)

