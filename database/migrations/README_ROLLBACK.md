# Firewall Integration Rollback Migration

## Overview

This document describes the rollback migration for the SonicWall Firewall Integration feature. The rollback migration completely removes all firewall-related database objects created by migrations 0012-0019.

## What Gets Rolled Back

The rollback migration removes the following in reverse order of creation:

### 1. Migration 0019 - Retention Policies
- `cleanup_firewall_retention_all()` function
- `cleanup_firewall_alerts()` function
- `cleanup_firewall_metrics_rollup()` function
- `cleanup_firewall_health_snapshots()` function
- pg_cron schedule: `firewall-retention-cleanup`

### 2. Migration 0018 - Alerts Table
- `firewall_alerts` table
- All related indexes, constraints, and foreign keys

### 3. Migration 0017 - Metrics Rollup Table
- `firewall_metrics_rollup` table
- All related indexes, constraints, and foreign keys

### 4. Migration 0016 - Config Risks Table
- `firewall_config_risks` table
- All related indexes, constraints, and foreign keys

### 5. Migration 0015 - Licenses Table
- `firewall_licenses` table
- All related indexes, constraints, and foreign keys

### 6. Migration 0014 - Security Posture Table
- `firewall_security_posture` table
- All related indexes, constraints, and foreign keys

### 7. Migration 0013 - Health Snapshots Table
- `firewall_health_snapshots` table
- All related indexes, constraints, and foreign keys

### 8. Migration 0012 - Devices Table
- `firewall_devices` table
- All related indexes, constraints, and foreign keys

## When to Use This Rollback

Use this rollback migration in the following scenarios:

1. **Development/Testing**: Rolling back changes during development or testing
2. **Migration Issues**: Fixing problems with the firewall integration schema
3. **Feature Removal**: Completely removing the firewall integration feature
4. **Schema Redesign**: Starting fresh with a new schema design

## ⚠️ WARNING - Data Loss

**This rollback migration will permanently delete ALL firewall-related data:**
- All registered firewall devices
- All health snapshots
- All security posture records
- All license information
- All configuration risks
- All metrics rollup data
- All alerts

**This action cannot be undone. Make sure to backup your data before running this rollback.**

## How to Execute the Rollback

### Option 1: Using psql (Recommended)

```bash
# Connect to your database
psql -U your_username -d your_database_name

# Execute the rollback migration
\i database/migrations/rollback_firewall_integration.sql
```

### Option 2: Using a Database Client

