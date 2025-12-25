# Migration 0016: Firewall Config Risks Table

## Overview
This migration creates the `firewall_config_risks` table for storing configuration risk analysis results from uploaded SonicWall .exp configuration files.

## Purpose
The config risks table stores:
- **Risk Detection Results**: Identified security misconfigurations and best practice violations
- **Risk Categorization**: Organized by category (network, security, exposure, etc.)
- **Severity Levels**: Critical, high, medium, and low risk classifications
- **Remediation Guidance**: Recommended steps to address each risk
- **Snapshot Tracking**: Optional reference to config upload event

## Table Structure

### Risk Categories
1. **network_misconfiguration** - Firewall rules and network configuration issues
2. **exposure_risk** - Services or interfaces exposed to untrusted networks
3. **security_feature_disabled** - Security features that are disabled
4. **license_expired** - Expired or missing licenses affecting security
5. **best_practice_violation** - Deviations from security best practices

### Risk Types (Maps to Firewall Risk Rules + Severity Matrix)
The `risk_type` column uses standardized identifiers that map to the official risk matrix:

#### Critical Risks
- **OPEN_INBOUND** - Unrestricted WAN to LAN access rule
- **WAN_MANAGEMENT_ENABLED** - Admin interface exposed to internet
- **IPS_DISABLED** - Intrusion Prevention System disabled
- **GAV_DISABLED** - Gateway Anti-Virus disabled
- **DHCP_ON_WAN** - DHCP server enabled on WAN interface

#### High Risks
- **ANY_ANY_RULE** - Overly permissive any-to-any firewall rule
- **ADMIN_NO_MFA** - Multi-factor authentication not enabled
- **SSH_ON_WAN** - SSH management enabled on WAN interface
- **BOTNET_FILTER_DISABLED** - Botnet Filter disabled
- **VPN_WEAK_ENCRYPTION** - VPN using weak encryption (DES, 3DES)
- **GUEST_NOT_ISOLATED** - Guest network not isolated from LAN

#### Medium Risks
- **DEFAULT_ADMIN_USERNAME** - Default admin username in use
- **DPI_SSL_DISABLED** - DPI-SSL disabled (encrypted traffic not inspected)
- **APP_CONTROL_DISABLED** - Application Control disabled
- **CONTENT_FILTER_DISABLED** - Content Filtering disabled
- **VPN_PSK_ONLY** - VPN using PSK only (not certificate-based)
- **OUTDATED_FIRMWARE** - Firmware version more than 6 months old

#### Low Risks
- **RULE_NO_DESCRIPTION** - Firewall rule missing description
- **DEFAULT_ADMIN_PORT** - Default HTTPS admin port (443) in use
- **NO_NTP** - NTP not configured

### Severity Levels
- **critical**: Immediate security threat requiring urgent action
- **high**: Significant security concern requiring prompt attention
- **medium**: Moderate security issue that should be addressed
- **low**: Minor best practice violation or informational finding

## Data Retention
- **Retention Period**: Risks are replaced when new config uploaded for same device
- **Update Strategy**: Delete old risks for device before inserting new ones
- **Historical Tracking**: Optional snapshot_id allows tracking risk changes over time

## Indexes
- `idx_config_risks_device`: Composite index on (device_id, severity) for device queries
- `idx_config_risks_severity`: Index on severity for filtering by risk level
- `idx_config_risks_category`: Index on risk_category for category-based queries
- `idx_config_risks_type`: Index on risk_type for specific risk type queries
- `idx_config_risks_detected_at`: Index on detected_at DESC for time-based queries
- `idx_config_risks_snapshot`: Partial index on snapshot_id (WHERE NOT NULL) for snapshot tracking

## Constraints
- **Foreign Key**: device_id references firewall_devices(id) with CASCADE delete
- **NOT NULL**: device_id, risk_category, risk_type, severity, description are required
- **Nullable**: snapshot_id (optional config upload reference), remediation (optional guidance)

## Usage in Application

### Configuration Parser
The configuration parser will:
1. Accept uploaded SonicWall .exp configuration file
2. Parse configuration text to extract:
   - Firewall access rules
   - NAT policies
   - Address and service objects
   - Security feature settings
   - Admin settings
   - Interface configurations
   - VPN configurations
   - System settings
3. Apply risk detection rules (30+ rules from requirements)
4. Generate risk records for each detected issue

