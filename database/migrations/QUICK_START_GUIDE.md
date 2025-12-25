# Firewall Integration Migration - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

This is a quick reference for getting the firewall integration migrations up and running. For comprehensive documentation, see [MIGRATION_PROCESS.md](./MIGRATION_PROCESS.md).

---

## Prerequisites

```bash
# 1. PostgreSQL running
brew services start postgresql@16  # macOS
# or
sudo systemctl start postgresql    # Linux

# 2. Database created
createdb avian_platform_dev

# 3. Environment variable set
export DATABASE_URL=postgresql://postgres:password@localhost:5432/avian_platform_dev

# 4. Dependencies installed
npm install
```

---

## Run Migrations (Choose One Method)

### Method 1: Automated Script (Recommended) ⭐

```bash
npx tsx scripts/run-migrations.ts
```

**What it does:**
- ✅ Runs all migrations in order
- ✅ Skips already-executed migrations
- ✅ Seeds default tenant and admin user
- ✅ Shows progress and results

### Method 2: Manual Execution

```bash
# Run each migration file
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

---

## Verify Migrations

### Quick Check

```bash
# List all firewall tables (should show 7 tables)
psql $DATABASE_URL -c "\dt firewall_*"
```

**Expected output:**
```
 firewall_alerts
 firewall_config_risks
 firewall_devices
 firewall_health_snapshots
 firewall_licenses
 firewall_metrics_rollup
 firewall_security_posture
```

### Comprehensive Test

```bash
# Run automated test suite
npx tsx scripts/test-firewall-migration.ts
```

**Expected:** All 7 tests pass ✅

---

## Common Commands

```bash
# Run migrations
npx tsx scripts/run-migrations.ts

# Test migrations
npx tsx scripts/test-firewall-migration.ts

# Check Drizzle status
npx drizzle-kit generate

# Backup database
pg_dump -U postgres -d avian_platform_dev -F c -f backup.dump

# Restore database
pg_restore -U postgres -d avian_platform_dev backup.dump

# Rollback (⚠️ DELETES ALL FIREWALL DATA)
psql $DATABASE_URL -f database/migrations/rollback_firewall_integration.sql
```

---

## Making Schema Changes (After Initial Setup)

### Step 1: Edit Schema

```typescript
// Edit database/schemas/firewall.ts
export const firewallDevices = pgTable('firewall_devices', {
  // ... existing columns ...
  hostname: varchar('hostname', { length: 255 }), // ← Add new column
});
```

### Step 2: Generate Migration

```bash
npx drizzle-kit generate --name add_hostname_to_devices
```

### Step 3: Apply Migration

```bash
npx tsx scripts/run-migrations.ts
```

### Step 4: Verify

```bash
psql $DATABASE_URL -c "\d firewall_devices"
```

---

## Troubleshooting

### Connection Refused
```bash
# Start PostgreSQL
brew services start postgresql@16  # macOS
sudo systemctl start postgresql    # Linux
```

### Database Not Found
```bash
createdb avian_platform_dev
```

### Authentication Failed
```bash
# Update DATABASE_URL with correct credentials
export DATABASE_URL=postgresql://correct_user:correct_password@localhost:5432/avian_platform_dev
```

### Tables Already Exist
```bash
# Option 1: Skip (migrations auto-skip if already run)
npx tsx scripts/run-migrations.ts

# Option 2: Fresh start (development only)
dropdb avian_platform_dev
createdb avian_platform_dev
npx tsx scripts/run-migrations.ts
```

---

## What Gets Created

### 7 Firewall Tables

1. **firewall_devices** - Registered SonicWall devices
2. **firewall_health_snapshots** - Health metrics (CPU, RAM, uptime)
3. **firewall_security_posture** - Security feature status (IPS, GAV, etc.)
4. **firewall_licenses** - License expiration tracking
5. **firewall_config_risks** - Configuration risk analysis
6. **firewall_metrics_rollup** - Daily aggregated metrics
7. **firewall_alerts** - Alert management system

### Additional Features

- ✅ Indexes for performance
- ✅ Foreign keys for data integrity
- ✅ Retention policies (90 days snapshots, 365 days metrics)
- ✅ Automatic cleanup functions
- ✅ Drizzle ORM integration

---

## File Structure

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
│   ├── MIGRATION_PROCESS.md ← Full documentation
│   ├── QUICK_START_GUIDE.md ← This file
│   └── README_*.md ← Per-migration docs
├── schemas/
│   └── firewall.ts ← Drizzle ORM schema
└── seeds/
    └── development.ts

scripts/
├── run-migrations.ts ← Run migrations
├── test-firewall-migration.ts ← Test migrations
└── test-firewall-rollback.ts ← Test rollback
```

---

## Next Steps

After successful migration:

1. ✅ Verify all 7 tables exist
2. ✅ Run test suite to confirm
3. ✅ Proceed to Task 1.4: Implement Credential Encryption
4. ✅ Continue with Phase 2: SonicWall API Client

---

## Documentation

- **Quick Start**: `QUICK_START_GUIDE.md` (this file)
- **Full Guide**: `MIGRATION_PROCESS.md` (comprehensive)
- **Testing**: `README_TESTING.md`
- **Rollback**: `README_ROLLBACK.md`
- **Retention**: `RETENTION_QUICK_REFERENCE.md`

---

## Support

For detailed information:
1. See [MIGRATION_PROCESS.md](./MIGRATION_PROCESS.md) for comprehensive guide
2. Check individual migration READMEs: `README_00XX.md`
3. Review troubleshooting section in MIGRATION_PROCESS.md
4. Check PostgreSQL logs for detailed errors

---

## Summary

**To get started:**
```bash
# 1. Set database URL
export DATABASE_URL=postgresql://postgres:password@localhost:5432/avian_platform_dev

# 2. Run migrations
npx tsx scripts/run-migrations.ts

# 3. Verify
npx tsx scripts/test-firewall-migration.ts
```

**That's it!** 🎉

All 7 firewall tables will be created, tested, and ready to use.

For making future schema changes, see the "Making Schema Changes" section above or the full [MIGRATION_PROCESS.md](./MIGRATION_PROCESS.md) guide.
