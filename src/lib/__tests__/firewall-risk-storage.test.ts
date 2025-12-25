/**
 * Tests for Firewall Risk Storage Service
 * 
 * Tests the storage, retrieval, and management of configuration risks
 * for firewall devices with device_id and snapshot_id associations.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
    storeConfigRisks,
    deleteOldRisks,
    deleteRisksBySnapshot,
    getRisksByDevice,
    getRisksByDeviceAndSeverity,
    getRisksBySnapshot,
    replaceDeviceRisks,
    countRisksBySeverity,
    createConfigRisk,
} from '../firewall-risk-storage';
import { db } from '../database';
import { firewallDevices, firewallConfigRisks } from '../../../database/schemas/firewall';
import { tenants } from '../../../database/schemas/main';
import { ConfigRisk } from '@/types/firewall';
import { eq } from 'drizzle-orm';

describe('Firewall Risk Storage', () => {
    let testTenantId: string;
    let testDeviceId: string;
    let testSnapshotId: string;

    // Sample risks for testing
    const sampleRisks: ConfigRisk[] = [
        {
            riskCategory: 'exposure_risk',
            riskType: 'OPEN_INBOUND',
            severity: 'critical',
            description: 'Unrestricted WAN to LAN access rule detected',
            remediation: 'Restrict the destination address to specific hosts or networks.',
        },
        {
            riskCategory: 'network_misconfiguration',
            riskType: 'ANY_ANY_RULE',
            severity: 'high',
            description: 'Overly permissive any-to-any rule detected',
            remediation: 'Replace any-to-any rules with specific source/destination rules.',
        },
        {
            riskCategory: 'security_feature_disabled',
            riskType: 'IPS_DISABLED',
            severity: 'critical',
            description: 'Intrusion Prevention System is disabled',
            remediation: 'Enable Intrusion Prevention System (IPS).',
        },
        {
            riskCategory: 'best_practice_violation',
            riskType: 'ADMIN_NO_MFA',
            severity: 'high',
            description: 'Multi-factor authentication not enabled for admin accounts',
            remediation: 'Enable multi-factor authentication (MFA) for all admin accounts.',
        },
        {
            riskCategory: 'best_practice_violation',
            riskType: 'RULE_NO_DESCRIPTION',
            severity: 'low',
            description: 'Firewall rule missing description',
            remediation: 'Add a description to firewall rules.',
        },
    ];

    beforeEach(async () => {
        // Create a test tenant
        const [tenant] = await db
            .insert(tenants)
            .values({
                name: 'Test Tenant for Risk Storage',
                slug: `test-risk-storage-${Date.now()}`,
            })
            .returning();
        testTenantId = tenant.id;

        // Create a test device
        const [device] = await db
            .insert(firewallDevices)
            .values({
                tenantId: testTenantId,
                managementIp: '192.168.1.1',
                model: 'TZ400',
                firmwareVersion: '7.0.1-5050',
                serialNumber: `TEST-${Date.now()}`,
            })
            .returning();
        testDeviceId = device.id;

        // Generate a test snapshot ID (UUID v4 format)
        testSnapshotId = crypto.randomUUID();
    });

    afterEach(async () => {
        // Clean up test data
        if (testDeviceId) {
            await db
                .delete(firewallConfigRisks)
                .where(eq(firewallConfigRisks.deviceId, testDeviceId));
            await db
                .delete(firewallDevices)
                .where(eq(firewallDevices.id, testDeviceId));
        }
        if (testTenantId) {
            await db.delete(tenants).where(eq(tenants.id, testTenantId));
        }
    });

    describe('storeConfigRisks', () => {
        it('should store risks with device_id only', async () => {
            const createdRisks = await storeConfigRisks(testDeviceId, sampleRisks);

            expect(createdRisks).toHaveLength(sampleRisks.length);
            expect(createdRisks[0].deviceId).toBe(testDeviceId);
            expect(createdRisks[0].snapshotId).toBeNull();
            expect(createdRisks[0].riskCategory).toBe('exposure_risk');
            expect(createdRisks[0].riskType).toBe('OPEN_INBOUND');
            expect(createdRisks[0].severity).toBe('critical');
        });

        it('should store risks with device_id and snapshot_id', async () => {
            const createdRisks = await storeConfigRisks(
                testDeviceId,
                sampleRisks,
                testSnapshotId
            );

            expect(createdRisks).toHaveLength(sampleRisks.length);
            expect(createdRisks[0].deviceId).toBe(testDeviceId);
            expect(createdRisks[0].snapshotId).toBe(testSnapshotId);
        });

        it('should return empty array when no risks provided', async () => {
            const createdRisks = await storeConfigRisks(testDeviceId, []);

            expect(createdRisks).toHaveLength(0);
        });

        it('should store all risk fields correctly', async () => {
            const createdRisks = await storeConfigRisks(
                testDeviceId,
                [sampleRisks[0]],
                testSnapshotId
            );

            const risk = createdRisks[0];
            expect(risk.id).toBeDefined();
            expect(risk.deviceId).toBe(testDeviceId);
            expect(risk.snapshotId).toBe(testSnapshotId);
            expect(risk.riskCategory).toBe('exposure_risk');
            expect(risk.riskType).toBe('OPEN_INBOUND');
            expect(risk.severity).toBe('critical');
            expect(risk.description).toBe('Unrestricted WAN to LAN access rule detected');
            expect(risk.remediation).toBe(
                'Restrict the destination address to specific hosts or networks.'
            );
            expect(risk.detectedAt).toBeInstanceOf(Date);
        });
    });

    describe('deleteOldRisks', () => {
        it('should delete all risks for a device', async () => {
            // Store some risks
            await storeConfigRisks(testDeviceId, sampleRisks);

            // Verify risks were stored
            let risks = await getRisksByDevice(testDeviceId);
            expect(risks).toHaveLength(sampleRisks.length);

            // Delete old risks
            const deletedCount = await deleteOldRisks(testDeviceId);
            expect(deletedCount).toBe(sampleRisks.length);

            // Verify risks were deleted
            risks = await getRisksByDevice(testDeviceId);
            expect(risks).toHaveLength(0);
        });

        it('should return 0 when no risks exist', async () => {
            const deletedCount = await deleteOldRisks(testDeviceId);
            expect(deletedCount).toBe(0);
        });
    });

    describe('deleteRisksBySnapshot', () => {
        it('should delete only risks for a specific snapshot', async () => {
            const snapshot1 = crypto.randomUUID();
            const snapshot2 = crypto.randomUUID();

            // Store risks for two different snapshots
            await storeConfigRisks(testDeviceId, [sampleRisks[0]], snapshot1);
            await storeConfigRisks(testDeviceId, [sampleRisks[1]], snapshot2);

            // Delete risks for snapshot1
            const deletedCount = await deleteRisksBySnapshot(snapshot1);
            expect(deletedCount).toBe(1);

            // Verify only snapshot1 risks were deleted
            const snapshot1Risks = await getRisksBySnapshot(snapshot1);
            expect(snapshot1Risks).toHaveLength(0);

            const snapshot2Risks = await getRisksBySnapshot(snapshot2);
            expect(snapshot2Risks).toHaveLength(1);
        });
    });

    describe('getRisksByDevice', () => {
        it('should retrieve all risks for a device', async () => {
            await storeConfigRisks(testDeviceId, sampleRisks);

            const risks = await getRisksByDevice(testDeviceId);

            expect(risks).toHaveLength(sampleRisks.length);
            expect(risks[0].deviceId).toBe(testDeviceId);
        });

        it('should return empty array when no risks exist', async () => {
            const risks = await getRisksByDevice(testDeviceId);
            expect(risks).toHaveLength(0);
        });

        it('should order risks by detection time descending', async () => {
            // Store risks one at a time with slight delay
            await storeConfigRisks(testDeviceId, [sampleRisks[0]]);
            await new Promise((resolve) => setTimeout(resolve, 10));
            await storeConfigRisks(testDeviceId, [sampleRisks[1]]);

            const risks = await getRisksByDevice(testDeviceId);

            // Most recent risk should be first
            expect(risks[0].riskType).toBe('ANY_ANY_RULE');
            expect(risks[1].riskType).toBe('OPEN_INBOUND');
        });
    });

    describe('getRisksByDeviceAndSeverity', () => {
        it('should filter risks by severity', async () => {
            await storeConfigRisks(testDeviceId, sampleRisks);

            const criticalRisks = await getRisksByDeviceAndSeverity(
                testDeviceId,
                'critical'
            );
            const highRisks = await getRisksByDeviceAndSeverity(testDeviceId, 'high');
            const lowRisks = await getRisksByDeviceAndSeverity(testDeviceId, 'low');

            expect(criticalRisks).toHaveLength(2); // OPEN_INBOUND, IPS_DISABLED
            expect(highRisks).toHaveLength(2); // ANY_ANY_RULE, ADMIN_NO_MFA
            expect(lowRisks).toHaveLength(1); // RULE_NO_DESCRIPTION

            expect(criticalRisks.every((r) => r.severity === 'critical')).toBe(true);
            expect(highRisks.every((r) => r.severity === 'high')).toBe(true);
            expect(lowRisks.every((r) => r.severity === 'low')).toBe(true);
        });

        it('should return empty array when no risks match severity', async () => {
            await storeConfigRisks(testDeviceId, [sampleRisks[4]]); // Only low severity

            const criticalRisks = await getRisksByDeviceAndSeverity(
                testDeviceId,
                'critical'
            );
            expect(criticalRisks).toHaveLength(0);
        });
    });

    describe('getRisksBySnapshot', () => {
        it('should retrieve risks for a specific snapshot', async () => {
            await storeConfigRisks(testDeviceId, sampleRisks, testSnapshotId);

            const risks = await getRisksBySnapshot(testSnapshotId);

            expect(risks).toHaveLength(sampleRisks.length);
            expect(risks.every((r) => r.snapshotId === testSnapshotId)).toBe(true);
        });

        it('should return empty array when snapshot has no risks', async () => {
            const risks = await getRisksBySnapshot(crypto.randomUUID());
            expect(risks).toHaveLength(0);
        });
    });

    describe('replaceDeviceRisks', () => {
        it('should delete old risks and store new ones', async () => {
            // Store initial risks
            await storeConfigRisks(testDeviceId, [sampleRisks[0], sampleRisks[1]]);

            // Replace with new risks
            const result = await replaceDeviceRisks(testDeviceId, [
                sampleRisks[2],
                sampleRisks[3],
                sampleRisks[4],
            ]);

            expect(result.deletedCount).toBe(2);
            expect(result.createdRisks).toHaveLength(3);

            // Verify only new risks exist
            const risks = await getRisksByDevice(testDeviceId);
            expect(risks).toHaveLength(3);
            expect(risks.some((r) => r.riskType === 'OPEN_INBOUND')).toBe(false);
            expect(risks.some((r) => r.riskType === 'IPS_DISABLED')).toBe(true);
        });

        it('should associate new risks with snapshot_id', async () => {
            const result = await replaceDeviceRisks(
                testDeviceId,
                sampleRisks,
                testSnapshotId
            );

            expect(result.createdRisks.every((r) => r.snapshotId === testSnapshotId)).toBe(
                true
            );
        });
    });

    describe('countRisksBySeverity', () => {
        it('should count risks by severity correctly', async () => {
            await storeConfigRisks(testDeviceId, sampleRisks);

            const counts = await countRisksBySeverity(testDeviceId);

            expect(counts.critical).toBe(2); // OPEN_INBOUND, IPS_DISABLED
            expect(counts.high).toBe(2); // ANY_ANY_RULE, ADMIN_NO_MFA
            expect(counts.medium).toBe(0);
            expect(counts.low).toBe(1); // RULE_NO_DESCRIPTION
            expect(counts.total).toBe(5);
        });

        it('should return zero counts when no risks exist', async () => {
            const counts = await countRisksBySeverity(testDeviceId);

            expect(counts.critical).toBe(0);
            expect(counts.high).toBe(0);
            expect(counts.medium).toBe(0);
            expect(counts.low).toBe(0);
            expect(counts.total).toBe(0);
        });
    });

    describe('createConfigRisk', () => {
        it('should create a single risk record', async () => {
            const risk = await createConfigRisk({
                deviceId: testDeviceId,
                snapshotId: testSnapshotId,
                riskCategory: 'exposure_risk',
                riskType: 'OPEN_INBOUND',
                severity: 'critical',
                description: 'Test risk',
                remediation: 'Test remediation',
            });

            expect(risk.id).toBeDefined();
            expect(risk.deviceId).toBe(testDeviceId);
            expect(risk.snapshotId).toBe(testSnapshotId);
            expect(risk.riskType).toBe('OPEN_INBOUND');
        });

        it('should create risk without snapshot_id', async () => {
            const risk = await createConfigRisk({
                deviceId: testDeviceId,
                riskCategory: 'exposure_risk',
                riskType: 'OPEN_INBOUND',
                severity: 'critical',
                description: 'Test risk',
            });

            expect(risk.snapshotId).toBeNull();
        });
    });

    describe('Integration: Config Upload Workflow', () => {
        it('should handle complete config upload workflow', async () => {
            const snapshot1 = crypto.randomUUID();
            const snapshot2 = crypto.randomUUID();

            // First config upload
            await storeConfigRisks(testDeviceId, [sampleRisks[0], sampleRisks[1]], snapshot1);

            let risks = await getRisksByDevice(testDeviceId);
            expect(risks).toHaveLength(2);

            // Second config upload - replace old risks
            const result = await replaceDeviceRisks(
                testDeviceId,
                [sampleRisks[2], sampleRisks[3], sampleRisks[4]],
                snapshot2
            );

            expect(result.deletedCount).toBe(2);
            expect(result.createdRisks).toHaveLength(3);

            // Verify new risks are associated with snapshot2
            risks = await getRisksByDevice(testDeviceId);
            expect(risks).toHaveLength(3);
            expect(risks.every((r) => r.snapshotId === snapshot2)).toBe(true);

            // Verify old snapshot has no risks
            const snapshot1Risks = await getRisksBySnapshot(snapshot1);
            expect(snapshot1Risks).toHaveLength(0);
        });
    });
});
