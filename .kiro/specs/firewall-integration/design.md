# SonicWall Firewall Integration - Design Document (MVP)

## Overview
The AVIAN SonicWall Integration is a lightweight monitoring system that uses API polling to track firewall health, security posture, and summary metrics. This MVP explicitly avoids log ingestion and SIEM features, focusing instead on snapshots, counters, and configuration risk analysis.

**Core Principle:** Summaries + Posture + Snapshots Only. No Logs. No SIEM.

## Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Client SonicWall Devices                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  SonicWall   │  │  SonicWall   │  │  SonicWall   │     │
│  │  (Tenant A)  │  │  (Tenant B)  │  │  (Tenant C)  │     │
│  │  API Enabled │  │  API Enabled │  │  API Enabled │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │ HTTPS API        │ HTTPS API        │ HTTPS API
          │ (30s polling)    │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  AVIAN Platform                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Polling Engine (Worker)                  │  │
│  │  • 30s interval  • API client  • Counter tracking    │  │
│  │  • Alert generation  • Retry logic                   │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │              Data Storage Layer                       │  │
│  │  • PostgreSQL (devices, snapshots, posture, metrics) │  │
│  │  • Redis (polling state, alert dedup)               │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           Config Parser & Risk Engine                 │  │
│  │  • Parse .exp files  • Apply risk rules              │  │
│  │  • Generate risk records                             │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │              Email Alert Listener                     │  │
│  │  • IMAP client  • Email parser  • Alert creation    │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │                  API Layer (REST)                     │  │
│  │  • Device CRUD  • Posture Query  • Metrics Query    │  │
│  │  • Config Upload  • Alert Management                │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │                  Web Dashboard                        │  │
│  │  • Device Overview  • Security Posture  • Metrics   │  │
│  │  • Config Risks  • Alerts  • License Status         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Backend:** Node.js/TypeScript with Next.js API routes
- **Database:** PostgreSQL (NO TimescaleDB needed for MVP)
- **Cache:** Redis for polling state and alert deduplication
- **Polling:** Node.js worker with node-cron scheduler
- **Email:** nodemailer with IMAP for email alert listening
- **Frontend:** React with Next.js, TailwindCSS, Recharts
- **Authentication:** Existing AVIAN auth system with tenant isolation

## Data Models

### Database Schema (ONLY These Tables)

#### firewall_devices
```sql
CREATE TABLE firewall_devices (
    device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model VARCHAR(100),
    firmware_version VARCHAR(50),
    serial_number VARCHAR(100) UNIQUE,
    management_ip INET NOT NULL,
    api_username VARCHAR(255),
    api_password_encrypted TEXT, -- AES-256 encrypted
    uptime_seconds BIGINT DEFAULT 0,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, offline
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_firewall_devices_tenant ON firewall_devices(tenant_id);
CREATE INDEX idx_firewall_devices_status ON firewall_devices(status);
CREATE INDEX idx_firewall_devices_serial ON firewall_devices(serial_number);
```

#### firewall_health_snapshots
```sql
CREATE TABLE firewall_health_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES firewall_devices(id) ON DELETE CASCADE,
    cpu_percent FLOAT NOT NULL,
    ram_percent FLOAT NOT NULL,
    wan_status VARCHAR(10) NOT NULL, -- up, down
    vpn_status VARCHAR(10) NOT NULL, -- up, down
    interface_status JSONB NOT NULL, -- {"X0": "up", "X1": "up", "X2": "down"}
    wifi_status VARCHAR(10), -- on, off
    ha_status VARCHAR(20), -- active, standby, failover, standalone
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_health_snapshots_device ON firewall_health_snapshots(device_id, timestamp DESC);

-- Retention: Delete snapshots older than 90 days
-- Frequency: Create snapshot every 4-6 hours
```

