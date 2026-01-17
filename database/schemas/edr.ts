import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    integer,
    jsonb,
    index,
    unique,
    check,
    decimal,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users } from './main';
import { sql } from 'drizzle-orm';

// ============================================================================
// EDR Integration Tables (Microsoft Defender + Intune)
// ============================================================================

/**
 * EDR Devices Table
 * Stores endpoint devices from Microsoft Defender and Intune with merged data
 */
export const edrDevices = pgTable(
    'edr_devices',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        microsoftDeviceId: varchar('microsoft_device_id', { length: 255 }).notNull(),
        deviceName: varchar('device_name', { length: 255 }).notNull(),
        operatingSystem: varchar('operating_system', { length: 100 }),
        osVersion: varchar('os_version', { length: 100 }),
        primaryUser: varchar('primary_user', { length: 255 }),

        // Defender Data
        defenderHealthStatus: varchar('defender_health_status', { length: 50 }),
        riskScore: integer('risk_score'), // 0-100
        exposureLevel: varchar('exposure_level', { length: 50 }),

        // Intune Data
        intuneComplianceState: varchar('intune_compliance_state', { length: 50 }),
        intuneEnrollmentStatus: varchar('intune_enrollment_status', { length: 50 }),

        // Timestamps
        lastSeenAt: timestamp('last_seen_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_edr_devices_tenant').on(table.tenantId),
        riskIdx: index('idx_edr_devices_risk').on(sql`${table.riskScore} DESC`),
        complianceIdx: index('idx_edr_devices_compliance').on(
            table.intuneComplianceState
        ),
        lastSeenIdx: index('idx_edr_devices_last_seen').on(
            sql`${table.lastSeenAt} DESC`
        ),
        // Unique constraint for tenant + microsoft device ID
        tenantDeviceUnique: unique('edr_devices_tenant_microsoft_device_unique').on(
            table.tenantId,
            table.microsoftDeviceId
        ),
        // Check constraints
        checkRiskScore: check(
            'check_edr_risk_score_range',
            sql`${table.riskScore} IS NULL OR (${table.riskScore} >= 0 AND ${table.riskScore} <= 100)`
        ),
    })
);

/**
 * EDR Alerts Table
 * Stores security alerts from Microsoft Defender
 */
export const edrAlerts = pgTable(
    'edr_alerts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        deviceId: uuid('device_id').references(() => edrDevices.id, {
            onDelete: 'cascade',
        }),
        microsoftAlertId: varchar('microsoft_alert_id', { length: 255 }).notNull(),

        severity: varchar('severity', { length: 50 }).notNull(),
        threatType: varchar('threat_type', { length: 100 }),
        threatName: varchar('threat_name', { length: 255 }),
        status: varchar('status', { length: 50 }),
        description: text('description'),

        detectedAt: timestamp('detected_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_edr_alerts_tenant').on(table.tenantId),
        deviceIdx: index('idx_edr_alerts_device').on(table.deviceId),
        severityIdx: index('idx_edr_alerts_severity').on(table.severity),
        statusIdx: index('idx_edr_alerts_status').on(table.status),
        detectedIdx: index('idx_edr_alerts_detected').on(
            sql`${table.detectedAt} DESC`
        ),
        // Unique constraint for tenant + microsoft alert ID
        tenantAlertUnique: unique('edr_alerts_tenant_microsoft_alert_unique').on(
            table.tenantId,
            table.microsoftAlertId
        ),
    })
);

/**
 * EDR Vulnerabilities Table
 * Stores CVE vulnerabilities detected by Microsoft Defender
 */
export const edrVulnerabilities = pgTable(
    'edr_vulnerabilities',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        cveId: varchar('cve_id', { length: 50 }).notNull(),

        severity: varchar('severity', { length: 50 }).notNull(),
        cvssScore: decimal('cvss_score', { precision: 3, scale: 1 }),
        exploitability: varchar('exploitability', { length: 50 }),
        description: text('description'),

        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_edr_vulnerabilities_tenant').on(table.tenantId),
        severityIdx: index('idx_edr_vulnerabilities_severity').on(table.severity),
        // Unique constraint for tenant + CVE ID
        tenantCveUnique: unique('edr_vulnerabilities_tenant_cve_unique').on(
            table.tenantId,
            table.cveId
        ),
        // Check constraints
        checkCvssScore: check(
            'check_edr_cvss_score_range',
            sql`${table.cvssScore} IS NULL OR (${table.cvssScore} >= 0 AND ${table.cvssScore} <= 10)`
        ),
    })
);

