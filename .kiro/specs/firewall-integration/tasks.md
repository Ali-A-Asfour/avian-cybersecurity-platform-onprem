# SonicWall Firewall Integration - Implementation Tasks (MVP)

## Phase 1: Database Schema and Models

### Task 1.1: Create Database Schema
- [x] Create firewall_devices table with tenant association and API credentials
- [x] Create firewall_health_snapshots table with 4-6 hour snapshot frequency
- [x] Create firewall_security_posture table for security feature status and daily counters
- [x] Create firewall_licenses table for license expiry tracking
- [x] Create firewall_config_risks table for configuration risk analysis
- [x] Create firewall_metrics_rollup table for daily summary metrics
- [x] Create firewall_alerts table for alert management
- [x] Add all indexes for performance optimization
- [x] Add retention policies (90 days snapshots, 365 days metrics, 90 days alerts)
- _Requirements: 1.1-1.6, All data models_

### Task 1.2: Create Drizzle ORM Models
- [x] Define FirewallDevice model with encrypted API credentials
- [x] Define FirewallHealthSnapshot model
- [x] Define FirewallSecurityPosture model
- [x] Define FirewallLicense model
- [x] Define FirewallConfigRisk model
- [x] Define FirewallMetricsRollup model
- [x] Define FirewallAlert model
- [x] Add TypeScript types for all models
- [x] Add relations between models
- _Requirements: All data models_

### Task 1.3: Create Database Migration
- [x] Generate Drizzle migration for all tables
- [x] Test migration on development database
- [x] Add rollback migration
- [x] Document migration process
- _Requirements: All data models_

### Task 1.4: Implement Credential Encryption
- [x] Create encryption utility using AES-256
- [x] Implement encryptCredentials() function
- [x] Implement decryptCredentials() function
- [x] Store encryption key in environment variable
- [x] Test encryption/decryption roundtrip
- _Requirements: 1.1-1.6_


## Phase 2: SonicWall API Client

### Task 2.1: Implement SonicWall API Client
- [x] Create SonicWallAPI class with authentication
- [x] Implement authenticate() method to get auth token
- [x] Implement getSecurityStatistics() method
- [x] Implement getInterfaces() method
- [x] Implement getSystemStatus() method
- [x] Implement getVPNPolicies() method
- [x] Implement getLicenses() method
- [x] Add error handling and retry logic
- [x] Add request timeout (30 seconds)
- _Requirements: 2.1-2.12, 7.1-7.21_

### Task 2.2: Define API Response Types
- [x] Define SecurityStats interface
- [x] Define SystemHealth interface
- [x] Define InterfaceStatus interface
- [x] Define VPNPolicy interface
- [x] Define LicenseInfo interface
- [x] Add TypeScript types for all API responses
- _Requirements: 7.6-7.10_

### Task 2.3: Implement API Error Handling
- [x] Handle authentication failures
- [x] Handle network timeouts
- [x] Handle API rate limiting
- [x] Implement exponential backoff (30s, 60s, 120s, 300s max)
- [x] Log API errors with context
- _Requirements: 2.6_

### Task 2.4: Test API Client
- [x] Create mock SonicWall API server for testing
- [x] Test authentication flow
- [x] Test all API endpoint methods
- [x] Test error handling and retries
- [ ] Test with real SonicWall device (if available)
- _Requirements: 2.1-2.12_


## Phase 3: Polling Engine

### Task 3.1: Implement Polling Engine Core
- [x] Create PollingEngine class with 30-second interval
- [x] Implement start() and stop() methods
- [x] Load all active devices from database
- [x] Implement pollDevice() method for single device
- [x] Use node-cron for scheduling
- [x] Add graceful shutdown handling
- _Requirements: 2.1-2.12_

### Task 3.2: Implement Counter Tracking
- [x] Store last poll counters in Redis
- [x] Implement detectCounterChanges() method
- [x] Compare new counters with previous poll
- [x] Generate alerts when counters increase
- [x] Store counter deltas in alert metadata
- _Requirements: 2.7_

