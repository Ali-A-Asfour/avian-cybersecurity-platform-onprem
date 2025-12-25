# Migration 0019: Firewall Retention Policies

## Overview
This migration implements automated data retention policies for firewall monitoring tables to prevent unbounded data growth and maintain system performance.

## Retention Policies

### 1. Health Snapshots (90 days)
- **Table:** `firewall_health_snapshots`
- **Retention:** 90 days
- **Rationale:** Health snapshots are captured every 4-6 hours. 90 days provides sufficient historical data for trend analysis while keeping storage manageable.
- **Estimated Records:** ~540 snapshots per device (4 per day × 90 days)

### 2. Metrics Rollup (365 days)
- **Table:** `firewall_metrics_rollup`
- **Retention:** 365 days (1 year)
- **Rationale:** Daily aggregated metrics are valuable for long-term trend analysis and compliance reporting. One year of data is standard for security monitoring.
- **Estimated Records:** 365 records per device per year

### 3. Alerts (90 days)
- **Table:** `firewall_alerts`
- **Retention:** 90 days
- **Rationale:** Alerts older than 90 days are typically resolved or no longer actionable. Recent alerts are sufficient for operational needs.
- **Estimated Records:** Varies by alert frequency

## Implementation

### Cleanup Functions
The migration creates three cleanup functions:

1. `cleanup_firewall_health_snapshots()` - Removes snapshots older than 90 days
2. `cleanup_firewall_metrics_rollup()` - Removes rollup records older than 365 days
3. `cleanup_firewall_alerts()` - Removes alerts older than 90 days
4. `cleanup_firewall_retention_all()` - Runs all cleanup functions

### Scheduling Options

#### Option 1: pg_cron (Automatic)
If the `pg_cron` PostgreSQL extension is available, the migration automatically creates a daily schedule:
- **Schedule:** Every day at 2:00 AM UTC
- **Job Name:** `firewall-retention-cleanup`
- **Command:** `SELECT cleanup_firewall_retention_all();`

To verify the schedule:
```sql
SELECT * FROM cron.job WHERE jobname = 'firewall-retention-cleanup';
```

#### Option 2: Application-Level Cron (Manual)
If `pg_cron` is not available, schedule the cleanup in your application using Node.js cron:

```typescript
import cron from 'node-cron';
import { db } from '@/lib/database';

// Run daily at 2:00 AM UTC
cron.schedule('0 2 * * *', async () => {
  try {
    await db.execute('SELECT cleanup_firewall_retention_all()');
    console.log('Firewall retention cleanup completed');
  } catch (error) {
    console.error('Firewall retention cleanup failed:', error);
  }
});
```

#### Option 3: External Scheduler (Manual)
Use an external scheduler (cron, systemd timer, etc.) to call the cleanup function:

```bash
# Add to crontab
0 2 * * * psql -U your_user -d your_database -c "SELECT cleanup_firewall_retention_all();"
```

## Manual Execution

To manually run retention cleanup:

```sql
-- Run all cleanup functions
SELECT cleanup_firewall_retention_all();

-- Or run individual functions
SELECT cleanup_firewall_health_snapshots();
SELECT cleanup_firewall_metrics_rollup();
SELECT cleanup_firewall_alerts();
```

## Testing

A test file is provided to verify the retention policies work correctly:

```bash
psql -U your_user -d your_database -f database/migrations/test_0019.sql
```

The test:
1. Creates test data with various ages
2. Runs cleanup functions
3. Verifies correct records were deleted
4. Cleans up test data

## Performance Considerations

### Index Usage
The cleanup functions use existing indexes:
- `firewall_health_snapshots`: `idx_health_snapshots_timestamp`
- `firewall_metrics_rollup`: `idx_metrics_rollup_date`
- `firewall_alerts`: `idx_alerts_created_at`

### Execution Time
- Expected execution time: < 1 second for typical workloads
- For large datasets (100+ devices, millions of records), consider:
  - Running cleanup during off-peak hours (default: 2:00 AM UTC)
  - Using `DELETE ... LIMIT` with multiple passes if needed
  - Monitoring query performance

### Storage Impact
Estimated storage savings per device per year:
- Health snapshots: ~50 MB (assuming 1 KB per snapshot)
- Metrics rollup: Minimal (records kept for 1 year)
- Alerts: Varies by alert frequency

## Monitoring

Monitor cleanup execution:

```sql
-- Check last cleanup execution (if using pg_cron)
SELECT jobname, last_run, next_run, status 
FROM cron.job_run_details 
WHERE jobname = 'firewall-retention-cleanup'
ORDER BY start_time DESC 
LIMIT 10;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('firewall_health_snapshots', 'firewall_metrics_rollup', 'firewall_alerts')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check record counts
SELECT 
    'firewall_health_snapshots' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '90 days') as within_retention
FROM firewall_health_snapshots
UNION ALL
SELECT 
    'firewall_metrics_rollup',
    COUNT(*),
    COUNT(*) FILTER (WHERE date > CURRENT_DATE - INTERVAL '365 days')
FROM firewall_metrics_rollup
UNION ALL
SELECT 
    'firewall_alerts',
    COUNT(*),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days')
FROM firewall_alerts;
```

## Rollback

To remove the retention policies:

```sql
-- Drop the pg_cron schedule (if it exists)
SELECT cron.unschedule('firewall-retention-cleanup');

-- Drop the cleanup functions
DROP FUNCTION IF EXISTS cleanup_firewall_retention_all();
DROP FUNCTION IF EXISTS cleanup_firewall_alerts();
DROP FUNCTION IF EXISTS cleanup_firewall_metrics_rollup();
DROP FUNCTION IF EXISTS cleanup_firewall_health_snapshots();
```

Note: This does not restore deleted data. Ensure you have backups before running cleanup functions.

## Requirements Validation

This migration satisfies the following requirements:

- **Requirement 3.9:** "WHEN health snapshots exceed 90 days old, THE System SHALL automatically delete old snapshots"
- **Requirement 9.8:** "WHEN rollup records exceed 365 days old, THE System SHALL automatically delete old rollups"
- **Requirement 12.7:** "WHERE alerts are older than 90 days, THE System SHALL automatically archive or delete old alerts"

## Next Steps

1. Verify the migration runs successfully
2. Choose and implement a scheduling option (pg_cron, application cron, or external scheduler)
3. Monitor cleanup execution and storage usage
4. Adjust retention periods if needed based on business requirements
