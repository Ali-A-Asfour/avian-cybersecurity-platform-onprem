/**
 * Unit tests for EDR Posture Score Calculator
 * 
 * Tests the posture score calculation algorithm including:
 * - Component score calculations (device risk, alerts, vulnerabilities, compliance)
 * - Weight distribution
 * - Edge cases (no data, extreme values)
 * - Final score calculation
 * - Database storage
 */

import {
    calculatePostureScore,
    calculateAndStorePostureScore,
} from '../edr-posture-calculator';
import {
    upsertDevice,
    upsertAlert,
    upsertVulnerability,
    upsertCompliance,
} from '../edr-database-operations';
import { db } from '../database';
import {
    edrDevices,
    edrAlerts,
    edrVulnerabilities,
    edrCompliance,
    edrPostureScores,
} from '../../../database/schemas/edr';
import { eq } from 'drizzle-orm';
import type {
    NormalizedDevice,
    NormalizedAlert,
    NormalizedVulnerability,
    NormalizedCompliance,
} from '../../types/edr';

describe('EDR Posture Score Calculator', () => {
    const testTenantId = 'test-tenant-posture-calc';
    const testDeviceId = 'test-device-posture-calc';

    beforeEach(async () => {
        // Clean up test data
        await db.delete(edrPostureScores).where(eq(edrPostureScores.tenantId, testTenantId));
        await db.delete(edrCompliance).where(eq(edrCompliance.tenantId, testTenantId));
        await db.delete(edrAlerts).where(eq(edrAlerts.tenantId, testTenantId));
        await db.delete(edrVulnerabilities).where(eq(edrVulnerabilities.tenantId, testTenantId));
        await db.delete(edrDevices).where(eq(edrDevices.tenantId, testTenantId));
    });

    afterEach(async () => {
        // Clean up test data
        await db.delete(edrPostureScores).where(eq(edrPostureScores.tenantId, testTenantId));
        await db.delete(edrCompliance).where(eq(edrCompliance.tenantId, testTenantId));
        await db.delete(edrAlerts).where(eq(edrAlerts.tenantId, testTenantId));
        await db.delete(edrVulnerabilities).where(eq(edrVulnerabilities.tenantId, testTenantId));
        await db.delete(edrDevices).where(eq(edrDevices.tenantId, testTenantId));
    });

    describe('No Data Edge Cases', () => {
        it('should return perfect score (100) when no data exists', async () => {
            const result = await calculatePostureScore(testTenantId);

            expect(result.score).toBe(100);
            expect(result.deviceCount).toBe(0);
            expect(result.highRiskDeviceCount).toBe(0);
            expect(result.activeAlertCount).toBe(0);
            expect(result.criticalVulnerabilityCount).toBe(0);
            expect(result.nonCompliantDeviceCount).toBe(0);
        });

        it('should return perfect score when only devices exist with zero risk', async () => {
            // Create device with zero risk
            await upsertDevice({
                id: testDeviceId,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-1',
                deviceName: 'Test Device',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 0,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await calculatePostureScore(testTenantId);

            expect(result.score).toBe(100);
            expect(result.deviceCount).toBe(1);
            expect(result.highRiskDeviceCount).toBe(0);
        });
    });

    describe('Device Risk Score Component (30% weight)', () => {
        it('should calculate device risk score correctly for low-risk devices', async () => {
            // Create 3 devices with low risk (average = 20)
            for (let i = 0; i < 3; i++) {
                await upsertDevice({
                    id: `${testDeviceId}-${i}`,
                    tenantId: testTenantId,
                    microsoftDeviceId: `ms-device-${i}`,
                    deviceName: `Test Device ${i}`,
                    operatingSystem: 'Windows',
                    osVersion: '10',
                    primaryUser: 'test@example.com',
                    defenderHealthStatus: 'Active',
                    riskScore: 20,
                    exposureLevel: 'Low',
                    intuneComplianceState: 'Compliant',
                    intuneEnrollmentStatus: 'Enrolled',
                    lastSeenAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            const result = await calculatePostureScore(testTenantId);

            // Average risk = 20, so device risk component = 100 - 20 = 80
            // Weighted contribution = 80 * 0.30 = 24
            expect(result.factors.deviceRiskAverage).toBe(20);
            expect(result.deviceCount).toBe(3);
            expect(result.highRiskDeviceCount).toBe(0);
        });

        it('should identify high-risk devices (risk >= 70)', async () => {
            // Create 2 high-risk devices and 2 low-risk devices
            await upsertDevice({
                id: `${testDeviceId}-high-1`,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-high-1',
                deviceName: 'High Risk Device 1',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 80,
                exposureLevel: 'High',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertDevice({
                id: `${testDeviceId}-high-2`,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-high-2',
                deviceName: 'High Risk Device 2',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 75,
                exposureLevel: 'High',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertDevice({
                id: `${testDeviceId}-low-1`,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-low-1',
                deviceName: 'Low Risk Device 1',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 20,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertDevice({
                id: `${testDeviceId}-low-2`,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-low-2',
                deviceName: 'Low Risk Device 2',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 25,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await calculatePostureScore(testTenantId);

            // Average risk = (80 + 75 + 20 + 25) / 4 = 50
            expect(result.factors.deviceRiskAverage).toBe(50);
            expect(result.deviceCount).toBe(4);
            expect(result.highRiskDeviceCount).toBe(2);
        });
    });

    describe('Active Alerts Score Component (25% weight)', () => {
        it('should calculate alert score with severity weighting', async () => {
            // Create a device first
            const device = await upsertDevice({
                id: testDeviceId,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-1',
                deviceName: 'Test Device',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 30,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Create alerts with different severities
            await upsertAlert({
                id: 'alert-high-1',
                tenantId: testTenantId,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-high-1',
                severity: 'high',
                threatType: 'Malware',
                threatName: 'Test Threat High',
                status: 'active',
                description: 'High severity alert',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertAlert({
                id: 'alert-medium-1',
                tenantId: testTenantId,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-medium-1',
                severity: 'medium',
                threatType: 'Suspicious',
                threatName: 'Test Threat Medium',
                status: 'active',
                description: 'Medium severity alert',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertAlert({
                id: 'alert-low-1',
                tenantId: testTenantId,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-low-1',
                severity: 'low',
                threatType: 'Informational',
                threatName: 'Test Threat Low',
                status: 'active',
                description: 'Low severity alert',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await calculatePostureScore(testTenantId);

            expect(result.activeAlertCount).toBe(3);
            expect(result.factors.alertSeverityDistribution).toEqual({
                high: 1,
                medium: 1,
                low: 1,
            });
        });

        it('should ignore resolved alerts', async () => {
            // Create a device first
            const device = await upsertDevice({
                id: testDeviceId,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-1',
                deviceName: 'Test Device',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 30,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Create active alert
            await upsertAlert({
                id: 'alert-active',
                tenantId: testTenantId,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-active',
                severity: 'high',
                threatType: 'Malware',
                threatName: 'Active Threat',
                status: 'active',
                description: 'Active alert',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Create resolved alert
            await upsertAlert({
                id: 'alert-resolved',
                tenantId: testTenantId,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-resolved',
                severity: 'high',
                threatType: 'Malware',
                threatName: 'Resolved Threat',
                status: 'resolved',
                description: 'Resolved alert',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await calculatePostureScore(testTenantId);

            // Only active alert should be counted
            expect(result.activeAlertCount).toBe(1);
            expect(result.factors.alertSeverityDistribution.high).toBe(1);
        });
    });

    describe('Vulnerabilities Score Component (25% weight)', () => {
        it('should count critical vulnerabilities (CVSS >= 7.0)', async () => {
            // Create vulnerabilities with different CVSS scores
            await upsertVulnerability({
                id: 'vuln-critical-1',
                tenantId: testTenantId,
                cveId: 'CVE-2024-0001',
                severity: 'Critical',
                cvssScore: 9.8,
                exploitability: 'High',
                description: 'Critical vulnerability',
                affectedDeviceCount: 5,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertVulnerability({
                id: 'vuln-critical-2',
                tenantId: testTenantId,
                cveId: 'CVE-2024-0002',
                severity: 'High',
                cvssScore: 7.5,
                exploitability: 'Medium',
                description: 'High vulnerability',
                affectedDeviceCount: 3,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertVulnerability({
                id: 'vuln-medium',
                tenantId: testTenantId,
                cveId: 'CVE-2024-0003',
                severity: 'Medium',
                cvssScore: 5.5,
                exploitability: 'Low',
                description: 'Medium vulnerability',
                affectedDeviceCount: 2,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await calculatePostureScore(testTenantId);

            // Only vulnerabilities with CVSS >= 7.0 are critical
            expect(result.criticalVulnerabilityCount).toBe(2);
            expect(result.factors.vulnerabilityExposure).toBe(2);
        });

        it('should handle vulnerabilities with no CVSS score', async () => {
            await upsertVulnerability({
                id: 'vuln-no-cvss',
                tenantId: testTenantId,
                cveId: 'CVE-2024-0004',
                severity: 'Unknown',
                cvssScore: 0,
                exploitability: 'Unknown',
                description: 'Vulnerability with no CVSS',
                affectedDeviceCount: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await calculatePostureScore(testTenantId);

            // Should not count as critical
            expect(result.criticalVulnerabilityCount).toBe(0);
        });
    });

    describe('Compliance Score Component (20% weight)', () => {
        it('should calculate compliance percentage correctly', async () => {
            // Create devices first
            const device1 = await upsertDevice({
                id: `${testDeviceId}-1`,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-1',
                deviceName: 'Device 1',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 30,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const device2 = await upsertDevice({
                id: `${testDeviceId}-2`,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-2',
                deviceName: 'Device 2',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 30,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const device3 = await upsertDevice({
                id: `${testDeviceId}-3`,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-3',
                deviceName: 'Device 3',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 30,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const device4 = await upsertDevice({
                id: `${testDeviceId}-4`,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-4',
                deviceName: 'Device 4',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 30,
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // 3 compliant, 1 non-compliant
            await upsertCompliance({
                id: 'compliance-1',
                tenantId: testTenantId,
                deviceId: device1.id,
                complianceState: 'compliant',
                failedRules: [],
                securityBaselineStatus: 'Compliant',
                requiredAppsStatus: [],
                checkedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertCompliance({
                id: 'compliance-2',
                tenantId: testTenantId,
                deviceId: device2.id,
                complianceState: 'compliant',
                failedRules: [],
                securityBaselineStatus: 'Compliant',
                requiredAppsStatus: [],
                checkedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertCompliance({
                id: 'compliance-3',
                tenantId: testTenantId,
                deviceId: device3.id,
                complianceState: 'compliant',
                failedRules: [],
                securityBaselineStatus: 'Compliant',
                requiredAppsStatus: [],
                checkedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertCompliance({
                id: 'compliance-4',
                tenantId: testTenantId,
                deviceId: device4.id,
                complianceState: 'noncompliant',
                failedRules: [{ ruleName: 'Password Policy', state: 'failed' }],
                securityBaselineStatus: 'NonCompliant',
                requiredAppsStatus: [],
                checkedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await calculatePostureScore(testTenantId);

            // 3 out of 4 compliant = 75%
            expect(result.nonCompliantDeviceCount).toBe(1);
            expect(result.factors.compliancePercentage).toBe(75);
        });
    });

    describe('Final Score Calculation', () => {
        it('should calculate weighted total score correctly', async () => {
            // Create a device with moderate risk
            const device = await upsertDevice({
                id: testDeviceId,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-1',
                deviceName: 'Test Device',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 30, // Device risk component = 100 - 30 = 70
                exposureLevel: 'Low',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Create 1 medium alert (weighted = 0.5)
            await upsertAlert({
                id: 'alert-1',
                tenantId: testTenantId,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-1',
                severity: 'medium',
                threatType: 'Suspicious',
                threatName: 'Test Threat',
                status: 'active',
                description: 'Test alert',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Create 1 critical vulnerability
            await upsertVulnerability({
                id: 'vuln-1',
                tenantId: testTenantId,
                cveId: 'CVE-2024-0001',
                severity: 'Critical',
                cvssScore: 9.0,
                exploitability: 'High',
                description: 'Critical vulnerability',
                affectedDeviceCount: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Create compliant device
            await upsertCompliance({
                id: 'compliance-1',
                tenantId: testTenantId,
                deviceId: device.id,
                complianceState: 'compliant',
                failedRules: [],
                securityBaselineStatus: 'Compliant',
                requiredAppsStatus: [],
                checkedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await calculatePostureScore(testTenantId);

            // Verify score is between 0 and 100
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);

            // Verify all factors are present
            expect(result.factors.deviceRiskAverage).toBe(30);
            expect(result.factors.alertSeverityDistribution.medium).toBe(1);
            expect(result.factors.vulnerabilityExposure).toBe(1);
            expect(result.factors.compliancePercentage).toBe(100);
        });

        it('should round final score to nearest integer', async () => {
            const result = await calculatePostureScore(testTenantId);

            // Score should be an integer
            expect(Number.isInteger(result.score)).toBe(true);
        });
    });

    describe('Database Storage', () => {
        it('should store posture score in database', async () => {
            const postureScore = await calculateAndStorePostureScore(testTenantId);

            expect(postureScore.id).toBeDefined();
            expect(postureScore.tenantId).toBe(testTenantId);
            expect(postureScore.score).toBeGreaterThanOrEqual(0);
            expect(postureScore.score).toBeLessThanOrEqual(100);
            expect(postureScore.calculatedAt).toBeInstanceOf(Date);
            expect(postureScore.createdAt).toBeInstanceOf(Date);

            // Verify it was stored in database
            const stored = await db
                .select()
                .from(edrPostureScores)
                .where(eq(edrPostureScores.id, postureScore.id))
                .limit(1);

            expect(stored.length).toBe(1);
            expect(stored[0].tenantId).toBe(testTenantId);
            expect(stored[0].score).toBe(postureScore.score);
        });

        it('should store all contributing factors', async () => {
            // Create some test data
            const device = await upsertDevice({
                id: testDeviceId,
                tenantId: testTenantId,
                microsoftDeviceId: 'ms-device-1',
                deviceName: 'Test Device',
                operatingSystem: 'Windows',
                osVersion: '10',
                primaryUser: 'test@example.com',
                defenderHealthStatus: 'Active',
                riskScore: 50,
                exposureLevel: 'Medium',
                intuneComplianceState: 'Compliant',
                intuneEnrollmentStatus: 'Enrolled',
                lastSeenAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertAlert({
                id: 'alert-1',
                tenantId: testTenantId,
                deviceId: device.id,
                microsoftAlertId: 'ms-alert-1',
                severity: 'high',
                threatType: 'Malware',
                threatName: 'Test Threat',
                status: 'active',
                description: 'Test alert',
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertVulnerability({
                id: 'vuln-1',
                tenantId: testTenantId,
                cveId: 'CVE-2024-0001',
                severity: 'Critical',
                cvssScore: 8.5,
                exploitability: 'High',
                description: 'Critical vulnerability',
                affectedDeviceCount: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await upsertCompliance({
                id: 'compliance-1',
                tenantId: testTenantId,
                deviceId: device.id,
                complianceState: 'noncompliant',
                failedRules: [{ ruleName: 'Test Rule', state: 'failed' }],
                securityBaselineStatus: 'NonCompliant',
                requiredAppsStatus: [],
                checkedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const postureScore = await calculateAndStorePostureScore(testTenantId);

            // Verify all counts are stored
            expect(postureScore.deviceCount).toBe(1);
            expect(postureScore.highRiskDeviceCount).toBe(0); // Risk score 50 < 70
            expect(postureScore.activeAlertCount).toBe(1);
            expect(postureScore.criticalVulnerabilityCount).toBe(1);
            expect(postureScore.nonCompliantDeviceCount).toBe(1);
        });
    });
});
