/**
 * TypeScript types for Firewall Integration models
 * These types correspond to the Drizzle ORM schema definitions
 */

// ============================================================================
// Firewall Device Types
// ============================================================================

export type FirewallDeviceStatus = 'active' | 'inactive' | 'offline';

export interface FirewallDevice {
    id: string;
    tenantId: string;
    model: string | null;
    firmwareVersion: string | null;
    serialNumber: string | null;
    managementIp: string;
    apiUsername: string | null;
    apiPasswordEncrypted: string | null; // AES-256 encrypted
    uptimeSeconds: number;
    lastSeenAt: Date | null;
    status: FirewallDeviceStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateFirewallDeviceInput {
    tenantId: string;
    model?: string;
    firmwareVersion?: string;
    serialNumber?: string;
    managementIp: string;
    apiUsername?: string;
    apiPasswordEncrypted?: string;
    status?: FirewallDeviceStatus;
}

export interface UpdateFirewallDeviceInput {
    model?: string;
    firmwareVersion?: string;
    serialNumber?: string;
    managementIp?: string;
    apiUsername?: string;
    apiPasswordEncrypted?: string;
    uptimeSeconds?: number;
    lastSeenAt?: Date;
    status?: FirewallDeviceStatus;
    updatedAt?: Date;
}

// ============================================================================
// Health Snapshot Types
// ============================================================================

export type WanStatus = 'up' | 'down';
export type VpnStatus = 'up' | 'down';
export type WifiStatus = 'on' | 'off';
export type HaStatus = 'active' | 'standby' | 'failover' | 'standalone';

export interface InterfaceStatusMap {
    [interfaceName: string]: 'up' | 'down';
}

export interface FirewallHealthSnapshot {
    id: string;
    deviceId: string;
    cpuPercent: number;
    ramPercent: number;
    uptimeSeconds: number;
    wanStatus: WanStatus;
    vpnStatus: VpnStatus;
    interfaceStatus: InterfaceStatusMap;
    wifiStatus: WifiStatus | null;
    haStatus: HaStatus | null;
    timestamp: Date;
}

export interface CreateHealthSnapshotInput {
    deviceId: string;
    cpuPercent: number;
    ramPercent: number;
    uptimeSeconds: number;
    wanStatus: WanStatus;
    vpnStatus: VpnStatus;
    interfaceStatus: InterfaceStatusMap;
    wifiStatus?: WifiStatus | null;
    haStatus?: HaStatus | null;
}

// ============================================================================
// Security Posture Types
// ============================================================================

export type LicenseStatus = 'active' | 'expiring' | 'expired';
export type CertificateStatus = 'valid' | 'expiring' | 'expired';

export interface FirewallSecurityPosture {
    id: string;
    deviceId: string;

    // IPS
    ipsEnabled: boolean;
    ipsLicenseStatus: LicenseStatus | null;
    ipsDailyBlocks: number;

    // Gateway Anti-Virus
    gavEnabled: boolean;
    gavLicenseStatus: LicenseStatus | null;
    gavDailyBlocks: number;

    // DPI-SSL
    dpiSslEnabled: boolean;
    dpiSslCertificateStatus: CertificateStatus | null;
    dpiSslDailyBlocks: number;

    // ATP
    atpEnabled: boolean;
    atpLicenseStatus: LicenseStatus | null;
    atpDailyVerdicts: number;

    // Botnet Filter
    botnetFilterEnabled: boolean;
    botnetDailyBlocks: number;

    // Application Control
    appControlEnabled: boolean;
    appControlLicenseStatus: LicenseStatus | null;
    appControlDailyBlocks: number;

    // Content Filtering
    contentFilterEnabled: boolean;
    contentFilterLicenseStatus: LicenseStatus | null;
    contentFilterDailyBlocks: number;