### Task 3.3: Implement Status Change Detection
- [x] Store last poll status in Redis
- [x] Implement detectStatusChanges() method
- [x] Detect WAN status changes (up→down, down→up)
- [x] Detect VPN status changes
- [x] Detect security feature enable/disable changes
- [x] Generate alerts for status changes
- _Requirements: 2.8-2.10_

### Task 3.4: Implement Health Snapshot Creation
- [x] Check if 4-6 hours elapsed since last snapshot
- [x] Create health snapshot record with CPU, RAM, uptime
- [x] Store WAN status, VPN status, interface status
- [x] Store WiFi status and HA status
- [x] Update device last_seen_at timestamp
- _Requirements: 3.1-3.8_

### Task 3.5: Implement Security Posture Storage
- [x] Extract security feature enabled status from API response
- [x] Infer feature status from counter presence (Requirements 7.11-7.17)
- [x] Store IPS, GAV, DPI-SSL, ATP, Botnet, AppControl status
- [x] Store daily block counters
- [x] Store license status for each feature
- [x] Update posture record on changes
- _Requirements: 4.1-4.7, 7.11-7.17_

### Task 3.6: Implement License Tracking
- [x] Extract license expiry dates from API response
- [x] Store license information in firewall_licenses table
- [x] Calculate days remaining for each license
- [x] Generate warning alerts for licenses expiring within 30 days
- [x] Generate critical alerts for expired licenses
- _Requirements: 5.1-5.7_

### Task 3.7: Implement Health Metric Alerts
- [x] Check CPU percentage threshold (> 80%)
- [x] Check RAM percentage threshold (> 90%)
- [x] Generate warning alerts for high resource usage
- [x] Track alert frequency to avoid spam
- _Requirements: 2.11_


## Phase 4: Configuration Parser and Risk Engine

### Task 4.1: Implement Configuration Parser
- [x] Create ConfigParser class
- [x] Implement parseConfig() method for .exp format
- [x] Extract firewall rules (source, dest, action, etc.)
- [x] Extract NAT policies
- [x] Extract address objects and service objects
- [x] Extract security feature settings
- [x] Extract admin settings (usernames, MFA, WAN management)
- [x] Extract interface configurations
- [x] Extract VPN configurations
- [x] Extract system settings (firmware, hostname, NTP, DNS)
- _Requirements: 6.1-6.10_

### Task 4.2: Implement Risk Detection Rules (Network)
- [x] Detect WAN-to-LAN any rules (CRITICAL)
- [x] Detect any-to-any rules (HIGH)
- [x] Detect Guest zone routing to LAN (HIGH)
- [x] Detect DHCP server on WAN interface (CRITICAL)
- _Requirements: 6.11-6.13, 6.27-6.28_

### Task 4.3: Implement Risk Detection Rules (Admin)
- [x] Detect WAN management enabled (CRITICAL)
- [x] Detect MFA disabled (HIGH)
- [x] Detect default admin username (MEDIUM)
- [x] Detect SSH on WAN interface (HIGH)
- [x] Detect default HTTPS admin port (LOW)
- _Requirements: 6.13-6.15, 6.23-6.24_

### Task 4.4: Implement Risk Detection Rules (Security)
- [x] Detect IPS disabled (CRITICAL)
- [x] Detect Gateway AV disabled (CRITICAL)
- [x] Detect DPI-SSL disabled (MEDIUM)
- [x] Detect Botnet Filter disabled (HIGH)
- [x] Detect Application Control disabled (MEDIUM)
- [x] Detect Content Filtering disabled (MEDIUM)
- _Requirements: 6.16-6.21_

### Task 4.5: Implement Risk Detection Rules (Other)
- [x] Detect missing rule descriptions (LOW)
- [x] Detect weak VPN encryption (HIGH)
- [x] Detect VPN PSK-only authentication (MEDIUM)
- [x] Detect outdated firmware (MEDIUM)
- [x] Detect missing NTP configuration (LOW)
- _Requirements: 6.22, 6.25-6.26, 6.29-6.30_

