# Firewall Retention Policies - Quick Reference

## TL;DR

**What:** Automated cleanup of old firewall monitoring data  
**When:** Daily at 2:00 AM UTC (configurable)  
**How:** PostgreSQL functions + scheduler (pg_cron, app cron, or external)

## Retention Periods

| Table | Retention | Why |
|-------|-----------|-----|
| `firewall_health_snapshots` | 90 days | Snapshots every 4-6 hours; 90 days = ~540 records/device |
| `firewall_metrics_rollup` | 365 days | Daily metrics; 1 year standard for security monitoring |
| `firewall_alerts` | 90 days | Older alerts typically resolved; 90 days sufficient |

## Quick Commands

### Manual Cleanup (Run Anytime)
```sql
-- Run all cleanups
SELECT cleanup_firewall_retention_all();

-- Or run individually
SELECT cleanup_firewall_health_snapshots();
SELECT cleanup_firewall_metrics_rollup();
SELECT cleanup_firewall_alerts();
```

### Check What Will Be Deleted
```sql
-- Health snapshots older than 90 days
SELECT COUNT(*) FROM firewall_health_snapshots 
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Metrics older than 365 days
SELECT COUNT(*) FROM firewall_metrics_rollup 
WHERE date < CURRENT_DATE - INTERVAL '365 days';

-- Alerts older than 90 days
SELECT COUNT(*) FROM firewall_alerts 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Monitor Table Sizes
```sql
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size,
    pg_total_relation_size('public.'||tablename) AS bytes
FROM pg_tables
WHERE tablename IN ('firewall_health_snapshots', 'firewall_metrics_rollup', 'firewall_alerts')
ORDER BY bytes DESC;
```

## Setup Scheduling

### Option 1: Application Cron (Recommended)

Add to your app startup (e.g., `src/lib/cron-jobs.ts`):

```typescript
import cron from 'node-cron';
import { db } from '@/lib/database';

// Run daily at 2:00 AM UTC
cron.schedule('0 2 * * *', async () => {
  try {
    await db.execute('SELECT cleanup_firewall_retention_all()');
    console.log('✅ Firewall retention cleanup completed');
  } catch (error) {
    console.error('❌ Firewall retention cleanup failed:', error);
  }
});
```

### Option 2: pg_cron (If Available)

Check if schedule exists:
```sql
SELECT * FROM cron.job WHERE jobname = 'firewall-retention-cleanup';
```

Create schedule manually:
```sql
SELECT cron.schedule(
    'firewall-retention-cleanup',
    '0 2 * * *',
    'SELECT cleanup_firewall_retention_all();'
);
```

Remove schedule:
```sql
SELECT cron.unschedule('firewall-retention-cleanup');
```

### Option 3: System Cron

```bash
# Add to crontab (crontab -e)
0 2 * * * psql $DATABASE_URL -c "SELECT cleanup_firewall_retention_all();"
```

## Testing

Run the test suite:
```bash
psql $DATABASE_URL -f database/migrations/test_0019.sql
```

Expected output:
```
✓ TEST 1 PASSED: Health snapshots retention working correctly
✓ TEST 2 PASSED: Metrics rollup retention working correctly
✓ TEST 3 PASSED: Alerts retention working correctly
✓ TEST 4 PASSED: Combined cleanup function working correctly
ALL TESTS PASSED ✓
```

## Troubleshooting

### Cleanup Not Running

1. **Check if scheduled:**
   ```sql
   -- For pg_cron
   SELECT * FROM cron.job WHERE jobname = 'firewall-retention-cleanup';
   ```

2. **Check last execution:**
   ```sql
   -- For pg_cron
   SELECT * FROM cron.job_run_details 
   WHERE jobname = 'firewall-retention-cleanup'
   ORDER BY start_time DESC LIMIT 5;
   ```

3. **Run manually to test:**
   ```sql
   SELECT cleanup_firewall_retention_all();
   ```

### Cleanup Taking Too Long

If cleanup takes > 5 seconds:

1. **Check table sizes:**
   ```sql
   SELECT COUNT(*) FROM firewall_health_snapshots;
   SELECT COUNT(*) FROM firewall_metrics_rollup;
   SELECT COUNT(*) FROM firewall_alerts;
   ```

2. **Check indexes exist:**
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename IN ('firewall_health_snapshots', 'firewall_metrics_rollup', 'firewall_alerts');
   ```

