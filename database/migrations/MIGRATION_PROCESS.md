# Firewall Integration Migration Process

## Overview

This document provides a comprehensive guide to the database migration process for the SonicWall Firewall Integration feature. It covers the complete migration workflow, from initial table creation through Drizzle ORM integration, testing, and rollback procedures.

## Table of Contents

1. [Migration Architecture](#migration-architecture)
2. [Migration Files](#migration-files)
3. [Running Migrations](#running-migrations)
4. [Testing Migrations](#testing-migrations)
5. [Rollback Procedures](#rollback-procedures)
6. [Future Schema Changes](#future-schema-changes)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Migration Architecture

### Migration Strategy

The firewall integration uses a **hybrid migration approach**:

1. **Manual SQL Migrations (0012-0019)**: Initial table creation with detailed control
2. **Drizzle ORM Integration (0020)**: Synchronization point for future automated migrations
3. **Future Migrations**: Drizzle-generated migrations for schema changes

### Why This Approach?

- ✅ **Precise Control**: Manual migrations allow exact control over table structure, indexes, and constraints
- ✅ **Retention Policies**: Complex retention logic implemented with PostgreSQL functions and pg_cron
- ✅ **Type Safety**: Drizzle ORM provides TypeScript types and schema validation
- ✅ **Future Flexibility**: Drizzle Kit automates future schema changes
- ✅ **Documentation**: Clear migration history with comprehensive documentation

### Migration Timeline

```
0012 → 0013 → 0014 → 0015 → 0016 → 0017 → 0018 → 0019 → 0020
 │      │      │      │      │      │      │      │      │
 │      │      │      │      │      │      │      │      └─ Drizzle Sync
 │      │      │      │      │      │      │      └─ Retention Policies
 │      │      │      │      │      │      └─ Alerts Table
 │      │      │      │      │      └─ Metrics Rollup
 │      │      │      │      └─ Config Risks
 │      │      │      └─ Licenses
 │      │      └─ Security Posture
 │      └─ Health Snapshots
 └─ Devices Table
```

---

## Migration Files

### Core Migrations

| Migration | File | Purpose | Dependencies |
|-----------|------|---------|--------------|
| **0012** | `0012_firewall_devices_table.sql` | Create firewall_devices table | tenants table |
| **0013** | `0013_firewall_health_snapshots.sql` | Create health snapshots table | 0012 |
| **0014** | `0014_firewall_security_posture.sql` | Create security posture table | 0012 |
| **0015** | `0015_firewall_licenses.sql` | Create licenses table | 0012 |
| **0016** | `0016_firewall_config_risks.sql` | Create config risks table | 0012 |
| **0017** | `0017_firewall_metrics_rollup.sql` | Create metrics rollup table | 0012 |
| **0018** | `0018_firewall_alerts.sql` | Create alerts table | 0012, tenants |
| **0019** | `0019_firewall_retention_policies.sql` | Create retention functions | 0013, 0017, 0018 |
| **0020** | `0020_firewall_drizzle_schema.sql` | Drizzle ORM synchronization | 0012-0019 |

### Documentation Files

| File | Purpose |
|------|---------|
| `README_00XX.md` | Detailed documentation for each migration |
| `MIGRATION_00XX_SUMMARY.md` | Quick reference summaries |
| `test_00XX.sql` | SQL test scripts for verification |
| `MIGRATION_PROCESS.md` | This comprehensive guide |
| `README_TESTING.md` | Testing procedures and instructions |
| `README_ROLLBACK.md` | Rollback procedures and warnings |
| `VERIFICATION_CHECKLIST.md` | Verification checklist for Drizzle integration |
| `RETENTION_QUICK_REFERENCE.md` | Retention policy reference |
| `ROLLBACK_QUICK_REFERENCE.md` | Quick rollback guide |

### Drizzle Files

| File | Purpose |
|------|---------|
| `database/schemas/firewall.ts` | Drizzle ORM schema definitions |
| `database/migrations/meta/0000_snapshot.json` | Complete schema snapshot |
| `database/migrations/meta/_journal.json` | Migration tracking journal |
| `drizzle.config.ts` | Drizzle Kit configuration |

### Test Scripts

| File | Purpose |
|------|---------|
| `scripts/test-firewall-migration.ts` | Automated TypeScript test suite |
| `scripts/test-firewall-rollback.ts` | Rollback verification script |
| `scripts/run-migrations.ts` | Migration execution script |

---

## Running Migrations

### Prerequisites

1. **PostgreSQL 14+** installed and running
2. **Database created**: `createdb avian_platform_dev`
3. **Environment variable set**: `export DATABASE_URL=postgresql://user:pass@localhost:5432/avian_platform_dev`
4. **Dependencies installed**: `npm install`

### Method 1: Automated Migration Script (Recommended)

```bash
# Set database URL
export DATABASE_URL=postgresql://postgres:password@localhost:5432/avian_platform_dev

# Run all migrations
npx tsx scripts/run-migrations.ts
```

**What this does:**
- Creates `schema_migrations` tracking table
- Runs all pending migrations in order (0001-0020)
- Skips already-executed migrations
- Seeds default tenant and admin user
- Provides detailed progress output

### Method 2: Manual Migration Execution

```bash
# Run migrations in order
psql $DATABASE_URL -f database/migrations/0012_firewall_devices_table.sql
psql $DATABASE_URL -f database/migrations/0013_firewall_health_snapshots.sql
psql $DATABASE_URL -f database/migrations/0014_firewall_security_posture.sql
psql $DATABASE_URL -f database/migrations/0015_firewall_licenses.sql
psql $DATABASE_URL -f database/migrations/0016_firewall_config_risks.sql
psql $DATABASE_URL -f database/migrations/0017_firewall_metrics_rollup.sql
psql $DATABASE_URL -f database/migrations/0018_firewall_alerts.sql
psql $DATABASE_URL -f database/migrations/0019_firewall_retention_policies.sql
psql $DATABASE_URL -f database/migrations/0020_firewall_drizzle_schema.sql
```

### Method 3: Using Drizzle Kit (Future Migrations Only)

```bash
# For future schema changes after 0020
npx drizzle-kit push
```

**Note:** This method only works for migrations generated by Drizzle Kit after the initial setup.

### Verification After Migration

```bash
# List all firewall tables
psql $DATABASE_URL -c "\dt firewall_*"

# Expected output: 7 tables
# - firewall_alerts
# - firewall_config_risks
# - firewall_devices
# - firewall_health_snapshots
# - firewall_licenses
# - firewall_metrics_rollup
# - firewall_security_posture
```

---

## Testing Migrations

### Automated Testing (Recommended)

```bash
# Run comprehensive test suite
npx tsx scripts/test-firewall-migration.ts
```

**Tests performed:**
1. ✅ Verify all 7 firewall tables exist
2. ✅ Check table structures and columns
3. ✅ Validate foreign key relationships
4. ✅ Verify indexes are created
5. ✅ Check constraints (unique, check)
6. ✅ Test data insertion and retrieval
7. ✅ Clean up test data

### Manual SQL Testing

```bash
# Run SQL test script
psql $DATABASE_URL -f database/migrations/test_0020.sql
```

### Individual Table Verification

```sql
-- Check specific table structure
\d firewall_devices

-- Count rows
SELECT COUNT(*) FROM firewall_devices;

-- Verify indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename LIKE 'firewall_%'
ORDER BY tablename, indexname;

-- Check foreign keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name LIKE 'firewall_%'
ORDER BY tc.table_name;
```

### Expected Test Results

```
🧪 Testing Firewall Integration Migration (0020)
============================================================

✅ PASS: All 7 firewall tables exist
✅ PASS: All columns exist in firewall_devices
✅ PASS: Found X foreign key relationships
✅ PASS: Found X indexes
✅ PASS: Found X check constraints
✅ PASS: Found X unique constraints
✅ PASS: All data operations successful

Total Tests: 7
Passed: 7
Failed: 0

🎉 All tests passed! Migration is successful.
```

---

## Rollback Procedures

### ⚠️ WARNING: Data Loss

**Rolling back will permanently delete ALL firewall-related data:**
- All registered firewall devices
- All health snapshots
- All security posture records
- All license information
- All configuration risks
- All metrics rollup data
- All alerts

**Always backup before rollback!**

### Backup Before Rollback

```bash
# Backup entire database
pg_dump -U postgres -d avian_platform_dev -F c -f backup_before_rollback.dump

# Or backup just firewall tables
pg_dump -U postgres -d avian_platform_dev \
  -t firewall_devices \
  -t firewall_health_snapshots \
  -t firewall_security_posture \
  -t firewall_licenses \
  -t firewall_config_risks \
  -t firewall_metrics_rollup \
  -t firewall_alerts \
  -F c -f firewall_tables_backup.dump
```

### Execute Rollback

#### Method 1: Using psql

```bash
psql $DATABASE_URL -f database/migrations/rollback_firewall_integration.sql
```

#### Method 2: Using Test Script

```bash
npx tsx scripts/test-firewall-rollback.ts
```

### Verify Rollback

```bash
# Check that all firewall tables are removed
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'firewall_%';"

# Should return 0 rows
```

### Restore from Backup

```bash
# Restore entire database
pg_restore -U postgres -d avian_platform_dev backup_before_rollback.dump

# Or restore just firewall tables
pg_restore -U postgres -d avian_platform_dev firewall_tables_backup.dump
```

### Re-applying After Rollback

```bash
# After successful rollback, re-run migrations
npx tsx scripts/run-migrations.ts
```

---

## Future Schema Changes

### Workflow for Schema Changes

After migration 0020, all future schema changes should use Drizzle Kit:

#### Step 1: Modify Schema

```typescript
// Edit database/schemas/firewall.ts
export const firewallDevices = pgTable('firewall_devices', {
  // ... existing columns ...
  hostname: varchar('hostname', { length: 255 }), // ← New column
});
```

#### Step 2: Generate Migration

```bash
npx drizzle-kit generate --name add_hostname_to_devices
```

This creates a new migration file in `database/migrations/` with the ALTER TABLE statement.

#### Step 3: Review Generated SQL

```bash
# Check the generated migration
cat database/migrations/XXXX_add_hostname_to_devices.sql
```

#### Step 4: Apply Migration

```bash
# Using migration script
npx tsx scripts/run-migrations.ts

# Or manually
psql $DATABASE_URL -f database/migrations/XXXX_add_hostname_to_devices.sql
```

#### Step 5: Test Migration

```bash
# Verify the change
psql $DATABASE_URL -c "\d firewall_devices"
```

### Example: Adding a New Table

```typescript
// In database/schemas/firewall.ts
export const firewallBackups = pgTable('firewall_backups', {
  backupId: uuid('backup_id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => firewallDevices.deviceId, { onDelete: 'cascade' }),
  backupData: text('backup_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Then:
```bash
npx drizzle-kit generate --name add_firewall_backups_table
npx tsx scripts/run-migrations.ts
```

### Example: Modifying a Column

```typescript
// Change column type
export const firewallDevices = pgTable('firewall_devices', {
  // ... other columns ...
  serialNumber: varchar('serial_number', { length: 200 }), // Changed from 100 to 200
});
```

Then:
```bash
npx drizzle-kit generate --name increase_serial_number_length
npx tsx scripts/run-migrations.ts
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# macOS
brew services start postgresql@16

# Linux
sudo systemctl start postgresql

# Docker
docker start postgres-container
```

#### Issue: Database Does Not Exist

```
Error: database "avian_platform_dev" does not exist
```

**Solution:**
```bash
createdb avian_platform_dev
```

#### Issue: Authentication Failed

```
Error: password authentication failed for user "postgres"
```

**Solution:**
```bash
# Update DATABASE_URL with correct credentials
export DATABASE_URL=postgresql://correct_user:correct_password@localhost:5432/avian_platform_dev
```

#### Issue: Tables Already Exist

```
Error: relation "firewall_devices" already exists
```

**Solution:**
```bash
# Option 1: Skip if migrations already applied
# The migration script automatically skips executed migrations

# Option 2: Drop and recreate (development only)
dropdb avian_platform_dev
createdb avian_platform_dev
npx tsx scripts/run-migrations.ts
```

#### Issue: Foreign Key Constraint Violation

```
Error: insert or update on table violates foreign key constraint
```

**Solution:**
```sql
-- Check that parent records exist
SELECT * FROM tenants LIMIT 1;

-- If no tenants exist, run full migration to seed data
npx tsx scripts/run-migrations.ts
```

#### Issue: Drizzle Schema Drift

```
Warning: Schema drift detected
```

**Solution:**
```bash
# Check what changed
npx drizzle-kit generate

# If changes are expected, apply them
npx tsx scripts/run-migrations.ts

# If changes are unexpected, review schema files
```

#### Issue: pg_cron Not Available

```
Error: extension "pg_cron" is not available
```

**Solution:**
```sql
-- Install pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Or skip retention policies if pg_cron not needed
-- (retention can be handled by application code)
```

---

## Best Practices

### Development Workflow

1. **Always backup before migrations** in production
2. **Test migrations on development database** first
3. **Review generated SQL** before applying
4. **Run tests after migrations** to verify
5. **Document schema changes** in migration files
6. **Use descriptive migration names** for clarity

### Migration Naming

```bash
# Good names
npx drizzle-kit generate --name add_hostname_to_devices
npx drizzle-kit generate --name create_firewall_backups_table
npx drizzle-kit generate --name add_index_on_serial_number

# Avoid generic names
npx drizzle-kit generate --name update_schema
npx drizzle-kit generate --name fix_bug
```

### Schema Changes

1. **Additive changes are safest**: Adding columns, tables, indexes
2. **Destructive changes need care**: Dropping columns, tables, constraints
3. **Data migrations need planning**: Moving or transforming data
4. **Always provide rollback**: Document how to undo changes

### Testing Strategy

1. **Run automated tests** after every migration
2. **Test with real data** when possible
3. **Verify foreign keys** and constraints
4. **Check index performance** on large datasets
5. **Test rollback procedures** before production

### Documentation

1. **Document why** changes were made
2. **Include examples** of usage
3. **Note breaking changes** clearly
4. **Update related docs** (API, types, etc.)
5. **Keep README files current**

### Team Collaboration

1. **Communicate schema changes** to team
2. **Update .env.example** if new variables needed
3. **Run migrations locally** before pushing
4. **Tag releases** with migration numbers
5. **Notify team** of breaking changes

---

## Quick Reference

### Essential Commands

```bash
# Run all migrations
npx tsx scripts/run-migrations.ts

# Test migrations
npx tsx scripts/test-firewall-migration.ts

# Generate new migration
npx drizzle-kit generate --name descriptive_name

# Check schema status
npx drizzle-kit generate

# Rollback firewall integration
psql $DATABASE_URL -f database/migrations/rollback_firewall_integration.sql

# Backup database
pg_dump -U postgres -d avian_platform_dev -F c -f backup.dump

# Restore database
pg_restore -U postgres -d avian_platform_dev backup.dump
```

### File Locations

```
database/
├── migrations/
│   ├── 0012_firewall_devices_table.sql
│   ├── 0013_firewall_health_snapshots.sql
│   ├── 0014_firewall_security_posture.sql
│   ├── 0015_firewall_licenses.sql
│   ├── 0016_firewall_config_risks.sql
│   ├── 0017_firewall_metrics_rollup.sql
│   ├── 0018_firewall_alerts.sql
│   ├── 0019_firewall_retention_policies.sql
│   ├── 0020_firewall_drizzle_schema.sql
│   ├── rollback_firewall_integration.sql
│   ├── MIGRATION_PROCESS.md (this file)
│   └── meta/
│       ├── 0000_snapshot.json
│       └── _journal.json
├── schemas/
│   ├── main.ts
│   ├── tenant.ts
│   └── firewall.ts
└── seeds/
    └── development.ts

scripts/
├── run-migrations.ts
├── test-firewall-migration.ts
└── test-firewall-rollback.ts
```

---

## Related Documentation

- **Requirements**: `.kiro/specs/firewall-integration/requirements.md`
- **Design**: `.kiro/specs/firewall-integration/design.md`
- **Tasks**: `.kiro/specs/firewall-integration/tasks.md`
- **Testing Guide**: `database/migrations/README_TESTING.md`
- **Rollback Guide**: `database/migrations/README_ROLLBACK.md`
- **Retention Reference**: `database/migrations/RETENTION_QUICK_REFERENCE.md`
- **Verification Checklist**: `database/migrations/VERIFICATION_CHECKLIST.md`

---

## Support and Questions

For issues or questions about the migration process:

1. Check this documentation first
2. Review individual migration README files
3. Run test scripts to verify state
4. Check PostgreSQL logs for detailed errors
5. Consult the design document for schema rationale

---

## Summary

The firewall integration migration process is designed to be:

- ✅ **Safe**: Comprehensive testing and rollback procedures
- ✅ **Documented**: Detailed documentation at every step
- ✅ **Automated**: Scripts for common operations
- ✅ **Flexible**: Support for both manual and automated migrations
- ✅ **Type-Safe**: Drizzle ORM integration for TypeScript types
- ✅ **Maintainable**: Clear structure and naming conventions

**Migration Status: ✅ COMPLETE**

All 7 firewall tables are created, tested, and integrated with Drizzle ORM. Future schema changes can be generated using Drizzle Kit.