### Task 4.6: Implement Risk Storage
- [x] Create risk records in firewall_config_risks table
- [x] Associate risks with device_id and snapshot_id
- [x] Store risk category, type, severity, description, remediation
- [x] Delete old risks when new config uploaded
- [x] Query risks by device and severity
- _Requirements: 6.1-6.30_

### Task 4.7: Test Configuration Parser
- [x] Create sample SonicWall .exp files for testing
- [x] Test parsing of rules, NAT, objects, services
- [x] Test all 30 risk detection rules
- [x] Verify risk severity assignments
- [x] Test with malformed config files
- _Requirements: 6.1-6.30_


## Phase 5: Alert Management System

### Task 5.1: Implement Alert Manager
- [x] Create AlertManager class
- [x] Implement createAlert() method
- [x] Implement deduplicateAlert() method using Redis
- [x] Implement acknowledgeAlert() method
- [-] Implement getAlerts() method with filtering
- [x] Implement checkAlertStorm() method
- _Requirements: 12.1-12.7_

### Task 5.2: Implement Alert Deduplication
- [x] Check Redis for duplicate alerts (same type + device + severity within 5 min)
- [x] Skip creating duplicate alerts
- [x] Use Redis key expiration for automatic cleanup
- [x] Log skipped duplicates for debugging
- _Requirements: 12.1_

### Task 5.3: Implement Alert Storm Detection
- [x] Count alerts per device in 5-minute window
- [x] If > 10 alerts, create meta-alert "alert storm detected"
- [x] Suppress further alerts for device for 15 minutes
- [x] Store suppression state in Redis
- _Requirements: 12.7_

### Task 5.4: Implement Alert Filtering
- [x] Filter by tenant_id (always enforced)
- [x] Filter by device_id
- [x] Filter by severity
- [x] Filter by acknowledged status
- [x] Filter by date range
- [x] Sort by timestamp descending
- _Requirements: 12.3_

### Task 5.5: Test Alert System
- [x] Test alert creation from polling engine
- [x] Test alert deduplication
- [x] Test alert storm detection
- [x] Test alert acknowledgment
- [x] Test alert filtering and querying
- _Requirements: 12.1-12.7_


## Phase 6: Email Alert Listener

### Task 6.1: Implement Email Listener
- [x] Create EmailAlertListener class
- [x] Configure IMAP connection (host, port, user, password)
- [x] Implement start() and stop() methods
- [x] Check for new emails every 5 minutes
- [x] Filter emails from SonicWall sender
- _Requirements: 11.1-11.10_

### Task 6.2: Implement Email Parser
- [x] Parse email subject for alert type (regex patterns)
- [x] Parse email body for severity
- [x] Parse email headers/body for timestamp
- [x] Parse email body for device identifier (serial, hostname, IP)
- [x] Extract message text from email body
- _Requirements: 11.2-11.5_

### Task 6.3: Implement Device Matching
- [x] Match device identifier to firewall_devices table
- [x] Try matching by serial_number
- [x] Try matching by management_ip
- [x] Try matching by hostname (if available)
- [x] If no match, create alert with device_id=null and flag for review
- _Requirements: 11.6-11.7_

### Task 6.4: Implement Email Processing
- [x] Create alert record from parsed email
- [x] Set source="email" in alert
- [x] Mark email as read
- [x] Move email to processed folder
- [x] Detect and skip duplicate emails (same alert within 5 min)
- _Requirements: 11.8-11.10_

### Task 6.5: Test Email Listener
- [x] Create sample SonicWall alert emails
- [x] Test email parsing for various alert types
- [x] Test device matching logic
- [x] Test duplicate detection
- [x] Test error handling for malformed emails
- _Requirements: 11.1-11.10_


## Phase 7: Daily Metrics Aggregator

