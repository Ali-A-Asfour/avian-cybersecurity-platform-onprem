# SonicWall Firewall Integration - Requirements (MVP)

## Introduction
AVIAN must support lightweight monitoring of SonicWall firewalls through API polling, summary counters, and configuration snapshot analysis. This MVP focuses on security posture visibility, health monitoring, and risk assessment WITHOUT log ingestion or SIEM capabilities.

## Glossary
- **SonicWall**: Next-Generation Firewall device (primary target for MVP)
- **API Polling**: Periodic queries to SonicWall API for status and counters
- **Security Posture**: Current state of security features (IPS, GAV, ATP, etc.)
- **Health Snapshot**: Point-in-time capture of device health metrics
- **Config Snapshot**: Uploaded configuration file parsed for risk analysis
- **Summary Counters**: Daily aggregated counts (blocks, threats, sessions)
- **Risk Scoring**: Analysis of configuration against security best practices
- **Multi-Tenant**: Supporting multiple isolated client environments

## Requirements

### Requirement 1: Firewall Device Registration

**User Story:** As a managed service provider, I want to register SonicWall firewalls in AVIAN, so that I can monitor their security posture and health.

#### Acceptance Criteria
1. WHEN a firewall is added to AVIAN, THE System SHALL create a firewall device record with tenant association
2. WHEN registering a firewall, THE System SHALL store device metadata (model, firmware version, serial number, management IP)
3. WHEN a firewall is registered, THE System SHALL assign a unique device ID
4. WHEN registration is complete, THE System SHALL initiate API polling for the device
5. WHERE multiple firewalls exist for one tenant, THE System SHALL support multiple device registrations
6. WHEN a firewall is removed, THE System SHALL stop polling and mark device as inactive

### Requirement 2: API Polling Engine

**User Story:** As a security analyst, I want AVIAN to poll SonicWall devices regularly, so that I can monitor security posture and detect changes in real-time.

#### Acceptance Criteria
1. WHEN a firewall is registered, THE System SHALL poll the SonicWall API at a configurable interval (default: 30 seconds per firewall, adjustable at tenant or system level)
2. WHEN polling, THE System SHALL retrieve the following counters from SonicWall summary/statistics APIs ONLY: IPS daily blocks, GAV daily blocks, DPI-SSL daily blocks, ATP daily verdicts, blocked connections count, web filter hits, active sessions count
3. WHEN retrieving counters, THE System SHALL use ONLY summary fields from API responses, NOT traffic logs, event logs, or connection logs
4. WHEN polling, THE System SHALL retrieve the following status values: WAN status (up/down), VPN tunnel status (up/down), interface status per interface (up/down), WiFi status (on/off), HA status (active/standby/failover)
5. WHEN polling, THE System SHALL retrieve the following security feature states: IPS enabled (boolean), GAV enabled (boolean), DPI-SSL enabled (boolean), ATP enabled (boolean), Botnet Filter enabled (boolean), Application Control enabled (boolean)
6. WHEN polling, THE System SHALL retrieve device health metrics: CPU percentage, RAM percentage, uptime in seconds
7. WHERE API polling fails, THE System SHALL retry with exponential backoff (30s, 60s, 120s, 300s max), and once polling succeeds again, interval SHALL reset to default (30 seconds or configured value)
8. WHEN any counter increases from previous poll, THE System SHALL generate an alert event with counter name, previous value, and new value
9. WHEN WAN status changes from up to down, THE System SHALL generate a critical alert event
10. WHEN VPN tunnel status changes from up to down, THE System SHALL generate a high-priority alert event
11. WHEN any security feature changes from enabled to disabled, THE System SHALL generate a critical alert event
12. WHEN CPU exceeds 80% or RAM exceeds 90%, THE System SHALL generate a warning alert event
13. WHEN polling succeeds, THE System SHALL update device last_seen_at timestamp

### Requirement 3: Health Snapshot Collection

**User Story:** As a network administrator, I want periodic health snapshots of firewalls, so that I can track device health over time.