### Risk Detection Rules
The risk engine applies 30+ detection rules covering:
- **Network Rules**: WAN-to-LAN any rules, any-to-any rules, guest isolation
- **Admin Security**: WAN management, MFA status, default usernames, SSH on WAN
- **Security Features**: IPS, GAV, DPI-SSL, ATP, Botnet, AppControl, Content Filter status
- **Best Practices**: Rule descriptions, admin ports, VPN encryption, firmware updates, NTP
- **Network Config**: DHCP on WAN, guest zone routing

### Risk Scoring
Configuration risk score calculation:
```typescript
// Base score: 100
let score = 100;

// Deduct based on severity
risks.forEach(risk => {
  switch(risk.severity) {
    case 'critical': score -= 25; break;
    case 'high': score -= 15; break;
    case 'medium': score -= 5; break;
    case 'low': score -= 1; break;
  }
});

// Enforce bounds
score = Math.max(0, Math.min(100, score));
```

### API Endpoints
- **POST /api/firewall/config/upload** - Upload config file, parse, detect risks
- **GET /api/firewall/config/risks/:deviceId** - Get config risks for device

### Dashboard Display
The config risks panel displays:
- Total risk count by severity (critical, high, medium, low)
- Risk list with severity badges
- Risk description and remediation guidance
- Filter by severity and category
- Overall risk score (0-100)

## Related Requirements
- **Requirement 6**: Configuration Snapshot Analysis
- **Requirement 6.1-6.10**: Configuration extraction requirements
- **Requirement 6.11-6.13**: Configuration parsing depth
- **Requirement 6.14-6.33**: Risk detection rules (30 rules)
- **Requirement 6.34-6.38**: Risk scoring algorithm
- **Requirement 6.39-6.40**: Risk matrix reference
- **Requirement 15.4-15.5**: Configuration API endpoints

## Related Design Components
- **Data Models**: firewall_config_risks schema
- **Configuration Parser**: ConfigParser class (Task 4.1)
- **Risk Engine**: RiskEngine class with detection methods (Tasks 4.2-4.5)
- **Risk Storage**: Risk record management (Task 4.6)
- **API Layer**: Config upload and risk query endpoints (Task 8.2)
- **Dashboard**: Config risks display component

## Testing
See `test_0016.sql` for validation queries.

### Test Coverage
- Table and column existence
- Foreign key constraint and cascade delete
- Index creation (device, severity, category, type, timestamp)
- Data type validation (varchar lengths, text fields)
- Insert and query operations
- Risk filtering by severity and category
- Risk scoring calculations

## Rollback
To rollback this migration:
```sql
DROP TABLE IF EXISTS "firewall_config_risks" CASCADE;
```

## Dependencies
- **Requires**: Migration 0012 (firewall_devices table)
- **Required by**: 
  - Configuration parser and risk engine (Tasks 4.1-4.7)
  - Config upload API endpoint (Task 8.2)
  - Dashboard config risks display components

## Example Data

### Sample Risk Records
```sql
-- Critical: WAN management enabled
INSERT INTO firewall_config_risks (
    device_id,
    snapshot_id,
    risk_category,
    risk_type,
    severity,
    description,
    remediation
) VALUES (
    'device-uuid-here',
    'snapshot-uuid-here',
    'exposure_risk',
    'WAN_MANAGEMENT_ENABLED',
    'critical',
    'WAN management access enabled - exposes admin interface to internet',
    'Disable WAN management access. Access firewall admin interface only from trusted internal networks or VPN.'
);

-- High: Any-to-any rule
INSERT INTO firewall_config_risks (
    device_id,
    snapshot_id,
    risk_category,
    risk_type,
    severity,
    description,
    remediation
) VALUES (
    'device-uuid-here',
    'snapshot-uuid-here',
    'network_misconfiguration',
    'ANY_ANY_RULE',
    'high',
    'Overly permissive any-to-any rule detected',
    'Replace any-to-any rules with specific source/destination rules. Follow principle of least privilege.'
);

-- Medium: DPI-SSL disabled
INSERT INTO firewall_config_risks (
    device_id,
    snapshot_id,
    risk_category,
    risk_type,
    severity,
    description,
    remediation
) VALUES (
    'device-uuid-here',
    'snapshot-uuid-here',
    'security_feature_disabled',
    'DPI_SSL_DISABLED',
    'medium',
    'DPI-SSL is disabled - encrypted traffic not inspected',
    'Enable DPI-SSL to inspect encrypted traffic for threats. Install DPI-SSL certificate on client devices.'
);

-- Low: Missing rule description
INSERT INTO firewall_config_risks (
    device_id,
    snapshot_id,
    risk_category,
    risk_type,
    severity,
    description,
    remediation
) VALUES (
    'device-uuid-here',
    'snapshot-uuid-here',
    'best_practice_violation',
    'RULE_NO_DESCRIPTION',
    'low',
    'Firewall rule missing description',
    'Add descriptive comments to all firewall rules to document their purpose and business justification.'
);
```