#### firewall_security_posture
```sql
CREATE TABLE firewall_security_posture (
    posture_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES firewall_devices(id) ON DELETE CASCADE,
    
    -- IPS
    ips_enabled BOOLEAN NOT NULL,
    ips_license_status VARCHAR(20), -- active, expiring, expired
    ips_daily_blocks INTEGER DEFAULT 0,
    
    -- Gateway Anti-Virus
    gav_enabled BOOLEAN NOT NULL,
    gav_license_status VARCHAR(20),
    gav_daily_blocks INTEGER DEFAULT 0,
    
    -- DPI-SSL
    dpi_ssl_enabled BOOLEAN NOT NULL,
    dpi_ssl_certificate_status VARCHAR(20), -- valid, expiring, expired
    dpi_ssl_daily_blocks INTEGER DEFAULT 0,
    
    -- ATP (Advanced Threat Protection)
    atp_enabled BOOLEAN NOT NULL,
    atp_license_status VARCHAR(20),
    atp_daily_verdicts INTEGER DEFAULT 0,
    
    -- Other Features
    botnet_filter_enabled BOOLEAN NOT NULL,
    app_control_enabled BOOLEAN NOT NULL,
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_security_posture_device ON firewall_security_posture(device_id, timestamp DESC);

-- Store latest posture only, or keep last 30 days for trending
```

#### firewall_licenses
```sql
CREATE TABLE firewall_licenses (
    license_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES firewall_devices(id) ON DELETE CASCADE,
    ips_expiry DATE,
    gav_expiry DATE,
    atp_expiry DATE,
    app_control_expiry DATE,
    content_filter_expiry DATE,
    support_expiry DATE,
    license_warnings JSONB DEFAULT '[]', -- ["IPS expiring in 15 days", "GAV expired"]
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_licenses_device ON firewall_licenses(device_id, timestamp DESC);
```

#### firewall_config_risks
```sql
CREATE TABLE firewall_config_risks (
    risk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES firewall_devices(id) ON DELETE CASCADE,
    snapshot_id UUID, -- Reference to config upload event
    risk_category VARCHAR(50) NOT NULL, -- network, security, license, admin
    risk_type VARCHAR(100) NOT NULL, -- wan_to_lan_any, default_admin, ips_disabled, etc.
    severity VARCHAR(20) NOT NULL, -- critical, high, medium, low
    description TEXT NOT NULL,
    remediation TEXT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_config_risks_device ON firewall_config_risks(device_id, severity);
CREATE INDEX idx_config_risks_severity ON firewall_config_risks(severity);
```

#### firewall_metrics_rollup
```sql
CREATE TABLE firewall_metrics_rollup (
    rollup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES firewall_devices(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    threats_blocked INTEGER DEFAULT 0, -- Sum of IPS + GAV + ATP + Botnet
    malware_blocked INTEGER DEFAULT 0, -- GAV blocks
    ips_blocked INTEGER DEFAULT 0, -- IPS blocks
    blocked_connections INTEGER DEFAULT 0, -- Total denied connections
    web_filter_hits INTEGER DEFAULT 0, -- Content filter blocks
    bandwidth_total_mb BIGINT DEFAULT 0, -- If available from API
    active_sessions_count INTEGER DEFAULT 0, -- Average or final value
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(device_id, date)
);

CREATE INDEX idx_metrics_rollup_device ON firewall_metrics_rollup(device_id, date DESC);

-- Retention: Delete rollups older than 365 days
```

#### firewall_alerts
```sql
CREATE TABLE firewall_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_id UUID REFERENCES firewall_devices(id) ON DELETE CASCADE, -- Nullable for email alerts without device match
    alert_type VARCHAR(100) NOT NULL, -- ips_counter_increase, wan_down, vpn_down, license_expired, feature_disabled, config_risk
    severity VARCHAR(20) NOT NULL, -- critical, high, medium, low, info
    message TEXT NOT NULL,
    source VARCHAR(20) NOT NULL, -- api, email
    metadata JSONB DEFAULT '{}', -- {"previous_value": 100, "new_value": 150, "counter_name": "ips_blocks"}
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_tenant ON firewall_alerts(tenant_id, created_at DESC);
CREATE INDEX idx_alerts_device ON firewall_alerts(device_id, created_at DESC);
CREATE INDEX idx_alerts_severity ON firewall_alerts(severity);
CREATE INDEX idx_alerts_acknowledged ON firewall_alerts(acknowledged);

-- Retention: Delete alerts older than 90 days
```