#### Acceptance Criteria
1. WHEN 4 hours have elapsed since last snapshot, THE System SHALL create a new health snapshot record
2. WHEN creating a snapshot, THE System SHALL store CPU percentage, RAM percentage, and uptime in seconds
3. WHEN creating a snapshot, THE System SHALL store WAN status (up/down) and VPN status (up/down)
4. WHEN creating a snapshot, THE System SHALL store interface status as JSON object mapping interface name to up/down state
5. WHEN creating a snapshot, THE System SHALL store WiFi status (on/off) and HA status (active/standby/failover)
6. WHEN creating a snapshot, THE System SHALL record snapshot timestamp
7. WHERE no new data exists since the last successful poll, snapshots SHALL NOT be duplicated
8. WHEN viewing health history, THE System SHALL display snapshots for last 7 days, 30 days, or 90 days
9. WHEN health snapshots exceed 90 days old, THE System SHALL automatically delete old snapshots

### Requirement 4: Security Posture Tracking

**User Story:** As a security officer, I want to track security feature status and daily block counts, so that I can assess firewall effectiveness.

#### Acceptance Criteria
1. WHEN polling the firewall, THE System SHALL retrieve IPS enabled status and IPS license status
2. WHEN polling the firewall, THE System SHALL retrieve Gateway AV enabled status and GAV license status
3. WHEN polling the firewall, THE System SHALL retrieve DPI-SSL enabled status and certificate status
4. WHEN polling the firewall, THE System SHALL retrieve ATP enabled status and ATP license status
5. WHERE security features are disabled, THE System SHALL generate alert events
6. WHEN polling the firewall, THE System SHALL retrieve daily block counts (IPS blocks, GAV blocks, DPI-SSL blocks, ATP verdicts)
7. WHEN security posture changes, THE System SHALL store updated posture snapshot

### Requirement 5: License Management

**User Story:** As a managed service provider, I want to track firewall license expiration, so that I can renew licenses before they expire.

#### Acceptance Criteria
1. WHEN polling the firewall, THE System SHALL retrieve IPS license expiry date
2. WHEN polling the firewall, THE System SHALL retrieve Gateway AV license expiry date
3. WHEN polling the firewall, THE System SHALL retrieve ATP license expiry date
4. WHEN polling the firewall, THE System SHALL retrieve Application Control license expiry date
5. WHERE licenses expire within 30 days, THE System SHALL generate warning alerts
6. WHEN licenses expire, THE System SHALL generate critical alerts
7. WHEN viewing licenses, THE System SHALL display days remaining for each license

### Requirement 6: Configuration Snapshot Analysis

**User Story:** As a security engineer, I want to upload firewall configurations for risk analysis, so that I can identify security misconfigurations.

#### Acceptance Criteria

**Configuration Extraction:**
1. WHEN a user uploads a SonicWall configuration file (.exp format), THE System SHALL parse the configuration text
2. WHEN parsing configuration, THE System SHALL extract firewall access rules including: rule name, source zone, destination zone, source address, destination address, service/port, action (allow/deny), enabled status, schedule, comment/description
3. WHEN parsing configuration, THE System SHALL extract NAT policies including: original source, translated source, original destination, translated destination, interface
4. WHEN parsing configuration, THE System SHALL extract address objects including: object name, IP address/range, zone assignment
5. WHEN parsing configuration, THE System SHALL extract service objects including: service name, protocol, port range
6. WHEN parsing configuration, THE System SHALL extract security feature settings including: IPS enabled, GAV enabled, Anti-Spyware enabled, Application Control enabled, Content Filtering enabled, Botnet Filter enabled, DPI-SSL enabled, Geo-IP Filter enabled
7. WHEN parsing configuration, THE System SHALL extract admin settings including: admin usernames, MFA enabled status, WAN management enabled status, HTTPS admin port, SSH enabled status
8. WHEN parsing configuration, THE System SHALL extract interface configurations including: interface name, zone assignment, IP address, DHCP server enabled
9. WHEN parsing configuration, THE System SHALL extract VPN configurations including: VPN policy names, encryption settings, authentication methods
10. WHEN parsing configuration, THE System SHALL extract system settings including: firmware version, hostname, timezone, NTP servers, DNS servers

