# Design Document: EDR Integration (Microsoft Defender + Intune)

## Overview

**This MVP is fully agentless.** All telemetry originates from Microsoft Defender and Intune via Microsoft Graph API. A future AVIAN Endpoint Agent will expand capabilities but is not required for this phase. Although the AVIAN Agent is planned for future releases, this architecture must operate with zero dependency on any local software running on endpoints.

This design document specifies the architecture and implementation approach for integrating Microsoft Defender for Endpoint and Microsoft Intune into the AVIAN cybersecurity platform. The integration is cloud-to-cloud, leveraging Microsoft Graph API to retrieve endpoint security data without deploying any AVIAN agent to endpoints.

The system consists of:
- **Backend Polling Service**: Scheduled worker that fetches data from Microsoft APIs
- **Microsoft Graph API Client**: Handles authentication and API communication
- **Normalization Layer**: Transforms Microsoft data models into AVIAN's schema
- **Database Layer**: Stores devices, alerts, vulnerabilities, compliance, and actions
- **REST API**: Provides frontend access to EDR data
- **Frontend Dashboards**: React-based UI for viewing and managing endpoint security

All data is tenant-isolated, ensuring multi-tenant security. The system handles API rate limiting, credential management, and automatic data refresh.

## Architecture

### High-Level Data Flow

```
┌─────────────┐
│  Endpoints  │
│ (Workstations,│
│   Servers)   │
└──────┬──────┘
       │
       │ Report to Microsoft
       ▼
┌─────────────────────────────────┐
│   Microsoft Cloud Services      │
│                                  │
│  ┌──────────────────────────┐  │
│  │ Microsoft Defender       │  │
│  │ - Threat Detection       │  │
│  │ - Vulnerability Scanning │  │
│  │ - Risk Scoring           │  │
│  └──────────────────────────┘  │
│                                  │
│  ┌──────────────────────────┐  │
│  │ Microsoft Intune         │  │
│  │ - Compliance Policies    │  │
│  │ - Device Management      │  │
│  │ - Security Baselines     │  │
│  └──────────────────────────┘  │
│                                  │
│  ┌──────────────────────────┐  │
│  │ Microsoft Graph API      │  │
│  │ (Unified API Endpoint)   │  │
│  └──────────────────────────┘  │
└────────────┬────────────────────┘
             │
             │ HTTPS / OAuth 2.0
             ▼
┌─────────────────────────────────┐
│      AVIAN Platform (AWS)       │
│                                  │
│  ┌──────────────────────────┐  │
│  │ Polling Worker           │  │
│  │ (Lambda / ECS)           │  │
│  │ - Scheduled execution    │  │
│  │ - Multi-tenant support   │  │
│  └──────────┬───────────────┘  │
│             │                    │
│             ▼                    │
│  ┌──────────────────────────┐  │
│  │ Graph API Client         │  │
│  │ - Authentication         │  │
│  │ - Rate limiting          │  │
│  │ - Error handling         │  │
│  └──────────┬───────────────┘  │
│             │                    │
│             ▼                    │
│  ┌──────────────────────────┐  │
│  │ Normalization Layer      │  │
│  │ - Data transformation    │  │
│  │ - Merging Defender/Intune│  │
│  └──────────┬───────────────┘  │
│             │                    │
│             ▼                    │
│  ┌──────────────────────────┐  │
│  │ PostgreSQL (RDS)         │  │
│  │ - edr_devices            │  │
│  │ - edr_alerts             │  │
│  │ - edr_vulnerabilities    │  │
│  │ - edr_compliance         │  │
│  │ - edr_actions            │  │
│  │ - edr_posture_scores     │  │
│  └──────────┬───────────────┘  │
│             │                    │
│             ▼                    │
│  ┌──────────────────────────┐  │
│  │ AVIAN REST API           │  │
│  │ (Next.js API Routes)     │  │
│  │ - Tenant validation      │  │
│  │ - Data filtering         │  │
│  │ - Remote actions         │  │
│  └──────────┬───────────────┘  │
│             │                    │
└─────────────┼────────────────────┘
              │
              │ HTTPS / JWT
              ▼
┌─────────────────────────────────┐
│      Frontend (React)           │
│                                  │
│  - Devices Dashboard            │
│  - Alerts Dashboard             │
│  - Vulnerability Dashboard      │
│  - Compliance Dashboard         │
│  - Posture Score Widget         │
│  - Device Detail Page           │
│  - Auto-refresh (30s polling)   │
└─────────────────────────────────┘
```

### Component Responsibilities

**Polling Worker:**
- Executes on CloudWatch Events schedule (default: every 15 minutes)
- Retrieves credentials from AWS Secrets Manager
- Iterates through all active tenants
- Calls Graph API Client for each tenant
- Passes data to Normalization Layer
- Logs execution metrics

**Graph API Client:**
- Authenticates using OAuth 2.0 client credentials flow
- Manages access token lifecycle (caching, refresh)
- Implements rate limiting with exponential backoff
- Handles API errors and retries
- Provides methods for:
  - `getDevices(tenantId)`
  - `getAlerts(tenantId)`
  - `getVulnerabilities(tenantId)`
  - `getCompliance(tenantId)`
  - `executeRemoteAction(deviceId, action)`

