# EDR Database Operations

This module provides database operations for the EDR (Microsoft Defender + Intune) integration.

## Overview

All operations enforce tenant isolation by requiring `tenant_id` in all insert/update operations. The module provides:

- **Device Operations**: Upsert devices by `microsoft_device_id`
- **Alert Operations**: Upsert alerts by `microsoft_alert_id`
- **Vulnerability Operations**: Upsert vulnerabilities by `cve_id`
- **Device-Vulnerability Junction**: Manage many-to-many relationships
- **Compliance Operations**: Upsert compliance by `device_id`
- **Remote Action Operations**: Log actions with user attribution
- **Posture Score Operations**: Store calculated security posture scores

## Key Features

### Upsert Operations

All upsert operations follow the pattern:
- Insert if the record doesn't exist
- Update if the record exists (based on unique constraint)
- Always include `tenant_id` for isolation
- Update `updated_at` timestamp on every operation

### Batch Operations

For efficiency, batch operations are provided:
- `upsertDevices()` - Process devices in batches of 50
- `upsertAlerts()` - Process alerts in batches of 50
- `upsertVulnerabilities()` - Process vulnerabilities in batches of 50
- `upsertComplianceRecords()` - Process compliance in batches of 50

### Tenant Isolation

All operations enforce tenant isolation:
- `tenant_id` is required in all insert/update operations
- Query operations filter by `tenant_id`
- Cross-tenant access is prevented at the database layer

## Usage Examples

### Device Operations

```typescript
import { upsertDevice, upsertDevices, getDeviceById } from './edr-database-operations';

// Upsert a single device
const device: NormalizedDevice = {
  tenantId: 'tenant-uuid',
  microsoftDeviceId: 'ms-device-123',
  deviceName: 'LAPTOP-001',
  operatingSystem: 'Windows 11',
  osVersion: '22H2',
  primaryUser: 'user@example.com',
  defenderHealthStatus: 'active',
  riskScore: 25,
  exposureLevel: 'Low',
  intuneComplianceState: 'compliant',
  intuneEnrollmentStatus: 'enrolled',
  lastSeenAt: new Date(),
  // ... other fields
};

const result = await upsertDevice(device);
console.log('Device ID:', result.id);

// Batch upsert devices
const devices: NormalizedDevice[] = [device1, device2, device3];
const results = await upsertDevices(devices);

// Get device by ID with tenant validation
const retrievedDevice = await getDeviceById('device-uuid', 'tenant-uuid');
```

### Alert Operations

```typescript
import { upsertAlert, upsertAlerts } from './edr-database-operations';

// Upsert a single alert
const alert: NormalizedAlert = {
  tenantId: 'tenant-uuid',
  deviceId: 'device-uuid',
  microsoftAlertId: 'ms-alert-456',
  severity: 'high',
  threatType: 'malware',
  threatName: 'Trojan.Generic',
  status: 'active',
  description: 'Malware detected on device',
  detectedAt: new Date(),
  // ... other fields
};

const result = await upsertAlert(alert);

// Batch upsert alerts
const alerts: NormalizedAlert[] = [alert1, alert2, alert3];
await upsertAlerts(alerts);
```

### Vulnerability Operations

```typescript
import { 
  upsertVulnerability, 
  linkDeviceVulnerabilities,
  syncDeviceVulnerabilities 
} from './edr-database-operations';

// Upsert a vulnerability
const vulnerability: NormalizedVulnerability = {
  tenantId: 'tenant-uuid',
  cveId: 'CVE-2024-1234',
  severity: 'critical',
  cvssScore: 9.8,
  exploitability: 'high',
  description: 'Remote code execution vulnerability',
  // ... other fields
};

const result = await upsertVulnerability(vulnerability);

// Link vulnerabilities to a device
await linkDeviceVulnerabilities('device-uuid', ['vuln-uuid-1', 'vuln-uuid-2']);

// Sync device vulnerabilities (removes old, adds new)
await syncDeviceVulnerabilities('device-uuid', ['vuln-uuid-1', 'vuln-uuid-3']);
```

### Compliance Operations