**Configuration Parsing Depth:**
11. WHEN parsing configuration, THE System SHALL extract only the fields required to evaluate risk rules and posture
12. WHERE parsing is performed, THE System SHALL NOT reconstruct full firewall configuration or resolve full dependency graphs
13. WHEN parsing configuration, THE System SHALL extract enough detail to evaluate ALL risk rules defined in the Firewall Risk Rules + Severity Matrix

**Risk Detection Rules:**
14. WHEN any firewall rule has action "allow" AND source zone is "WAN" AND destination zone is "LAN" AND destination address is "any", THE System SHALL create risk: risk_type="OPEN_INBOUND", category="exposure_risk", severity="critical", description="Unrestricted WAN to LAN access rule detected"
15. WHEN any firewall rule has source address "any" AND destination address "any" AND action "allow", THE System SHALL create risk: risk_type="ANY_ANY_RULE", category="network_misconfiguration", severity="high", description="Overly permissive any-to-any rule detected"
16. WHEN WAN management is enabled, THE System SHALL create risk: risk_type="WAN_MANAGEMENT_ENABLED", category="exposure_risk", severity="critical", description="WAN management access enabled - exposes admin interface to internet"
17. WHEN admin MFA is disabled, THE System SHALL create risk: risk_type="ADMIN_NO_MFA", category="best_practice_violation", severity="high", description="Multi-factor authentication not enabled for admin accounts"
18. WHEN default admin username exists (admin, root, administrator), THE System SHALL create risk: risk_type="DEFAULT_ADMIN_USERNAME", category="best_practice_violation", severity="medium", description="Default admin username detected - should be renamed"
19. WHEN IPS is disabled, THE System SHALL create risk: risk_type="IPS_DISABLED", category="security_feature_disabled", severity="critical", description="Intrusion Prevention System is disabled"
20. WHEN Gateway Anti-Virus is disabled, THE System SHALL create risk: risk_type="GAV_DISABLED", category="security_feature_disabled", severity="critical", description="Gateway Anti-Virus is disabled"
21. WHEN DPI-SSL is disabled, THE System SHALL create risk: risk_type="DPI_SSL_DISABLED", category="security_feature_disabled", severity="medium", description="DPI-SSL is disabled - encrypted traffic not inspected"
22. WHEN Botnet Filter is disabled, THE System SHALL create risk: risk_type="BOTNET_FILTER_DISABLED", category="security_feature_disabled", severity="high", description="Botnet Filter is disabled"
23. WHEN Application Control is disabled, THE System SHALL create risk: risk_type="APP_CONTROL_DISABLED", category="security_feature_disabled", severity="medium", description="Application Control is disabled"
24. WHEN Content Filtering is disabled, THE System SHALL create risk: risk_type="CONTENT_FILTER_DISABLED", category="security_feature_disabled", severity="medium", description="Content Filtering is disabled"
25. WHEN any firewall rule has no description/comment, THE System SHALL create risk: risk_type="RULE_NO_DESCRIPTION", category="best_practice_violation", severity="low", description="Firewall rule missing description"
26. WHEN SSH is enabled on WAN interface, THE System SHALL create risk: risk_type="SSH_ON_WAN", category="exposure_risk", severity="high", description="SSH management enabled on WAN interface"
27. WHEN HTTPS admin port is default (443), THE System SHALL create risk: risk_type="DEFAULT_ADMIN_PORT", category="best_practice_violation", severity="low", description="Default HTTPS admin port in use - consider changing"
28. WHEN VPN uses weak encryption (DES, 3DES), THE System SHALL create risk: risk_type="VPN_WEAK_ENCRYPTION", category="security_feature_disabled", severity="high", description="VPN using weak encryption algorithm"
29. WHEN VPN uses pre-shared key authentication only, THE System SHALL create risk: risk_type="VPN_PSK_ONLY", category="best_practice_violation", severity="medium", description="VPN using PSK only - consider certificate-based authentication"
30. WHEN GUEST zone has route to LAN zone, THE System SHALL create risk: risk_type="GUEST_NOT_ISOLATED", category="network_misconfiguration", severity="high", description="Guest network not properly isolated from LAN"
31. WHEN interface has DHCP server enabled on WAN, THE System SHALL create risk: risk_type="DHCP_ON_WAN", category="network_misconfiguration", severity="critical", description="DHCP server enabled on WAN interface"
32. WHEN firmware version is more than 6 months old, THE System SHALL create risk: risk_type="OUTDATED_FIRMWARE", category="best_practice_violation", severity="medium", description="Firmware version outdated - update recommended"
33. WHEN NTP is not configured, THE System SHALL create risk: risk_type="NO_NTP", category="best_practice_violation", severity="low", description="NTP not configured - time synchronization required for accurate logging"

