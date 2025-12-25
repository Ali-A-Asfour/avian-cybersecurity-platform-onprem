# Firewall Risk Storage Service

This module provides functionality for storing, retrieving, and managing configuration risks for firewall devices. It handles the association of risks with both `device_id` and optional `snapshot_id`.

## Overview

The risk storage service implements Task 4.6 of the Firewall Integration specification, providing:

- Storage of configuration risks with device and snapshot associations
- Batch operations for efficient risk management
- Querying risks by device, severity, and snapshot
- Automatic cleanup of old risks when new configurations are uploaded

## Core Functions

### `storeConfigRisks(deviceId, risks, snapshotId?)`

Stores an array of configuration risks for a device.

**Parameters:**
- `deviceId` (string): UUID of the firewall device
- `risks` (ConfigRisk[]): Array of detected configuration risks
- `snapshotId` (string | null, optional): UUID of the config upload snapshot

**Returns:** Promise<FirewallConfigRisk[]> - Array of created risk records

**Example:**
```typescript
import { storeConfigRisks } from '@/lib/firewall-risk-storage';
import { RiskEngine, ConfigParser } from '@/lib/firewall-config-parser';

// Parse configuration and detect risks
const parser = new ConfigParser();
const riskEngine = new RiskEngine();
const config = parser.parseConfig(configFileContent);
const risks = riskEngine.analyzeConfig(config);

// Store risks with device_id and snapshot_id
const snapshotId = crypto.randomUUID();
const storedRisks = await storeConfigRisks(deviceId, risks, snapshotId);
```

### `deleteOldRisks(deviceId)`

Deletes all existing risks for a device. Useful when uploading a new configuration.

**Parameters:**
- `deviceId` (string): UUID of the firewall device

**Returns:** Promise<number> - Number of deleted risk records

**Example:**
```typescript
import { deleteOldRisks } from '@/lib/firewall-risk-storage';

const deletedCount = await deleteOldRisks(deviceId);
console.log(`Deleted ${deletedCount} old risks`);
```

### `replaceDeviceRisks(deviceId, risks, snapshotId?)`

Convenience function that combines `deleteOldRisks` and `storeConfigRisks` in a single operation. This ensures only the latest configuration analysis results are stored.

**Parameters:**
- `deviceId` (string): UUID of the firewall device
- `risks` (ConfigRisk[]): Array of detected configuration risks
- `snapshotId` (string | null, optional): UUID of the config upload snapshot

**Returns:** Promise<{ deletedCount: number, createdRisks: FirewallConfigRisk[] }>

**Example:**
```typescript
import { replaceDeviceRisks } from '@/lib/firewall-risk-storage';

// Upload new config and replace old risks
const result = await replaceDeviceRisks(deviceId, newRisks, snapshotId);
console.log(`Deleted ${result.deletedCount} old risks`);
console.log(`Created ${result.createdRisks.length} new risks`);
```

### `getRisksByDevice(deviceId)`

Retrieves all risks for a device, ordered by detection time (newest first).

**Parameters:**
- `deviceId` (string): UUID of the firewall device

**Returns:** Promise<FirewallConfigRisk[]> - Array of risk records

**Example:**
```typescript
import { getRisksByDevice } from '@/lib/firewall-risk-storage';

const risks = await getRisksByDevice(deviceId);
console.log(`Found ${risks.length} risks for device`);
```

### `getRisksByDeviceAndSeverity(deviceId, severity)`

Retrieves risks for a device filtered by severity level.

**Parameters:**
- `deviceId` (string): UUID of the firewall device
- `severity` (RiskSeverity): 'critical' | 'high' | 'medium' | 'low'

**Returns:** Promise<FirewallConfigRisk[]> - Array of risk records matching the severity

**Example:**
```typescript
import { getRisksByDeviceAndSeverity } from '@/lib/firewall-risk-storage';

const criticalRisks = await getRisksByDeviceAndSeverity(deviceId, 'critical');
console.log(`Found ${criticalRisks.length} critical risks`);
```