**Normalization Layer:**
- Transforms Microsoft Graph API responses into AVIAN data models
- Merges Defender and Intune data for the same device
- Calculates AVIAN-specific fields (posture contribution, risk categories)
- Handles missing or null fields gracefully
- Maintains data consistency

**Database Layer:**
- Stores all EDR data with tenant isolation
- Implements indexes for query performance
- Maintains foreign key relationships
- Supports upsert operations for data updates
- Retains historical data for trend analysis

**REST API:**
- Validates JWT authentication
- Enforces tenant isolation
- Provides filtering, sorting, and pagination
- Handles remote action requests
- Returns normalized JSON responses

**Frontend:**
- Implements responsive dashboards
- Auto-refreshes data every 30 seconds
- Provides search and filter controls
- Displays real-time status updates
- Handles loading and error states

## Components and Interfaces

### 1. Microsoft Graph API Client

**File:** `src/lib/microsoft-graph-client.ts`

**Interface:**
```typescript
interface MicrosoftGraphClient {
  // Authentication
  authenticate(tenantId: string): Promise<string>; // Returns access token
  refreshToken(tenantId: string): Promise<string>;
  
  // Device Operations
  getDefenderDevices(tenantId: string): Promise<DefenderDevice[]>; // Uses standard Defender machines endpoint
  getIntuneDevices(tenantId: string): Promise<IntuneDevice[]>; // Uses Intune managedDevices endpoint
  
  // Alert Operations
  getDefenderAlerts(tenantId: string, since?: Date): Promise<DefenderAlert[]>;
  
  // Vulnerability Operations
  getVulnerabilities(tenantId: string): Promise<Vulnerability[]>;
  getDeviceVulnerabilities(deviceId: string): Promise<Vulnerability[]>;
  
  // Compliance Operations
  getDeviceCompliance(tenantId: string): Promise<ComplianceStatus[]>;
  
  // Remote Actions
  isolateDevice(deviceId: string): Promise<ActionResult>;
  unisolateDevice(deviceId: string): Promise<ActionResult>;
  runAntivirusScan(deviceId: string): Promise<ActionResult>;
  
  // Rate Limiting
  handleRateLimit(retryAfter: number): Promise<void>;
}
```

**Key Methods:**

- `authenticate()`: Uses OAuth 2.0 client credentials flow with stored client ID and secret
- `getDefenderDevices()`: Calls standard Defender machines/devices endpoints (NOT Advanced Hunting or runHuntingQuery)
- `getDefenderAlerts()`: Calls standard Defender alerts endpoints with filtering
- `getVulnerabilities()`: Calls standard Defender vulnerabilities endpoints
- `isolateDevice()`: Calls Defender remote action endpoints
- `handleRateLimit()`: Implements exponential backoff based on Retry-After header

**Important Note on API Endpoints:**
This integration exclusively uses standard Microsoft Graph REST endpoints. No KQL, Advanced Hunting, or Threat Analytics APIs are included in the MVP. All device, alert, vulnerability, and compliance data is retrieved through standard Graph API REST endpoints for Defender and Intune.

**Critical Note on Remote Actions:**
The remote action method names and API paths shown in this document are conceptual placeholders. The actual implementation MUST use the official Microsoft Defender for Endpoint remote action APIs and correct Graph API paths as documented by Microsoft. These should NOT be treated as exact URLs.

**Important:** Microsoft's Defender remote actions API does NOT live under Intune's `/managedDevices/{id}` path. The actual remote action API endpoints often differ from the Graph device endpoints and may require direct Defender-specific actions endpoints. Final URLs must be confirmed using Microsoft's official documentation during implementation.

**MVP Exclusions:**
This design explicitly does NOT include:
- Advanced Hunting queries
- KQL (Kusto Query Language) execution
- Threat Analytics ingestion
- runHuntingQuery API calls
- Any custom scripts or agents on endpoints
All data retrieval uses standard REST endpoints from Microsoft Graph API for Defender and Intune.

### 2. Normalization Layer

**File:** `src/lib/edr-normalizer.ts`

**Interface:**
```typescript
interface EDRNormalizer {
  // Device Normalization
  normalizeDevice(
    defenderDevice: DefenderDevice,
    intuneDevice?: IntuneDevice
  ): NormalizedDevice;
  
  mergeDevices(
    defenderDevices: DefenderDevice[],
    intuneDevices: IntuneDevice[]
  ): NormalizedDevice[];
  
  // Alert Normalization
  normalizeAlert(defenderAlert: DefenderAlert): NormalizedAlert;
  
  // Vulnerability Normalization
  normalizeVulnerability(vuln: Vulnerability): NormalizedVulnerability;
  
  // Compliance Normalization
  normalizeCompliance(compliance: ComplianceStatus): NormalizedCompliance;
  
  // Posture Calculation
  calculatePostureScore(
    devices: NormalizedDevice[],
    alerts: NormalizedAlert[],
    vulnerabilities: NormalizedVulnerability[],
    compliance: NormalizedCompliance[]
  ): PostureScore;
}
```

**Normalization Rules:**

- **Device Matching**: Match Defender and Intune devices by device ID, hostname, or serial number
- **Risk Mapping**: Map Microsoft's risk levels (Low/Medium/High) to AVIAN's 0-100 scale
- **Severity Mapping**: Map Microsoft severity (Informational/Low/Medium/High) to AVIAN severity levels
- **Timestamp Handling**: Convert all timestamps to UTC ISO 8601 format
- **Null Handling**: Provide default values for missing fields
- **Posture Contribution Mapping**: Calculate device contribution to posture score (Phase 2: ML-driven custom weighting)

