/**
 * Firewall Risk Storage Service
 * 
 * Handles storage and retrieval of configuration risks for firewall devices.
 * Associates risks with device_id and optional snapshot_id.
 * 
 * Requirements: 6.1-6.30, Task 4.6
 */

import { db } from '@/lib/database';
import { firewallConfigRisks } from '../../database/schemas/firewall';
import { eq, and, desc } from 'drizzle-orm';
import {
    ConfigRisk,
    FirewallConfigRisk,
    CreateConfigRiskInput,
    RiskSeverity,
} from '@/types/firewall';

/**
 * Store configuration risks for a device
 * 
 * @param deviceId - UUID of the firewall device
 * @param risks - Array of detected configuration risks
 * @param snapshotId - Optional UUID of the config upload snapshot
 * @returns Array of created risk records
 */
export async function storeConfigRisks(
    deviceId: string,
    risks: ConfigRisk[],
    snapshotId?: string | null
): Promise<FirewallConfigRisk[]> {
    if (risks.length === 0) {
        return [];
    }

    // Prepare risk records for insertion
    const riskRecords = risks.map((risk) => ({
        deviceId,
        snapshotId: snapshotId || null,
        riskCategory: risk.riskCategory,
        riskType: risk.riskType,
        severity: risk.severity,
        description: risk.description,
        remediation: risk.remediation || null,
    }));

    // Insert all risks in a single batch operation
    const insertedRisks = await db
        .insert(firewallConfigRisks)
        .values(riskRecords)
        .returning();

    return insertedRisks as FirewallConfigRisk[];
}

/**
 * Delete old risks for a device when new config is uploaded
 * 
 * This function removes all existing risks for a device to ensure
 * that only the latest configuration analysis results are stored.
 * 
 * @param deviceId - UUID of the firewall device
 * @returns Number of deleted risk records
 */
export async function deleteOldRisks(deviceId: string): Promise<number> {
    const result = await db
        .delete(firewallConfigRisks)
        .where(eq(firewallConfigRisks.deviceId, deviceId));

    return result.rowCount || 0;
}

/**
 * Delete risks associated with a specific snapshot
 * 
 * @param snapshotId - UUID of the config snapshot
 * @returns Number of deleted risk records
 */
export async function deleteRisksBySnapshot(snapshotId: string): Promise<number> {
    const result = await db
        .delete(firewallConfigRisks)
        .where(eq(firewallConfigRisks.snapshotId, snapshotId));

    return result.rowCount || 0;
}

/**
 * Get all risks for a device
 * 
 * @param deviceId - UUID of the firewall device
 * @returns Array of risk records sorted by severity and detection time
 */
export async function getRisksByDevice(
    deviceId: string
): Promise<FirewallConfigRisk[]> {
    const risks = await db
        .select()
        .from(firewallConfigRisks)
        .where(eq(firewallConfigRisks.deviceId, deviceId))
        .orderBy(desc(firewallConfigRisks.detectedAt));

    return risks as FirewallConfigRisk[];
}

/**
 * Get risks for a device filtered by severity
 * 
 * @param deviceId - UUID of the firewall device
 * @param severity - Risk severity level to filter by
 * @returns Array of risk records matching the severity
 */
export async function getRisksByDeviceAndSeverity(
    deviceId: string,
    severity: RiskSeverity
): Promise<FirewallConfigRisk[]> {
    const risks = await db
        .select()
        .from(firewallConfigRisks)
        .where(
            and(
                eq(firewallConfigRisks.deviceId, deviceId),
                eq(firewallConfigRisks.severity, severity)
            )
        )
        .orderBy(desc(firewallConfigRisks.detectedAt));

    return risks as FirewallConfigRisk[];
}

/**
 * Get risks for a specific snapshot
 * 
 * @param snapshotId - UUID of the config snapshot
 * @returns Array of risk records for the snapshot
 */
export async function getRisksBySnapshot(
    snapshotId: string
): Promise<FirewallConfigRisk[]> {
    const risks = await db
        .select()
        .from(firewallConfigRisks)
        .where(eq(firewallConfigRisks.snapshotId, snapshotId))
        .orderBy(desc(firewallConfigRisks.detectedAt));

    return risks as FirewallConfigRisk[];
}

/**
 * Store risks and replace old ones for a device
 * 
 * This is a convenience function that combines deleteOldRisks and storeConfigRisks
 * in a single operation. It ensures that only the latest configuration analysis
 * results are stored for a device.
 * 
 * @param deviceId - UUID of the firewall device
 * @param risks - Array of detected configuration risks
 * @param snapshotId - Optional UUID of the config upload snapshot
 * @returns Object containing deleted count and created risks
 */
export async function replaceDeviceRisks(
    deviceId: string,
    risks: ConfigRisk[],
    snapshotId?: string | null
): Promise<{
    deletedCount: number;
    createdRisks: FirewallConfigRisk[];
}> {
    // Delete old risks first
    const deletedCount = await deleteOldRisks(deviceId);

    // Store new risks
    const createdRisks = await storeConfigRisks(deviceId, risks, snapshotId);

    return {
        deletedCount,
        createdRisks,
    };
}

/**
 * Count risks by severity for a device
 * 
 * @param deviceId - UUID of the firewall device
 * @returns Object with counts for each severity level
 */
export async function countRisksBySeverity(deviceId: string): Promise<{
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
}> {
    const risks = await getRisksByDevice(deviceId);

    const counts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: risks.length,
    };

    for (const risk of risks) {
        switch (risk.severity) {
            case 'critical':
                counts.critical++;
                break;
            case 'high':
                counts.high++;
                break;
            case 'medium':
                counts.medium++;
                break;
            case 'low':
                counts.low++;
                break;
        }
    }

    return counts;
}

/**
 * Create a single risk record
 * 
 * This is a lower-level function for creating individual risk records.
 * For batch operations, use storeConfigRisks instead.
 * 
 * @param input - Risk creation input
 * @returns Created risk record
 */
export async function createConfigRisk(
    input: CreateConfigRiskInput
): Promise<FirewallConfigRisk> {
    const [risk] = await db
        .insert(firewallConfigRisks)
        .values({
            deviceId: input.deviceId,
            snapshotId: input.snapshotId || null,
            riskCategory: input.riskCategory,
            riskType: input.riskType,
            severity: input.severity,
            description: input.description,
            remediation: input.remediation || null,
        })
        .returning();

    return risk as FirewallConfigRisk;
}