## Components and Interfaces

### 1. Polling Engine

**Responsibility:** Poll SonicWall API every 30 seconds and detect changes

```typescript
interface PollingState {
    deviceId: string;
    lastPollTime: Date;
    lastCounters: {
        ipsBlocks: number;
        gavBlocks: number;
        dpiSslBlocks: number;
        atpVerdicts: number;
        appControlBlocks: number;
        botnetBlocks: number;
        contentFilterBlocks: number;
    };
    lastStatus: {
        wanStatus: 'up' | 'down';
        vpnStatus: 'up' | 'down';
    };
}

class PollingEngine {
    private devices: FirewallDevice[];
    private pollingInterval: number = 30000; // Default 30 seconds, configurable per tenant/system
    
    async start(): Promise<void>;
    async stop(): Promise<void>;
    async pollDevice(device: FirewallDevice): Promise<void>;
    async detectCounterChanges(deviceId: string, newCounters: Counters): Promise<Alert[]>;
    async detectStatusChanges(deviceId: string, newStatus: Status): Promise<Alert[]>;
    async storeHealthSnapshot(deviceId: string, health: HealthData): Promise<void>;
    async storeSecurityPosture(deviceId: string, posture: PostureData): Promise<void>;
    async shouldCreateSnapshot(deviceId: string): Promise<boolean>; // Check if 4-6 hours elapsed and new data exists
    setPollingInterval(interval: number): void; // Configure polling interval
}
```

**Polling Logic:**
1. At configurable interval (default 30 seconds, adjustable per tenant/system), iterate through all active devices
2. Call SonicWall API endpoints (security stats, interfaces, system status, VPN, licenses)
3. Extract counters from SonicWall summary/statistics APIs ONLY (no logs, no traffic logs, no event logs)
4. Compare counters with previous poll (stored in Redis)
5. If counter increased, generate alert
6. If status changed (WAN/VPN up→down), generate alert
7. If security feature disabled, generate alert
8. Every 4-6 hours, create health snapshot record (only if new data exists)
9. Update device last_seen_at timestamp
10. On polling failure, retry with exponential backoff (30s, 60s, 120s, 300s max)
11. On successful poll after failure, reset interval to default (30s or configured value)

### 2. SonicWall API Client

**Responsibility:** Communicate with SonicWall API

```typescript
interface SonicWallAPIClient {
    baseUrl: string;
    username: string;
    password: string;
    authToken?: string;
}

class SonicWallAPI {
    constructor(config: SonicWallAPIClient);
    
    async authenticate(): Promise<string>; // Get auth token
    async getSecurityStatistics(): Promise<SecurityStats>;
    async getInterfaces(): Promise<InterfaceStatus[]>;
    async getSystemStatus(): Promise<SystemHealth>;
    async getVPNPolicies(): Promise<VPNPolicy[]>;
    async getLicenses(): Promise<LicenseInfo>;
}

interface SecurityStats {
    ips_blocks_today: number;
    gav_blocks_today: number;
    dpi_ssl_blocks_today: number;
    atp_verdicts_today: number;
    app_control_blocks_today: number;
    content_filter_blocks_today: number;
    botnet_blocks_today: number;
}

interface SystemHealth {
    cpu_percent: number;
    ram_percent: number;
    uptime_seconds: number;
    firmware_version: string;
    model: string;
    serial_number: string;
    ha_role?: 'primary' | 'secondary';
    ha_state?: 'active' | 'standby' | 'failover';
}

interface InterfaceStatus {
    interface_name: string;
    zone: string;
    ip_address: string;
    status: 'up' | 'down';
    link_speed: string;
}

interface VPNPolicy {
    policy_name: string;
    status: 'up' | 'down';
    remote_gateway: string;
    encryption: string;
    authentication_method: string;
}

interface LicenseInfo {
    ips_expiry: string; // ISO date
    gav_expiry: string;
    atp_expiry: string;
    app_control_expiry: string;
    content_filter_expiry: string;
    support_expiry: string;
}
```