**Configuration Risk Scoring:**
34. WHEN calculating configuration risk score, THE System SHALL start with base score = 100
35. WHEN risks are detected, THE System SHALL reduce score based on severity: critical = -25, high = -15, medium = -5, low = -1
36. WHERE risk score is calculated, THE System SHALL enforce minimum score = 0 and maximum score = 100
37. WHEN applying risk scoring logic, THE System SHALL reference the official Firewall Risk Rules + Severity Matrix specification
38. WHERE risk detection rules are implemented, ALL rules SHALL map to risk_type keys defined in the Firewall Risk Rules + Severity Matrix

**Risk Matrix Reference:**
39. ALL risk detection logic SHALL follow the definitions, category assignments, and severity levels listed in the "Firewall Risk Rules + Severity Matrix" specification
40. WHERE new risks are identified, NO additional or implicit risk rules may be created without explicit definition in the matrix

### Requirement 7: SonicWall API Data Structure

**User Story:** As a developer, I want clearly defined API polling data structures, so that I can implement consistent data extraction from SonicWall devices.

#### Acceptance Criteria

**API Endpoints to Poll:**
1. WHEN polling for security counters, THE System SHALL call SonicWall API endpoint: GET /api/sonicos/reporting/security-services/statistics
2. WHEN polling for interface status, THE System SHALL call SonicWall API endpoint: GET /api/sonicos/interfaces
3. WHEN polling for system health, THE System SHALL call SonicWall API endpoint: GET /api/sonicos/system/status
4. WHEN polling for VPN status, THE System SHALL call SonicWall API endpoint: GET /api/sonicos/vpn/policies
5. WHEN polling for license information, THE System SHALL call SonicWall API endpoint: GET /api/sonicos/licenses

**Expected Response Fields:**
6. WHEN parsing security statistics response, THE System SHALL extract: ips_blocks_today (integer), gav_blocks_today (integer), dpi_ssl_blocks_today (integer), atp_verdicts_today (integer), app_control_blocks_today (integer), content_filter_blocks_today (integer), botnet_blocks_today (integer)
7. WHEN parsing interface response, THE System SHALL extract per interface: interface_name (string), zone (string), ip_address (string), status (up/down), link_speed (string)
8. WHEN parsing system status response, THE System SHALL extract: cpu_percent (float), ram_percent (float), uptime_seconds (integer), firmware_version (string), model (string), serial_number (string)
9. WHEN parsing VPN policies response, THE System SHALL extract per policy: policy_name (string), status (up/down), remote_gateway (string), encryption (string), authentication_method (string)
10. WHEN parsing licenses response, THE System SHALL extract: ips_expiry (date), gav_expiry (date), atp_expiry (date), app_control_expiry (date), content_filter_expiry (date), support_expiry (date)

**Security Feature Status Detection:**
11. WHEN security statistics response shows ips_blocks_today >= 0, THE System SHALL infer IPS is enabled
12. WHEN security statistics response shows gav_blocks_today >= 0, THE System SHALL infer GAV is enabled
13. WHEN security statistics response shows dpi_ssl_blocks_today >= 0, THE System SHALL infer DPI-SSL is enabled
14. WHEN security statistics response shows atp_verdicts_today >= 0, THE System SHALL infer ATP is enabled
15. WHEN security statistics response shows app_control_blocks_today >= 0, THE System SHALL infer Application Control is enabled
16. WHEN security statistics response shows botnet_blocks_today >= 0, THE System SHALL infer Botnet Filter is enabled
17. WHERE any security counter field is null or missing, THE System SHALL infer that feature is disabled

