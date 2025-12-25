# Testing Firewall Integration Migrations

This document provides instructions for testing the firewall integration database migrations on a development database.

## Prerequisites

Before testing the migrations, ensure you have:

1. **PostgreSQL installed and running**
   - macOS: `brew install postgresql@16 && brew services start postgresql@16`
   - Linux: `sudo apt-get install postgresql-16`
   - Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16`

2. **Database created**
   ```bash
   createdb avian_platform_dev
   ```

3. **Environment variables set**
   ```bash
   export DATABASE_URL=postgresql://postgres:password@localhost:5432/avian_platform_dev
   ```

## Testing Methods

### Method 1: Automated Test Script (Recommended)

We've created a comprehensive test script that verifies all aspects of the firewall migration:

```bash
# Set the database URL
export DATABASE_URL=postgresql://postgres:password@localhost:5432/avian_platform_dev

# Run the test script
npx tsx scripts/test-firewall-migration.ts
```

The test script will:
- ✅ Verify all 7 firewall tables exist
- ✅ Check table structures and columns
- ✅ Validate foreign key relationships
- ✅ Verify indexes are created
- ✅ Check constraints (unique, check)
- ✅ Test data insertion and retrieval
- ✅ Clean up test data

### Method 2: Manual SQL Testing

You can also run the SQL test file directly:

```bash
# Connect to the database and run the test
psql $DATABASE_URL -f database/migrations/test_0020.sql
```

### Method 3: Run All Migrations

To run all migrations including the firewall tables:

```bash
# Run the migration script
npx tsx scripts/run-migrations.ts
```

This will:
1. Create the `schema_migrations` tracking table
2. Run all pending migrations in order (0001-0020)
3. Skip already-executed migrations
4. Seed default data (tenant and admin user)

## Expected Results

### Successful Test Output

When all tests pass, you should see:

```
🧪 Testing Firewall Integration Migration (0020)
============================================================

📋 Test 1: Verify all firewall tables exist
------------------------------------------------------------
✅ PASS: All 7 firewall tables exist
   - firewall_alerts
   - firewall_config_risks
   - firewall_devices
   - firewall_health_snapshots
   - firewall_licenses
   - firewall_metrics_rollup
   - firewall_security_posture

🏗️  Test 2: Verify firewall_devices table structure
------------------------------------------------------------
✅ PASS: All 13 columns exist in firewall_devices
   - device_id: uuid (nullable: NO)
   - tenant_id: uuid (nullable: NO)
   - model: character varying (nullable: YES)
   ...

🔗 Test 3: Verify foreign key relationships
------------------------------------------------------------
✅ PASS: Found X foreign key relationships
   - firewall_devices.tenant_id → tenants.id
   - firewall_health_snapshots.device_id → firewall_devices.device_id
   ...

📇 Test 4: Verify indexes exist
------------------------------------------------------------
✅ PASS: Found X indexes
   firewall_devices: X indexes
      - idx_firewall_devices_tenant
      - idx_firewall_devices_status
      ...

✔️  Test 5: Verify check constraints
------------------------------------------------------------
✅ PASS: Found X check constraints
   ...

🔑 Test 6: Verify unique constraints
------------------------------------------------------------
✅ PASS: Found X unique constraints
   - firewall_devices.serial_number
   - firewall_metrics_rollup.(device_id, date)
   ...

💾 Test 7: Test data insertion and retrieval
------------------------------------------------------------
✅ Successfully inserted test device: TEST-SERIAL-123456
✅ Successfully retrieved test device
✅ Successfully inserted health snapshot
✅ Successfully cleaned up test data

============================================================
📊 TEST SUMMARY
============================================================

✅ Tables Exist: All 7 firewall tables exist
✅ Firewall Devices Structure: All 13 columns exist
✅ Foreign Keys: Found X foreign key relationships
✅ Indexes: Found X indexes
✅ Check Constraints: Found X check constraints
✅ Unique Constraints: Found X unique constraints
✅ Data Operations: All data operations successful

Total Tests: 7
Passed: 7
Failed: 0

🎉 All tests passed! Migration is successful.
```

## Troubleshooting

### Connection Refused Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:** PostgreSQL is not running. Start it:
- macOS: `brew services start postgresql@16`
- Linux: `sudo systemctl start postgresql`
- Docker: `docker start <postgres-container-name>`

### Database Does Not Exist

```
Error: database "avian_platform_dev" does not exist
```

**Solution:** Create the database:
```bash
createdb avian_platform_dev
```

### Authentication Failed

```
Error: password authentication failed for user "postgres"
```

**Solution:** Update your DATABASE_URL with the correct credentials:
```bash
export DATABASE_URL=postgresql://your_user:your_password@localhost:5432/avian_platform_dev
```

### Tables Already Exist

If you see errors about tables already existing, the migrations have already been run. You can:

1. **Drop and recreate the database** (development only):
   ```bash
   dropdb avian_platform_dev
   createdb avian_platform_dev
   npx tsx scripts/run-migrations.ts
   ```

2. **Or just run the test script** to verify the existing tables:
   ```bash
   npx tsx scripts/test-firewall-migration.ts
   ```

### Missing Tenant

If Test 7 shows "No tenant found", run the full migration script to seed default data:
```bash
npx tsx scripts/run-migrations.ts
```

## Verifying Specific Tables

You can verify individual tables using psql:

```bash
# List all firewall tables
psql $DATABASE_URL -c "\dt firewall_*"

# Describe a specific table
psql $DATABASE_URL -c "\d firewall_devices"

# Count rows in a table
psql $DATABASE_URL -c "SELECT COUNT(*) FROM firewall_devices;"

# Check indexes
psql $DATABASE_URL -c "SELECT tablename, indexname FROM pg_indexes WHERE tablename LIKE 'firewall_%';"
```

## Next Steps

After successful testing:

1. ✅ Mark the task as complete in `.kiro/specs/firewall-integration/tasks.md`
2. ✅ Proceed to Task 1.4: Implement Credential Encryption
3. ✅ Document any issues or observations

## Related Files

- **Test Script:** `scripts/test-firewall-migration.ts`
- **SQL Test:** `database/migrations/test_0020.sql`
- **Migration Script:** `scripts/run-migrations.ts`
- **Migration Files:** `database/migrations/0012_*.sql` through `0020_*.sql`
- **Drizzle Schema:** `database/schemas/firewall.ts`

## Support

If you encounter issues not covered here:

1. Check the migration summary: `database/migrations/MIGRATION_0020_SUMMARY.md`
2. Review the Drizzle migration guide: `database/migrations/DRIZZLE_MIGRATION_COMPLETE.md`
3. Check the retention policies: `database/migrations/RETENTION_QUICK_REFERENCE.md`
4. Review individual migration READMEs: `database/migrations/README_00XX.md`