### Query Examples

#### Get all risks for a device ordered by severity
```sql
SELECT 
    risk_type,
    severity,
    description,
    remediation,
    detected_at
FROM firewall_config_risks
WHERE device_id = 'device-uuid-here'
ORDER BY 
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    detected_at DESC;
```

#### Get risk count by severity for a device
```sql
SELECT 
    severity,
    COUNT(*) as risk_count
FROM firewall_config_risks
WHERE device_id = 'device-uuid-here'
GROUP BY severity
ORDER BY 
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;
```

#### Get all critical and high risks across all devices for a tenant
```sql
SELECT 
    d.model,
    d.serial_number,
    r.risk_type,
    r.severity,
    r.description,
    r.detected_at
FROM firewall_config_risks r
JOIN firewall_devices d ON r.device_id = d.id
WHERE 
    d.tenant_id = 'tenant-uuid-here'
    AND r.severity IN ('critical', 'high')
ORDER BY 
    CASE r.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
    END,
    r.detected_at DESC;
```

#### Calculate risk score for a device
```sql
SELECT 
    device_id,
    100 - (
        COALESCE(SUM(CASE severity
            WHEN 'critical' THEN 25
            WHEN 'high' THEN 15
            WHEN 'medium' THEN 5
            WHEN 'low' THEN 1
            ELSE 0
        END), 0)
    ) as risk_score
FROM firewall_config_risks
WHERE device_id = 'device-uuid-here'
GROUP BY device_id;
```

#### Get risks by category
```sql
SELECT 
    risk_category,
    COUNT(*) as risk_count,
    array_agg(DISTINCT severity) as severities
FROM firewall_config_risks
WHERE device_id = 'device-uuid-here'
GROUP BY risk_category
ORDER BY risk_count DESC;
```

#### Delete old risks before uploading new config
```sql
-- This is done before inserting new risks from a fresh config parse
DELETE FROM firewall_config_risks
WHERE device_id = 'device-uuid-here';
```

## Risk Type Reference

### Complete Risk Type List (30 Rules)
All risk_type values map to the official Firewall Risk Rules + Severity Matrix:

1. **OPEN_INBOUND** (critical) - WAN to LAN any rule
2. **ANY_ANY_RULE** (high) - Any-to-any rule
3. **WAN_MANAGEMENT_ENABLED** (critical) - WAN management enabled
4. **ADMIN_NO_MFA** (high) - MFA disabled for admin
5. **DEFAULT_ADMIN_USERNAME** (medium) - Default admin username
6. **IPS_DISABLED** (critical) - IPS disabled
7. **GAV_DISABLED** (critical) - Gateway AV disabled
8. **DPI_SSL_DISABLED** (medium) - DPI-SSL disabled
9. **BOTNET_FILTER_DISABLED** (high) - Botnet Filter disabled
10. **APP_CONTROL_DISABLED** (medium) - Application Control disabled
11. **CONTENT_FILTER_DISABLED** (medium) - Content Filtering disabled
12. **RULE_NO_DESCRIPTION** (low) - Rule missing description
13. **SSH_ON_WAN** (high) - SSH on WAN interface
14. **DEFAULT_ADMIN_PORT** (low) - Default admin port (443)
15. **VPN_WEAK_ENCRYPTION** (high) - Weak VPN encryption
16. **VPN_PSK_ONLY** (medium) - VPN PSK-only authentication
17. **GUEST_NOT_ISOLATED** (high) - Guest zone not isolated
18. **DHCP_ON_WAN** (critical) - DHCP server on WAN
19. **OUTDATED_FIRMWARE** (medium) - Firmware outdated
20. **NO_NTP** (low) - NTP not configured

## Notes
- All risk_type values MUST map to the official Firewall Risk Rules + Severity Matrix
- Risks are replaced (not appended) when new config uploaded for same device
- snapshot_id is optional but recommended for tracking risk changes over time
- Foreign key CASCADE delete ensures risks are removed when devices are deleted
- Indexes optimize queries by device, severity, category, and type
- Risk scoring algorithm: Base 100, deduct by severity (critical=-25, high=-15, medium=-5, low=-1)
- Minimum risk score: 0, Maximum risk score: 100