/**
 * EDR Device Vulnerabilities Junction Table
 * Many-to-many relationship between devices and vulnerabilities
 */
export const edrDeviceVulnerabilities = pgTable(
    'edr_device_vulnerabilities',
    {
        deviceId: uuid('device_id')
            .notNull()
            .references(() => edrDevices.id, { onDelete: 'cascade' }),
        vulnerabilityId: uuid('vulnerability_id')
            .notNull()
            .references(() => edrVulnerabilities.id, { onDelete: 'cascade' }),
        detectedAt: timestamp('detected_at').notNull().defaultNow(),
    },
    (table) => ({
        // Composite primary key
        pk: {
            name: 'edr_device_vulnerabilities_pkey',
            columns: [table.deviceId, table.vulnerabilityId],
        },
        deviceIdx: index('idx_edr_device_vulns_device').on(table.deviceId),
        vulnIdx: index('idx_edr_device_vulns_vuln').on(table.vulnerabilityId),
    })
);

/**
 * EDR Compliance Table
 * Stores device compliance status from Microsoft Intune
 */
export const edrCompliance = pgTable(
    'edr_compliance',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        deviceId: uuid('device_id')
            .notNull()
            .references(() => edrDevices.id, { onDelete: 'cascade' }),

        complianceState: varchar('compliance_state', { length: 50 }).notNull(),
        failedRules: jsonb('failed_rules'), // Array of failed rule objects
        securityBaselineStatus: varchar('security_baseline_status', { length: 50 }),
        requiredAppsStatus: jsonb('required_apps_status'), // Array of app status objects

        checkedAt: timestamp('checked_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_edr_compliance_tenant').on(table.tenantId),
        deviceIdx: index('idx_edr_compliance_device').on(table.deviceId),
        stateIdx: index('idx_edr_compliance_state').on(table.complianceState),
        // Unique constraint for tenant + device
        tenantDeviceUnique: unique('edr_compliance_tenant_device_unique').on(
            table.tenantId,
            table.deviceId
        ),
    })
);

/**
 * EDR Remote Actions Table
 * Logs all remote actions executed on devices with user attribution
 */
export const edrRemoteActions = pgTable(
    'edr_remote_actions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        deviceId: uuid('device_id')
            .notNull()
            .references(() => edrDevices.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),

        actionType: varchar('action_type', { length: 50 }).notNull(),
        status: varchar('status', { length: 50 }).notNull(),
        resultMessage: text('result_message'),

        initiatedAt: timestamp('initiated_at').notNull().defaultNow(),
        completedAt: timestamp('completed_at'),

        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_edr_remote_actions_tenant').on(table.tenantId),
        deviceIdx: index('idx_edr_remote_actions_device').on(table.deviceId),
        userIdx: index('idx_edr_remote_actions_user').on(table.userId),
        initiatedIdx: index('idx_edr_remote_actions_initiated').on(
            sql`${table.initiatedAt} DESC`
        ),
        // Check constraints
        checkActionType: check(
            'check_edr_remote_action_type_valid',
            sql`${table.actionType} IN ('isolate', 'unisolate', 'scan', 'resolve_alert')`
        ),
        checkStatus: check(
            'check_edr_remote_action_status_valid',
            sql`${table.status} IN ('pending', 'in_progress', 'completed', 'failed')`
        ),
    })
);

/**
 * EDR Posture Scores Table
 * Stores calculated security posture scores with contributing factors
 */
