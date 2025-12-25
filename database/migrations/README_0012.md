# Migration 0012: Firewall Devices Table

## Overview
This migration creates the `firewall_devices` table for the SonicWall Firewall Integration feature. This is the first table in a series of tables that will support lightweight firewall monitoring through API polling.

## What This Migration Does

### Creates Table: `firewall_devices`
Stores registered SonicWall firewall devices with the following features:
- **Tenant Association**: Each device belongs to exactly one tenant (multi-tenant isolation)
- **Device Metadata**: Model, firmware version, serial number, management IP
- **API Credentials**: Encrypted username and password for SonicWall API authentication
- **Status Tracking**: Device status (active/inactive/offline) and last seen timestamp
- **Uptime Tracking**: Stores device uptime in seconds

### Indexes Created
For optimal query performance:
- `idx_firewall_devices_tenant` - Fast tenant-based filtering
- `idx_firewall_devices_status` - Quick status lookups
- `idx_firewall_devices_serial` - Unique device identification
- `idx_firewall_devices_last_seen` - Monitoring and health checks

### Foreign Key Constraints
- `tenant_id` references `tenants(id)` with CASCADE delete
  - When a tenant is deleted, all their firewall devices are automatically removed

## Security Features

### Encrypted Credentials
The `api_password_encrypted` field stores AES-256 encrypted passwords. The encryption/decryption will be handled by the application layer using a key stored in environment variables.

### Tenant Isolation
All queries must filter by `tenant_id` to ensure proper multi-tenant data isolation. The foreign key constraint ensures devices cannot exist without a valid tenant.

## How to Apply This Migration

### Using the Migration Script (Recommended)
```bash
# Set your database connection string
export DATABASE_URL="postgresql://user:password@localhost:5432/avian"

# Run all pending migrations
tsx scripts/run-migrations.ts
```

### Manual Application
```bash
# Connect to your database
psql $DATABASE_URL

# Run the migration file
\i database/migrations/0012_firewall_devices_table.sql
```

## Verification

After applying the migration, verify it was successful:

```sql
-- Check if table exists
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'firewall_devices'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'firewall_devices';

-- Check foreign key constraints
SELECT conname, contype, confdeltype
FROM pg_constraint
WHERE conrelid = 'firewall_devices'::regclass;
```

Expected results:
- 12 columns in the table
- 4 indexes (plus the primary key index)
- 1 foreign key constraint to tenants table

## Next Steps

This migration is part of Task 1.1 in the firewall integration spec. The remaining sub-tasks are:
1. ✅ Create firewall_devices table (this migration)
2. ⏳ Create firewall_health_snapshots table
3. ⏳ Create firewall_security_posture table
4. ⏳ Create firewall_licenses table
5. ⏳ Create firewall_config_risks table
6. ⏳ Create firewall_metrics_rollup table
7. ⏳ Create firewall_alerts table

## Rollback

If you need to rollback this migration:

```sql
-- Drop the table (will cascade to any dependent data)
DROP TABLE IF EXISTS firewall_devices CASCADE;

-- Remove from migration tracking
DELETE FROM schema_migrations WHERE migration_name = '0012_firewall_devices_table.sql';
```

## Related Files

- **Migration SQL**: `database/migrations/0012_firewall_devices_table.sql`
- **Drizzle Schema**: `database/schemas/main.ts` (firewallDevices table)
- **Design Document**: `.kiro/specs/firewall-integration/design.md`
- **Requirements**: `.kiro/specs/firewall-integration/requirements.md`

## Schema Definition

```typescript
// From database/schemas/main.ts
export const firewallDevices = pgTable(
  'firewall_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    model: varchar('model', { length: 100 }),
    firmware_version: varchar('firmware_version', { length: 50 }),
    serial_number: varchar('serial_number', { length: 100 }).unique(),
    management_ip: varchar('management_ip', { length: 45 }).notNull(),
    api_username: varchar('api_username', { length: 255 }),
    api_password_encrypted: text('api_password_encrypted'),
    uptime_seconds: integer('uptime_seconds').default(0),
    last_seen_at: timestamp('last_seen_at'),
    status: varchar('status', { length: 20 }).default('active'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  // ... indexes
);
```

## Notes

- The `management_ip` field uses `varchar(45)` to support both IPv4 and IPv6 addresses
- The `serial_number` field has a UNIQUE constraint to prevent duplicate device registrations
- The `status` field accepts: 'active', 'inactive', or 'offline'
- Timestamps use `timestamp with time zone` for proper timezone handling
- The table uses UUID primary keys for consistency with the rest of the platform