**API Endpoints (SonicWall):**
- `POST /api/sonicos/auth` - Authenticate and get token
- `GET /api/sonicos/reporting/security-services/statistics` - **Security counters (summary fields ONLY, no logs)**
- `GET /api/sonicos/interfaces` - Interface status
- `GET /api/sonicos/system/status` - System health
- `GET /api/sonicos/vpn/policies` - VPN status
- `GET /api/sonicos/licenses` - License information

**CRITICAL: Counter Source Requirements**
- ALL counters (IPS blocks, GAV blocks, ATP verdicts, etc.) MUST come from SonicWall summary/statistics APIs
- Counters MUST NOT be derived from raw logs, traffic logs, event logs, or connection logs
- No packet-level logs, IPS event logs, or firewall event logs may be stored or processed
- This ensures the system remains lightweight and avoids log ingestion

### 3. Configuration Parser

**Responsibility:** Parse SonicWall .exp config files and detect risks

```typescript
interface ConfigParser {
    parseConfig(configText: string): ParsedConfig;
    extractRules(config: ParsedConfig): FirewallRule[];
    extractNATPolicies(config: ParsedConfig): NAT Policy[];
    extractAddressObjects(config: ParsedConfig): AddressObject[];
    extractSecuritySettings(config: ParsedConfig): SecuritySettings;
    extractAdminSettings(config: ParsedConfig): AdminSettings;
}

interface ParsedConfig {
    rules: FirewallRule[];
    natPolicies: NATPolicy[];
    addressObjects: AddressObject[];
    serviceObjects: ServiceObject[];
    securitySettings: SecuritySettings;
    adminSettings: AdminSettings;
    interfaces: InterfaceConfig[];
    vpnConfigs: VPNConfig[];
    systemSettings: SystemSettings;
}

interface FirewallRule {
    ruleName: string;
    sourceZone: string;
    destinationZone: string;
    sourceAddress: string;
    destinationAddress: string;
    service: string;
    action: 'allow' | 'deny';
    enabled: boolean;
    schedule?: string;
    comment?: string;
}

class RiskEngine {
    analyzeConfig(config: ParsedConfig): ConfigRisk[];
    calculateRiskScore(risks: ConfigRisk[]): number; // Base 100, deduct by severity
    
    // Risk detection methods (all map to Firewall Risk Rules + Severity Matrix)
    detectWANtoLANAnyRules(rules: FirewallRule[]): ConfigRisk[];
    detectAnyToAnyRules(rules: FirewallRule[]): ConfigRisk[];
    detectWANManagement(adminSettings: AdminSettings): ConfigRisk[];
    detectDefaultAdminUsername(adminSettings: AdminSettings): ConfigRisk[];
    detectMissingMFA(adminSettings: AdminSettings): ConfigRisk[];
    detectDisabledSecurityFeatures(securitySettings: SecuritySettings): ConfigRisk[];
    detectMissingRuleDescriptions(rules: FirewallRule[]): ConfigRisk[];
    detectWeakVPNEncryption(vpnConfigs: VPNConfig[]): ConfigRisk[];
    detectGuestIsolationIssues(rules: FirewallRule[]): ConfigRisk[];
    detectOutdatedFirmware(systemSettings: SystemSettings): ConfigRisk[];
}

interface ConfigRisk {
    riskCategory: 'network_misconfiguration' | 'exposure_risk' | 'security_feature_disabled' | 'license_expired' | 'best_practice_violation';
    riskType: string; // Maps to Firewall Risk Rules + Severity Matrix (e.g., "ANY_ANY_RULE", "OPEN_INBOUND", "WAN_MANAGEMENT_ENABLED")
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    remediation: string;
}
```

**Risk Scoring Algorithm:**
- Base score: 100
- Severity deductions:
  - critical: -25
  - high: -15
  - medium: -5
  - low: -1
- Minimum score: 0
- Maximum score: 100
- All risk_type values MUST map to official Firewall Risk Rules + Severity Matrix

