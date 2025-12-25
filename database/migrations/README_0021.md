# Migration 0021: EDR Integration Tables

## Overview

This migration creates the database schema for Microsoft Defender for Endpoint and Microsoft Intune integration. It establishes tables for devices, alerts, vulnerabilities, compliance status, remote actions, and security posture scores with full tenant isolation.

## Tables Created

### 1. edr_devices
Stores endpoint devices from Microsoft Defender and Intune.

**Key Features:**
- Tenant isolation via `tenant_id`
- Unique constraint on `(tenant_id, microsoft_device_id)`
- Risk score validation (0-100)
- Indexes on tenant, risk score, compliance state, and last seen timestamp

**Columns:**
- Device identification: `microsoft_device_id`, `device_name`, `operating_system`, `os_version`
- User information: `primary_user`
- Defender data: `defender_health_status`, `risk_score`, `exposure_level`
- Intune data: `intune_compliance_state`, `intune_enrollment_status`
- Timestamps: `last_seen_at`, `created_at`, `updated_at`

### 2. edr_alerts
Stores security alerts from Microsoft Defender for Endpoint.

**Key Features:**
- Tenant isolation via `tenant_id`
- Foreign key to `edr_devices` with CASCADE delete
- Unique constraint on `(tenant_id, microsoft_alert_id)`
- Indexes on tenant, device, severity, status, and detection time

**Columns:**
- Alert identification: `microsoft_alert_id`, `threat_type`, `threat_name`
- Severity and status: `severity`, `status`
- Details: `description`
- Timestamps: `detected_at`, `created_at`, `updated_at`

### 3. edr_vulnerabilities
Stores CVE vulnerabilities detected by Microsoft Defender.

**Key Features:**
- Tenant isolation via `tenant_id`
- Unique constraint on `(tenant_id, cve_id)`
- CVSS score storage (0.0-10.0)
- Indexes on tenant, severity, and CVSS score

**Columns:**
- Vulnerability identification: `cve_id`
- Severity information: `severity`, `cvss_score`, `exploitability`
- Details: `description`
- Timestamps: `created_at`, `updated_at`

### 4. edr_device_vulnerabilities
Junction table for many-to-many relationship between devices and vulnerabilities.

**Key Features:**
- Composite primary key on `(device_id, vulnerability_id)`
- Foreign keys to both `edr_devices` and `edr_vulnerabilities` with CASCADE delete
- Indexes on both device and vulnerability IDs
- Detection timestamp tracking

### 5. edr_compliance
Stores device compliance status from Microsoft Intune.

**Key Features:**
- Tenant isolation via `tenant_id`
- Foreign key to `edr_devices` with CASCADE delete
- Unique constraint on `(tenant_id, device_id)` - one compliance record per device
- JSONB storage for failed rules and required apps
- Indexes on tenant, device, and compliance state

**Columns:**
- Compliance information: `compliance_state`, `security_baseline_status`
- Failed policies: `failed_rules` (JSONB)
- Required apps: `required_apps_status` (JSONB)
- Timestamps: `checked_at`, `created_at`, `updated_at`

### 6. edr_actions
Audit log of remote actions executed on devices.

**Key Features:**
- Tenant isolation via `tenant_id`
- Foreign keys to `edr_devices` and `users`
- User attribution for all actions
- Indexes on tenant, device, user, and initiation time

**Columns:**
- Action details: `action_type`, `status`, `result_message`
- Attribution: `user_id`
- Timestamps: `initiated_at`, `completed_at`, `created_at`

**Action Types:**
- `isolate` - Network isolate device
- `unisolate` - Remove network isolation
- `scan` - Run antivirus scan
- `resolve_alert` - Mark alert as resolved

**Status Values:**
- `pending` - Action queued
- `in_progress` - Action executing
- `completed` - Action successful
- `failed` - Action failed

### 7. edr_posture_scores
Historical security posture scores calculated from EDR data.