3. **Consider batched deletion** (for very large tables):
   ```sql
   -- Delete in batches of 10,000
   DELETE FROM firewall_health_snapshots 
   WHERE id IN (
       SELECT id FROM firewall_health_snapshots 
       WHERE timestamp < NOW() - INTERVAL '90 days'
       LIMIT 10000
   );
   ```

### Need to Adjust Retention Periods

Edit the functions:
```sql
-- Example: Change health snapshots to 60 days
CREATE OR REPLACE FUNCTION cleanup_firewall_health_snapshots()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM firewall_health_snapshots
    WHERE timestamp < NOW() - INTERVAL '60 days';  -- Changed from 90
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % old records', deleted_count;
END;
$$;
```

## Monitoring Queries

### Records Within Retention
```sql
SELECT 
    'health_snapshots' as table_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '90 days') as within_retention,
    COUNT(*) FILTER (WHERE timestamp <= NOW() - INTERVAL '90 days') as should_delete
FROM firewall_health_snapshots
UNION ALL
SELECT 
    'metrics_rollup',
    COUNT(*),
    COUNT(*) FILTER (WHERE date > CURRENT_DATE - INTERVAL '365 days'),
    COUNT(*) FILTER (WHERE date <= CURRENT_DATE - INTERVAL '365 days')
FROM firewall_metrics_rollup
UNION ALL
SELECT 
    'alerts',
    COUNT(*),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days'),
    COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '90 days')
FROM firewall_alerts;
```

### Oldest Records
```sql
SELECT 'health_snapshots' as table_name, MIN(timestamp) as oldest_record
FROM firewall_health_snapshots
UNION ALL
SELECT 'metrics_rollup', MIN(date)::timestamp
FROM firewall_metrics_rollup
UNION ALL
SELECT 'alerts', MIN(created_at)
FROM firewall_alerts;
```

### Storage Trends (Run Weekly)
```sql
-- Save this query result weekly to track trends
SELECT 
    CURRENT_DATE as check_date,
    'firewall_health_snapshots' as table_name,
    COUNT(*) as record_count,
    pg_size_pretty(pg_total_relation_size('firewall_health_snapshots')) as size
FROM firewall_health_snapshots
UNION ALL
SELECT 
    CURRENT_DATE,
    'firewall_metrics_rollup',
    COUNT(*),
    pg_size_pretty(pg_total_relation_size('firewall_metrics_rollup'))
FROM firewall_metrics_rollup
UNION ALL
SELECT 
    CURRENT_DATE,
    'firewall_alerts',
    COUNT(*),
    pg_size_pretty(pg_total_relation_size('firewall_alerts'))
FROM firewall_alerts;
```

## Emergency: Disable Cleanup

If cleanup is causing issues:

```sql
-- Option 1: Unschedule (pg_cron)
SELECT cron.unschedule('firewall-retention-cleanup');

-- Option 2: Rename functions (prevents execution)
ALTER FUNCTION cleanup_firewall_retention_all() RENAME TO cleanup_firewall_retention_all_disabled;

-- Option 3: Drop functions (can be recreated from migration file)
DROP FUNCTION cleanup_firewall_retention_all();
```

## Files Reference

- **Migration:** `database/migrations/0019_firewall_retention_policies.sql`
- **Documentation:** `database/migrations/README_0019.md`
- **Tests:** `database/migrations/test_0019.sql`
- **Summary:** `database/migrations/MIGRATION_0019_SUMMARY.md`
- **This file:** `database/migrations/RETENTION_QUICK_REFERENCE.md`

## Support

For issues or questions:
1. Check the full documentation: `README_0019.md`
2. Run the test suite: `test_0019.sql`
3. Review the implementation summary: `MIGRATION_0019_SUMMARY.md`