**Risk Detection Rules (20 rules from requirements):**
- See Requirement 6 for complete list with risk_type mappings (ANY_ANY_RULE, OPEN_INBOUND, WAN_MANAGEMENT_ENABLED, ADMIN_NO_MFA, DEFAULT_ADMIN_USERNAME, IPS_DISABLED, GAV_DISABLED, DPI_SSL_DISABLED, BOTNET_FILTER_DISABLED, APP_CONTROL_DISABLED, CONTENT_FILTER_DISABLED, RULE_NO_DESCRIPTION, SSH_ON_WAN, DEFAULT_ADMIN_PORT, VPN_WEAK_ENCRYPTION, VPN_PSK_ONLY, GUEST_NOT_ISOLATED, DHCP_ON_WAN, OUTDATED_FIRMWARE, NO_NTP)

**Configuration Parsing Depth:**
- Parser extracts ONLY fields required to evaluate risk rules
- Does NOT reconstruct full firewall configuration
- Does NOT resolve full dependency graphs
- Extracts enough detail to evaluate ALL risk rules in the matrix

### 4. Email Alert Listener

**Responsibility:** Listen for SonicWall alert emails and create alerts

```typescript
interface EmailListener {
    imapConfig: {
        host: string;
        port: number;
        user: string;
        password: string;
        tls: boolean;
    };
}

class EmailAlertListener {
    private imapClient: any;
    
    async start(): Promise<void>;
    async stop(): Promise<void>;
    async checkForNewEmails(): Promise<void>;
    async parseEmail(email: Email): Promise<ParsedAlert | null>;
    async createAlertFromEmail(alert: ParsedAlert): Promise<void>;
    async markEmailAsProcessed(emailId: string): Promise<void>;
}

interface ParsedAlert {
    alertType: string; // Extracted from subject
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    message: string; // Email body
    timestamp: Date;
    deviceIdentifier?: string; // Serial number, hostname, or IP
    deviceId?: string; // Resolved device_id
}
```

**Email Parsing Logic:**
1. Connect to IMAP inbox
2. Fetch unread emails from SonicWall sender
3. Parse subject for alert type (regex patterns)
4. Parse body for severity, timestamp, device identifier
5. Match device identifier to firewall_devices table
6. Create alert record
7. Mark email as read and move to processed folder

### 5. Alert Manager

**Responsibility:** Create, deduplicate, and manage alerts

```typescript
class AlertManager {
    async createAlert(alert: CreateAlertInput): Promise<string>;
    async deduplicateAlert(alert: CreateAlertInput): Promise<boolean>;
    async acknowledgeAlert(alertId: string, userId: string): Promise<void>;
    async getAlerts(filters: AlertFilters): Promise<Alert[]>;
    async checkAlertStorm(deviceId: string): Promise<boolean>;
}

interface CreateAlertInput {
    tenantId: string;
    deviceId?: string;
    alertType: string;
    severity: string;
    message: string;
    source: 'api' | 'email';
    metadata?: Record<string, any>;
}

interface AlertFilters {
    tenantId: string;
    deviceId?: string;
    severity?: string;
    acknowledged?: boolean;
    startDate?: Date;
    endDate?: Date;
}
```

**Alert Deduplication:**
- Check if same alert_type + device_id + severity exists within last 2 minutes
- If same alert_type occurs within 2 minutes AND values have not changed, skip creating duplicate
- Use Redis for fast deduplication checks with 2-minute TTL

**Alert Storm Detection:**
- If > 10 alerts created for same device in 5 minutes, create meta-alert
- Suppress further alerts for that device for 15 minutes

### 6. Daily Metrics Aggregator

**Responsibility:** Create daily rollup records at midnight UTC

```typescript
class MetricsAggregator {
    async runDailyRollup(): Promise<void>;
    async aggregateDeviceMetrics(deviceId: string, date: Date): Promise<MetricsRollup>;
}

interface MetricsRollup {
    deviceId: string;
    date: Date;
    threatsBlocked: number; // Sum of IPS + GAV + ATP + Botnet
    malwareBlocked: number; // GAV blocks
    ipsBlocked: number; // IPS blocks
    blockedConnections: number;
    webFilterHits: number;
    bandwidthTotalMb: number;
    activeSessionsCount: number;
}
```

