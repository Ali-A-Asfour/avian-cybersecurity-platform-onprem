# EDR Data Normalization Layer

## Overview

The EDR Normalization Layer transforms Microsoft Defender and Intune API responses into AVIAN's standardized data models. This layer handles device merging, risk/severity mapping, null field handling, and posture score calculation.

## Requirements

Implements requirements: 1.2, 1.3, 2.2, 3.2, 4.2

## Core Functions

### Device Normalization

#### `normalizeDevice(defenderDevice, tenantId, intuneDevice?)`

Normalizes a single device from Microsoft Defender, optionally merging with Intune data.

**Parameters:**
- `defenderDevice`: Device data from Microsoft Defender API
- `tenantId`: AVIAN tenant ID for multi-tenant isolation
- `intuneDevice`: Optional device data from Microsoft Intune API

**Returns:** Normalized device object ready for database storage

**Features:**
- Merges Defender and Intune data for the same device
- Maps risk scores from exposure levels when not directly available
- Handles missing fields with sensible defaults
- Preserves explicit 0 risk scores (secure devices)

**Example:**
```typescript
const defenderDevice = {
    id: 'azure-device-123',
    computerDnsName: 'DESKTOP-ABC123',
    osPlatform: 'Windows10',
    osVersion: '10.0.19044',
    lastSeen: '2024-01-15T10:30:00Z',
    healthStatus: 'Active',
    riskScore: 45,
    exposureLevel: 'Medium',
};

const intuneDevice = {
    id: 'intune-123',
    azureADDeviceId: 'azure-device-123',
    deviceName: 'DESKTOP-ABC123',
    userPrincipalName: 'user@example.com',
    complianceState: 'compliant',
    enrollmentType: 'AzureDomainJoined',
    lastSyncDateTime: '2024-01-15T10:25:00Z',
};

const normalized = normalizeDevice(defenderDevice, tenantId, intuneDevice);
// Result includes data from both sources
```

#### `mergeDevices(defenderDevices, intuneDevices, tenantId)`

Merges arrays of Defender and Intune devices into normalized devices.

**Matching Strategy:**
1. **Azure AD Device ID** (most reliable)
2. **Hostname** (case-insensitive)
3. **Serial Number** (if available)

**Parameters:**
- `defenderDevices`: Array of devices from Microsoft Defender
- `intuneDevices`: Array of devices from Microsoft Intune
- `tenantId`: AVIAN tenant ID

**Returns:** Array of normalized devices with merged data

**Features:**
- Matches devices across both sources
- Includes unmatched devices from both sources
- Prevents duplicate device records
- Case-insensitive hostname matching

**Example:**
```typescript
const defenderDevices = [/* ... */];
const intuneDevices = [/* ... */];

const merged = mergeDevices(defenderDevices, intuneDevices, tenantId);
// Returns all devices with merged data where possible
```

### Alert Normalization

#### `normalizeAlert(defenderAlert, tenantId, deviceId)`

Normalizes a Microsoft Defender alert into AVIAN's alert model.

**Parameters:**
- `defenderAlert`: Alert data from Microsoft Defender API
- `tenantId`: AVIAN tenant ID
- `deviceId`: AVIAN device ID (from normalized device)

**Returns:** Normalized alert object

**Features:**
- Maps Microsoft severity to AVIAN severity levels
- Handles missing fields with defaults
- Converts timestamps to Date objects

**Severity Mapping:**
- `Informational` → `low`
- `Low` → `low`
- `Medium` → `medium`
- `High` → `high`
- `Critical` → `critical`
- Unknown → `medium` (default)

### Vulnerability Normalization

#### `normalizeVulnerability(vuln, tenantId)`

Normalizes a vulnerability into AVIAN's vulnerability model.

**Parameters:**
- `vuln`: Vulnerability data from Microsoft Defender API
- `tenantId`: AVIAN tenant ID

**Returns:** Normalized vulnerability object

**Features:**
- Maps severity levels
- Counts affected devices
- Handles missing exploitability data

### Compliance Normalization

#### `normalizeCompliance(compliance, tenantId, deviceId)`

Normalizes compliance status into AVIAN's compliance model.

**Parameters:**
- `compliance`: Compliance data from Microsoft Intune API
- `tenantId`: AVIAN tenant ID
- `deviceId`: AVIAN device ID

**Returns:** Normalized compliance object

**Features:**
- Extracts failed compliance rules
- Determines security baseline status
- Handles missing policy states

### Posture Score Calculation

#### `calculatePostureScore(devices, alerts, vulnerabilities, compliance, tenantId)`

Calculates AVIAN posture score based on multiple security factors.

**Weighting:**
- Device risk scores: 30%
- Active alerts: 25%
- Vulnerabilities: 25%
- Compliance: 20%

**Parameters:**
- `devices`: Array of normalized devices
- `alerts`: Array of normalized alerts
- `vulnerabilities`: Array of normalized vulnerabilities
- `compliance`: Array of normalized compliance records
- `tenantId`: AVIAN tenant ID

**Returns:** Posture score object (0-100 scale)

**Calculation Details:**
- **Device Risk Factor**: Inverted average risk score (lower risk = higher score)
- **Alert Factor**: Weighted by severity (high/critical alerts have more impact)
- **Vulnerability Factor**: Based on CVSS scores and affected device count
- **Compliance Factor**: Percentage of compliant devices