### 3. Database Schema

**File:** `database/schemas/edr.ts`

**Tables:**

```sql
-- EDR Devices
CREATE TABLE edr_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  microsoft_device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  operating_system VARCHAR(100),
  os_version VARCHAR(100),
  primary_user VARCHAR(255),
  
  -- Defender Data
  defender_health_status VARCHAR(50),
  risk_score INTEGER, -- 0-100
  exposure_level VARCHAR(50),
  
  -- Intune Data
  intune_compliance_state VARCHAR(50),
  intune_enrollment_status VARCHAR(50),
  
  -- Timestamps
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, microsoft_device_id)
);

CREATE INDEX idx_edr_devices_tenant ON edr_devices(tenant_id);
CREATE INDEX idx_edr_devices_risk ON edr_devices(risk_score DESC);
CREATE INDEX idx_edr_devices_compliance ON edr_devices(intune_compliance_state);

-- EDR Alerts
CREATE TABLE edr_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES edr_devices(id) ON DELETE CASCADE,
  microsoft_alert_id VARCHAR(255) NOT NULL,
  
  severity VARCHAR(50) NOT NULL,
  threat_type VARCHAR(100),
  threat_name VARCHAR(255),
  status VARCHAR(50),
  description TEXT,
  
  detected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, microsoft_alert_id)
);

CREATE INDEX idx_edr_alerts_tenant ON edr_alerts(tenant_id);
CREATE INDEX idx_edr_alerts_device ON edr_alerts(device_id);
CREATE INDEX idx_edr_alerts_severity ON edr_alerts(severity);
CREATE INDEX idx_edr_alerts_status ON edr_alerts(status);
CREATE INDEX idx_edr_alerts_detected ON edr_alerts(detected_at DESC);

-- EDR Vulnerabilities
CREATE TABLE edr_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cve_id VARCHAR(50) NOT NULL,
  
  severity VARCHAR(50) NOT NULL,
  cvss_score DECIMAL(3,1),
  exploitability VARCHAR(50),
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, cve_id)
);

CREATE INDEX idx_edr_vulnerabilities_tenant ON edr_vulnerabilities(tenant_id);
CREATE INDEX idx_edr_vulnerabilities_severity ON edr_vulnerabilities(severity);

-- EDR Device Vulnerabilities (Many-to-Many)
CREATE TABLE edr_device_vulnerabilities (
  device_id UUID NOT NULL REFERENCES edr_devices(id) ON DELETE CASCADE,
  vulnerability_id UUID NOT NULL REFERENCES edr_vulnerabilities(id) ON DELETE CASCADE,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (device_id, vulnerability_id)
);

CREATE INDEX idx_edr_device_vulns_device ON edr_device_vulnerabilities(device_id);
CREATE INDEX idx_edr_device_vulns_vuln ON edr_device_vulnerabilities(vulnerability_id);

-- EDR Compliance
CREATE TABLE edr_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES edr_devices(id) ON DELETE CASCADE,
  
  compliance_state VARCHAR(50) NOT NULL,
  failed_rules JSONB,
  security_baseline_status VARCHAR(50),
  required_apps_status JSONB,
  
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, device_id)
);

CREATE INDEX idx_edr_compliance_tenant ON edr_compliance(tenant_id);
CREATE INDEX idx_edr_compliance_device ON edr_compliance(device_id);
CREATE INDEX idx_edr_compliance_state ON edr_compliance(compliance_state);

-- EDR Remote Actions
CREATE TABLE edr_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES edr_devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  action_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  result_message TEXT,
  
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_edr_actions_tenant ON edr_actions(tenant_id);
CREATE INDEX idx_edr_actions_device ON edr_actions(device_id);
CREATE INDEX idx_edr_actions_user ON edr_actions(user_id);
CREATE INDEX idx_edr_actions_initiated ON edr_actions(initiated_at DESC);

-- EDR Posture Scores
CREATE TABLE edr_posture_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  score INTEGER NOT NULL, -- 0-100
  device_count INTEGER,
  high_risk_device_count INTEGER,
  active_alert_count INTEGER,
  critical_vulnerability_count INTEGER,
  non_compliant_device_count INTEGER,
  
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_edr_posture_tenant ON edr_posture_scores(tenant_id);
CREATE INDEX idx_edr_posture_calculated ON edr_posture_scores(calculated_at DESC);
```

### 4. Polling Worker

**File:** `src/services/edr-polling-worker.ts`

**Interface:**
```typescript
interface EDRPollingWorker {
  // Main execution
  execute(): Promise<void>;
  
  // Per-tenant polling
  pollTenant(tenantId: string): Promise<PollResult>;
  
  // Data retrieval
  fetchDevices(tenantId: string): Promise<void>;
  fetchAlerts(tenantId: string): Promise<void>;
  fetchVulnerabilities(tenantId: string): Promise<void>;
  fetchCompliance(tenantId: string): Promise<void>;
  
  // Posture calculation
  calculatePosture(tenantId: string): Promise<void>;
  
  // Logging
  logExecution(result: PollResult): Promise<void>;
}
```