**Aggregation Logic:**
1. Run at 00:00 UTC daily (cron job)
2. For each device, get final cumulative counter from SonicWall for the current day (NOT calculated by summing increments)
3. Use final counter values from last successful poll of previous day
4. Calculate totals (threats_blocked = ips + gav + atp + botnet)
5. Insert into firewall_metrics_rollup table
6. Counters reset daily on SonicWall, so we capture final cumulative values
7. Do NOT sum increments - use final counter values only

### 7. API Layer

**Responsibility:** Provide REST API for frontend and integrations

```typescript
// API Routes
POST   /api/firewall/devices              // Register device
GET    /api/firewall/devices              // List devices (tenant-filtered)
GET    /api/firewall/devices/:id          // Get device details + latest snapshot
PUT    /api/firewall/devices/:id          // Update device
DELETE /api/firewall/devices/:id          // Delete device

POST   /api/firewall/config/upload        // Upload config file for parsing
GET    /api/firewall/config/risks/:deviceId // Get config risks

GET    /api/firewall/posture/:deviceId    // Get latest security posture
GET    /api/firewall/health/:deviceId     // Get health snapshots (with date range)
GET    /api/firewall/licenses/:deviceId   // Get license status

GET    /api/firewall/alerts               // List alerts (tenant-filtered)
PUT    /api/firewall/alerts/:id/acknowledge // Acknowledge alert

GET    /api/firewall/metrics/:deviceId    // Get daily metrics (with date range)
```

**API Implementation:**
```typescript
// Example: Get device details
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await getSession(request);
    const device = await db.query.firewallDevices.findFirst({
        where: and(
            eq(firewallDevices.deviceId, params.id),
            eq(firewallDevices.tenantId, session.tenantId)
        )
    });
    
    if (!device) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
    
    // Get latest health snapshot
    const latestHealth = await db.query.firewallHealthSnapshots.findFirst({
        where: eq(firewallHealthSnapshots.deviceId, params.id),
        orderBy: desc(firewallHealthSnapshots.timestamp),
        limit: 1
    });
    
    // Get latest security posture
    const latestPosture = await db.query.firewallSecurityPosture.findFirst({
        where: eq(firewallSecurityPosture.deviceId, params.id),
        orderBy: desc(firewallSecurityPosture.timestamp),
        limit: 1
    });
    
    return NextResponse.json({
        device,
        health: latestHealth,
        posture: latestPosture
    });
}
```

### 8. Dashboard Components

**Responsibility:** Visualize firewall data

```typescript
// React Components

<DeviceOverviewCard device={device} health={health} posture={posture} />
  - Model, firmware, uptime, last seen
  - WAN status badge (green/red)
  - VPN status badge (green/red)
  - CPU/RAM gauges
  - Quick stats (threats blocked today)

<SecurityPosturePanel posture={posture} licenses={licenses} />
  - Feature status grid (IPS, GAV, DPI-SSL, ATP, Botnet, AppControl)
  - Green checkmark if enabled, red X if disabled
  - License expiry dates with warning badges
  - Daily block counters

<ConfigRisksTable risks={risks} />
  - Severity badge (critical/high/medium/low)
  - Risk description
  - Remediation guidance
  - Detected timestamp
  - Filter by severity

<MetricsDashboard metrics={metrics} />
  - Line chart: Threats blocked per day (7d, 30d, 90d)
  - Bar chart: Breakdown by type (IPS, GAV, ATP, Botnet)
  - Stats cards: Total threats, malware, IPS blocks
  - Active sessions trend

<AlertsPanel alerts={alerts} />
  - Alert list with severity badges
  - Filter by severity, acknowledged status
  - Acknowledge button
  - Alert details modal
  - Real-time updates (polling every 30s)

<HealthTrendsChart snapshots={snapshots} />
  - Line chart: CPU % over time
  - Line chart: RAM % over time
  - Interface status timeline
  - WAN/VPN uptime percentage
```

## Security Considerations