**HA Status Detection:**
18. WHEN system status response includes ha_role field with value "primary", THE System SHALL set HA status to "active"
19. WHEN system status response includes ha_role field with value "secondary", THE System SHALL set HA status to "standby"
20. WHEN system status response includes ha_state field with value "failover", THE System SHALL set HA status to "failover"
21. WHERE ha_role field is missing or null, THE System SHALL set HA status to "standalone"

### Requirement 9: Daily Metrics Rollup

**User Story:** As a security analyst, I want daily summary metrics, so that I can track firewall activity trends without storing detailed logs.

#### Acceptance Criteria
1. WHEN midnight UTC occurs, THE System SHALL create a daily metrics rollup record for the previous day
2. WHEN creating rollup, THE System SHALL use the final cumulative counter from SonicWall for the current day (NOT calculated by summing increments)
3. WHEN creating rollup, THE System SHALL store the final counter values: threats_blocked (sum of IPS + GAV + ATP + Botnet), malware_blocked (GAV blocks), ips_blocked (IPS blocks), blocked_connections (total denied connections), web_filter_hits (content filter blocks)
4. WHEN creating rollup, THE System SHALL store bandwidth_total_mb (if available from API)
5. WHEN creating rollup, THE System SHALL store active_sessions_count (average or final value from last poll)
6. WHEN creating rollup, THE System SHALL associate rollup with device_id and date
7. WHEN viewing metrics dashboard, THE System SHALL display daily trends for 7 days, 30 days, or 90 days
8. WHEN rollup records exceed 365 days old, THE System SHALL automatically delete old rollups

### Requirement 11: Email Alert Listener

**User Story:** As a security operations team, I want to receive SonicWall alert emails, so that I can capture critical events without log ingestion.

#### Acceptance Criteria
1. WHEN SonicWall sends an alert email to configured AVIAN inbox, THE System SHALL retrieve email via IMAP
2. WHEN parsing email subject, THE System SHALL extract alert type using pattern matching (e.g., "IPS Alert", "VPN Down", "License Expiring")
3. WHEN parsing email body, THE System SHALL extract severity (Critical, High, Medium, Low, Info) from email text
4. WHEN parsing email body, THE System SHALL extract timestamp from email headers or body
5. WHEN parsing email body, THE System SHALL extract firewall device identifier (serial number, hostname, or IP address)
6. WHEN email is parsed, THE System SHALL create an alert event record with: alert_type, severity, message (email body text), timestamp, device_id, source="email"
7. WHERE email parsing fails to identify device, THE System SHALL create alert with device_id=null and flag for manual review
8. WHEN viewing alerts, THE System SHALL display email-sourced alerts with "email" badge alongside API-sourced alerts
9. WHEN email is successfully processed, THE System SHALL mark email as read and move to processed folder
10. WHEN duplicate emails are detected (same alert_type, device_id, timestamp within 5 minutes), THE System SHALL skip processing to avoid duplicates

### Requirement 12: Alert Management System

**User Story:** As a security analyst, I want to manage firewall alerts, so that I can track and respond to security events.

#### Acceptance Criteria
1. WHEN an alert is generated (from API polling or email), THE System SHALL create an alert record with: alert_id, tenant_id, device_id, alert_type, severity, message, timestamp, acknowledged (false), acknowledged_by (null)
2. WHEN the same alert_type occurs repeatedly within 2 minutes AND values have not changed, THE System SHALL NOT generate duplicate alerts
3. WHEN viewing alerts, THE System SHALL display alerts sorted by timestamp descending (newest first)
4. WHEN filtering alerts, THE System SHALL support filtering by: severity, alert_type, device_id, acknowledged status, date range
5. WHEN a user acknowledges an alert, THE System SHALL update acknowledged=true and acknowledged_by=user_id
6. WHEN viewing alert details, THE System SHALL display full message, timestamp, device name, and acknowledgment status
7. WHERE alerts are older than 90 days, THE System SHALL automatically archive or delete old alerts
8. WHEN alert count exceeds threshold (e.g., 10 alerts in 5 minutes), THE System SHALL generate a meta-alert for "alert storm detected"