```typescript
import { upsertCompliance } from './edr-database-operations';

const compliance: NormalizedCompliance = {
  tenantId: 'tenant-uuid',
  deviceId: 'device-uuid',
  complianceState: 'noncompliant',
  failedRules: [
    { ruleName: 'BitLocker Encryption', state: 'failed' },
    { ruleName: 'Firewall Enabled', state: 'failed' }
  ],
  securityBaselineStatus: 'noncompliant',
  requiredAppsStatus: [
    { appName: 'Antivirus', installed: true },
    { appName: 'VPN Client', installed: false }
  ],
  checkedAt: new Date(),
  // ... other fields
};

await upsertCompliance(compliance);
```

### Remote Action Operations

```typescript
import { 
  logRemoteAction, 
  updateActionStatus,
  getDeviceActions 
} from './edr-database-operations';

// Log a remote action
const action = {
  tenantId: 'tenant-uuid',
  deviceId: 'device-uuid',
  userId: 'user-uuid',
  actionType: 'isolate' as const,
  status: 'pending' as const,
  resultMessage: '',
  initiatedAt: new Date(),
  completedAt: new Date(),
};

const result = await logRemoteAction(action);

// Update action status when it completes
await updateActionStatus(result.id, 'completed', 'Device isolated successfully');

// Get all actions for a device
const actions = await getDeviceActions('device-uuid', 'tenant-uuid');
```

### Posture Score Operations

```typescript
import { 
  storePostureScore, 
  getLatestPostureScore,
  getPostureScoreHistory 
} from './edr-database-operations';

// Store a calculated posture score
const score = {
  tenantId: 'tenant-uuid',
  score: 75,
  deviceCount: 100,
  highRiskDeviceCount: 5,
  activeAlertCount: 12,
  criticalVulnerabilityCount: 3,
  nonCompliantDeviceCount: 8,
  calculatedAt: new Date(),
};

await storePostureScore(score);

// Get the latest posture score
const latestScore = await getLatestPostureScore('tenant-uuid');

// Get posture score history
const history = await getPostureScoreHistory(
  'tenant-uuid',
  new Date('2024-01-01'),
  new Date('2024-12-31')
);
```

## Database Schema

### Tables

- **edr_devices**: Endpoint devices from Defender and Intune
- **edr_alerts**: Security alerts from Defender
- **edr_vulnerabilities**: CVE vulnerabilities
- **edr_device_vulnerabilities**: Many-to-many junction table
- **edr_compliance**: Device compliance status from Intune
- **edr_actions**: Remote action audit log
- **edr_posture_scores**: Security posture scores

### Unique Constraints

- `edr_devices`: (tenant_id, microsoft_device_id)
- `edr_alerts`: (tenant_id, microsoft_alert_id)
- `edr_vulnerabilities`: (tenant_id, cve_id)
- `edr_compliance`: (tenant_id, device_id)
- `edr_device_vulnerabilities`: (device_id, vulnerability_id)

### Indexes

All tables have indexes on:
- `tenant_id` for tenant filtering
- Timestamp fields for sorting
- Foreign keys for joins
- Severity/status fields for filtering

## Error Handling

All operations may throw database errors:
- **Unique constraint violations**: Handled by `onConflictDoUpdate`
- **Foreign key violations**: Thrown if referenced records don't exist
- **Connection errors**: Thrown if database is unavailable
- **Validation errors**: Thrown if data violates check constraints

## Performance Considerations

- **Batch Operations**: Use batch functions for bulk inserts (50 records per batch)
- **Indexes**: All queries use indexed columns for performance
- **Upsert**: Uses `onConflictDoUpdate` for efficient insert-or-update
- **Connection Pooling**: Managed by Drizzle ORM

## Security

- **Tenant Isolation**: All operations enforce tenant_id filtering
- **User Attribution**: Remote actions log user_id for audit trail
- **No SQL Injection**: Uses parameterized queries via Drizzle ORM
- **Access Control**: Caller must provide valid tenant_id

## Requirements Validation

This module satisfies the following requirements:

- **1.2**: Device normalization and storage with tenant_id
- **2.2**: Alert storage with tenant_id
- **2.3**: Alert upsert behavior (duplicate handling)
- **3.2**: Vulnerability storage with device relationships
- **4.2**: Compliance storage with tenant_id
- **5.3**: Remote action logging with user attribution
- **5.4**: Action status updates
- **6.2**: Posture score storage
- **9.1, 9.2, 9.3**: Tenant ID in all records
- **10.1, 10.2**: Audit logging for remote actions