**Key Features:**
- Tenant isolation via `tenant_id`
- Score validation (0-100)
- Contributing factor tracking
- Indexes on tenant and calculation time

**Columns:**
- Score: `score` (0-100)
- Contributing factors: `device_count`, `high_risk_device_count`, `active_alert_count`, `critical_vulnerability_count`, `non_compliant_device_count`
- Timestamps: `calculated_at`, `created_at`

## Indexes

All tables include performance indexes on:
- `tenant_id` - For tenant isolation queries
- Foreign key columns - For join performance
- Timestamp columns - For date range queries
- Status/severity columns - For filtering

## Foreign Key Constraints

All foreign keys use `ON DELETE CASCADE` to maintain referential integrity:
- Deleting a tenant removes all EDR data
- Deleting a device removes all related alerts, compliance, actions, and vulnerability associations
- Deleting a vulnerability removes all device associations

Exception: `edr_actions.user_id` uses `ON DELETE NO ACTION` to preserve audit trail even if user is deleted.

## Tenant Isolation

All tables include `tenant_id` with foreign key constraints to the `tenants` table. This ensures:
- Multi-tenant data isolation
- Automatic cleanup when tenants are removed
- Query performance through indexed tenant filtering

## Requirements Validated

This migration satisfies the following requirements from the EDR integration spec:

- **1.2**: Device data normalization and storage
- **2.2**: Alert data storage with tenant isolation
- **3.2**: Vulnerability storage with device associations
- **4.2**: Compliance data storage
- **5.3**: Remote action audit logging
- **6.2**: Posture score storage
- **9.1, 9.2, 9.3**: Tenant ID presence in all records

## Testing

Run the test script to verify the migration:

```bash
psql $DATABASE_URL -f database/migrations/test_0021.sql
```

The test script validates:
1. All 7 tables created
2. Foreign key constraints exist
3. Performance indexes created
4. Unique constraints work
5. Data insertion and tenant isolation
6. CASCADE delete functionality

## Rollback

To rollback this migration:

```bash
psql $DATABASE_URL -f database/migrations/rollback_0021_edr_integration.sql
```

This will drop all EDR tables in the correct order (child tables first).

## Usage Example

```sql
-- Insert a device
INSERT INTO edr_devices (
    tenant_id,
    microsoft_device_id,
    device_name,
    operating_system,
    risk_score
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    'defender-device-001',
    'DESKTOP-ABC123',
    'Windows 11',
    45
);

-- Query devices by tenant with high risk
SELECT device_name, risk_score, intune_compliance_state
FROM edr_devices
WHERE tenant_id = '123e4567-e89b-12d3-a456-426614174000'
AND risk_score > 70
ORDER BY risk_score DESC;

-- Get alerts for a device
SELECT severity, threat_name, status, detected_at
FROM edr_alerts
WHERE device_id = 'device-uuid-here'
AND tenant_id = 'tenant-uuid-here'
ORDER BY detected_at DESC;

-- Get vulnerabilities affecting a device
SELECT v.cve_id, v.severity, v.cvss_score
FROM edr_vulnerabilities v
JOIN edr_device_vulnerabilities dv ON v.id = dv.vulnerability_id
WHERE dv.device_id = 'device-uuid-here'
AND v.tenant_id = 'tenant-uuid-here'
ORDER BY v.cvss_score DESC;
```

## Next Steps

After applying this migration:

1. Update Drizzle schema definitions in `database/schemas/edr.ts`
2. Create TypeScript types in `src/types/edr.ts`
3. Implement Microsoft Graph API client
4. Build data normalization layer
5. Create REST API endpoints
6. Implement polling worker service

## Notes

- All timestamps use `timestamp with time zone` for proper timezone handling
- JSONB columns allow flexible storage of complex data structures
- Check constraints ensure data validity (e.g., risk_score 0-100)
- Comments on tables and columns provide inline documentation
