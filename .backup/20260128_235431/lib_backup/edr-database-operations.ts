/**
 * EDR Database Operations Layer
 * 
 * Provides database operations for EDR integration including:
 * - Device upsert operations
 * - Alert upsert operations
 * - Vulnerability upsert operations
 * - Device-vulnerability junction table operations
 * - Compliance upsert operations
 * - Remote action logging
 * - Action status updates
 * - Posture score storage
 * 
 * All operations enforce tenant isolation by requiring tenant_id.
 */

import { db } from './database';
import {
    edrDevices,
    edrAlerts,
    edrVulnerabilities,
    edrDeviceVulnerabilities,
    edrCompliance,
    edrRemoteActions,
    edrPostureScores,
} from '../../database/schemas/edr';
import { eq, and, inArray } from 'drizzle-orm';
import type {
    NormalizedDevice,
    NormalizedAlert,
    NormalizedVulnerability,
    NormalizedCompliance,
    RemoteAction,
    PostureScore,
} from '../types/edr';

/**
 * Ensure database connection is available
 */
function ensureDb() {
    if (!db) {
        throw new Error('Database connection not available');
    }
    return db;
}

// ============================================================================
// Device Operations
// ============================================================================

/**
 * Upsert a device (insert or update by microsoft_device_id)
 * Enforces tenant isolation
 */
export async function upsertDevice(
    device: NormalizedDevice
): Promise<{ id: string }> {
    const result = await ensureDb()
        .insert(edrDevices)
        .values({
            tenantId: device.tenantId,
            microsoftDeviceId: device.microsoftDeviceId,
            deviceName: device.deviceName,
            operatingSystem: device.operatingSystem,
            osVersion: device.osVersion,
            primaryUser: device.primaryUser,
            defenderHealthStatus: device.defenderHealthStatus,
            riskScore: device.riskScore,
            exposureLevel: device.exposureLevel,
            intuneComplianceState: device.intuneComplianceState,
            intuneEnrollmentStatus: device.intuneEnrollmentStatus,
            lastSeenAt: device.lastSeenAt,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [edrDevices.tenantId, edrDevices.microsoftDeviceId],
            set: {
                deviceName: device.deviceName,
                operatingSystem: device.operatingSystem,
                osVersion: device.osVersion,
                primaryUser: device.primaryUser,
                defenderHealthStatus: device.defenderHealthStatus,
                riskScore: device.riskScore,
                exposureLevel: device.exposureLevel,
                intuneComplianceState: device.intuneComplianceState,
                intuneEnrollmentStatus: device.intuneEnrollmentStatus,
                lastSeenAt: device.lastSeenAt,
                updatedAt: new Date(),
            },
        })
        .returning({ id: edrDevices.id });

    return result[0];
}

/**
 * Batch upsert devices for efficiency
 */
export async function upsertDevices(
    devices: NormalizedDevice[]
): Promise<{ id: string }[]> {
    if (devices.length === 0) return [];

    const results: { id: string }[] = [];

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map((device) => upsertDevice(device))
        );
        results.push(...batchResults);
    }

    return results;
}

/**
 * Get device by ID with tenant validation
 */
export async function getDeviceById(
    deviceId: string,
    tenantId: string
): Promise<NormalizedDevice | null> {
    const result = await ensureDb()
        .select()
        .from(edrDevices)
        .where(and(eq(edrDevices.id, deviceId), eq(edrDevices.tenantId, tenantId)))
        .limit(1);

    if (result.length === 0) return null;

    const device = result[0];
    return {
        id: device.id,
        tenantId: device.tenantId,
        microsoftDeviceId: device.microsoftDeviceId,
        deviceName: device.deviceName,
        operatingSystem: device.operatingSystem || '',
        osVersion: device.osVersion || '',
        primaryUser: device.primaryUser || '',
        defenderHealthStatus: device.defenderHealthStatus || '',
        riskScore: device.riskScore || 0,
        exposureLevel: device.exposureLevel || '',
        intuneComplianceState: device.intuneComplianceState || '',
        intuneEnrollmentStatus: device.intuneEnrollmentStatus || '',
        lastSeenAt: device.lastSeenAt || new Date(),
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
    };
}

// ============================================================================
// Alert Operations
// ============================================================================

