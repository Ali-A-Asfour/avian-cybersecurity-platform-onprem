/**
 * Tests for EDR Data Normalization Layer
 * 
 * Validates device normalization, merging, alert/vulnerability/compliance normalization,
 * and posture score calculation.
 */

import {
    normalizeDevice,
    mergeDevices,
    normalizeAlert,
    normalizeVulnerability,
    normalizeCompliance,
    calculatePostureScore,
    calculatePostureFactors,
    mapRiskLevel,
    mapSeverity,
    validateNormalizedDevice,
    validateNormalizedAlert,
    validateNormalizedVulnerability,
    validateNormalizedCompliance,
} from '../edr-normalizer';

import {
    DefenderDevice,
    IntuneDevice,
    DefenderAlert,
    Vulnerability,
    ComplianceStatus,
} from '@/types/edr';

describe('EDR Normalizer', () => {
    const testTenantId = '550e8400-e29b-41d4-a716-446655440000';
    const testDeviceId = '660e8400-e29b-41d4-a716-446655440001';

    describe('normalizeDevice', () => {
        it('should normalize a Defender device without Intune data', () => {
            const defenderDevice: DefenderDevice = {
                id: 'defender-123',
                computerDnsName: 'DESKTOP-ABC123',
                osPlatform: 'Windows10',
                osVersion: '10.0.19044',
                lastSeen: '2024-01-15T10:30:00Z',
                healthStatus: 'Active',
                riskScore: 45,
                exposureLevel: 'Medium',
            };

            const normalized = normalizeDevice(defenderDevice, testTenantId);

            expect(normalized.tenantId).toBe(testTenantId);
            expect(normalized.microsoftDeviceId).toBe('defender-123');
            expect(normalized.deviceName).toBe('DESKTOP-ABC123');
            expect(normalized.operatingSystem).toBe('Windows10');
            expect(normalized.osVersion).toBe('10.0.19044');
            expect(normalized.defenderHealthStatus).toBe('Active');
            expect(normalized.riskScore).toBe(45);
            expect(normalized.exposureLevel).toBe('Medium');
            expect(normalized.primaryUser).toBe('Unknown');
            expect(normalized.intuneComplianceState).toBe('Unknown');
            expect(normalized.lastSeenAt).toBeInstanceOf(Date);
        });

        it('should normalize a Defender device with Intune data', () => {
            const defenderDevice: DefenderDevice = {
                id: 'defender-123',
                computerDnsName: 'DESKTOP-ABC123',
                osPlatform: 'Windows10',
                osVersion: '10.0.19044',
                lastSeen: '2024-01-15T10:30:00Z',
                healthStatus: 'Active',
                riskScore: 45,
                exposureLevel: 'Medium',
            };

            const intuneDevice: IntuneDevice = {
                id: 'intune-123',
                deviceName: 'DESKTOP-ABC123',
                operatingSystem: 'Windows',
                osVersion: '10.0.19044',
                userPrincipalName: 'user@example.com',
                complianceState: 'compliant',
                enrollmentType: 'AzureDomainJoined',
                lastSyncDateTime: '2024-01-15T10:25:00Z',
            };

            const normalized = normalizeDevice(defenderDevice, testTenantId, intuneDevice);

            expect(normalized.primaryUser).toBe('user@example.com');
            expect(normalized.intuneComplianceState).toBe('compliant');
            expect(normalized.intuneEnrollmentStatus).toBe('AzureDomainJoined');
        });

        it('should handle missing fields with defaults', () => {
            const defenderDevice: DefenderDevice = {
                id: 'defender-123',
                computerDnsName: '',
                osPlatform: '',
                osVersion: '',
                lastSeen: '',
                healthStatus: '',
                riskScore: 0,
                exposureLevel: '',
            };

            const normalized = normalizeDevice(defenderDevice, testTenantId);

            expect(normalized.deviceName).toBe('Unknown Device');
            expect(normalized.operatingSystem).toBe('Unknown');
            expect(normalized.osVersion).toBe('Unknown');
            expect(normalized.defenderHealthStatus).toBe('Unknown');
            expect(normalized.exposureLevel).toBe('None');
        });

        it('should map exposure level to risk score when riskScore is missing', () => {
            const defenderDevice: DefenderDevice = {
                id: 'defender-123',
                computerDnsName: 'DESKTOP-ABC123',
                osPlatform: 'Windows10',
                osVersion: '10.0.19044',
                lastSeen: '2024-01-15T10:30:00Z',
                healthStatus: 'Active',
                riskScore: 0, // Explicitly 0 means no risk
                exposureLevel: 'None',
            };

            const normalized = normalizeDevice(defenderDevice, testTenantId);

            expect(normalized.riskScore).toBe(0); // Explicit 0 is preserved
        });

        it('should use exposure level when riskScore is undefined', () => {
            // Create a device without riskScore property
            const defenderDevice = {
                id: 'defender-123',
                computerDnsName: 'DESKTOP-ABC123',
                osPlatform: 'Windows10',
                osVersion: '10.0.19044',
                lastSeen: '2024-01-15T10:30:00Z',
                healthStatus: 'Active',
                exposureLevel: 'High',
            } as DefenderDevice;

            const normalized = normalizeDevice(defenderDevice, testTenantId);

            expect(normalized.riskScore).toBe(75); // High exposure = 75
        });
    });

    describe('mergeDevices', () => {
        it('should merge Defender and Intune devices by Azure AD Device ID', () => {
            const defenderDevices: DefenderDevice[] = [
                {
                    id: 'azure-device-123',
                    computerDnsName: 'DESKTOP-ABC123',
                    osPlatform: 'Windows10',
                    osVersion: '10.0.19044',
                    lastSeen: '2024-01-15T10:30:00Z',
                    healthStatus: 'Active',
                    riskScore: 45,
                    exposureLevel: 'Medium',
                },
            ];

            const intuneDevices: IntuneDevice[] = [
                {
                    id: 'intune-123',
                    azureADDeviceId: 'azure-device-123',
                    deviceName: 'DESKTOP-ABC123',
                    operatingSystem: 'Windows',
                    osVersion: '10.0.19044',
                    userPrincipalName: 'user@example.com',
                    complianceState: 'compliant',
                    enrollmentType: 'AzureDomainJoined',
                    lastSyncDateTime: '2024-01-15T10:25:00Z',
                },
            ];

            const merged = mergeDevices(defenderDevices, intuneDevices, testTenantId);

            expect(merged).toHaveLength(1);
            expect(merged[0].primaryUser).toBe('user@example.com');
            expect(merged[0].intuneComplianceState).toBe('compliant');
        });

        it('should merge Defender and Intune devices by hostname', () => {
            const defenderDevices: DefenderDevice[] = [
                {
                    id: 'defender-123',
                    computerDnsName: 'DESKTOP-ABC123',
                    osPlatform: 'Windows10',
                    osVersion: '10.0.19044',
                    lastSeen: '2024-01-15T10:30:00Z',
                    healthStatus: 'Active',
                    riskScore: 45,
                    exposureLevel: 'Medium',
                },
            ];

            const intuneDevices: IntuneDevice[] = [
                {
                    id: 'intune-123',
                    deviceName: 'desktop-abc123', // Case-insensitive match
                    operatingSystem: 'Windows',
                    osVersion: '10.0.19044',
                    userPrincipalName: 'user@example.com',
                    complianceState: 'compliant',
                    enrollmentType: 'AzureDomainJoined',
                    lastSyncDateTime: '2024-01-15T10:25:00Z',
                },
            ];

            const merged = mergeDevices(defenderDevices, intuneDevices, testTenantId);

            expect(merged).toHaveLength(1);
            expect(merged[0].primaryUser).toBe('user@example.com');
        });

        it('should include unmatched Intune devices', () => {
            const defenderDevices: DefenderDevice[] = [
                {
                    id: 'defender-123',
                    computerDnsName: 'DESKTOP-ABC123',
                    osPlatform: 'Windows10',
                    osVersion: '10.0.19044',
                    lastSeen: '2024-01-15T10:30:00Z',
                    healthStatus: 'Active',
                    riskScore: 45,
                    exposureLevel: 'Medium',
                },
            ];

            const intuneDevices: IntuneDevice[] = [
                {
                    id: 'intune-456',
                    deviceName: 'DESKTOP-XYZ789',
                    operatingSystem: 'Windows',
                    osVersion: '10.0.19044',
                    userPrincipalName: 'user2@example.com',
                    complianceState: 'compliant',
                    enrollmentType: 'AzureDomainJoined',
                    lastSyncDateTime: '2024-01-15T10:25:00Z',
                },
            ];

            const merged = mergeDevices(defenderDevices, intuneDevices, testTenantId);

            expect(merged).toHaveLength(2);
            expect(merged[1].deviceName).toBe('DESKTOP-XYZ789');
            expect(merged[1].primaryUser).toBe('user2@example.com');
            expect(merged[1].riskScore).toBe(0); // Intune-only device has no risk score
        });

        it('should handle empty device arrays', () => {
            const merged = mergeDevices([], [], testTenantId);
            expect(merged).toHaveLength(0);
        });
    });

    describe('normalizeAlert', () => {
        it('should normalize a Defender alert', () => {
            const defenderAlert: DefenderAlert = {
                id: 'alert-123',
                severity: 'High',
                title: 'Suspicious PowerShell Activity',
                category: 'Execution',
                status: 'New',
                description: 'Detected suspicious PowerShell command execution',
                detectionSource: 'EDR',
                createdDateTime: '2024-01-15T10:30:00Z',
            };

            const normalized = normalizeAlert(defenderAlert, testTenantId, testDeviceId);

            expect(normalized.tenantId).toBe(testTenantId);
            expect(normalized.deviceId).toBe(testDeviceId);
            expect(normalized.microsoftAlertId).toBe('alert-123');
            expect(normalized.severity).toBe('high');
            expect(normalized.threatType).toBe('Execution');
            expect(normalized.threatName).toBe('Suspicious PowerShell Activity');
            expect(normalized.status).toBe('New');
            expect(normalized.description).toBe('Detected suspicious PowerShell command execution');
            expect(normalized.detectedAt).toBeInstanceOf(Date);
        });

        it('should map severity levels correctly', () => {
            const testCases = [
                { input: 'Informational', expected: 'low' },
                { input: 'Low', expected: 'low' },
                { input: 'Medium', expected: 'medium' },
                { input: 'High', expected: 'high' },
                { input: 'Critical', expected: 'critical' },
                { input: 'Unknown', expected: 'medium' }, // Default
            ];

            testCases.forEach(({ input, expected }) => {
                const alert: DefenderAlert = {
                    id: 'alert-123',
                    severity: input,
                    title: 'Test Alert',
                    category: 'Test',
                    status: 'New',
                    description: 'Test',
                    detectionSource: 'EDR',
                    createdDateTime: '2024-01-15T10:30:00Z',
                };

                const normalized = normalizeAlert(alert, testTenantId, testDeviceId);
                expect(normalized.severity).toBe(expected);
            });
        });

        it('should handle missing fields with defaults', () => {
            const defenderAlert: DefenderAlert = {
                id: 'alert-123',
                severity: 'High',
                title: '',
                category: '',
                status: '',
                description: '',
                detectionSource: 'EDR',
                createdDateTime: '',
            };

            const normalized = normalizeAlert(defenderAlert, testTenantId, testDeviceId);

            expect(normalized.threatName).toBe('Unknown Threat');
            expect(normalized.threatType).toBe('Unknown');
            expect(normalized.status).toBe('New');
            expect(normalized.description).toBe('');
        });
    });

    describe('normalizeVulnerability', () => {
        it('should normalize a vulnerability', () => {
            const vulnerability: Vulnerability = {
                id: 'vuln-123',
                cveId: 'CVE-2024-1234',
                severity: 'High',
                cvssScore: 8.5,
                exploitability: 'High',
                description: 'Remote code execution vulnerability',
                affectedDevices: ['device-1', 'device-2', 'device-3'],
            };

            const normalized = normalizeVulnerability(vulnerability, testTenantId);

            expect(normalized.tenantId).toBe(testTenantId);
            expect(normalized.cveId).toBe('CVE-2024-1234');
            expect(normalized.severity).toBe('high');
            expect(normalized.cvssScore).toBe(8.5);
            expect(normalized.exploitability).toBe('High');
            expect(normalized.description).toBe('Remote code execution vulnerability');
            expect(normalized.affectedDeviceCount).toBe(3);
        });

        it('should handle missing affected devices', () => {
            const vulnerability: Vulnerability = {
                id: 'vuln-123',
                cveId: 'CVE-2024-1234',
                severity: 'Medium',
                cvssScore: 5.0,
                exploitability: 'Low',
                description: 'Test vulnerability',
            };

            const normalized = normalizeVulnerability(vulnerability, testTenantId);

            expect(normalized.affectedDeviceCount).toBe(0);
        });
    });

    describe('normalizeCompliance', () => {
        it('should normalize compliance status with failed rules', () => {
            const compliance: ComplianceStatus = {
                deviceId: 'device-123',
                complianceState: 'noncompliant',
                complianceGracePeriodExpirationDateTime: '2024-01-20T00:00:00Z',
                deviceCompliancePolicyStates: [
                    {
                        settingName: 'BitLocker Encryption',
                        state: 'noncompliant',
                    },
                    {
                        settingName: 'Firewall Enabled',
                        state: 'compliant',
                    },
                    {
                        settingName: 'Antivirus Updated',
                        state: 'error',
                    },
                ],
            };

            const normalized = normalizeCompliance(compliance, testTenantId, testDeviceId);

            expect(normalized.tenantId).toBe(testTenantId);
            expect(normalized.deviceId).toBe(testDeviceId);
            expect(normalized.complianceState).toBe('noncompliant');
            expect(normalized.failedRules).toHaveLength(2);
            expect(normalized.failedRules[0].ruleName).toBe('BitLocker Encryption');
            expect(normalized.failedRules[1].ruleName).toBe('Antivirus Updated');
            expect(normalized.securityBaselineStatus).toBe('Non-Compliant');
        });

        it('should handle compliant devices', () => {
            const compliance: ComplianceStatus = {
                deviceId: 'device-123',
                complianceState: 'compliant',
                deviceCompliancePolicyStates: [
                    {
                        settingName: 'BitLocker Encryption',
                        state: 'compliant',
                    },
                ],
            };

            const normalized = normalizeCompliance(compliance, testTenantId, testDeviceId);

            expect(normalized.complianceState).toBe('compliant');
            expect(normalized.failedRules).toHaveLength(0);
            expect(normalized.securityBaselineStatus).toBe('Compliant');
        });
    });

    describe('calculatePostureScore', () => {
        it('should calculate posture score with all factors', () => {
            const devices = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    microsoftDeviceId: 'device-1',
                    deviceName: 'Device 1',
                    operatingSystem: 'Windows',
                    osVersion: '10',
                    primaryUser: 'user1',
                    defenderHealthStatus: 'Active',
                    riskScore: 30,
                    exposureLevel: 'Low',
                    intuneComplianceState: 'compliant',
                    intuneEnrollmentStatus: 'Enrolled',
                    lastSeenAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: '2',
                    tenantId: testTenantId,
                    microsoftDeviceId: 'device-2',
                    deviceName: 'Device 2',
                    operatingSystem: 'Windows',
                    osVersion: '10',
                    primaryUser: 'user2',
                    defenderHealthStatus: 'Active',
                    riskScore: 80,
                    exposureLevel: 'High',
                    intuneComplianceState: 'noncompliant',
                    intuneEnrollmentStatus: 'Enrolled',
                    lastSeenAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const alerts = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    deviceId: '1',
                    microsoftAlertId: 'alert-1',
                    severity: 'high',
                    threatType: 'Malware',
                    threatName: 'Trojan',
                    status: 'New',
                    description: 'Test',
                    detectedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const vulnerabilities = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    cveId: 'CVE-2024-1234',
                    severity: 'high',
                    cvssScore: 8.5,
                    exploitability: 'High',
                    description: 'Test',
                    affectedDeviceCount: 2,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const compliance = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    deviceId: '2',
                    complianceState: 'noncompliant',
                    failedRules: [],
                    securityBaselineStatus: 'Non-Compliant',
                    requiredAppsStatus: [],
                    checkedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const postureScore = calculatePostureScore(
                devices,
                alerts,
                vulnerabilities,
                compliance,
                testTenantId
            );

            expect(postureScore.tenantId).toBe(testTenantId);
            expect(postureScore.score).toBeGreaterThanOrEqual(0);
            expect(postureScore.score).toBeLessThanOrEqual(100);
            expect(postureScore.deviceCount).toBe(2);
            expect(postureScore.highRiskDeviceCount).toBe(1);
            expect(postureScore.activeAlertCount).toBe(1);
            expect(postureScore.criticalVulnerabilityCount).toBe(1);
            expect(postureScore.nonCompliantDeviceCount).toBe(1);
        });

        it('should return zero score for no devices', () => {
            const postureScore = calculatePostureScore([], [], [], [], testTenantId);

            expect(postureScore.score).toBe(0);
            expect(postureScore.deviceCount).toBe(0);
            expect(postureScore.highRiskDeviceCount).toBe(0);
            expect(postureScore.activeAlertCount).toBe(0);
            expect(postureScore.criticalVulnerabilityCount).toBe(0);
            expect(postureScore.nonCompliantDeviceCount).toBe(0);
        });

        it('should calculate perfect score for secure environment', () => {
            const devices = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    microsoftDeviceId: 'device-1',
                    deviceName: 'Device 1',
                    operatingSystem: 'Windows',
                    osVersion: '10',
                    primaryUser: 'user1',
                    defenderHealthStatus: 'Active',
                    riskScore: 0,
                    exposureLevel: 'None',
                    intuneComplianceState: 'compliant',
                    intuneEnrollmentStatus: 'Enrolled',
                    lastSeenAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const postureScore = calculatePostureScore(devices, [], [], [], testTenantId);

            expect(postureScore.score).toBeGreaterThanOrEqual(90);
            expect(postureScore.highRiskDeviceCount).toBe(0);
            expect(postureScore.activeAlertCount).toBe(0);
            expect(postureScore.criticalVulnerabilityCount).toBe(0);
        });
    });

    describe('calculatePostureFactors', () => {
        it('should calculate detailed posture factors', () => {
            const devices = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    microsoftDeviceId: 'device-1',
                    deviceName: 'Device 1',
                    operatingSystem: 'Windows',
                    osVersion: '10',
                    primaryUser: 'user1',
                    defenderHealthStatus: 'Active',
                    riskScore: 30,
                    exposureLevel: 'Low',
                    intuneComplianceState: 'compliant',
                    intuneEnrollmentStatus: 'Enrolled',
                    lastSeenAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: '2',
                    tenantId: testTenantId,
                    microsoftDeviceId: 'device-2',
                    deviceName: 'Device 2',
                    operatingSystem: 'Windows',
                    osVersion: '10',
                    primaryUser: 'user2',
                    defenderHealthStatus: 'Active',
                    riskScore: 70,
                    exposureLevel: 'High',
                    intuneComplianceState: 'noncompliant',
                    intuneEnrollmentStatus: 'Enrolled',
                    lastSeenAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const alerts = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    deviceId: '1',
                    microsoftAlertId: 'alert-1',
                    severity: 'low',
                    threatType: 'Malware',
                    threatName: 'Adware',
                    status: 'New',
                    description: 'Test',
                    detectedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: '2',
                    tenantId: testTenantId,
                    deviceId: '2',
                    microsoftAlertId: 'alert-2',
                    severity: 'high',
                    threatType: 'Malware',
                    threatName: 'Trojan',
                    status: 'New',
                    description: 'Test',
                    detectedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const vulnerabilities = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    cveId: 'CVE-2024-1234',
                    severity: 'high',
                    cvssScore: 8.5,
                    exploitability: 'High',
                    description: 'Test',
                    affectedDeviceCount: 2,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const compliance = [
                {
                    id: '1',
                    tenantId: testTenantId,
                    deviceId: '2',
                    complianceState: 'noncompliant',
                    failedRules: [],
                    securityBaselineStatus: 'Non-Compliant',
                    requiredAppsStatus: [],
                    checkedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const factors = calculatePostureFactors(devices, alerts, vulnerabilities, compliance);

            expect(factors.deviceRiskAverage).toBe(50); // (30 + 70) / 2
            expect(factors.alertSeverityDistribution.low).toBe(1);
            expect(factors.alertSeverityDistribution.high).toBe(1);
            expect(factors.vulnerabilityExposure).toBeGreaterThan(0);
            expect(factors.compliancePercentage).toBe(50); // 1 out of 2 compliant
        });
    });

    describe('Helper Functions', () => {
        it('should map risk levels correctly', () => {
            expect(mapRiskLevel('None')).toBe(0);
            expect(mapRiskLevel('Low')).toBe(30);
            expect(mapRiskLevel('Medium')).toBe(60);
            expect(mapRiskLevel('High')).toBe(90);
            expect(mapRiskLevel('Critical')).toBe(100);
            expect(mapRiskLevel('Unknown')).toBe(50);
        });

        it('should map severity levels correctly', () => {
            expect(mapSeverity('Informational')).toBe('low');
            expect(mapSeverity('Low')).toBe('low');
            expect(mapSeverity('Medium')).toBe('medium');
            expect(mapSeverity('High')).toBe('high');
            expect(mapSeverity('Critical')).toBe('critical');
            expect(mapSeverity('Unknown')).toBe('medium');
        });

        it('should validate normalized devices', () => {
            const validDevice = {
                tenantId: testTenantId,
                microsoftDeviceId: 'device-123',
                deviceName: 'Test Device',
                operatingSystem: 'Windows',
                lastSeenAt: new Date(),
            };

            expect(validateNormalizedDevice(validDevice)).toBe(true);

            const invalidDevice = {
                tenantId: testTenantId,
                microsoftDeviceId: '',
                deviceName: 'Test Device',
            };

            expect(validateNormalizedDevice(invalidDevice)).toBe(false);
        });

        it('should validate normalized alerts', () => {
            const validAlert = {
                tenantId: testTenantId,
                deviceId: testDeviceId,
                microsoftAlertId: 'alert-123',
                severity: 'high',
                threatName: 'Test Threat',
                detectedAt: new Date(),
            };

            expect(validateNormalizedAlert(validAlert)).toBe(true);

            const invalidAlert = {
                tenantId: testTenantId,
                deviceId: '',
                microsoftAlertId: 'alert-123',
            };

            expect(validateNormalizedAlert(invalidAlert)).toBe(false);
        });

        it('should validate normalized vulnerabilities', () => {
            const validVuln = {
                tenantId: testTenantId,
                cveId: 'CVE-2024-1234',
                severity: 'high',
            };

            expect(validateNormalizedVulnerability(validVuln)).toBe(true);

            const invalidVuln = {
                tenantId: testTenantId,
                cveId: '',
            };

            expect(validateNormalizedVulnerability(invalidVuln)).toBe(false);
        });

        it('should validate normalized compliance', () => {
            const validCompliance = {
                tenantId: testTenantId,
                deviceId: testDeviceId,
                complianceState: 'compliant',
                checkedAt: new Date(),
            };

            expect(validateNormalizedCompliance(validCompliance)).toBe(true);

            const invalidCompliance = {
                tenantId: testTenantId,
                deviceId: '',
                complianceState: 'compliant',
            };

            expect(validateNormalizedCompliance(invalidCompliance)).toBe(false);
        });
    });
});
