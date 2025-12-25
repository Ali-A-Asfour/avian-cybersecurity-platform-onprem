# Migration 0017: Firewall Metrics Rollup Table

## Overview
This migration creates the `firewall_metrics_rollup` table for storing daily aggregated metrics from SonicWall firewalls. This table is part of the SonicWall Firewall Integration MVP feature.

## Purpose
The `firewall_metrics_rollup` table stores daily summary metrics that are aggregated at midnight UTC by the MetricsAggregator service. This provides:
- Historical trend analysis without storing detailed logs
- Efficient storage (< 100MB per firewall per year)
- Quick dashboard queries for daily/weekly/monthly metrics
- 365-day retention for compliance and reporting

## Table Structure

### Columns
- **id** (uuid, PK): Unique identifier for the rollup record
- **device_id** (uuid, FK): Reference to firewall_devices table
- **date** (date): Date for which metrics are aggregated (YYYY-MM-DD)
- **threats_blocked** (integer): Total threats blocked (sum of IPS + GAV + ATP + Botnet)
- **malware_blocked** (integer): Gateway Anti-Virus blocks for the day
- **ips_blocked** (integer): Intrusion Prevention System blocks for the day
- **blocked_connections** (integer): Total denied connections for the day
- **web_filter_hits** (integer): Content filter blocks for the day
- **bandwidth_total_mb** (bigint): Total bandwidth usage in megabytes (if available)
- **active_sessions_count** (integer): Active sessions count (average or final value)
- **created_at** (timestamp): Timestamp when the rollup record was created

### Constraints
- **Primary Key**: `id`
- **Foreign Key**: `device_id` → `firewall_devices(id)` with CASCADE DELETE
- **Unique Constraint**: `(device_id, date)` - One rollup per device per day
- **Check Constraints**: All metric columns must be non-negative (>= 0)

### Indexes
- `idx_metrics_rollup_device`: Composite index on (device_id, date DESC) for fast device queries
- `idx_metrics_rollup_date`: Index on date DESC for time-range queries
- `idx_metrics_rollup_created_at`: Index on created_at DESC for recent records

## Data Flow

### Daily Aggregation Process
1. **Trigger**: Cron job runs at 00:00 UTC daily
2. **Source**: Final cumulative counter values from SonicWall API (NOT calculated by summing increments)
3. **Calculation**: 
   - Get final counter values from last successful poll of previous day
   - Calculate `threats_blocked` = `ips_blocked` + `malware_blocked` + `atp_verdicts` + `botnet_blocks`
4. **Storage**: Insert into `firewall_metrics_rollup` with UPSERT on conflict
5. **Cleanup**: Delete rollups older than 365 days

### Counter Source
**CRITICAL**: All counters MUST come from SonicWall summary/statistics APIs ONLY:
- NO log ingestion
- NO traffic logs
- NO event logs
- NO connection logs
- Counters are retrieved from API endpoint: `GET /api/sonicos/reporting/security-services/statistics`

## Usage Examples

### Query Daily Metrics for a Device
```sql
SELECT 
    date,
    threats_blocked,
    malware_blocked,
    ips_blocked,
    blocked_connections,
    web_filter_hits
FROM firewall_metrics_rollup
WHERE device_id = 'device-uuid-here'
    AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

### Query Trend Analysis (7-day average)
```sql
SELECT 
    device_id,
    AVG(threats_blocked) as avg_threats_blocked,
    AVG(malware_blocked) as avg_malware_blocked,
    AVG(ips_blocked) as avg_ips_blocked
FROM firewall_metrics_rollup
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY device_id;
```

### Query Total Threats Blocked (Last 30 Days)
```sql
SELECT 
    device_id,
    SUM(threats_blocked) as total_threats_blocked,
    SUM(malware_blocked) as total_malware_blocked,
    SUM(ips_blocked) as total_ips_blocked
FROM firewall_metrics_rollup
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY device_id;
```

## Retention Policy
- **Retention Period**: 365 days
- **Cleanup Process**: Automated daily cleanup job deletes rollups older than 365 days
- **Storage Estimate**: ~36KB per device per year (100 bytes × 365 days)

## Related Tables
- **firewall_devices**: Parent table containing device metadata
- **firewall_health_snapshots**: Stores health metrics every 4-6 hours
- **firewall_security_posture**: Stores security feature status and daily counters
- **firewall_alerts**: Stores alerts generated from counter changes

## Testing
Run the test script to verify the migration:
```bash
psql -U your_user -d your_database -f database/migrations/test_0017.sql
```

The test script validates:
1. Table creation
2. All required columns exist
3. Primary key constraint
4. Foreign key constraint to firewall_devices
5. Unique constraint on (device_id, date)
6. All required indexes
7. Check constraints for non-negative values
8. Insert operations and constraint enforcement
9. Column data types
10. Default values

## Rollback
To rollback this migration:
```sql
DROP TABLE IF EXISTS firewall_metrics_rollup CASCADE;
```

## Dependencies
- Requires `firewall_devices` table (Migration 0012)
- Requires `tenants` table (from core schema)

## Performance Considerations
- Composite index on (device_id, date DESC) enables fast queries for device-specific metrics
- Date index enables efficient time-range queries across all devices
- Unique constraint on (device_id, date) prevents duplicate rollups
- Estimated query time: < 50ms for 30-day range per device
- Estimated storage: < 100MB for 100 devices over 365 days

## Security
- Tenant isolation enforced at application layer (not in this table)
- Cascade delete ensures cleanup when devices are removed
- No sensitive data stored (only aggregated counters)

## References
- **Requirements**: Requirement 9 (Daily Metrics Rollup)
- **Design Document**: Section "Daily Metrics Aggregator"
- **API Endpoint**: `GET /api/firewall/metrics/:deviceId`
