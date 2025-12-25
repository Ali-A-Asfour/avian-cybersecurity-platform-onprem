import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    jsonb,
    index,
    integer,
    bigint,
    real,
    date,
    unique,
    check,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users } from './main';
import { sql } from 'drizzle-orm';

// ============================================================================
// Firewall Integration Tables
// ============================================================================

/**
 * Firewall Devices Table
 * Stores registered SonicWall firewall devices with tenant association and encrypted API credentials
 */
export const firewallDevices = pgTable(
    'firewall_devices',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        model: varchar('model', { length: 100 }),
        firmwareVersion: varchar('firmware_version', { length: 50 }),
        serialNumber: varchar('serial_number', { length: 100 }).unique(),
        managementIp: varchar('management_ip', { length: 45 }).notNull(), // INET type stored as varchar
        apiUsername: varchar('api_username', { length: 255 }),
        apiPasswordEncrypted: text('api_password_encrypted'), // AES-256 encrypted
        uptimeSeconds: bigint('uptime_seconds', { mode: 'number' }).default(0),
        lastSeenAt: timestamp('last_seen_at'),
        status: varchar('status', { length: 20 }).default('active'), // active, inactive, offline
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_firewall_devices_tenant').on(table.tenantId),
        statusIdx: index('idx_firewall_devices_status').on(table.status),
        serialIdx: index('idx_firewall_devices_serial').on(table.serialNumber),
        lastSeenIdx: index('idx_firewall_devices_last_seen').on(table.lastSeenAt),
    })
);

/**
 * Firewall Health Snapshots Table
 * Stores periodic health snapshots of firewall devices (captured every 4-6 hours)
 * Retention: 90 days
 */
export const firewallHealthSnapshots = pgTable(
    'firewall_health_snapshots',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        deviceId: uuid('device_id')
            .notNull()
            .references(() => firewallDevices.id, { onDelete: 'cascade' }),
        cpuPercent: real('cpu_percent').notNull(),
        ramPercent: real('ram_percent').notNull(),
        uptimeSeconds: bigint('uptime_seconds', { mode: 'number' }).notNull(),
        wanStatus: varchar('wan_status', { length: 10 }).notNull(), // up, down
        vpnStatus: varchar('vpn_status', { length: 10 }).notNull(), // up, down
        interfaceStatus: jsonb('interface_status').notNull(), // {"X0": "up", "X1": "up", "X2": "down"}
        wifiStatus: varchar('wifi_status', { length: 10 }), // on, off
        haStatus: varchar('ha_status', { length: 20 }), // active, standby, failover, standalone
        timestamp: timestamp('timestamp').defaultNow(),
    },
    (table) => ({
        deviceIdx: index('idx_health_snapshots_device').on(
            table.deviceId,
            sql`${table.timestamp} DESC`
        ),
        timestampIdx: index('idx_health_snapshots_timestamp').on(
            sql`${table.timestamp} DESC`
        ),
        // Check constraints
        checkWanStatus: check(
            'check_wan_status',
            sql`${table.wanStatus} IN ('up', 'down')`
        ),
        checkVpnStatus: check(
            'check_vpn_status',
            sql`${table.vpnStatus} IN ('up', 'down')`
        ),
        checkWifiStatus: check(
            'check_wifi_status',
            sql`${table.wifiStatus} IS NULL OR ${table.wifiStatus} IN ('on', 'off')`
        ),
        checkHaStatus: check(
            'check_ha_status',
            sql`${table.haStatus} IS NULL OR ${table.haStatus} IN ('active', 'standby', 'failover', 'standalone')`
        ),
        checkCpuRange: check(
            'check_cpu_percent_range',
            sql`${table.cpuPercent} >= 0 AND ${table.cpuPercent} <= 100`
        ),
        checkRamRange: check(
            'check_ram_percent_range',
            sql`${table.ramPercent} >= 0 AND ${table.ramPercent} <= 100`
        ),
        checkUptimePositive: check(
            'check_uptime_positive',
            sql`${table.uptimeSeconds} >= 0`
        ),
    })
);