### Requirement 14: Firewall Dashboard and Visualization

**User Story:** As a managed service provider, I want a firewall overview dashboard, so that I can quickly assess firewall health and security status across all clients.

#### Acceptance Criteria
1. WHEN viewing device overview, THE System SHALL display: device model, firmware version, uptime, last seen timestamp, WAN status, VPN status, CPU percentage, RAM percentage
2. WHEN viewing security posture, THE System SHALL display: IPS enabled status, GAV enabled status, DPI-SSL enabled status, ATP enabled status, Botnet Filter enabled status, Application Control enabled status
3. WHEN viewing daily metrics, THE System SHALL display: threats blocked today, malware blocked today, IPS blocks today, active sessions count
4. WHEN viewing license status, THE System SHALL display: license name, expiry date, days remaining, status (active/expiring/expired)
5. WHERE configuration risks exist, THE System SHALL display: total risk count, critical risks count, high risks count, medium risks count, low risks count
6. WHEN viewing health trends, THE System SHALL display line charts for: CPU percentage over time, RAM percentage over time, threats blocked per day
7. WHEN multiple firewalls exist for tenant, THE System SHALL display firewall list with status indicators (green=healthy, yellow=warning, red=critical)

### Requirement 15: AVIAN API Endpoints

**User Story:** As a platform developer, I want REST API endpoints for firewall operations, so that I can integrate firewall functionality into workflows.

#### Acceptance Criteria
1. WHEN registering a device, THE System SHALL provide POST /api/firewall/devices endpoint accepting: tenant_id, model, firmware_version, serial_number, management_ip, api_credentials
2. WHEN retrieving devices, THE System SHALL provide GET /api/firewall/devices endpoint with tenant filtering
3. WHEN retrieving device details, THE System SHALL provide GET /api/firewall/devices/:id endpoint returning device metadata and latest health snapshot
4. WHEN uploading configuration, THE System SHALL provide POST /api/firewall/config/upload endpoint accepting configuration file and device_id
5. WHEN retrieving configuration risks, THE System SHALL provide GET /api/firewall/config/risks/:device_id endpoint returning risk list
6. WHEN retrieving security posture, THE System SHALL provide GET /api/firewall/posture/:device_id endpoint returning latest posture snapshot
7. WHEN retrieving alerts, THE System SHALL provide GET /api/firewall/alerts endpoint with filtering by device_id, severity, acknowledged status
8. WHEN acknowledging alert, THE System SHALL provide PUT /api/firewall/alerts/:id/acknowledge endpoint
9. WHEN retrieving metrics, THE System SHALL provide GET /api/firewall/metrics/:device_id endpoint with date range filtering
10. WHEN API errors occur, THE System SHALL return appropriate HTTP status codes (400, 401, 403, 404, 500) and error messages

### Requirement 17: Multi-Tenant Isolation

**User Story:** As a platform administrator, I want strict tenant isolation for firewall data, so that clients cannot access each other's firewall information.

#### Acceptance Criteria
1. WHEN users access firewall data, THE System SHALL enforce tenant-based access control using JWT token tenant_id
2. WHEN querying devices, THE System SHALL filter by tenant_id from authenticated user context
3. WHEN viewing dashboards, THE System SHALL display only devices and data for authorized tenant
4. WHEN API requests are made, THE System SHALL validate tenant_id matches device tenant_id
5. WHERE a firewall device is registered, THE System SHALL ensure device belongs to exactly one tenant
6. WHERE multi-tenant queries occur, THE System SHALL use database row-level security to prevent cross-tenant data leakage
7. WHEN super-admin accesses data, THE System SHALL allow viewing all tenants with explicit super-admin role check
8. WHERE cross-tenant access to devices is attempted, THE System SHALL prohibit access unless role=super-admin
9. WHEN tenant is deleted, THE System SHALL cascade delete all associated firewall devices, snapshots, posture records, alerts, and metrics