**Example:**
```typescript
const postureScore = calculatePostureScore(
    devices,
    alerts,
    vulnerabilities,
    compliance,
    tenantId
);

console.log(postureScore.score); // 0-100
console.log(postureScore.highRiskDeviceCount);
console.log(postureScore.activeAlertCount);
console.log(postureScore.criticalVulnerabilityCount);
console.log(postureScore.nonCompliantDeviceCount);
```

#### `calculatePostureFactors(devices, alerts, vulnerabilities, compliance)`

Calculates detailed posture factors for display in the UI.

**Returns:** PostureFactors object with:
- `deviceRiskAverage`: Average risk score across all devices
- `alertSeverityDistribution`: Count of alerts by severity (low/medium/high)
- `vulnerabilityExposure`: Average CVSS score weighted by affected devices
- `compliancePercentage`: Percentage of compliant devices

## Risk and Severity Mapping

### Risk Level Mapping (Microsoft → AVIAN 0-100 scale)

| Microsoft Level | AVIAN Score |
|----------------|-------------|
| None           | 0           |
| Informational  | 10          |
| Low            | 30          |
| Medium         | 60          |
| High           | 90          |
| Critical       | 100         |
| Unknown        | 50 (default)|

### Exposure Level Mapping

| Exposure Level | Risk Score |
|---------------|------------|
| None          | 0          |
| Low           | 25         |
| Medium        | 50         |
| High          | 75         |
| Critical      | 100        |

### Severity Mapping (Microsoft → AVIAN)

| Microsoft Severity | AVIAN Severity |
|-------------------|----------------|
| Informational     | low            |
| Low               | low            |
| Medium            | medium         |
| High              | high           |
| Critical          | critical       |
| Unknown           | medium (default)|

## Helper Functions

### `mapRiskLevel(riskLevel: string): number`

Maps a Microsoft risk level string to AVIAN's 0-100 scale.

### `mapSeverity(severity: string): string`

Maps a Microsoft severity string to AVIAN's severity format.

### Validation Functions

- `validateNormalizedDevice(device)`: Validates required fields are present
- `validateNormalizedAlert(alert)`: Validates required alert fields
- `validateNormalizedVulnerability(vuln)`: Validates required vulnerability fields
- `validateNormalizedCompliance(compliance)`: Validates required compliance fields

## Null Handling

The normalization layer handles missing or null fields gracefully:

- **Device Name**: Defaults to "Unknown Device"
- **Operating System**: Defaults to "Unknown"
- **OS Version**: Defaults to "Unknown"
- **Primary User**: Defaults to "Unknown"
- **Health Status**: Defaults to "Unknown"
- **Risk Score**: Uses exposure level mapping or defaults to 0
- **Exposure Level**: Defaults to "None"
- **Compliance State**: Defaults to "Unknown"
- **Enrollment Status**: Defaults to "Unknown"
- **Threat Name**: Defaults to "Unknown Threat"
- **Threat Type**: Defaults to "Unknown"
- **Alert Status**: Defaults to "New"
- **CVSS Score**: Defaults to 0
- **Exploitability**: Defaults to "Unknown"
- **Affected Device Count**: Defaults to 0

## Usage in Polling Worker

```typescript
import {
    mergeDevices,
    normalizeAlert,
    normalizeVulnerability,
    normalizeCompliance,
    calculatePostureScore,
} from '@/lib/edr-normalizer';

// In polling worker execution
async function pollTenant(tenantId: string) {
    // Fetch data from Microsoft APIs
    const defenderDevices = await graphClient.getDefenderDevices(tenantId);
    const intuneDevices = await graphClient.getIntuneDevices(tenantId);
    const defenderAlerts = await graphClient.getDefenderAlerts(tenantId);
    const vulnerabilities = await graphClient.getVulnerabilities(tenantId);
    const complianceData = await graphClient.getDeviceCompliance(tenantId);

    // Normalize and merge devices
    const normalizedDevices = mergeDevices(defenderDevices, intuneDevices, tenantId);

    // Store devices in database
    for (const device of normalizedDevices) {
        await db.upsertDevice(device);
    }

    // Normalize and store alerts
    for (const alert of defenderAlerts) {
        const deviceId = await findDeviceId(alert.devices[0].deviceId);
        const normalizedAlert = normalizeAlert(alert, tenantId, deviceId);
        await db.upsertAlert(normalizedAlert);
    }

    // Normalize and store vulnerabilities
    for (const vuln of vulnerabilities) {
        const normalizedVuln = normalizeVulnerability(vuln, tenantId);
        await db.upsertVulnerability(normalizedVuln);
    }

    // Normalize and store compliance
    for (const compliance of complianceData) {
        const deviceId = await findDeviceId(compliance.deviceId);
        const normalizedCompliance = normalizeCompliance(compliance, tenantId, deviceId);
        await db.upsertCompliance(normalizedCompliance);
    }

    // Calculate and store posture score
    const devices = await db.getDevices(tenantId);
    const alerts = await db.getAlerts(tenantId);
    const vulns = await db.getVulnerabilities(tenantId);
    const complianceRecords = await db.getCompliance(tenantId);

    const postureScore = calculatePostureScore(
        devices,
        alerts,
        vulns,
        complianceRecords,
        tenantId
    );

    await db.storePostureScore(postureScore);
}
```

## Testing

Comprehensive unit tests are available in `src/lib/__tests__/edr-normalizer.test.ts`.

Run tests:
```bash
npm test -- src/lib/__tests__/edr-normalizer.test.ts
```

## Design Document Reference

See `.kiro/specs/edr-defender-intune/design.md` for complete architecture and data model specifications.