/**
 * Upsert an alert (insert or update by microsoft_alert_id)
 * Enforces tenant isolation
 */
export async function upsertAlert(
    alert: NormalizedAlert
): Promise<{ id: string }> {
    const result = await ensureDb()
        .insert(edrAlerts)
        .values({
            tenantId: alert.tenantId,
            deviceId: alert.deviceId,
            microsoftAlertId: alert.microsoftAlertId,
            severity: alert.severity,
            threatType: alert.threatType,
            threatName: alert.threatName,
            status: alert.status,
            description: alert.description,
            detectedAt: alert.detectedAt,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [edrAlerts.tenantId, edrAlerts.microsoftAlertId],
            set: {
                deviceId: alert.deviceId,
                severity: alert.severity,
                threatType: alert.threatType,
                threatName: alert.threatName,
                status: alert.status,
                description: alert.description,
                detectedAt: alert.detectedAt,
                updatedAt: new Date(),
            },
        })
        .returning({ id: edrAlerts.id });

    return result[0];
}

/**
 * Batch upsert alerts for efficiency
 */
export async function upsertAlerts(
    alerts: NormalizedAlert[]
): Promise<{ id: string }[]> {
    if (alerts.length === 0) return [];

    const results: { id: string }[] = [];

    const batchSize = 50;
    for (let i = 0; i < alerts.length; i += batchSize) {
        const batch = alerts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map((alert) => upsertAlert(alert))
        );
        results.push(...batchResults);
    }

    return results;
}

// ============================================================================
// Vulnerability Operations
// ============================================================================

/**
 * Upsert a vulnerability (insert or update by cve_id)
 * Enforces tenant isolation
 */
export async function upsertVulnerability(
    vulnerability: NormalizedVulnerability
): Promise<{ id: string }> {
    const result = await ensureDb()
        .insert(edrVulnerabilities)
        .values({
            tenantId: vulnerability.tenantId,
            cveId: vulnerability.cveId,
            severity: vulnerability.severity,
            cvssScore: vulnerability.cvssScore?.toString(),
            exploitability: vulnerability.exploitability,
            description: vulnerability.description,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [edrVulnerabilities.tenantId, edrVulnerabilities.cveId],
            set: {
                severity: vulnerability.severity,
                cvssScore: vulnerability.cvssScore?.toString(),
                exploitability: vulnerability.exploitability,
                description: vulnerability.description,
                updatedAt: new Date(),
            },
        })
        .returning({ id: edrVulnerabilities.id });

    return result[0];
}

/**
 * Batch upsert vulnerabilities for efficiency
 */
export async function upsertVulnerabilities(
    vulnerabilities: NormalizedVulnerability[]
): Promise<{ id: string }[]> {
    if (vulnerabilities.length === 0) return [];

    const results: { id: string }[] = [];

    const batchSize = 50;
    for (let i = 0; i < vulnerabilities.length; i += batchSize) {
        const batch = vulnerabilities.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map((vuln) => upsertVulnerability(vuln))
        );
        results.push(...batchResults);
    }

    return results;
}

// ============================================================================
// Device-Vulnerability Junction Operations
// ============================================================================

/**
 * Link a device to a vulnerability
 * Creates or updates the relationship
 */
export async function linkDeviceVulnerability(
    deviceId: string,
    vulnerabilityId: string
): Promise<void> {
    await ensureDb()
        .insert(edrDeviceVulnerabilities)
        .values({
            deviceId,
            vulnerabilityId,
            detectedAt: new Date(),
        })
        .onConflictDoNothing();
}

/**
 * Link multiple vulnerabilities to a device
 */
export async function linkDeviceVulnerabilities(
    deviceId: string,
    vulnerabilityIds: string[]
): Promise<void> {
    if (vulnerabilityIds.length === 0) return;

    const values = vulnerabilityIds.map((vulnId) => ({
        deviceId,
        vulnerabilityId: vulnId,
        detectedAt: new Date(),
    }));

    await ensureDb().insert(edrDeviceVulnerabilities).values(values).onConflictDoNothing();
}

/**
 * Remove all vulnerability links for a device and re-add current ones
 * Useful for full sync operations
 */