## Explicit MVP Prohibitions

**The following features are EXPLICITLY PROHIBITED in the MVP and must NOT be implemented:**

### ❌ Log Ingestion and Storage
- Syslog server (UDP/TCP listeners)
- firewall_logs table or any log storage table
- Raw IPS/GAV/ATP log entries
- Traffic logs (allowed/denied connections with source/dest details)
- Rule hit counters from logs
- Web filtering logs with URLs
- User activity logs
- VPN login/logout logs with usernames
- System audit logs with configuration changes
- TimescaleDB hypertables for log data
- Log parsing pipelines
- Log retention policies
- Log compression or archival
- **Counters derived from raw logs of any kind**
- **Packet-level logs, connection logs, IPS event logs, or firewall event logs**
- **ANY log storage or processing - counters MUST ONLY come from SonicWall summary/statistics APIs**

### ❌ SIEM-Like Features
- Threat timelines or event correlation
- Deep packet inspection data storage
- Signature-level threat storage
- Attack pattern analysis
- Threat intelligence enrichment
- Log-based anomaly detection
- Security event workflows
- Incident response automation
- Forensic log analysis
- Log search and query interfaces

### ❌ Advanced Traffic Analysis
- Traffic flow records (NetFlow/sFlow)
- Bandwidth usage per host
- Top talkers by traffic volume
- Protocol distribution from logs
- Application usage statistics from logs
- Geo-IP mapping of connections
- Connection duration tracking
- Session state tracking

### ❌ Configuration Management
- Direct firewall configuration push
- Automated policy deployment
- Rule optimization recommendations
- Configuration version control (git-like)
- Configuration rollback capability
- Scheduled configuration backups
- Configuration compliance scanning beyond risk detection

## Non-Functional Requirements

### Performance
- API polling: 30 second intervals per firewall
- Dashboard load time: < 2 seconds
- API response time: < 500ms for queries
- Alert generation: < 10 seconds from counter change detection
- Support for 100+ firewalls per platform instance
- Storage usage: < 100MB per firewall per year (snapshots + metrics only)

### Security
- Encrypted API credentials storage (AES-256)
- TLS 1.2+ for SonicWall API communication
- Role-based access control for firewall management
- Audit logging for device registration and configuration uploads
- Secure API authentication (JWT tokens)
- Row-level security for tenant isolation

### Reliability
- 99.9% API polling uptime
- Automatic retry for failed API calls (exponential backoff)
- Data retention: 90 days for snapshots, 365 days for daily metrics
- Graceful degradation if firewall API unavailable
- Alert deduplication to prevent alert storms

### Scalability
- Horizontal scaling for polling workers
- Database indexing for fast queries on: device_id, tenant_id, timestamp/date
- Health snapshots, posture snapshots, licenses, and rollups optimized for fast retrieval
- Redis caching for dashboard metrics (5 min TTL)
- Efficient storage (summary counters only, no logs)
- Support for 1000+ firewalls (future)

### Compatibility
- SonicWall Gen 6 and Gen 7 (primary target)
- SonicOS 6.5+ API compatibility
- Future: Fortinet FortiGate, Palo Alto Networks (post-MVP)

## Out of Scope (MVP)
- Real-time streaming dashboards (polling-based only)
- Mobile app for firewall monitoring
- Automated remediation actions
- Integration with external SIEM platforms
- Custom alerting rules engine
- Machine learning threat detection
- Compliance framework mapping (NIST, CIS, etc.)
- Multi-firewall policy synchronization
- Firewall performance benchmarking

## Success Metrics
- 100% API polling success rate (when firewall online)
- < 10 second alert generation time from counter change
- < 100MB storage per firewall per year
- 100% tenant data isolation (zero cross-tenant leaks)
- < 5% false positive rate for configuration risks
- 95%+ user satisfaction with dashboard usability