### Tenant Isolation
- All queries filtered by tenant_id from JWT token
- Row-level security policies in PostgreSQL
- API validates tenant ownership before returning data
- Device registration requires tenant_id
- **A firewall device MUST belong to exactly one tenant**
- Cross-tenant access to devices prohibited unless role=super-admin
- Tenant deletion cascades to all associated firewall data

### Credential Storage
- SonicWall API credentials encrypted with AES-256
- Encryption key stored in environment variable
- Credentials decrypted only during API calls
- Never returned in API responses

### API Authentication
- JWT tokens with tenant_id claim
- Role-based access control (admin, analyst, viewer)
- Rate limiting per user (100 requests/minute)
- API key authentication for external integrations

### Audit Logging
- Log device registration/deletion
- Log configuration uploads
- Log alert acknowledgments
- Retention: 1 year

## Performance Optimization

### Polling Efficiency
- Use Redis to store last poll state (counters, status)
- Only query database when changes detected
- Batch health snapshots (every 4-6 hours, not every poll)
- Connection pooling for SonicWall API

### Database Optimization
- **Required indexes on: device_id, tenant_id, timestamp/date** (all tables)
- Health snapshots, posture snapshots, licenses, and rollups optimized for fast retrieval
- Partition firewall_health_snapshots by month (if needed)
- Automatic cleanup of old data (90 days snapshots, 365 days metrics)
- Use JSONB for flexible metadata storage

### Caching
- Cache device list in Redis (5 min TTL)
- Cache latest posture/health in Redis (1 min TTL)
- Cache dashboard metrics (5 min TTL)
- Invalidate cache on updates

### Storage Efficiency
- NO log storage = minimal storage usage
- Estimated: < 100MB per firewall per year
- Health snapshots: ~1KB each, 4 per day = 1.4MB/year
- Metrics rollups: ~100 bytes each, 365 per year = 36KB/year
- Posture records: ~500 bytes each, updated on change = minimal

## Deployment Architecture

### Services
- **Polling Worker:** Node.js service with cron scheduler (30s interval)
- **Email Listener:** Node.js service with IMAP client (check every 5 min)
- **API Server:** Next.js API routes
- **Web Dashboard:** Next.js frontend
- **Metrics Aggregator:** Cron job (daily at midnight UTC)

### Infrastructure
- **Database:** PostgreSQL with connection pooling
- **Cache:** Redis for polling state and caching
- **Queue:** Redis for async tasks (optional)
- **Storage:** No S3 needed (no log archival)
- **Monitoring:** Prometheus + Grafana for service health

### Scaling
- Horizontal scaling: Multiple polling workers (shard by device_id)
- Database read replicas for dashboard queries
- Redis cluster for high availability
- Load balancer for API servers

## Testing Strategy

### Unit Tests
- SonicWall API client with mocked responses
- Config parser with sample .exp files
- Risk engine with test configs
- Alert deduplication logic
- Metrics aggregation calculations

### Integration Tests
- End-to-end polling flow with test SonicWall device
- Config upload and risk detection
- Email parsing with sample emails
- API endpoints with authentication
- Tenant isolation validation

### Load Tests
- 100 devices polling every 30 seconds
- Dashboard query performance with 1000+ devices
- API response times under load
- Database query performance

### Security Tests
- Cross-tenant access attempts
- SQL injection in config parsing
- Authentication bypass attempts
- Credential encryption/decryption

## Migration from Existing System

If migrating from log-based system:
1. **DO NOT** migrate historical logs
2. Start fresh with polling-based approach
3. Import device metadata only
4. Run initial config analysis for all devices
5. Begin polling immediately

## Future Enhancements (Post-MVP)

### Phase 2
- Support for Fortinet FortiGate
- Support for Palo Alto Networks
- Advanced risk scoring algorithms
- Automated remediation suggestions
- Integration with ticketing systems

### Phase 3 (Threat Lake Integration)
- Export summary metrics to Threat Lake
- Correlation with other security data sources
- Advanced analytics and ML-based anomaly detection
- Cross-tenant threat intelligence

---

**Design Status:** Ready for implementation
**Next Step:** Create implementation task list