### `getRisksBySnapshot(snapshotId)`

Retrieves all risks associated with a specific configuration snapshot.

**Parameters:**
- `snapshotId` (string): UUID of the config snapshot

**Returns:** Promise<FirewallConfigRisk[]> - Array of risk records for the snapshot

**Example:**
```typescript
import { getRisksBySnapshot } from '@/lib/firewall-risk-storage';

const snapshotRisks = await getRisksBySnapshot(snapshotId);
console.log(`Snapshot has ${snapshotRisks.length} risks`);
```

### `countRisksBySeverity(deviceId)`

Counts risks by severity level for a device.

**Parameters:**
- `deviceId` (string): UUID of the firewall device

**Returns:** Promise<{ critical: number, high: number, medium: number, low: number, total: number }>

**Example:**
```typescript
import { countRisksBySeverity } from '@/lib/firewall-risk-storage';

const counts = await countRisksBySeverity(deviceId);
console.log(`Critical: ${counts.critical}, High: ${counts.high}, Medium: ${counts.medium}, Low: ${counts.low}`);
```

### `deleteRisksBySnapshot(snapshotId)`

Deletes all risks associated with a specific snapshot.

**Parameters:**
- `snapshotId` (string): UUID of the config snapshot

**Returns:** Promise<number> - Number of deleted risk records

**Example:**
```typescript
import { deleteRisksBySnapshot } from '@/lib/firewall-risk-storage';

const deletedCount = await deleteRisksBySnapshot(snapshotId);
```

### `createConfigRisk(input)`

Creates a single risk record. For batch operations, use `storeConfigRisks` instead.

**Parameters:**
- `input` (CreateConfigRiskInput): Risk creation input object

**Returns:** Promise<FirewallConfigRisk> - Created risk record

**Example:**
```typescript
import { createConfigRisk } from '@/lib/firewall-risk-storage';

const risk = await createConfigRisk({
    deviceId: 'device-uuid',
    snapshotId: 'snapshot-uuid',
    riskCategory: 'exposure_risk',
    riskType: 'OPEN_INBOUND',
    severity: 'critical',
    description: 'Unrestricted WAN to LAN access rule detected',
    remediation: 'Restrict the destination address to specific hosts or networks.',
});
```

## Complete Workflow Example

Here's a complete example of uploading a firewall configuration, analyzing it for risks, and storing the results:

```typescript
import { ConfigParser, RiskEngine } from '@/lib/firewall-config-parser';
import { replaceDeviceRisks, countRisksBySeverity } from '@/lib/firewall-risk-storage';

async function uploadAndAnalyzeConfig(deviceId: string, configFileContent: string) {
    // 1. Parse the configuration file
    const parser = new ConfigParser();
    const config = parser.parseConfig(configFileContent);
    
    // 2. Analyze configuration for risks
    const riskEngine = new RiskEngine();
    const risks = riskEngine.analyzeConfig(config);
    
    // 3. Calculate risk score
    const riskScore = riskEngine.calculateRiskScore(risks);
    
    // 4. Generate a snapshot ID for this config upload
    const snapshotId = crypto.randomUUID();
    
    // 5. Replace old risks with new ones
    const result = await replaceDeviceRisks(deviceId, risks, snapshotId);
    
    console.log(`Deleted ${result.deletedCount} old risks`);
    console.log(`Created ${result.createdRisks.length} new risks`);
    console.log(`Risk score: ${riskScore}/100`);
    
    // 6. Get risk counts by severity
    const counts = await countRisksBySeverity(deviceId);
    
    return {
        snapshotId,
        riskScore,
        counts,
        risks: result.createdRisks,
    };
}
```

## Database Schema

Risks are stored in the `firewall_config_risks` table with the following structure:

```sql
CREATE TABLE firewall_config_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES firewall_devices(id) ON DELETE CASCADE,
    snapshot_id UUID,  -- Optional reference to config upload event
    risk_category VARCHAR(50) NOT NULL,
    risk_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    remediation TEXT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes

The table includes the following indexes for optimal query performance:

- `idx_config_risks_device` - Composite index on (device_id, severity)
- `idx_config_risks_severity` - Index on severity
- `idx_config_risks_category` - Index on risk_category
- `idx_config_risks_type` - Index on risk_type
- `idx_config_risks_detected_at` - Index on detected_at (descending)
- `idx_config_risks_snapshot` - Index on snapshot_id

## Risk Categories

Risks are categorized into the following types:

- `network_misconfiguration` - Network configuration issues (e.g., ANY_ANY_RULE, GUEST_NOT_ISOLATED)
- `exposure_risk` - Security exposure risks (e.g., OPEN_INBOUND, WAN_MANAGEMENT_ENABLED, SSH_ON_WAN)
- `security_feature_disabled` - Disabled security features (e.g., IPS_DISABLED, GAV_DISABLED)
- `license_expired` - License expiration issues
- `best_practice_violation` - Best practice violations (e.g., ADMIN_NO_MFA, DEFAULT_ADMIN_USERNAME)

## Risk Severities

Risks are assigned one of four severity levels:

- `critical` - Immediate action required (e.g., OPEN_INBOUND, IPS_DISABLED)
- `high` - High priority issues (e.g., ANY_ANY_RULE, ADMIN_NO_MFA)
- `medium` - Medium priority issues (e.g., DPI_SSL_DISABLED, VPN_PSK_ONLY)
- `low` - Low priority issues (e.g., RULE_NO_DESCRIPTION, NO_NTP)

## API Integration

This service is designed to be used in API routes for config upload endpoints:

```typescript
// Example API route: POST /api/firewall/config/upload
import { NextRequest, NextResponse } from 'next/server';
import { ConfigParser, RiskEngine } from '@/lib/firewall-config-parser';
import { replaceDeviceRisks } from '@/lib/firewall-risk-storage';

export async function POST(request: NextRequest) {
    const { deviceId, configFile } = await request.json();
    
    // Parse and analyze config
    const parser = new ConfigParser();
    const riskEngine = new RiskEngine();
    const config = parser.parseConfig(configFile);
    const risks = riskEngine.analyzeConfig(config);
    const riskScore = riskEngine.calculateRiskScore(risks);
    
    // Store risks with snapshot
    const snapshotId = crypto.randomUUID();
    const result = await replaceDeviceRisks(deviceId, risks, snapshotId);
    
    return NextResponse.json({
        success: true,
        snapshotId,
        riskScore,
        riskSummary: {
            totalRisks: result.createdRisks.length,
            criticalRisks: result.createdRisks.filter(r => r.severity === 'critical').length,
            highRisks: result.createdRisks.filter(r => r.severity === 'high').length,
            mediumRisks: result.createdRisks.filter(r => r.severity === 'medium').length,
            lowRisks: result.createdRisks.filter(r => r.severity === 'low').length,
        },
        risks: result.createdRisks,
    });
}
```

## Requirements

This implementation satisfies the following requirements from the Firewall Integration specification:

- **Requirement 6.1-6.30**: Configuration risk detection and storage
- **Task 4.6**: Implement Risk Storage
  - ✅ Create risk records in firewall_config_risks table
  - ✅ Associate risks with device_id and snapshot_id
  - ✅ Store risk category, type, severity, description, remediation
  - ✅ Delete old risks when new config uploaded
  - ✅ Query risks by device and severity

## Testing

Comprehensive tests are provided in `src/lib/__tests__/firewall-risk-storage.test.ts` covering:

- Storing risks with device_id only
- Storing risks with device_id and snapshot_id
- Deleting old risks
- Querying risks by device
- Querying risks by device and severity
- Querying risks by snapshot
- Replacing device risks
- Counting risks by severity
- Complete config upload workflow

## Related Files

- `src/lib/firewall-config-parser.ts` - Configuration parsing and risk detection
- `database/schemas/firewall.ts` - Database schema definitions
- `src/types/firewall.ts` - TypeScript type definitions
- `database/migrations/0016_firewall_config_risks.sql` - Database migration