1. Open your preferred database client (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open the file `database/migrations/rollback_firewall_integration.sql`
4. Execute the entire script

### Option 3: Using Node.js Script

```typescript
import { db } from '@/lib/database';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function rollbackFirewallIntegration() {
  const rollbackSQL = fs.readFileSync(
    'database/migrations/rollback_firewall_integration.sql',
    'utf-8'
  );
  
  await db.execute(sql.raw(rollbackSQL));
  console.log('Firewall integration rollback complete');
}

rollbackFirewallIntegration();
```

## Verification After Rollback

After running the rollback, verify that all firewall tables have been removed:

```sql
-- Check for remaining firewall tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'firewall_%'
ORDER BY table_name;

-- Should return 0 rows if rollback was successful
```

Check for remaining functions:

```sql
-- Check for remaining firewall functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%firewall%'
ORDER BY routine_name;

-- Should return 0 rows if rollback was successful
```

Check for remaining pg_cron schedules (if pg_cron is installed):

```sql
-- Check for remaining firewall cron jobs
SELECT * 
FROM cron.job 
WHERE jobname LIKE '%firewall%';

-- Should return 0 rows if rollback was successful
```

## Re-applying Migrations After Rollback

If you need to re-apply the firewall integration after rollback:

1. Ensure the rollback completed successfully
2. Run migrations 0012-0019 in order:

```bash
# Using your migration tool
npm run db:migrate

# Or manually with psql
psql -U your_username -d your_database_name -f database/migrations/0012_firewall_devices_table.sql
psql -U your_username -d your_database_name -f database/migrations/0013_firewall_health_snapshots.sql
psql -U your_username -d your_database_name -f database/migrations/0014_firewall_security_posture.sql
psql -U your_username -d your_database_name -f database/migrations/0015_firewall_licenses.sql
psql -U your_username -d your_database_name -f database/migrations/0016_firewall_config_risks.sql
psql -U your_username -d your_database_name -f database/migrations/0017_firewall_metrics_rollup.sql
psql -U your_username -d your_database_name -f database/migrations/0018_firewall_alerts.sql
psql -U your_username -d your_database_name -f database/migrations/0019_firewall_retention_policies.sql
psql -U your_username -d your_database_name -f database/migrations/0020_firewall_drizzle_schema.sql
```

## Troubleshooting

### Issue: Foreign Key Constraint Errors

If you encounter foreign key constraint errors during rollback:

```sql
-- Manually drop foreign keys first
ALTER TABLE firewall_alerts DROP CONSTRAINT IF EXISTS firewall_alerts_device_id_firewall_devices_id_fk CASCADE;
ALTER TABLE firewall_health_snapshots DROP CONSTRAINT IF EXISTS firewall_health_snapshots_device_id_firewall_devices_id_fk CASCADE;
-- ... repeat for all foreign keys

-- Then run the rollback migration
```

### Issue: Table Dependencies

If tables cannot be dropped due to dependencies:

```sql
-- Use CASCADE to force drop
DROP TABLE firewall_devices CASCADE;
DROP TABLE firewall_health_snapshots CASCADE;
-- ... repeat for all tables
```

### Issue: pg_cron Schedule Won't Remove

If the pg_cron schedule cannot be removed:

```sql
-- Manually remove the schedule
SELECT cron.unschedule('firewall-retention-cleanup');

-- Or if that fails, delete directly from cron.job table
DELETE FROM cron.job WHERE jobname = 'firewall-retention-cleanup';
```

## Backup Before Rollback

**Always backup your data before running a rollback migration:**

```bash
# Backup entire database
pg_dump -U your_username -d your_database_name -F c -f backup_before_rollback.dump

# Or backup just firewall tables
pg_dump -U your_username -d your_database_name \
  -t firewall_devices \
  -t firewall_health_snapshots \
  -t firewall_security_posture \
  -t firewall_licenses \
  -t firewall_config_risks \
  -t firewall_metrics_rollup \
  -t firewall_alerts \
  -F c -f firewall_tables_backup.dump
```

## Restore from Backup

If you need to restore after rollback:

```bash
# Restore entire database
pg_restore -U your_username -d your_database_name backup_before_rollback.dump

# Or restore just firewall tables
pg_restore -U your_username -d your_database_name firewall_tables_backup.dump
```

## Support

For issues with the rollback migration:

1. Check the PostgreSQL logs for detailed error messages
2. Verify you have sufficient permissions to drop tables and functions
3. Ensure no active connections are using the firewall tables
4. Review the troubleshooting section above

## Related Files

- `database/migrations/rollback_firewall_integration.sql` - The rollback migration script
- `database/migrations/0012_firewall_devices_table.sql` - Original migration
- `database/migrations/0013_firewall_health_snapshots.sql` - Original migration
- `database/migrations/0014_firewall_security_posture.sql` - Original migration
- `database/migrations/0015_firewall_licenses.sql` - Original migration
- `database/migrations/0016_firewall_config_risks.sql` - Original migration
- `database/migrations/0017_firewall_metrics_rollup.sql` - Original migration
- `database/migrations/0018_firewall_alerts.sql` - Original migration
- `database/migrations/0019_firewall_retention_policies.sql` - Original migration
- `database/migrations/0020_firewall_drizzle_schema.sql` - Drizzle ORM reference

## Migration History

| Migration | Description | Rollback Step |
|-----------|-------------|---------------|
| 0012 | firewall_devices table | Step 9 (last) |
| 0013 | firewall_health_snapshots table | Step 8 |
| 0014 | firewall_security_posture table | Step 7 |
| 0015 | firewall_licenses table | Step 6 |
| 0016 | firewall_config_risks table | Step 5 |
| 0017 | firewall_metrics_rollup table | Step 4 |
| 0018 | firewall_alerts table | Step 3 |
| 0019 | Retention policies and functions | Step 2 |
| 0020 | Drizzle ORM schema reference | N/A (no-op) |

## Notes

- The rollback is wrapped in a transaction (BEGIN/COMMIT) for safety
- All operations use `IF EXISTS` to prevent errors if objects don't exist
- The rollback includes detailed RAISE NOTICE statements for progress tracking
- The script is idempotent - it can be run multiple times safely