/**
 * Firewall Security Posture Table
 * Tracks security feature status and daily block counts
 * Retention: 30 days for trending
 */
export const firewallSecurityPosture = pgTable(
    'firewall_security_posture',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        deviceId: uuid('device_id')
            .notNull()
            .references(() => firewallDevices.id, { onDelete: 'cascade' }),

        // IPS (Intrusion Prevention System)
        ipsEnabled: boolean('ips_enabled').notNull(),
        ipsLicenseStatus: varchar('ips_license_status', { length: 20 }), // active, expiring, expired
        ipsDailyBlocks: integer('ips_daily_blocks').default(0),

        // Gateway Anti-Virus
        gavEnabled: boolean('gav_enabled').notNull(),
        gavLicenseStatus: varchar('gav_license_status', { length: 20 }),
        gavDailyBlocks: integer('gav_daily_blocks').default(0),

        // DPI-SSL (Deep Packet Inspection - SSL)
        dpiSslEnabled: boolean('dpi_ssl_enabled').notNull(),
        dpiSslCertificateStatus: varchar('dpi_ssl_certificate_status', {
            length: 20,
        }), // valid, expiring, expired
        dpiSslDailyBlocks: integer('dpi_ssl_daily_blocks').default(0),

        // ATP (Advanced Threat Protection)
        atpEnabled: boolean('atp_enabled').notNull(),
        atpLicenseStatus: varchar('atp_license_status', { length: 20 }),
        atpDailyVerdicts: integer('atp_daily_verdicts').default(0),

        // Botnet Filter
        botnetFilterEnabled: boolean('botnet_filter_enabled').notNull(),
        botnetDailyBlocks: integer('botnet_daily_blocks').default(0),

        // Application Control
        appControlEnabled: boolean('app_control_enabled').notNull(),
        appControlLicenseStatus: varchar('app_control_license_status', {
            length: 20,
        }),
        appControlDailyBlocks: integer('app_control_daily_blocks').default(0),

        // Content Filtering
        contentFilterEnabled: boolean('content_filter_enabled').notNull(),
        contentFilterLicenseStatus: varchar('content_filter_license_status', {
            length: 20,
        }),
        contentFilterDailyBlocks: integer('content_filter_daily_blocks').default(0),

        timestamp: timestamp('timestamp').defaultNow(),
    },
    (table) => ({
        deviceIdx: index('idx_security_posture_device').on(
            table.deviceId,
            sql`${table.timestamp} DESC`
        ),
        timestampIdx: index('idx_security_posture_timestamp').on(
            sql`${table.timestamp} DESC`
        ),
        // Check constraints for license status
        checkIpsLicense: check(
            'check_ips_license_status',
            sql`${table.ipsLicenseStatus} IS NULL OR ${table.ipsLicenseStatus} IN ('active', 'expiring', 'expired')`
        ),
        checkGavLicense: check(
            'check_gav_license_status',
            sql`${table.gavLicenseStatus} IS NULL OR ${table.gavLicenseStatus} IN ('active', 'expiring', 'expired')`
        ),
        checkAtpLicense: check(
            'check_atp_license_status',
            sql`${table.atpLicenseStatus} IS NULL OR ${table.atpLicenseStatus} IN ('active', 'expiring', 'expired')`
        ),
        checkAppControlLicense: check(
            'check_app_control_license_status',
            sql`${table.appControlLicenseStatus} IS NULL OR ${table.appControlLicenseStatus} IN ('active', 'expiring', 'expired')`
        ),
        checkContentFilterLicense: check(
            'check_content_filter_license_status',
            sql`${table.contentFilterLicenseStatus} IS NULL OR ${table.contentFilterLicenseStatus} IN ('active', 'expiring', 'expired')`
        ),
        checkDpiSslCert: check(
            'check_dpi_ssl_certificate_status',
            sql`${table.dpiSslCertificateStatus} IS NULL OR ${table.dpiSslCertificateStatus} IN ('valid', 'expiring', 'expired')`
        ),
        // Check constraints for non-negative counters
        checkIpsBlocks: check(
            'check_ips_daily_blocks_positive',
            sql`${table.ipsDailyBlocks} >= 0`
        ),
        checkGavBlocks: check(
            'check_gav_daily_blocks_positive',
            sql`${table.gavDailyBlocks} >= 0`
        ),
        checkDpiSslBlocks: check(
            'check_dpi_ssl_daily_blocks_positive',
            sql`${table.dpiSslDailyBlocks} >= 0`
        ),
        checkAtpVerdicts: check(
            'check_atp_daily_verdicts_positive',
            sql`${table.atpDailyVerdicts} >= 0`
        ),
        checkBotnetBlocks: check(
            'check_botnet_daily_blocks_positive',
            sql`${table.botnetDailyBlocks} >= 0`
        ),
        checkAppControlBlocks: check(
            'check_app_control_daily_blocks_positive',
            sql`${table.appControlDailyBlocks} >= 0`
        ),
        checkContentFilterBlocks: check(
            'check_content_filter_daily_blocks_positive',
            sql`${table.contentFilterDailyBlocks} >= 0`
        ),
    })
);

