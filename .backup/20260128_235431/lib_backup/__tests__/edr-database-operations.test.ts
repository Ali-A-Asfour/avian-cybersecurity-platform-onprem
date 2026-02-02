/**
 * EDR Database Operations Tests
 * 
 * Tests all database operations for EDR integration including:
 * - Device upsert operations
 * - Alert upsert operations
 * - Vulnerability upsert operations
 * - Device-vulnerability junction operations
 * - Compliance upsert operations
 * - Remote action logging
 * - Posture score storage
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
    upsertDevice,
    upsertDevices,
    getDeviceById,
    upsertAlert,
    upsertAlerts,
    upsertVulnerability,
    upsertVulnerabilities,
    linkDeviceVulnerability,
    linkDeviceVulnerabilities,
    syncDeviceVulnerabilities,
    getDeviceVulnerabilities,
    getVulnerabilityDevices,
    upsertCompliance,
    upsertComplianceRecords,
    logRemoteAction,
    updateActionStatus,
    getActionById,
    getDeviceActions,
    storePostureScore,
    getLatestPostureScore,
    getPostureScoreHistory,
} from '../edr-database-operations';
import { db } from '../database';
import {
    edrDevices,
    edrAlerts,
    edrVulnerabilities,
    edrDeviceVulnerabilities,
    edrCompliance,
    edrActions,
    edrPostureScores,
} from '../../../database/schemas/edr';
import type {
    NormalizedDevice,
    NormalizedAlert,
    NormalizedVulnerability,
    NormalizedCompliance,
} from '../../types/edr';

// Test tenant IDs
const TENANT_ID_1 = '00000000-0000-0000-0000-000000000001';
const TENANT_ID_2 = '00000000-0000-0000-0000-000000000002';
const USER_ID = '00000000-0000-0000-0000-000000000003';

// Helper to clean up test data
async function cleanupTestData() {
    if (!db) return;

    await db.delete(edrPostureScores);
    await db.delete(edrActions);
    await db.delete(edrCompliance);
    await db.delete(edrDeviceVulnerabilities);
    await db.delete(edrAlerts);
    await db.delete(edrVulnerabilities);
    await db.delete(edrDevices);
}

describe('EDR Database Operations', () => {
    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    describe('Device Operations', () => {
        it('should upsert a device', async () => {
            const device: NormalizedDevice = {
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-001',
                deviceName: 'LAPTOP-001',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await upsertDevice(device);
            expect(result.id).toBeDefined();

            // Verify device was inserted
            const retrieved = await getDeviceById(result.id, TENANT_ID_1);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.deviceName).toBe('LAPTOP-001');
            expect(retrieved?.riskScore).toBe(25);
        });

        it('should update existing device on conflict', async () => {
            const device: NormalizedDevice = {
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-002',
                deviceName: 'LAPTOP-002',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 30,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Insert first time
            const result1 = await upsertDevice(device);

            // Update with same microsoft_device_id
            device.riskScore = 50;
            device.deviceName = 'LAPTOP-002-UPDATED';
            const result2 = await upsertDevice(device);

            // Should return same ID
            expect(result1.id).toBe(result2.id);

            // Verify update
            const retrieved = await getDeviceById(result1.id, TENANT_ID_1);
            expect(retrieved?.riskScore).toBe(50);
            expect(retrieved?.deviceName).toBe('LAPTOP-002-UPDATED');
        });

        it('should batch upsert devices', async () => {
            const devices: NormalizedDevice[] = Array.from({ length: 10 }, (_, i) => ({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: `ms-device-${i}`,
                deviceName: `LAPTOP-${i}`,
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: `user${i}@example.com`,
                defenderHealthStatus: 'active',
                riskScore: i * 10,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            const results = await upsertDevices(devices);
            expect(results).toHaveLength(10);
            expect(results.every((r) => r.id)).toBe(true);
        });

        it('should enforce tenant isolation', async () => {
            const device: NormalizedDevice = {
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-003',
                deviceName: 'LAPTOP-003',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await upsertDevice(device);

            // Try to retrieve with wrong tenant ID
            const retrieved = await getDeviceById(result.id, TENANT_ID_2);
            expect(retrieved).toBeNull();
        });
    });

    describe('Alert Operations', () => {
        it('should upsert an alert', async () => {
            // Create device first
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-004',
                deviceName: 'LAPTOP-004',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const alert: NormalizedAlert = {
                id: '',
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-001',
                severity: 'high',
                threatType: 'malware',
                threatName: 'Trojan.Generic',
                status: 'active',
                description: 'Malware detected',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await upsertAlert(alert);
            expect(result.id).toBeDefined();
        });

        it('should update existing alert on conflict', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-005',
                deviceName: 'LAPTOP-005',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const alert: NormalizedAlert = {
                id: '',
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-002',
                severity: 'high',
                threatType: 'malware',
                threatName: 'Trojan.Generic',
                status: 'active',
                description: 'Malware detected',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result1 = await upsertAlert(alert);

            // Update status
            alert.status = 'resolved';
            const result2 = await upsertAlert(alert);

            expect(result1.id).toBe(result2.id);
        });

        it('should batch upsert alerts', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-006',
                deviceName: 'LAPTOP-006',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const alerts: NormalizedAlert[] = Array.from({ length: 5 }, (_, i) => ({
                id: '',
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                microsoftAlertId: `ms-alert-${i}`,
                severity: 'high',
                threatType: 'malware',
                threatName: `Threat-${i}`,
                status: 'active',
                description: `Alert ${i}`,
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            const results = await upsertAlerts(alerts);
            expect(results).toHaveLength(5);
        });
    });

    describe('Vulnerability Operations', () => {
        it('should upsert a vulnerability', async () => {
            const vulnerability: NormalizedVulnerability = {
                id: '',
                tenantId: TENANT_ID_1,
                cveId: 'CVE-2024-0001',
                severity: 'critical',
                cvssScore: 9.8,
                exploitability: 'high',
                description: 'Remote code execution',
                affectedDeviceCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await upsertVulnerability(vulnerability);
            expect(result.id).toBeDefined();
        });

        it('should link device to vulnerability', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-007',
                deviceName: 'LAPTOP-007',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const vulnerability = await upsertVulnerability({
                id: '',
                tenantId: TENANT_ID_1,
                cveId: 'CVE-2024-0002',
                severity: 'high',
                cvssScore: 8.5,
                exploitability: 'medium',
                description: 'Privilege escalation',
                affectedDeviceCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await linkDeviceVulnerability(device.id, vulnerability.id);

            const deviceVulns = await getDeviceVulnerabilities(device.id);
            expect(deviceVulns).toContain(vulnerability.id);

            const vulnDevices = await getVulnerabilityDevices(vulnerability.id);
            expect(vulnDevices).toContain(device.id);
        });

        it('should sync device vulnerabilities', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-008',
                deviceName: 'LAPTOP-008',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const vuln1 = await upsertVulnerability({
                id: '',
                tenantId: TENANT_ID_1,
                cveId: 'CVE-2024-0003',
                severity: 'high',
                cvssScore: 8.0,
                exploitability: 'medium',
                description: 'Vuln 1',
                affectedDeviceCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const vuln2 = await upsertVulnerability({
                id: '',
                tenantId: TENANT_ID_1,
                cveId: 'CVE-2024-0004',
                severity: 'medium',
                cvssScore: 6.5,
                exploitability: 'low',
                description: 'Vuln 2',
                affectedDeviceCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Initial sync
            await syncDeviceVulnerabilities(device.id, [vuln1.id, vuln2.id]);
            let deviceVulns = await getDeviceVulnerabilities(device.id);
            expect(deviceVulns).toHaveLength(2);

            // Sync with only vuln2
            await syncDeviceVulnerabilities(device.id, [vuln2.id]);
            deviceVulns = await getDeviceVulnerabilities(device.id);
            expect(deviceVulns).toHaveLength(1);
            expect(deviceVulns).toContain(vuln2.id);
        });
    });

    describe('Compliance Operations', () => {
        it('should upsert compliance data', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-009',
                deviceName: 'LAPTOP-009',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const compliance: NormalizedCompliance = {
                id: '',
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                complianceState: 'noncompliant',
                failedRules: [
                    { ruleName: 'BitLocker', state: 'failed' },
                    { ruleName: 'Firewall', state: 'failed' },
                ],
                securityBaselineStatus: 'noncompliant',
                requiredAppsStatus: [
                    { appName: 'Antivirus', installed: true },
                    { appName: 'VPN', installed: false },
                ],
                checkedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await upsertCompliance(compliance);
            expect(result.id).toBeDefined();
        });

        it('should update existing compliance on conflict', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-010',
                deviceName: 'LAPTOP-010',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const compliance: NormalizedCompliance = {
                id: '',
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                complianceState: 'noncompliant',
                failedRules: [],
                securityBaselineStatus: 'noncompliant',
                requiredAppsStatus: [],
                checkedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result1 = await upsertCompliance(compliance);

            // Update to compliant
            compliance.complianceState = 'compliant';
            const result2 = await upsertCompliance(compliance);

            expect(result1.id).toBe(result2.id);
        });
    });

    describe('Remote Action Operations', () => {
        it('should log a remote action', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-011',
                deviceName: 'LAPTOP-011',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const action = {
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                userId: USER_ID,
                actionType: 'isolate' as const,
                status: 'pending' as const,
                resultMessage: '',
                initiatedAt: new Date(),
                completedAt: new Date(),
            };

            const result = await logRemoteAction(action);
            expect(result.id).toBeDefined();

            const retrieved = await getActionById(result.id, TENANT_ID_1);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.actionType).toBe('isolate');
            expect(retrieved?.status).toBe('pending');
        });

        it('should update action status', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-012',
                deviceName: 'LAPTOP-012',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const action = {
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                userId: USER_ID,
                actionType: 'scan' as const,
                status: 'pending' as const,
                resultMessage: '',
                initiatedAt: new Date(),
                completedAt: new Date(),
            };

            const result = await logRemoteAction(action);

            await updateActionStatus(result.id, 'completed', 'Scan completed successfully');

            const retrieved = await getActionById(result.id, TENANT_ID_1);
            expect(retrieved?.status).toBe('completed');
            expect(retrieved?.resultMessage).toBe('Scan completed successfully');
        });

        it('should get device actions', async () => {
            const device = await upsertDevice({
                id: '',
                tenantId: TENANT_ID_1,
                microsoftDeviceId: 'ms-device-013',
                deviceName: 'LAPTOP-013',
                operatingSystem: 'Windows 11',
                osVersion: '22H2',
                primaryUser: 'user@example.com',
                defenderHealthStatus: 'active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'compliant',
                intuneEnrollmentStatus: 'enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Log multiple actions
            await logRemoteAction({
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                userId: USER_ID,
                actionType: 'isolate',
                status: 'completed',
                resultMessage: '',
                initiatedAt: new Date(),
                completedAt: new Date(),
            });

            await logRemoteAction({
                tenantId: TENANT_ID_1,
                deviceId: device.id,
                userId: USER_ID,
                actionType: 'scan',
                status: 'pending',
                resultMessage: '',
                initiatedAt: new Date(),
                completedAt: new Date(),
            });

            const actions = await getDeviceActions(device.id, TENANT_ID_1);
            expect(actions).toHaveLength(2);
        });
    });

    describe('Posture Score Operations', () => {
        it('should store a posture score', async () => {
            const score = {
                tenantId: TENANT_ID_1,
                score: 75,
                deviceCount: 100,
                highRiskDeviceCount: 5,
                activeAlertCount: 12,
                criticalVulnerabilityCount: 3,
                nonCompliantDeviceCount: 8,
                calculatedAt: new Date(),
            };

            const result = await storePostureScore(score);
            expect(result.id).toBeDefined();

            const retrieved = await getLatestPostureScore(TENANT_ID_1);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.score).toBe(75);
            expect(retrieved?.deviceCount).toBe(100);
        });

        it('should get latest posture score', async () => {
            // Store multiple scores
            await storePostureScore({
                tenantId: TENANT_ID_1,
                score: 70,
                deviceCount: 100,
                highRiskDeviceCount: 10,
                activeAlertCount: 15,
                criticalVulnerabilityCount: 5,
                nonCompliantDeviceCount: 12,
                calculatedAt: new Date(Date.now() - 86400000), // 1 day ago
            });

            await storePostureScore({
                tenantId: TENANT_ID_1,
                score: 80,
                deviceCount: 100,
                highRiskDeviceCount: 5,
                activeAlertCount: 10,
                criticalVulnerabilityCount: 2,
                nonCompliantDeviceCount: 6,
                calculatedAt: new Date(), // Now
            });

            const latest = await getLatestPostureScore(TENANT_ID_1);
            expect(latest?.score).toBe(80);
        });

        it('should get posture score history', async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 86400000);
            const twoDaysAgo = new Date(now.getTime() - 172800000);

            await storePostureScore({
                tenantId: TENANT_ID_1,
                score: 70,
                deviceCount: 100,
                highRiskDeviceCount: 10,
                activeAlertCount: 15,
                criticalVulnerabilityCount: 5,
                nonCompliantDeviceCount: 12,
                calculatedAt: twoDaysAgo,
            });

            await storePostureScore({
                tenantId: TENANT_ID_1,
                score: 75,
                deviceCount: 100,
                highRiskDeviceCount: 8,
                activeAlertCount: 12,
                criticalVulnerabilityCount: 4,
                nonCompliantDeviceCount: 10,
                calculatedAt: yesterday,
            });

            await storePostureScore({
                tenantId: TENANT_ID_1,
                score: 80,
                deviceCount: 100,
                highRiskDeviceCount: 5,
                activeAlertCount: 10,
                criticalVulnerabilityCount: 2,
                nonCompliantDeviceCount: 6,
                calculatedAt: now,
            });

            const history = await getPostureScoreHistory(
                TENANT_ID_1,
                twoDaysAgo,
                now
            );

            expect(history).toHaveLength(3);
            expect(history[0].score).toBe(70);
            expect(history[1].score).toBe(75);
            expect(history[2].score).toBe(80);
        });
    });
});