export const edrPostureScores = pgTable(
    'edr_posture_scores',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),

        score: integer('score').notNull(), // 0-100
        deviceCount: integer('device_count'),
        highRiskDeviceCount: integer('high_risk_device_count'),
        activeAlertCount: integer('active_alert_count'),
        criticalVulnerabilityCount: integer('critical_vulnerability_count'),
        nonCompliantDeviceCount: integer('non_compliant_device_count'),

        calculatedAt: timestamp('calculated_at').notNull().defaultNow(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => ({
        tenantIdx: index('idx_edr_posture_tenant').on(table.tenantId),
        calculatedIdx: index('idx_edr_posture_calculated').on(
            sql`${table.calculatedAt} DESC`
        ),
        // Check constraints
        checkScore: check(
            'check_edr_posture_score_range',
            sql`${table.score} >= 0 AND ${table.score} <= 100`
        ),
        checkDeviceCount: check(
            'check_edr_device_count_non_negative',
            sql`${table.deviceCount} IS NULL OR ${table.deviceCount} >= 0`
        ),
        checkHighRiskCount: check(
            'check_edr_high_risk_count_non_negative',
            sql`${table.highRiskDeviceCount} IS NULL OR ${table.highRiskDeviceCount} >= 0`
        ),
        checkAlertCount: check(
            'check_edr_alert_count_non_negative',
            sql`${table.activeAlertCount} IS NULL OR ${table.activeAlertCount} >= 0`
        ),
        checkVulnCount: check(
            'check_edr_vuln_count_non_negative',
            sql`${table.criticalVulnerabilityCount} IS NULL OR ${table.criticalVulnerabilityCount} >= 0`
        ),
        checkNonCompliantCount: check(
            'check_edr_non_compliant_count_non_negative',
            sql`${table.nonCompliantDeviceCount} IS NULL OR ${table.nonCompliantDeviceCount} >= 0`
        ),
    })
);

// ============================================================================
// Relations
// ============================================================================

export const edrDevicesRelations = relations(edrDevices, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [edrDevices.tenantId],
        references: [tenants.id],
    }),
    alerts: many(edrAlerts),
    deviceVulnerabilities: many(edrDeviceVulnerabilities),
    compliance: one(edrCompliance),
    actions: many(edrRemoteActions),
}));

export const edrAlertsRelations = relations(edrAlerts, ({ one }) => ({
    tenant: one(tenants, {
        fields: [edrAlerts.tenantId],
        references: [tenants.id],
    }),
    device: one(edrDevices, {
        fields: [edrAlerts.deviceId],
        references: [edrDevices.id],
    }),
}));

export const edrVulnerabilitiesRelations = relations(
    edrVulnerabilities,
    ({ one, many }) => ({
        tenant: one(tenants, {
            fields: [edrVulnerabilities.tenantId],
            references: [tenants.id],
        }),
        deviceVulnerabilities: many(edrDeviceVulnerabilities),
    })
);

export const edrDeviceVulnerabilitiesRelations = relations(
    edrDeviceVulnerabilities,
    ({ one }) => ({
        device: one(edrDevices, {
            fields: [edrDeviceVulnerabilities.deviceId],
            references: [edrDevices.id],
        }),
        vulnerability: one(edrVulnerabilities, {
            fields: [edrDeviceVulnerabilities.vulnerabilityId],
            references: [edrVulnerabilities.id],
        }),
    })
);

export const edrComplianceRelations = relations(edrCompliance, ({ one }) => ({
    tenant: one(tenants, {
        fields: [edrCompliance.tenantId],
        references: [tenants.id],
    }),
    device: one(edrDevices, {
        fields: [edrCompliance.deviceId],
        references: [edrDevices.id],
    }),
}));

export const edrRemoteActionsRelations = relations(edrRemoteActions, ({ one }) => ({
    tenant: one(tenants, {
        fields: [edrRemoteActions.tenantId],
        references: [tenants.id],
    }),
    device: one(edrDevices, {
        fields: [edrRemoteActions.deviceId],
        references: [edrDevices.id],
    }),
    user: one(users, {
        fields: [edrRemoteActions.userId],
        references: [users.id],
    }),
}));

export const edrPostureScoresRelations = relations(
    edrPostureScores,
    ({ one }) => ({
        tenant: one(tenants, {
            fields: [edrPostureScores.tenantId],
            references: [tenants.id],
        }),
    })
);