/**
 * Firewall Licenses Table
 * Tracks license expiration dates and generates alerts for expiring/expired licenses
 */
export const firewallLicenses = pgTable(
    'firewall_licenses',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        deviceId: uuid('device_id')
            .notNull()
            .references(() => firewallDevices.id, { onDelete: 'cascade' }),
        ipsExpiry: date('ips_expiry'),
        gavExpiry: date('gav_expiry'),
        atpExpiry: date('atp_expiry'),
        appControlExpiry: date('app_control_expiry'),
        contentFilterExpiry: date('content_filter_expiry'),
        supportExpiry: date('support_expiry'),
        licenseWarnings: jsonb('license_warnings').default([]), // ["IPS expiring in 15 days", "GAV expired"]
        timestamp: timestamp('timestamp').defaultNow(),
    },
    (table) => ({
        deviceIdx: index('idx_licenses_device').on(
            table.deviceId,
            sql`${table.timestamp} DESC`
        ),
        timestampIdx: index('idx_licenses_timestamp').on(
            sql`${table.timestamp} DESC`
        ),
        // Partial indexes for expiry date queries
        ipsExpiryIdx: index('idx_licenses_ips_expiry').on(table.ipsExpiry),
        gavExpiryIdx: index('idx_licenses_gav_expiry').on(table.gavExpiry),
        atpExpiryIdx: index('idx_licenses_atp_expiry').on(table.atpExpiry),
        appControlExpiryIdx: index('idx_licenses_app_control_expiry').on(
            table.appControlExpiry
        ),
        contentFilterExpiryIdx: index('idx_licenses_content_filter_expiry').on(
            table.contentFilterExpiry
        ),
        supportExpiryIdx: index('idx_licenses_support_expiry').on(
            table.supportExpiry
        ),
    })
);

/**
 * Firewall Config Risks Table
 * Stores configuration risk analysis results from uploaded SonicWall .exp files
 */
export const firewallConfigRisks = pgTable(
    'firewall_config_risks',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        deviceId: uuid('device_id')
            .notNull()
            .references(() => firewallDevices.id, { onDelete: 'cascade' }),
        snapshotId: uuid('snapshot_id'), // Reference to config upload event
        riskCategory: varchar('risk_category', { length: 50 }).notNull(), // network_misconfiguration, exposure_risk, etc.
        riskType: varchar('risk_type', { length: 100 }).notNull(), // ANY_ANY_RULE, OPEN_INBOUND, etc.
        severity: varchar('severity', { length: 20 }).notNull(), // critical, high, medium, low
        description: text('description').notNull(),
        remediation: text('remediation'),
        detectedAt: timestamp('detected_at').defaultNow(),
    },
    (table) => ({
        deviceIdx: index('idx_config_risks_device').on(
            table.deviceId,
            table.severity
        ),
        severityIdx: index('idx_config_risks_severity').on(table.severity),
        categoryIdx: index('idx_config_risks_category').on(table.riskCategory),
        typeIdx: index('idx_config_risks_type').on(table.riskType),
        detectedAtIdx: index('idx_config_risks_detected_at').on(
            sql`${table.detectedAt} DESC`
        ),
        snapshotIdx: index('idx_config_risks_snapshot').on(table.snapshotId),
        // Check constraints
        checkSeverity: check(
            'check_severity_valid',
            sql`${table.severity} IN ('critical', 'high', 'medium', 'low')`
        ),
        checkCategory: check(
            'check_risk_category_valid',
            sql`${table.riskCategory} IN ('network_misconfiguration', 'exposure_risk', 'security_feature_disabled', 'license_expired', 'best_practice_violation')`
        ),
    })
);