### Task 7.1: Implement Metrics Aggregator
- [x] Create MetricsAggregator class
- [x] Schedule daily job at 00:00 UTC using node-cron
- [x] Implement runDailyRollup() method
- [x] Iterate through all active devices
- [x] Get final counter values from last poll of previous day
- _Requirements: 9.1-9.7_

### Task 7.2: Implement Metrics Calculation
- [x] Calculate threats_blocked (IPS + GAV + ATP + Botnet)
- [x] Store malware_blocked (GAV blocks)
- [x] Store ips_blocked (IPS blocks)
- [x] Store blocked_connections count
- [x] Store web_filter_hits count
- [x] Store bandwidth_total_mb (if available)
- [x] Store active_sessions_count (average or final)
- _Requirements: 9.2-9.4_

### Task 7.3: Implement Metrics Storage
- [x] Insert into firewall_metrics_rollup table
- [x] Handle duplicate dates (UPSERT)
- [x] Associate with device_id and date
- [x] Verify unique constraint (device_id, date)
- _Requirements: 9.5_

### Task 7.4: Implement Metrics Cleanup
- [x] Delete rollup records older than 365 days
- [x] Run cleanup as part of daily job
- [x] Log cleanup statistics
- _Requirements: 9.7_

### Task 7.5: Test Metrics Aggregator
- [x] Test daily rollup calculation
- [x] Test metrics storage
- [x] Test duplicate date handling
- [x] Test cleanup of old records
- [x] Verify cron scheduling
- _Requirements: 9.1-9.7_


## Phase 8: API Layer

### Task 8.1: Implement Device Management API
- [x] POST /api/firewall/devices - Register device
- [x] GET /api/firewall/devices - List devices (tenant-filtered)
- [x] GET /api/firewall/devices/:id - Get device details + latest snapshot
- [x] PUT /api/firewall/devices/:id - Update device
- [x] DELETE /api/firewall/devices/:id - Delete device
- [x] Add authentication and tenant validation
- [x] Add input validation
- _Requirements: 15.1-15.3_

### Task 8.2: Implement Configuration API
- [x] POST /api/firewall/config/upload - Upload config file
- [x] Parse config file using ConfigParser
- [x] Run risk detection using RiskEngine
- [x] Store risks in database
- [x] Return risk summary
- [x] GET /api/firewall/config/risks/:deviceId - Get config risks
- _Requirements: 15.4-15.5_

### Task 8.3: Implement Posture and Health API
- [x] GET /api/firewall/posture/:deviceId - Get latest security posture
- [x] GET /api/firewall/health/:deviceId - Get health snapshots with date range
- [x] GET /api/firewall/licenses/:deviceId - Get license status
- [x] Add tenant validation
- [x] Add date range filtering for health snapshots
- _Requirements: 15.6_

### Task 8.4: Implement Alert API
- [x] GET /api/firewall/alerts - List alerts (tenant-filtered)
- [x] Filter by device_id, severity, acknowledged status
- [x] Add pagination (limit, offset)
- [x] PUT /api/firewall/alerts/:id/acknowledge - Acknowledge alert
- [x] Validate user can acknowledge (tenant match)
- _Requirements: 15.7-15.8_

### Task 8.5: Implement Metrics API
- [x] GET /api/firewall/metrics/:deviceId - Get daily metrics
- [x] Add date range filtering
- [x] Return metrics sorted by date descending
- [x] Add tenant validation
- _Requirements: 15.9_

### Task 8.6: Implement API Error Handling
- [x] Return 400 for invalid input
- [x] Return 401 for unauthenticated requests
- [x] Return 403 for unauthorized access (wrong tenant)
- [x] Return 404 for not found resources
- [x] Return 500 for server errors
- [x] Include error messages in response
- _Requirements: 15.10_

### Task 8.7: Test API Endpoints
- [x] Test device CRUD operations
- [x] Test config upload and risk detection
- [x] Test posture, health, license queries
- [x] Test alert listing and acknowledgment
- [x] Test metrics queries
- [x] Test authentication and authorization
- [x] Test tenant isolation
- _Requirements: 15.1-15.10_