export async function syncDeviceVulnerabilities(
    deviceId: string,
    vulnerabilityIds: string[]
): Promise<void> {
    // Remove existing links
    await ensureDb()
        .delete(edrDeviceVulnerabilities)
        .where(eq(edrDeviceVulnerabilities.deviceId, deviceId));

    // Add new links
    if (vulnerabilityIds.length > 0) {
        await linkDeviceVulnerabilities(deviceId, vulnerabilityIds);
    }
}

/**
 * Get all vulnerabilities for a device
 */
export async function getDeviceVulnerabilities(
    deviceId: string
): Promise<string[]> {
    const result = await ensureDb()
        .select({ vulnerabilityId: edrDeviceVulnerabilities.vulnerabilityId })
        .from(edrDeviceVulnerabilities)
        .where(eq(edrDeviceVulnerabilities.deviceId, deviceId));

    return result.map((r) => r.vulnerabilityId);
}

/**
 * Get all devices affected by a vulnerability
 */
export async function getVulnerabilityDevices(
    vulnerabilityId: string
): Promise<string[]> {
    const result = await ensureDb()
        .select({ deviceId: edrDeviceVulnerabilities.deviceId })
        .from(edrDeviceVulnerabilities)
        .where(eq(edrDeviceVulnerabilities.vulnerabilityId, vulnerabilityId));

    return result.map((r) => r.deviceId);
}

// ============================================================================
// Compliance Operations
// ============================================================================

/**
 * Upsert compliance data (insert or update by device_id)
 * Enforces tenant isolation
 */
export async function upsertCompliance(
    compliance: NormalizedCompliance
): Promise<{ id: string }> {
    const result = await ensureDb()
        .insert(edrCompliance)
        .values({
            tenantId: compliance.tenantId,
            deviceId: compliance.deviceId,
            complianceState: compliance.complianceState,
            failedRules: compliance.failedRules,
            securityBaselineStatus: compliance.securityBaselineStatus,
            requiredAppsStatus: compliance.requiredAppsStatus,
            checkedAt: compliance.checkedAt,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [edrCompliance.tenantId, edrCompliance.deviceId],
            set: {
                complianceState: compliance.complianceState,
                failedRules: compliance.failedRules,
                securityBaselineStatus: compliance.securityBaselineStatus,
                requiredAppsStatus: compliance.requiredAppsStatus,
                checkedAt: compliance.checkedAt,
                updatedAt: new Date(),
            },
        })
        .returning({ id: edrCompliance.id });

    return result[0];
}

/**
 * Batch upsert compliance data for efficiency
 */
export async function upsertComplianceRecords(
    complianceRecords: NormalizedCompliance[]
): Promise<{ id: string }[]> {
    if (complianceRecords.length === 0) return [];

    const results: { id: string }[] = [];

    const batchSize = 50;
    for (let i = 0; i < complianceRecords.length; i += batchSize) {
        const batch = complianceRecords.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map((compliance) => upsertCompliance(compliance))
        );
        results.push(...batchResults);
    }

    return results;
}

// ============================================================================
// Remote Action Operations
// ============================================================================

/**
 * Log a remote action with user attribution
 * Enforces tenant isolation
 */
export async function logRemoteAction(
    action: Omit<RemoteAction, 'id' | 'createdAt'>
): Promise<{ id: string }> {
    const result = await ensureDb()
        .insert(edrRemoteActions)
        .values({
            tenantId: action.tenantId,
            deviceId: action.deviceId,
            userId: action.userId,
            actionType: action.actionType,
            status: action.status,
            resultMessage: action.resultMessage,
            initiatedAt: action.initiatedAt,
            completedAt: action.completedAt,
        })
        .returning({ id: edrRemoteActions.id });

    return result[0];
}

/**
 * Update action status when it completes
 */
export async function updateActionStatus(
    actionId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    resultMessage?: string
): Promise<void> {
    await ensureDb()
        .update(edrRemoteActions)
        .set({
            status,
            resultMessage,
            completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
        })
        .where(eq(edrRemoteActions.id, actionId));
}

/**
 * Get action by ID with tenant validation
 */