    timestamp: Date;
}

export interface CreateSecurityPostureInput {
    deviceId: string;
    ipsEnabled: boolean;
    ipsLicenseStatus?: LicenseStatus | null;
    ipsDailyBlocks?: number;
    gavEnabled: boolean;
    gavLicenseStatus?: LicenseStatus | null;
    gavDailyBlocks?: number;
    dpiSslEnabled: boolean;
    dpiSslCertificateStatus?: CertificateStatus | null;
    dpiSslDailyBlocks?: number;
    atpEnabled: boolean;
    atpLicenseStatus?: LicenseStatus | null;
    atpDailyVerdicts?: number;
    botnetFilterEnabled: boolean;
    botnetDailyBlocks?: number;
    appControlEnabled: boolean;
    appControlLicenseStatus?: LicenseStatus | null;
    appControlDailyBlocks?: number;
    contentFilterEnabled: boolean;
    contentFilterLicenseStatus?: LicenseStatus | null;
    contentFilterDailyBlocks?: number;
}

// ============================================================================
// License Types
// ============================================================================

export interface FirewallLicense {
    id: string;
    deviceId: string;
    ipsExpiry: string | null; // ISO date string
    gavExpiry: string | null;
    atpExpiry: string | null;
    appControlExpiry: string | null;
    contentFilterExpiry: string | null;
    supportExpiry: string | null;
    licenseWarnings: string[]; // ["IPS expiring in 15 days", "GAV expired"]
    timestamp: Date;
}

export interface CreateLicenseInput {
    deviceId: string;
    ipsExpiry?: string | null;
    gavExpiry?: string | null;
    atpExpiry?: string | null;
    appControlExpiry?: string | null;
    contentFilterExpiry?: string | null;
    supportExpiry?: string | null;
    licenseWarnings?: string[];
}

// ============================================================================
// Config Risk Types
// ============================================================================

export type RiskCategory =
    | 'network_misconfiguration'
    | 'exposure_risk'
    | 'security_feature_disabled'
    | 'license_expired'
    | 'best_practice_violation';

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

// Risk types from Firewall Risk Rules + Severity Matrix
export type RiskType =
    | 'OPEN_INBOUND'
    | 'ANY_ANY_RULE'
    | 'WAN_MANAGEMENT_ENABLED'
    | 'ADMIN_NO_MFA'
    | 'DEFAULT_ADMIN_USERNAME'
    | 'IPS_DISABLED'
    | 'GAV_DISABLED'
    | 'DPI_SSL_DISABLED'
    | 'BOTNET_FILTER_DISABLED'
    | 'APP_CONTROL_DISABLED'
    | 'CONTENT_FILTER_DISABLED'
    | 'RULE_NO_DESCRIPTION'
    | 'SSH_ON_WAN'
    | 'DEFAULT_ADMIN_PORT'
    | 'VPN_WEAK_ENCRYPTION'
    | 'VPN_PSK_ONLY'
    | 'GUEST_NOT_ISOLATED'
    | 'DHCP_ON_WAN'
    | 'OUTDATED_FIRMWARE'
    | 'NO_NTP';

export interface FirewallConfigRisk {
    id: string;
    deviceId: string;
    snapshotId: string | null;
    riskCategory: RiskCategory;
    riskType: RiskType;
    severity: RiskSeverity;
    description: string;
    remediation: string | null;
    detectedAt: Date;
}

export interface CreateConfigRiskInput {
    deviceId: string;
    snapshotId?: string | null;
    riskCategory: RiskCategory;
    riskType: RiskType;
    severity: RiskSeverity;
    description: string;
    remediation?: string | null;
}

// ============================================================================
// Metrics Rollup Types
// ============================================================================

export interface FirewallMetricsRollup {
    id: string;
    deviceId: string;
    date: string; // ISO date string (YYYY-MM-DD)
    threatsBlocked: number; // Sum of IPS + GAV + ATP + Botnet
    malwareBlocked: number; // GAV blocks
    ipsBlocked: number; // IPS blocks
    blockedConnections: number; // Total denied connections
    webFilterHits: number; // Content filter blocks
    bandwidthTotalMb: number; // If available from API
    activeSessionsCount: number; // Average or final value
    createdAt: Date;
}

export interface CreateMetricsRollupInput {
    deviceId: string;
    date: string;
    threatsBlocked?: number;
    malwareBlocked?: number;
    ipsBlocked?: number;
    blockedConnections?: number;
    webFilterHits?: number;
    bandwidthTotalMb?: number;
    activeSessionsCount?: number;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertSource = 'api' | 'email';

export type AlertType =
    | 'ips_counter_increase'
    | 'gav_counter_increase'
    | 'atp_counter_increase'
    | 'botnet_counter_increase'
    | 'wan_down'
    | 'wan_up'
    | 'vpn_down'
    | 'vpn_up'
    | 'license_expired'
    | 'license_expiring'
    | 'feature_disabled'
    | 'feature_enabled'
    | 'config_risk'
    | 'high_cpu'
    | 'high_ram'
    | 'alert_storm';

export interface AlertMetadata {
    [key: string]: any;
    previous_value?: number;
    new_value?: number;
    counter_name?: string;
    device_identifier?: string;
}

export interface FirewallAlert {
    id: string;
    tenantId: string;
    deviceId: string | null; // Nullable for email alerts without device match
    alertType: AlertType;
    severity: AlertSeverity;
    message: string;
    source: AlertSource;
    metadata: AlertMetadata;
    acknowledged: boolean;
    acknowledgedBy: string | null;
    acknowledgedAt: Date | null;
    createdAt: Date;
}

export interface CreateAlertInput {
    tenantId: string;
    deviceId?: string | null;
    alertType: AlertType;
    severity: AlertSeverity;
    message: string;
    source: AlertSource;
    metadata?: AlertMetadata;
}

export interface AcknowledgeAlertInput {
    acknowledgedBy: string;
    acknowledgedAt?: Date;
}

export interface AlertFilters {
    tenantId: string;
    deviceId?: string;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    startDate?: Date;
    endDate?: Date;
    alertType?: AlertType;
    source?: AlertSource;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface DeviceWithLatestData {
    device: FirewallDevice;
    health: FirewallHealthSnapshot | null;
    posture: FirewallSecurityPosture | null;
    licenses: FirewallLicense | null;
}

export interface RiskSummary {
    totalRisks: number;
    criticalRisks: number;
    highRisks: number;
    mediumRisks: number;
    lowRisks: number;
    riskScore: number; // 0-100
}

export interface MetricsTrend {
    date: string;
    threatsBlocked: number;
    malwareBlocked: number;
    ipsBlocked: number;
}

// ============================================================================
// Encryption Types
// ============================================================================

export interface EncryptedCredentials {
    encrypted: string; // Base64 encoded encrypted data
    iv: string; // Initialization vector
}

export interface DecryptedCredentials {
    username: string;
    password: string;
}

// ============================================================================
// SonicWall API Client Types
// ============================================================================

export interface SonicWallAPIConfig {
    baseUrl: string;
    username: string;
    password: string;
    authToken?: string;
    timeout?: number; // Default: 30000ms
}

// ============================================================================
// SonicWall API Response Types (Raw API Responses)
// ============================================================================

/**
 * Raw authentication response from SonicWall API
 * POST /api/sonicos/auth
 */
export interface SonicWallAuthResponse {
    token?: string;
    auth_token?: string;
    expires_in?: number;
    token_type?: string;
}

/**
 * Raw security statistics response from SonicWall API
 * GET /api/sonicos/reporting/security-services/statistics
 */
export interface SonicWallSecurityStatsResponse {
    ips_blocks_today?: number;
    ips_blocks?: number;
    'ips.blocks'?: number;
    gav_blocks_today?: number;
    gav_blocks?: number;
    'gateway_av.blocks'?: number;
    dpi_ssl_blocks_today?: number;
    dpi_ssl_blocks?: number;
    'dpi_ssl.blocks'?: number;
    atp_verdicts_today?: number;
    atp_verdicts?: number;
    'atp.verdicts'?: number;
    app_control_blocks_today?: number;
    app_control_blocks?: number;
    'app_control.blocks'?: number;
    content_filter_blocks_today?: number;
    content_filter_blocks?: number;
    'content_filter.blocks'?: number;
    botnet_blocks_today?: number;
    botnet_blocks?: number;
    'botnet.blocks'?: number;
    [key: string]: any; // Allow additional fields
}

/**
 * Raw interface response from SonicWall API
 * GET /api/sonicos/interfaces
 */
export interface SonicWallInterfaceResponse {
    interfaces?: SonicWallInterfaceData[];
    data?: SonicWallInterfaceData[];
    [key: string]: any;
}

export interface SonicWallInterfaceData {
    name?: string;
    interface_name?: string;
    interface?: string;
    zone?: string;
    security_zone?: string;
    ip?: string;
    ip_address?: string;
    ipv4?: string;
    status?: string;
    link_status?: string;
    link_speed?: string;
    speed?: string;
    [key: string]: any;
}

/**
 * Raw system status response from SonicWall API
 * GET /api/sonicos/system/status
 */
export interface SonicWallSystemStatusResponse {
    cpu_percent?: number;
    cpu?: number;
    cpu_usage?: number;
    ram_percent?: number;
    memory_percent?: number;
    memory?: number;
    ram?: number;
    uptime_seconds?: number;
    uptime?: number;
    system_uptime?: number;
    firmware_version?: string;
    firmware?: string;
    version?: string;
    model?: string;
    device_model?: string;
    product?: string;
    serial_number?: string;
    serial?: string;
    sn?: string;
    ha_role?: string;
    'ha.role'?: string;
    'high_availability.role'?: string;
    ha_state?: string;
    'ha.state'?: string;
    'high_availability.state'?: string;
    [key: string]: any;
}

/**
 * Raw VPN policies response from SonicWall API
 * GET /api/sonicos/vpn/policies
 */
export interface SonicWallVPNPoliciesResponse {
    policies?: SonicWallVPNPolicyData[];
    vpn_policies?: SonicWallVPNPolicyData[];
    data?: SonicWallVPNPolicyData[];
    [key: string]: any;
}

export interface SonicWallVPNPolicyData {
    name?: string;
    policy_name?: string;
    status?: string;
    tunnel_status?: string;
    remote_gateway?: string;
    peer?: string;
    remote_ip?: string;
    encryption?: string;
    encryption_algorithm?: string;
    authentication?: string;
    auth_method?: string;
    authentication_method?: string;
    [key: string]: any;
}

/**
 * Raw licenses response from SonicWall API
 * GET /api/sonicos/licenses
 */
export interface SonicWallLicensesResponse {
    ips_expiry?: string;
    'ips.expiry'?: string;
    'licenses.ips.expiry'?: string;
    gav_expiry?: string;
    gateway_av_expiry?: string;
    'licenses.gav.expiry'?: string;
    atp_expiry?: string;
    'licenses.atp.expiry'?: string;
    app_control_expiry?: string;
    'licenses.app_control.expiry'?: string;
    content_filter_expiry?: string;
    'licenses.content_filter.expiry'?: string;
    support_expiry?: string;
    'licenses.support.expiry'?: string;
    licenses?: {
        ips?: { expiry?: string };
        gav?: { expiry?: string };
        gateway_av?: { expiry?: string };
        atp?: { expiry?: string };
        app_control?: { expiry?: string };
        content_filter?: { expiry?: string };
        support?: { expiry?: string };
    };
    [key: string]: any;
}

// ============================================================================
// SonicWall API Normalized Response Types (Processed/Normalized)
// ============================================================================

export interface SecurityStats {
    ips_blocks_today: number;
    gav_blocks_today: number;
    dpi_ssl_blocks_today: number;
    atp_verdicts_today: number;
    app_control_blocks_today: number;
    content_filter_blocks_today: number;
    botnet_blocks_today: number;
    blocked_connections: number;
    bandwidth_total_mb?: number; // Optional: Total bandwidth usage in MB (if available from API)
}

export interface SystemHealth {
    cpu_percent: number;
    ram_percent: number;
    uptime_seconds: number;
    firmware_version: string;
    model: string;
    serial_number: string;
    ha_role?: 'primary' | 'secondary';
    ha_state?: 'active' | 'standby' | 'failover';
    bandwidth_total_mb?: number; // Optional: Total bandwidth usage in MB (if available from API)
    active_sessions_count?: number; // Optional: Active sessions count (if available from API)
}

export interface InterfaceStatus {
    interface_name: string;
    zone: string;
    ip_address: string;
    status: 'up' | 'down';
    link_speed: string;
}

export interface VPNPolicy {
    policy_name: string;
    status: 'up' | 'down';
    remote_gateway: string;
    encryption: string;
    authentication_method: string;
}

export interface LicenseInfo {
    ips_expiry: string; // ISO date
    gav_expiry: string;
    atp_expiry: string;
    app_control_expiry: string;
    content_filter_expiry: string;
    support_expiry: string;
}

// ============================================================================
// Polling Engine Types
// ============================================================================

export interface PollingState {
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
        blockedConnections: number;
    };
    lastStatus: {
        wanStatus: 'up' | 'down';
        vpnStatus: 'up' | 'down';
    };
}

export interface Counters {
    ipsBlocks: number;
    gavBlocks: number;
    dpiSslBlocks: number;
    atpVerdicts: number;
    appControlBlocks: number;
    botnetBlocks: number;
    contentFilterBlocks: number;
    blockedConnections: number;
    bandwidthTotalMb?: number; // Optional: Total bandwidth usage in MB (if available from API)
    activeSessionsCount?: number; // Optional: Active sessions count (if available from API)
}

export interface Status {
    wanStatus: 'up' | 'down';
    vpnStatus: 'up' | 'down';
}

export interface HealthData {
    cpuPercent: number;
    ramPercent: number;
    uptimeSeconds: number;
    wanStatus: WanStatus;
    vpnStatus: VpnStatus;
    interfaceStatus: InterfaceStatusMap;
    wifiStatus?: WifiStatus | null;
    haStatus?: HaStatus | null;
}

export interface PostureData {
    ipsEnabled: boolean;
    ipsLicenseStatus?: LicenseStatus | null;
    ipsDailyBlocks: number;
    gavEnabled: boolean;
    gavLicenseStatus?: LicenseStatus | null;
    gavDailyBlocks: number;
    dpiSslEnabled: boolean;
    dpiSslCertificateStatus?: CertificateStatus | null;
    dpiSslDailyBlocks: number;
    atpEnabled: boolean;
    atpLicenseStatus?: LicenseStatus | null;
    atpDailyVerdicts: number;
    botnetFilterEnabled: boolean;
    botnetDailyBlocks: number;
    appControlEnabled: boolean;
    appControlLicenseStatus?: LicenseStatus | null;
    appControlDailyBlocks: number;
    contentFilterEnabled: boolean;
    contentFilterLicenseStatus?: LicenseStatus | null;
    contentFilterDailyBlocks: number;
}

// ============================================================================
// Configuration Parser Types
// ============================================================================

export interface ParsedConfig {
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

export interface FirewallRule {
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

export interface NATPolicy {
    originalSource: string;
    translatedSource: string;
    originalDestination: string;
    translatedDestination: string;
    interface: string;
}

export interface AddressObject {
    objectName: string;
    ipAddress: string; // IP address or range
    zone: string;
}

export interface ServiceObject {
    serviceName: string;
    protocol: string;
    portRange: string;
}

export interface SecuritySettings {
    ipsEnabled: boolean;
    gavEnabled: boolean;
    antiSpywareEnabled: boolean;
    appControlEnabled: boolean;
    contentFilterEnabled: boolean;
    botnetFilterEnabled: boolean;
    dpiSslEnabled: boolean;
    geoIpFilterEnabled: boolean;
}

export interface AdminSettings {
    adminUsernames: string[];
    mfaEnabled: boolean;
    wanManagementEnabled: boolean;
    httpsAdminPort: number;
    sshEnabled: boolean;
}

export interface InterfaceConfig {
    interfaceName: string;
    zone: string;
    ipAddress: string;
    dhcpServerEnabled: boolean;
}

export interface VPNConfig {
    policyName: string;
    encryption: string;
    authenticationMethod: string;
}

export interface SystemSettings {
    firmwareVersion: string;
    hostname: string;
    timezone: string;
    ntpServers: string[];
    dnsServers: string[];
}

export interface ConfigRisk {
    riskCategory: RiskCategory;
    riskType: RiskType;
    severity: RiskSeverity;
    description: string;
    remediation: string;
}

// ============================================================================
// Email Alert Listener Types
// ============================================================================

export interface EmailConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    tls: boolean;
}

export interface Email {
    id: string;
    from: string;
    subject: string;
    body: string;
    headers: Record<string, string>;
    timestamp: Date;
}

export interface ParsedAlert {
    alertType: string;
    severity: AlertSeverity;
    message: string;
    timestamp: Date;
    deviceIdentifier?: string; // Serial number, hostname, or IP
    deviceId?: string; // Resolved device_id
}

// ============================================================================
// Alert Manager Types
// ============================================================================

export interface CreateAlertInput {
    tenantId: string;
    deviceId?: string | null;
    alertType: AlertType;
    severity: AlertSeverity;
    message: string;
    source: AlertSource;
    metadata?: AlertMetadata;
}

export interface AlertFilters {
    tenantId: string;
    deviceId?: string;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    startDate?: Date;
    endDate?: Date;
    alertType?: AlertType;
    source?: AlertSource;
}

// ============================================================================
// Metrics Aggregator Types
// ============================================================================

export interface MetricsRollup {
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

// ============================================================================
// Dashboard Component Types
// ============================================================================

export interface DeviceOverview {
    device: FirewallDevice;
    health: FirewallHealthSnapshot | null;
    posture: FirewallSecurityPosture | null;
    licenses: FirewallLicense | null;
    riskSummary: RiskSummary | null;
}

export interface SecurityFeatureStatus {
    name: string;
    enabled: boolean;
    licenseStatus?: LicenseStatus | null;
    dailyBlocks?: number;
}

export interface HealthTrend {
    timestamp: Date;
    cpuPercent: number;
    ramPercent: number;
}

export interface ThreatsTrend {
    date: string;
    ipsBlocks: number;
    gavBlocks: number;
    atpVerdicts: number;
    botnetBlocks: number;
    total: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface RegisterDeviceRequest {
    tenantId: string;
    model?: string;
    firmwareVersion?: string;
    serialNumber?: string;
    managementIp: string;
    apiUsername: string;
    apiPassword: string; // Will be encrypted before storage
}

export interface UpdateDeviceRequest {
    model?: string;
    firmwareVersion?: string;
    serialNumber?: string;
    managementIp?: string;
    apiUsername?: string;
    apiPassword?: string; // Will be encrypted before storage
    status?: FirewallDeviceStatus;
}

export interface UploadConfigRequest {
    deviceId: string;
    configFile: string; // .exp file content
}

export interface UploadConfigResponse {
    success: boolean;
    riskSummary: RiskSummary;
    risks: FirewallConfigRisk[];
}

export interface GetHealthRequest {
    deviceId: string;
    startDate?: string; // ISO date
    endDate?: string; // ISO date
}

export interface GetMetricsRequest {
    deviceId: string;
    startDate?: string; // ISO date
    endDate?: string; // ISO date
}

export interface AcknowledgeAlertRequest {
    userId: string;
}

export interface PaginationParams {
    limit?: number;
    offset?: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface APIError {
    code: string;
    message: string;
    details?: Record<string, any>;
}

export interface ValidationError {
    field: string;
    message: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DateRange = {
    startDate: Date;
    endDate: Date;
};

export type TimeRange = '7d' | '30d' | '90d' | '365d';

export interface RetryConfig {
    maxRetries: number;
    backoffIntervals: number[]; // [30s, 60s, 120s, 300s]
    currentRetry: number;
}

export interface PollingConfig {
    interval: number; // milliseconds, default 30000
    snapshotInterval: number; // milliseconds, default 4-6 hours
    retryConfig: RetryConfig;
}

// ============================================================================
// Service Layer Types
// ============================================================================

export interface DeviceService {
    registerDevice(input: RegisterDeviceRequest): Promise<FirewallDevice>;
    getDevice(deviceId: string, tenantId: string): Promise<FirewallDevice | null>;
    listDevices(tenantId: string): Promise<FirewallDevice[]>;
    updateDevice(
        deviceId: string,
        tenantId: string,
        input: UpdateDeviceRequest
    ): Promise<FirewallDevice>;
    deleteDevice(deviceId: string, tenantId: string): Promise<void>;
}

export interface HealthService {
    createSnapshot(input: CreateHealthSnapshotInput): Promise<FirewallHealthSnapshot>;
    getLatestSnapshot(deviceId: string): Promise<FirewallHealthSnapshot | null>;
    getSnapshots(
        deviceId: string,
        dateRange?: DateRange
    ): Promise<FirewallHealthSnapshot[]>;
}

export interface PostureService {
    createPosture(input: CreateSecurityPostureInput): Promise<FirewallSecurityPosture>;
    getLatestPosture(deviceId: string): Promise<FirewallSecurityPosture | null>;
    getPostures(
        deviceId: string,
        dateRange?: DateRange
    ): Promise<FirewallSecurityPosture[]>;
}

export interface LicenseService {
    createLicense(input: CreateLicenseInput): Promise<FirewallLicense>;
    getLatestLicense(deviceId: string): Promise<FirewallLicense | null>;
    checkExpiringLicenses(deviceId: string): Promise<string[]>;
}

export interface ConfigService {
    parseConfig(configText: string): Promise<ParsedConfig>;
    analyzeRisks(config: ParsedConfig): Promise<ConfigRisk[]>;
    storeRisks(deviceId: string, risks: ConfigRisk[]): Promise<void>;
    getRisks(deviceId: string): Promise<FirewallConfigRisk[]>;
    calculateRiskScore(risks: ConfigRisk[]): number;
}

export interface AlertService {
    createAlert(input: CreateAlertInput): Promise<FirewallAlert>;
    deduplicateAlert(input: CreateAlertInput): Promise<boolean>;
    acknowledgeAlert(alertId: string, userId: string): Promise<void>;
    getAlerts(filters: AlertFilters): Promise<FirewallAlert[]>;
    checkAlertStorm(deviceId: string): Promise<boolean>;
}

export interface MetricsService {
    createRollup(input: CreateMetricsRollupInput): Promise<FirewallMetricsRollup>;
    getRollups(
        deviceId: string,
        dateRange?: DateRange
    ): Promise<FirewallMetricsRollup[]>;
    aggregateDeviceMetrics(deviceId: string, date: Date): Promise<MetricsRollup>;
}