**Execution Flow:**
1. Retrieve list of active tenants with Microsoft integration enabled
2. For each tenant:
   - Authenticate with Microsoft Graph API
   - Fetch devices from Defender and Intune
   - Merge and normalize device data
   - Store/update devices in database
   - Fetch alerts, vulnerabilities, compliance
   - Calculate posture score
   - Log execution metrics
3. Handle errors with tenant isolation (one tenant failure doesn't affect others)

### 5. REST API Endpoints

**Base Path:** `/api/edr`

**Endpoints:**

```typescript
// Devices
GET    /api/edr/devices
  Query params: search, os, riskLevel, complianceState, lastSeenAfter
  Response: { devices: Device[], total: number }

GET    /api/edr/devices/:id
  Response: { device: Device, alerts: Alert[], vulnerabilities: Vulnerability[], compliance: Compliance }

// Alerts
GET    /api/edr/alerts
  Query params: severity, deviceId, status, startDate, endDate, page, limit
  Response: { alerts: Alert[], total: number, page: number, limit: number }

GET    /api/edr/alerts/:id
  Response: { alert: Alert }

// Vulnerabilities
GET    /api/edr/vulnerabilities
  Query params: severity, exploitability, page, limit
  Response: { vulnerabilities: Vulnerability[], total: number }

GET    /api/edr/vulnerabilities/:cveId/devices
  Response: { devices: Device[] }

// Compliance
GET    /api/edr/compliance
  Query params: state, deviceId
  Response: { compliance: Compliance[] }

GET    /api/edr/compliance/summary
  Response: { compliant: number, nonCompliant: number, unknown: number }

// Remote Actions
POST   /api/edr/actions
  Body: { deviceId: string, actionType: 'isolate' | 'unisolate' | 'scan' }
  Response: { action: Action }

GET    /api/edr/actions
  Query params: deviceId, userId, startDate, endDate
  Response: { actions: Action[] }

// Posture
GET    /api/edr/posture
  Response: { score: number, trend: 'up' | 'down' | 'stable', factors: PostureFactors }

GET    /api/edr/posture/history
  Query params: startDate, endDate
  Response: { scores: PostureScore[] }
```

**Authentication & Authorization:**
- All endpoints require valid JWT token
- Tenant ID extracted from JWT claims
- All queries filtered by tenant ID
- Remote actions require 'edr:execute_actions' permission

## Data Models

### TypeScript Interfaces

**File:** `src/types/edr.ts`

```typescript
// Device Models
export interface DefenderDevice {
  id: string;
  computerDnsName: string;
  osPlatform: string;
  osVersion: string;
  lastSeen: string;
  healthStatus: string;
  riskScore: number;
  exposureLevel: string;
}

export interface IntuneDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  userPrincipalName: string;
  complianceState: string;
  enrollmentType: string;
  lastSyncDateTime: string;
}

export interface NormalizedDevice {
  id: string;
  tenantId: string;
  microsoftDeviceId: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  primaryUser: string;
  defenderHealthStatus: string;
  riskScore: number;
  exposureLevel: string;
  intuneComplianceState: string;
  intuneEnrollmentStatus: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Alert Models
export interface DefenderAlert {
  id: string;
  severity: string;
  title: string;
  category: string;
  status: string;
  description: string;
  detectionSource: string;
  createdDateTime: string;
  devices: { deviceId: string }[];
}

export interface NormalizedAlert {
  id: string;
  tenantId: string;
  deviceId: string;
  microsoftAlertId: string;
  severity: string;
  threatType: string;
  threatName: string;
  status: string;
  description: string;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Vulnerability Models
export interface Vulnerability {
  id: string;
  cveId: string;
  severity: string;
  cvssScore: number;
  exploitability: string;
  description: string;
  affectedDevices: string[];
}

export interface NormalizedVulnerability {
  id: string;
  tenantId: string;
  cveId: string;
  severity: string;
  cvssScore: number;
  exploitability: string;
  description: string;
  affectedDeviceCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Compliance Models
export interface ComplianceStatus {
  deviceId: string;
  complianceState: string;
  complianceGracePeriodExpirationDateTime: string;
  deviceCompliancePolicyStates: {
    settingName: string;
    state: string;
  }[];
}

export interface NormalizedCompliance {
  id: string;
  tenantId: string;
  deviceId: string;
  complianceState: string;
  failedRules: { ruleName: string; state: string }[];
  securityBaselineStatus: string;
  requiredAppsStatus: { appName: string; installed: boolean }[];
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Action Models
export interface ActionResult {
  id: string;
  status: string;
  message: string;
}

export interface RemoteAction {
  id: string;
  tenantId: string;
  deviceId: string;
  userId: string;
  actionType: 'isolate' | 'unisolate' | 'scan' | 'resolve_alert';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  resultMessage: string;
  initiatedAt: Date;
  completedAt: Date;
  createdAt: Date;
}

// Posture Models
export interface PostureScore {
  id: string;
  tenantId: string;
  score: number;
  deviceCount: number;
  highRiskDeviceCount: number;
  activeAlertCount: number;
  criticalVulnerabilityCount: number;
  nonCompliantDeviceCount: number;
  calculatedAt: Date;
  createdAt: Date;
}

export interface PostureFactors {
  deviceRiskAverage: number;
  alertSeverityDistribution: { low: number; medium: number; high: number };
  vulnerabilityExposure: number;
  compliancePercentage: number;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, the following redundancies were identified and resolved:
- **3.2 and 3.3** both test many-to-many vulnerability-device relationships → Combined into Property 3
- **9.1, 9.2, 9.3** all test tenant ID presence → Combined into Property 9
- **10.1 and 10.3** both test audit logging → Combined into Property 10

### Data Retrieval and Normalization Properties

**Property 1: API data completeness**
*For any* polling execution, all retrieved device data from Microsoft Graph API should contain device name, operating system, primary user, Defender health status, Intune compliance state, risk score, and last check-in timestamp
**Validates: Requirements 1.1**

**Property 2: Device normalization and storage**
*For any* device data retrieved from Microsoft APIs, normalizing and storing the data should result in a record in the devices table with the correct tenant ID and all required fields populated
**Validates: Requirements 1.2**

**Property 3: Device merging from multiple sources**
*For any* device that exists in both Defender and Intune APIs, the normalized device record should contain data from both sources merged by device identifier
**Validates: Requirements 1.3**

**Property 4: Alert data completeness**
*For any* polling execution, all retrieved alert data from Microsoft Defender API should contain alert ID, severity, threat type, affected device, status, and timestamp
**Validates: Requirements 2.1**

**Property 5: Alert upsert behavior**
*For any* alert with the same Microsoft alert ID, storing it multiple times should result in exactly one database record with the most recent data
**Validates: Requirements 2.3**

**Property 6: Vulnerability-device relationship integrity**
*For any* vulnerability affecting multiple devices, the database should maintain associations between the vulnerability and all affected devices in the junction table
**Validates: Requirements 3.2, 3.3**

**Property 7: Compliance data storage**
*For any* compliance data retrieved from Intune, storing it should result in a record with the correct tenant ID, device association, and failed rules stored as JSONB
**Validates: Requirements 4.2, 4.3**

### Tenant Isolation Properties

**Property 8: Query tenant filtering**
*For any* API request with an authenticated tenant ID, all returned data should belong only to that tenant
**Validates: Requirements 1.4, 9.4**

**Property 9: Tenant ID presence in all records**
*For any* device, alert, or vulnerability stored in the database, the record should contain a valid tenant ID
**Validates: Requirements 9.1, 9.2, 9.3**

**Property 10: Cross-tenant access rejection**
*For any* attempt to access data from a different tenant than the authenticated user's tenant, the system should return a 403 Forbidden error
**Validates: Requirements 9.5**

### Remote Actions and Audit Properties

**Property 11: Remote action authorization**
*For any* remote action request, if the user's tenant ID does not match the target device's tenant ID, the action should be rejected
**Validates: Requirements 5.1**

**Property 12: Remote action audit logging**
*For any* remote action initiated, a record should be created in the actions table containing user ID, username, tenant ID, device ID, action type, and timestamp
**Validates: Requirements 5.3, 10.1**

**Property 13: Action completion updates**
*For any* remote action that completes, the corresponding action log record should be updated with the result status and completion timestamp
**Validates: Requirements 5.4, 10.2**

**Property 14: Audit log filtering**
*For any* audit report request with tenant and date range filters, all returned actions should belong to the specified tenant and fall within the date range
**Validates: Requirements 10.3, 10.5**

### Posture Score Properties

**Property 15: Posture score calculation**
*For any* set of devices, alerts, vulnerabilities, and compliance data for a tenant, the calculated posture score should be between 0 and 100 and reflect the weighted contribution of each factor
**Validates: Requirements 6.1**

**Property 16: Posture score storage**
*For any* calculated posture score, storing it should result in a record with the tenant ID, score value, contributing factors, and calculation timestamp
**Validates: Requirements 6.2**

**Property 17: Posture trend calculation**
*For any* tenant with multiple historical posture scores, the trend should be "up" if the most recent score is higher than the previous, "down" if lower, and "stable" if equal
**Validates: Requirements 6.3, 17.2**

### Polling and Scheduling Properties

**Property 18: Multi-tenant polling**
*For any* polling execution, all active tenants should be processed, and a failure in one tenant should not prevent processing of other tenants
**Validates: Requirements 7.3**

**Property 19: Credential retrieval and authentication**
*For any* polling execution, credentials should be retrieved from AWS Secrets Manager and used to authenticate with Microsoft Graph API
**Validates: Requirements 7.4, 8.2**

**Property 20: Credential caching scope**
*For any* polling cycle, credentials should be cached in memory only for the duration of that cycle and not persisted beyond it
**Validates: Requirements 8.3**

**Property 21: Token refresh on expiration**
*For any* expired access token, the system should attempt to refresh it using the stored refresh token before failing
**Validates: Requirements 8.4**

### Rate Limiting Properties

**Property 22: Rate limit header parsing**
*For any* 429 rate limit response from Microsoft API, the system should extract and parse the Retry-After header value
**Validates: Requirements 11.1**

**Property 23: Rate limit retry delay**
*For any* rate limit encountered, the system should wait for the duration specified in the Retry-After header before retrying the request
**Validates: Requirements 11.2**

**Property 24: Exponential backoff with cap**
*For any* sequence of multiple rate limit responses, the wait time should increase exponentially but never exceed 5 minutes
**Validates: Requirements 11.3**

**Property 25: Rate limit logging**
*For any* rate limit encountered, the system should log the event with the affected API endpoint and retry time
**Validates: Requirements 11.4**

### Query and Filtering Properties

**Property 26: Alert filtering**
*For any* alert query with severity, device, status, or date range filters, all returned alerts should match all specified filter criteria
**Validates: Requirements 2.4, 14.2**

**Property 27: Device search and filtering**
*For any* device query with search term or filters for OS, risk level, compliance status, or last seen date, all returned devices should match the criteria
**Validates: Requirements 13.2, 13.3**

**Property 28: Vulnerability filtering**
*For any* vulnerability query with severity or exploitability filters, all returned vulnerabilities should match the specified criteria
**Validates: Requirements 15.2**

**Property 29: Compliance summary accuracy**
*For any* tenant, the compliance summary counts should equal the actual number of devices in each compliance state
**Validates: Requirements 16.1**

**Property 30: Device detail data completeness**
*For any* device detail request, the response should include Defender health, Intune compliance, vulnerability list, active alerts, and available remote actions
**Validates: Requirements 13.4**

**Property 31: Vulnerability affected devices**
*For any* vulnerability detail request, the response should include all devices that have that vulnerability
**Validates: Requirements 15.4**

**Property 32: Posture contributing factors**
*For any* posture score request, the response should include device risk average, alert severity distribution, vulnerability exposure, and compliance percentage
**Validates: Requirements 17.3**

## Error Handling

### Microsoft API Errors

**Authentication Failures:**
- **401 Unauthorized**: Log error, attempt token refresh, notify administrators if refresh fails
- **403 Forbidden**: Log error with tenant ID, check API permissions, notify administrators
- **Invalid Credentials**: Log error, mark tenant as requiring credential update, notify administrators

**Rate Limiting:**
- **429 Too Many Requests**: Parse Retry-After header, implement exponential backoff (max 5 minutes), log retry attempts
- **Consistent Rate Limiting**: After 5 consecutive rate limits, reduce polling frequency and alert administrators

**Data Retrieval Errors:**
- **404 Not Found**: Log warning, continue processing other resources
- **500 Internal Server Error**: Log error, retry with exponential backoff (max 3 retries), continue with other tenants
- **Timeout**: Log error, retry once, continue with other tenants if retry fails

**Data Validation Errors:**
- **Missing Required Fields**: Log warning with field name and resource ID, skip record, continue processing
- **Invalid Data Types**: Log error with field name and value, skip record, continue processing
- **Malformed JSON**: Log error with response snippet, skip record, continue processing

### Database Errors

**Connection Failures:**
- **Connection Timeout**: Retry with exponential backoff (max 3 retries), fail polling execution if all retries fail
- **Connection Pool Exhausted**: Log error, wait for available connection, fail after 30 seconds

**Query Errors:**
- **Unique Constraint Violation**: Log warning, attempt upsert instead of insert
- **Foreign Key Violation**: Log error with device ID, skip record, continue processing
- **Deadlock**: Retry transaction up to 3 times with random jitter

**Data Integrity Errors:**
- **Null Constraint Violation**: Log error with field name, skip record, continue processing
- **Invalid Tenant ID**: Log error, skip record, alert administrators

### Frontend Errors

**API Request Failures:**
- **Network Error**: Display connection status indicator, pause auto-refresh, retry when connectivity restored
- **401 Unauthorized**: Redirect to login page
- **403 Forbidden**: Display "Access Denied" message
- **404 Not Found**: Display "Resource not found" message
- **500 Server Error**: Display "Server error, please try again" message, log error to monitoring

**Data Display Errors:**
- **Empty Results**: Display "No data available" message
- **Insufficient Data for Posture**: Display "Insufficient data for calculation" message
- **Missing Fields**: Display "N/A" for missing values, log warning

**Auto-Refresh Errors:**
- **Polling Failure**: Continue showing cached data, display warning indicator
- **Stale Data**: Display last update timestamp, allow manual refresh

## Testing Strategy

### Unit Testing

**Backend Components:**
- Microsoft Graph API Client: Mock API responses, test authentication, rate limiting, error handling
- Normalization Layer: Test data transformation, device merging, null handling
- Database Operations: Test CRUD operations, tenant isolation, upsert logic
- Posture Calculator: Test score calculation with various input combinations
- API Endpoints: Test request validation, tenant filtering, response formatting

**Frontend Components:**
- Dashboard Components: Test rendering with mock data, filter interactions, search functionality
- Auto-Refresh Logic: Test polling setup, cleanup, state updates
- Error Handling: Test error display, retry logic, connection status

### Property-Based Testing

**Phase 2 / Post-MVP:** Full property-based testing with extensive generators and 100+ iterations per property is recommended for production hardening but not required for initial MVP delivery.

**Testing Framework:** fast-check (for TypeScript/JavaScript)

**Test Configuration:**
- Minimum 100 iterations per property test
- Use seed for reproducibility
- Generate edge cases (empty arrays, null values, boundary values)

**Property Test Implementation:**

Each property-based test MUST:
1. Be tagged with a comment referencing the design document property
2. Generate random valid inputs using fast-check generators
3. Execute the system under test
4. Assert the property holds for all generated inputs
5. Run at least 100 iterations

**Example Property Test Structure:**
```typescript
/**
 * Feature: edr-defender-intune, Property 8: Query tenant filtering
 * For any API request with an authenticated tenant ID, all returned data should belong only to that tenant
 */
test('property: query tenant filtering', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(deviceGenerator(), { minLength: 10, maxLength: 50 }),
      fc.uuid(),
      async (devices, queryTenantId) => {
        // Setup: Store devices for multiple tenants
        await storeDevices(devices);
        
        // Execute: Query with specific tenant ID
        const results = await getDevices({ tenantId: queryTenantId });
        
        // Assert: All results belong to query tenant
        expect(results.every(d => d.tenantId === queryTenantId)).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Generators:**
- `deviceGenerator()`: Generates random devices with all required fields
- `alertGenerator()`: Generates random alerts with severity, threat type, timestamps
- `vulnerabilityGenerator()`: Generates random CVEs with severity and affected devices
- `complianceGenerator()`: Generates random compliance data with failed rules
- `tenantIdGenerator()`: Generates valid UUID tenant IDs
- `dateRangeGenerator()`: Generates valid date ranges for filtering

**Property Test Coverage:**

Properties 1-7 (Data Retrieval): Test with random API responses, verify normalization and storage
Properties 8-10 (Tenant Isolation): Test with multi-tenant data, verify filtering and access control
Properties 11-14 (Remote Actions): Test with random actions, verify authorization and audit logging
Properties 15-17 (Posture Score): Test with random device/alert/vulnerability data, verify calculation
Properties 18-21 (Polling): Test with random tenant configurations, verify execution and credential handling
Properties 22-25 (Rate Limiting): Test with simulated rate limit responses, verify backoff behavior
Properties 26-32 (Queries): Test with random data and filters, verify filtering accuracy

### Integration Testing

**End-to-End Flows:**
1. **Full Polling Cycle**: Deploy worker, trigger execution, verify data in database
2. **Device Detail Page**: Create device with alerts/vulnerabilities, verify detail page shows all data
3. **Remote Action Flow**: Initiate action, verify API call, verify audit log, verify status update
4. **Posture Calculation**: Store device/alert/vulnerability data, trigger calculation, verify score
5. **Multi-Tenant Isolation**: Create data for multiple tenants, verify queries respect tenant boundaries

**API Integration Tests:**
- Test all REST endpoints with valid and invalid inputs
- Test authentication and authorization
- Test pagination, filtering, sorting
- Test error responses (400, 401, 403, 404, 500)

**Database Integration Tests:**
- Test migrations apply cleanly
- Test indexes improve query performance
- Test foreign key constraints enforce relationships
- Test unique constraints prevent duplicates

**Microsoft API Integration Tests:**
- Use Microsoft Graph API sandbox/test environment **(Phase 2: Full live testing with Microsoft sandbox)**
- Test authentication flow
- Test data retrieval from all endpoints
- Test rate limiting behavior
- Test error handling
- **MVP**: Use mocked Microsoft API responses for integration tests

### Performance Testing

**Phase 2 / Post-MVP:** Extensive load testing and performance optimization are recommended for production scaling but not required for initial MVP delivery.

**Polling Performance:**
- Test polling execution time with 1, 10, 100 tenants
- Verify polling completes within configured interval
- Test database connection pool under load

**API Performance:**
- Test response times for device list (100, 1000, 10000 devices)
- Test response times for alert list with filters
- Test response times for device detail page
- Verify all endpoints respond within 500ms for typical loads

**Database Performance:**
- Test query performance with indexes
- Test upsert performance for large batches
- Verify no N+1 query problems

### Security Testing

**Authentication Testing:**
- Test JWT validation
- Test expired token handling
- Test invalid token rejection

**Authorization Testing:**
- Test tenant isolation in all endpoints
- Test cross-tenant access attempts
- Test permission checks for remote actions

**Input Validation Testing:**
- Test SQL injection attempts
- Test XSS attempts in search/filter inputs
- Test invalid UUID formats
- Test oversized payloads

**Credential Security Testing:**
- Verify credentials never logged
- Verify credentials not exposed in API responses
- Verify credentials retrieved from Secrets Manager only
- Verify credentials not persisted in application memory

## Deployment Architecture

### AWS Infrastructure

**Compute:**
- **Polling Worker**: AWS Lambda function (Node.js 20.x runtime) OR ECS Fargate task
  - Memory: 1024 MB
  - Timeout: 15 minutes (Lambda) or no timeout (ECS)
  - Concurrency: 1 (prevent overlapping executions)
  - Environment variables: DATABASE_URL, AWS_REGION, LOG_LEVEL

**Scheduling:**
- **CloudWatch Events Rule**: Triggers polling worker every 15 minutes (configurable)
- **EventBridge**: Alternative for more complex scheduling needs

**Database:**
- **RDS PostgreSQL**: Multi-AZ deployment for high availability
  - Instance: db.t3.medium (2 vCPU, 4 GB RAM) for MVP
  - Storage: 100 GB GP3 with auto-scaling
  - Backup: Automated daily backups, 7-day retention
  - Encryption: At rest and in transit

**Secrets Management:**
- **AWS Secrets Manager**: Store Microsoft API credentials per tenant
  - Secret format: `edr/tenant/{tenantId}/microsoft-credentials`
  - Rotation: Manual (future: automatic rotation)
  - Access: IAM role-based, least privilege

**Networking:**
- **VPC**: Isolated network for all resources
- **Private Subnets**: Database and Lambda/ECS
- **NAT Gateway**: Outbound internet access for API calls
- **Security Groups**: Restrict traffic between components

**Monitoring:**
- **CloudWatch Logs**: Centralized logging for all components
- **CloudWatch Metrics**: Custom metrics for polling success/failure, API latency
- **CloudWatch Alarms**: Alert on polling failures, high error rates, rate limiting

**IAM Roles:**
- **Polling Worker Role**: 
  - Permissions: secretsmanager:GetSecretValue, rds:Connect, logs:CreateLogGroup/CreateLogStream/PutLogEvents
  - Trust: Lambda or ECS service
- **API Role**:
  - Permissions: rds:Connect, logs:PutLogEvents
  - Trust: ECS service (for Next.js API)

### Deployment Process

**Infrastructure as Code:**
- Use AWS CloudFormation or Terraform
- Define all resources in version-controlled templates
- Separate stacks for networking, database, compute, monitoring

**CI/CD Pipeline:**
1. **Build**: Compile TypeScript, run linters, run tests
2. **Package**: Create Lambda deployment package or Docker image
3. **Deploy**: Update Lambda function or ECS service
4. **Verify**: Run smoke tests against deployed environment
5. **Rollback**: Automatic rollback on deployment failure

**Environment Configuration:**
- **Development**: Single-AZ RDS, smaller instance sizes, verbose logging
- **Staging**: Multi-AZ RDS, production-like configuration, integration tests
- **Production**: Multi-AZ RDS, auto-scaling, minimal logging, monitoring alerts

### Scalability Considerations

**Horizontal Scaling:**
- **Polling Worker**: Increase concurrency or deploy multiple workers with tenant sharding
- **API**: Auto-scaling ECS tasks based on CPU/memory utilization
- **Database**: Read replicas for query load distribution **(Phase 2 / Post-MVP)**

**Vertical Scaling:**
- **Database**: Upgrade RDS instance class as data grows
- **Lambda**: Increase memory allocation for faster execution

**Data Retention:**
- **Alerts**: Retain for 90 days, archive to S3 for long-term storage **(Phase 2 / Post-MVP)**
- **Posture Scores**: Retain for 1 year for trend analysis
- **Audit Logs**: Retain for 1 year for compliance

**Caching (Phase 2 / Post-MVP):**
- **Redis/ElastiCache**: Cache frequently accessed data (device lists, posture scores)
- **TTL**: 5 minutes for device data, 1 minute for alerts
- **Invalidation**: On data updates from polling worker
- **Note**: Caching is optional for MVP; implement if performance testing shows need

## Security Considerations

**Data Encryption:**
- **At Rest**: RDS encryption, Secrets Manager encryption, S3 encryption
- **In Transit**: TLS 1.2+ for all API communication, RDS SSL connections

**Access Control:**
- **API Authentication**: JWT tokens with short expiration (15 minutes)
- **API Authorization**: Role-based access control (RBAC)
- **Database Access**: IAM database authentication, no hardcoded credentials
- **Secrets Access**: IAM role-based, audit logging enabled

**Tenant Isolation:**
- **Database**: Tenant ID in all tables, enforced in all queries
- **API**: Tenant validation in middleware, automatic filtering
- **Polling**: Separate execution context per tenant, failure isolation

**Audit Logging:**
- **Remote Actions**: All actions logged with user attribution
- **API Access**: Request logs with tenant ID, user ID, endpoint, timestamp
- **Credential Access**: Secrets Manager access logged to CloudTrail
- **Database Changes**: Audit triggers for sensitive tables

**Compliance:**
- **HIPAA**: Encryption, audit logging, access controls (if applicable)
- **SOC 2**: Security monitoring, incident response, access reviews
- **GDPR**: Data retention policies, right to deletion, data export

**Vulnerability Management:**
- **Dependency Scanning**: Automated scanning of npm packages
- **Container Scanning**: Scan Docker images for vulnerabilities
- **Penetration Testing**: Annual third-party security assessment
- **Patch Management**: Regular updates to OS, runtime, dependencies

## Future Enhancements

**AVIAN Endpoint Agent (Phase 2 / Post-MVP):**
- Deploy lightweight agent to endpoints for additional telemetry
- Custom health checks and compliance rules
- Local policy enforcement
- Offline device detection
- **Note**: This is a separate project and NOT required for MVP delivery

**Advanced Analytics (Phase 2):**
- Machine learning for threat detection
- Anomaly detection for device behavior
- Predictive vulnerability analysis
- Automated remediation recommendations

**Additional Integrations (Phase 2):**
- CrowdStrike Falcon
- SentinelOne
- Carbon Black
- Cisco AMP

**Enhanced Reporting (Phase 2):**
- Executive dashboards
- Compliance reports
- Trend analysis
- Custom report builder

**Automation (Phase 2):**
- Automated response playbooks
- Integration with ticketing systems (Jira, ServiceNow)
- Slack/Teams notifications
- Automated patch deployment

**Performance Optimizations (Phase 2 / Post-MVP):**
- GraphQL API for flexible data fetching
- Server-side rendering for faster page loads
- Progressive web app (PWA) for offline access
- WebSocket for real-time updates (replace polling)