/**
 * Firewall Metrics Rollup Table
 * Stores daily aggregated metrics from SonicWall firewalls
 * Retention: 365 days
 */
export const firewallMetricsRollup = pgTable(
    'firewall_metrics_rollup',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        deviceId: uuid('device_id')
            .notNull()
            .references(() => firewallDevices.id, { onDelete: 'cascade' }),
        date: date('date').notNull(),
        threatsBlocked: integer('threats_blocked').default(0), // Sum of IPS + GAV + ATP + Botnet
        malwareBlocked: integer('malware_blocked').default(0), // GAV blocks
        ipsBlocked: integer('ips_blocked').default(0), // IPS blocks
        blockedConnections: integer('blocked_connections').default(0), // Total denied connections
        webFilterHits: integer('web_filter_hits').default(0), // Content filter blocks
        bandwidthTotalMb: bigint('bandwidth_total_mb', { mode: 'number' }).default(
            0
        ), // If available from API
        activeSessionsCount: integer('active_sessions_count').default(0), // Average or final value
        createdAt: timestamp('created_at').defaultNow(),
    },
    (table) => ({
        deviceIdx: index('idx_metrics_rollup_device').on(
            table.deviceId,
            sql`${table.date} DESC`
        ),
        dateIdx: index('idx_metrics_rollup_date').on(sql`${table.date} DESC`),
        createdAtIdx: index('idx_metrics_rollup_created_at').on(
            sql`${table.createdAt} DESC`
        ),
        // Unique constraint
        deviceDateUnique: unique('firewall_metrics_rollup_device_date_unique').on(
            table.deviceId,
            table.date
        ),
        // Check constraints for non-negative values
        checkThreatsBlocked: check(
            'check_threats_blocked_non_negative',
            sql`${table.threatsBlocked} >= 0`
        ),
        checkMalwareBlocked: check(
            'check_malware_blocked_non_negative',
            sql`${table.malwareBlocked} >= 0`
        ),
        checkIpsBlocked: check(
            'check_ips_blocked_non_negative',
            sql`${table.ipsBlocked} >= 0`
        ),
        checkBlockedConnections: check(
            'check_blocked_connections_non_negative',
            sql`${table.blockedConnections} >= 0`
        ),
        checkWebFilterHits: check(
            'check_web_filter_hits_non_negative',
            sql`${table.webFilterHits} >= 0`
        ),
        checkBandwidth: check(
            'check_bandwidth_total_mb_non_negative',
            sql`${table.bandwidthTotalMb} >= 0`
        ),
        checkActiveSessions: check(
            'check_active_sessions_count_non_negative',
            sql`${table.activeSessionsCount} >= 0`
        ),
    })
);

/**
 * Firewall Alerts Table
 * Stores alerts generated from API polling and email sources
 * Retention: 90 days
 */