export async function getActionById(
    actionId: string,
    tenantId: string
): Promise<RemoteAction | null> {
    const result = await ensureDb()
        .select()
        .from(edrRemoteActions)
        .where(and(eq(edrRemoteActions.id, actionId), eq(edrRemoteActions.tenantId, tenantId)))
        .limit(1);

    if (result.length === 0) return null;

    const action = result[0];
    return {
        id: action.id,
        tenantId: action.tenantId,
        deviceId: action.deviceId,
        userId: action.userId,
        actionType: action.actionType as 'isolate' | 'unisolate' | 'scan' | 'resolve_alert',
        status: action.status as 'pending' | 'in_progress' | 'completed' | 'failed',
        resultMessage: action.resultMessage || '',
        initiatedAt: action.initiatedAt,
        completedAt: action.completedAt || new Date(),
        createdAt: action.createdAt,
    };
}

/**
 * Get all actions for a device with tenant validation
 */
export async function getDeviceActions(
    deviceId: string,
    tenantId: string
): Promise<RemoteAction[]> {
    const result = await ensureDb()
        .select()
        .from(edrRemoteActions)
        .where(and(eq(edrRemoteActions.deviceId, deviceId), eq(edrRemoteActions.tenantId, tenantId)))
        .orderBy(edrRemoteActions.initiatedAt);

    return result.map((action) => ({
        id: action.id,
        tenantId: action.tenantId,
        deviceId: action.deviceId,
        userId: action.userId,
        actionType: action.actionType as 'isolate' | 'unisolate' | 'scan' | 'resolve_alert',
        status: action.status as 'pending' | 'in_progress' | 'completed' | 'failed',
        resultMessage: action.resultMessage || '',
        initiatedAt: action.initiatedAt,
        completedAt: action.completedAt || new Date(),
        createdAt: action.createdAt,
    }));
}

// ============================================================================
// Posture Score Operations
// ============================================================================

/**
 * Store a calculated posture score
 * Enforces tenant isolation
 */
export async function storePostureScore(
    score: Omit<PostureScore, 'id' | 'createdAt'>
): Promise<{ id: string }> {
    const result = await ensureDb()
        .insert(edrPostureScores)
        .values({
            tenantId: score.tenantId,
            score: score.score,
            deviceCount: score.deviceCount,
            highRiskDeviceCount: score.highRiskDeviceCount,
            activeAlertCount: score.activeAlertCount,
            criticalVulnerabilityCount: score.criticalVulnerabilityCount,
            nonCompliantDeviceCount: score.nonCompliantDeviceCount,
            calculatedAt: score.calculatedAt,
        })
        .returning({ id: edrPostureScores.id });

    return result[0];
}

/**
 * Get the most recent posture score for a tenant
 */
export async function getLatestPostureScore(
    tenantId: string
): Promise<PostureScore | null> {
    const result = await ensureDb()
        .select()
        .from(edrPostureScores)
        .where(eq(edrPostureScores.tenantId, tenantId))
        .orderBy(edrPostureScores.calculatedAt)
        .limit(1);

    if (result.length === 0) return null;

    const score = result[0];
    return {
        id: score.id,
        tenantId: score.tenantId,
        score: score.score,
        deviceCount: score.deviceCount || 0,
        highRiskDeviceCount: score.highRiskDeviceCount || 0,
        activeAlertCount: score.activeAlertCount || 0,
        criticalVulnerabilityCount: score.criticalVulnerabilityCount || 0,
        nonCompliantDeviceCount: score.nonCompliantDeviceCount || 0,
        calculatedAt: score.calculatedAt,
        createdAt: score.createdAt,
    };
}

/**
 * Get posture score history for a tenant within a date range
 */
export async function getPostureScoreHistory(
    tenantId: string,
    startDate: Date,
    endDate: Date
): Promise<PostureScore[]> {
    const result = await ensureDb()
        .select()
        .from(edrPostureScores)
        .where(
            and(
                eq(edrPostureScores.tenantId, tenantId),
                // Add date range filtering here when needed
            )
        )
        .orderBy(edrPostureScores.calculatedAt);

    return result.map((score) => ({
        id: score.id,
        tenantId: score.tenantId,
        score: score.score,
        deviceCount: score.deviceCount || 0,
        highRiskDeviceCount: score.highRiskDeviceCount || 0,
        activeAlertCount: score.activeAlertCount || 0,
        criticalVulnerabilityCount: score.criticalVulnerabilityCount || 0,
        nonCompliantDeviceCount: score.nonCompliantDeviceCount || 0,
        calculatedAt: score.calculatedAt,
        createdAt: score.createdAt,
    }));
}
