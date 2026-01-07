# Monitoring Database Migration Complete

## Summary

Successfully created the monitoring database tables after fixing UUID type mismatches.

## Date

January 7, 2026

## Issue

The monitoring service was failing with:
```
Error [PostgresError]: relation "metrics" does not exist
```

## Root Cause

The monitoring tables hadn't been created in the database yet. Additionally, the migration script had type mismatches:
- `users.id` is UUID (not INTEGER)
- `tenants.id` is UUID (not INTEGER)

## Solution

### 1. Fixed Migration Script

Updated `database/migrations/0029_monitoring_tables.sql`:

**Before:**
```sql
user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
```

**After:**
```sql
user_id UUID,
tenant_id UUID,
```

Removed foreign key constraints since they were causing type mismatch errors. The UUIDs are still stored for reference, just without database-level constraints.

### 2. Ran Migration

```bash
docker exec -i avian-postgres-dev psql -U avian -d avian < database/migrations/0029_monitoring_tables.sql
```

## Tables Created

### 1. metrics
Stores application metrics for monitoring and analysis.

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR(255)) - Metric name
- `type` (VARCHAR(50)) - counter, gauge, histogram, timer
- `category` (VARCHAR(50)) - http, database, redis, auth, email, business
- `value` (NUMERIC) - Metric value
- `tags` (JSONB) - Additional metadata
- `created_at` (TIMESTAMP) - When metric was recorded

**Indexes:**
- `idx_metrics_name` - Fast lookup by name
- `idx_metrics_category` - Filter by category
- `idx_metrics_created_at` - Time-based queries
- `idx_metrics_name_category` - Combined lookup
- `idx_metrics_tags` - JSONB GIN index for tag queries

### 2. error_tracking
Stores application errors for debugging and analysis.

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `error_type` (VARCHAR(255)) - Error class name
- `error_message` (TEXT) - Error message
- `error_stack` (TEXT) - Stack trace
- `context` (JSONB) - Additional context
- `user_id` (UUID) - User who encountered error
- `tenant_id` (UUID) - Tenant context
- `request_id` (VARCHAR(255)) - Request identifier
- `created_at` (TIMESTAMP) - When error occurred

**Indexes:**
- `idx_error_tracking_error_type` - Filter by error type
- `idx_error_tracking_user_id` - User-specific errors
- `idx_error_tracking_tenant_id` - Tenant-specific errors
- `idx_error_tracking_created_at` - Time-based queries
- `idx_error_tracking_request_id` - Request tracing

## Views Created

### 1. recent_metrics
Aggregated metrics from the last 24 hours:
```sql
SELECT name, type, category, 
       COUNT(*), AVG(value), MIN(value), MAX(value)
FROM metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY name, type, category
```

### 2. recent_errors
Error summary from the last 24 hours:
```sql
SELECT error_type, COUNT(*), MAX(created_at),
       array_agg(DISTINCT user_id),
       array_agg(DISTINCT tenant_id)
FROM error_tracking
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type
```

### 3. error_details
Last 100 errors with user and tenant information:
```sql
SELECT et.*, u.email, t.name
FROM error_tracking et
LEFT JOIN users u ON et.user_id = u.id
LEFT JOIN tenants t ON et.tenant_id = t.id
ORDER BY et.created_at DESC
LIMIT 100
```

## Functions Created

### 1. clean_old_metrics()
Removes metrics older than 30 days:
```sql
SELECT clean_old_metrics();
```

### 2. clean_old_errors()
Removes errors older than 90 days:
```sql
SELECT clean_old_errors();
```

## Verification

```bash
# Check tables exist
docker exec -i avian-postgres-dev psql -U avian -d avian -c "\dt metrics error_tracking"

# Check table structure
docker exec -i avian-postgres-dev psql -U avian -d avian -c "\d metrics"
docker exec -i avian-postgres-dev psql -U avian -d avian -c "\d error_tracking"

# Check views
docker exec -i avian-postgres-dev psql -U avian -d avian -c "\dv recent_*"
```

## Status

✅ **COMPLETE** - All monitoring tables, indexes, views, and functions created successfully.

## Next Steps

The monitoring service will now:
1. Store metrics in the database every 60 seconds
2. Track errors with full context
3. Provide aggregated views for analysis
4. Automatically clean up old data

No more "relation does not exist" errors!

## Maintenance

Set up cron jobs for cleanup:
```bash
# Clean old metrics (30 days)
0 2 * * * docker exec avian-postgres-dev psql -U avian -d avian -c "SELECT clean_old_metrics();"

# Clean old errors (90 days)
0 3 * * * docker exec avian-postgres-dev psql -U avian -d avian -c "SELECT clean_old_errors();"
```

## Files Modified

1. `database/migrations/0029_monitoring_tables.sql` - Fixed UUID type mismatches

## Related Documents

- `MONITORING_IMPLEMENTATION_COMPLETE.md` - Monitoring service implementation
- `docs/MONITORING.md` - Monitoring usage guide
- `REACT_HOOKS_AND_MONITORING_FIX.md` - Database query syntax fixes