export const firewallAlerts = pgTable(
    'firewall_alerts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        deviceId: uuid('device_id').references(() => firewallDevices.id, {
            onDelete: 'cascade',
        }), // Nullable for email alerts without device match
        alertType: varchar('alert_type', { length: 100 }).notNull(), // ips_counter_increase, wan_down, etc.
        severity: varchar('severity', { length: 20 }).notNull(), // critical, high, medium, low, info
        message: text('message').notNull(),
        source: varchar('source', { length: 20 }).notNull(), // api, email
        metadata: jsonb('metadata').default({}), // {"previous_value": 100, "new_value": 150}
        acknowledged: boolean('acknowledged').default(false),
        acknowledgedBy: uuid('acknowledged_by').references(() => users.id, {
            onDelete: 'set null',
        }),
        acknowledgedAt: timestamp('acknowledged_at'),
        createdAt: timestamp('created_at').defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_alerts_tenant').on(
            table.tenantId,
            sql`${table.createdAt} DESC`
        ),
        deviceIdx: index('idx_alerts_device').on(
            table.deviceId,
            sql`${table.createdAt} DESC`
        ),
        severityIdx: index('idx_alerts_severity').on(table.severity),
        acknowledgedIdx: index('idx_alerts_acknowledged').on(table.acknowledged),
        alertTypeIdx: index('idx_alerts_alert_type').on(table.alertType),
        sourceIdx: index('idx_alerts_source').on(table.source),
        createdAtIdx: index('idx_alerts_created_at').on(
            sql`${table.createdAt} DESC`
        ),
        // Check constraints
        checkSeverity: check(
            'check_severity_valid',
            sql`${table.severity} IN ('critical', 'high', 'medium', 'low', 'info')`
        ),
        checkSource: check(
            'check_source_valid',
            sql`${table.source} IN ('api', 'email')`
        ),
        checkAcknowledged: check(
            'check_acknowledged_consistency',
            sql`(${table.acknowledged} = false AND ${table.acknowledgedBy} IS NULL AND ${table.acknowledgedAt} IS NULL) OR (${table.acknowledged} = true AND ${table.acknowledgedBy} IS NOT NULL AND ${table.acknowledgedAt} IS NOT NULL)`
        ),
    })
);

// ============================================================================
// Relations
// ============================================================================

export const firewallDevicesRelations = relations(
    firewallDevices,
    ({ one, many }) => ({
        tenant: one(tenants, {
            fields: [firewallDevices.tenantId],
            references: [tenants.id],
        }),
        healthSnapshots: many(firewallHealthSnapshots),
        securityPostures: many(firewallSecurityPosture),
        licenses: many(firewallLicenses),
        configRisks: many(firewallConfigRisks),
        metricsRollups: many(firewallMetricsRollup),
        alerts: many(firewallAlerts),
    })
);

export const firewallHealthSnapshotsRelations = relations(
    firewallHealthSnapshots,
    ({ one }) => ({
        device: one(firewallDevices, {
            fields: [firewallHealthSnapshots.deviceId],
            references: [firewallDevices.id],
        }),
    })
);

export const firewallSecurityPostureRelations = relations(
    firewallSecurityPosture,
    ({ one }) => ({
        device: one(firewallDevices, {
            fields: [firewallSecurityPosture.deviceId],
            references: [firewallDevices.id],
        }),
    })
);

export const firewallLicensesRelations = relations(
    firewallLicenses,
    ({ one }) => ({
        device: one(firewallDevices, {
            fields: [firewallLicenses.deviceId],
            references: [firewallDevices.id],
        }),
    })
);

export const firewallConfigRisksRelations = relations(
    firewallConfigRisks,
    ({ one }) => ({
        device: one(firewallDevices, {
            fields: [firewallConfigRisks.deviceId],
            references: [firewallDevices.id],
        }),
    })
);

export const firewallMetricsRollupRelations = relations(
    firewallMetricsRollup,
    ({ one }) => ({
        device: one(firewallDevices, {
            fields: [firewallMetricsRollup.deviceId],
            references: [firewallDevices.id],
        }),
    })
);

export const firewallAlertsRelations = relations(
    firewallAlerts,
    ({ one }) => ({
        tenant: one(tenants, {
            fields: [firewallAlerts.tenantId],
            references: [tenants.id],
        }),
        device: one(firewallDevices, {
            fields: [firewallAlerts.deviceId],
            references: [firewallDevices.id],
        }),
        acknowledgedByUser: one(users, {
            fields: [firewallAlerts.acknowledgedBy],
            references: [users.id],
        }),
    })
);
