/**
 * Unit tests for DefenderIntegrationService
 * 
 * Tests the Microsoft Defender integration service functionality including:
 * - Alert context enrichment
 * - Deep-link generation
 * - Connection status management
 * - Graceful error handling
 * - Batch processing
 */

import { DefenderIntegrationService, createDefenderIntegrationService, hasDefenderContext, extractDefenderContextFromAlert } from '../DefenderIntegrationService';
import { MicrosoftGraphClient } from '../../../lib/microsoft-graph-client';
import type { DefenderIntegrationConfig, SecurityAlert } from '../../../types/alerts-incidents';
import type { DefenderDevice, DefenderAlert } from '../../../types/edr';

// Mock the MicrosoftGraphClient
jest.mock('../../../lib/microsoft-graph-client');
jest.mock('../../../lib/logger');

const MockedMicrosoftGraphClient = MicrosoftGraphClient as jest.MockedClass<typeof MicrosoftGraphClient>;

describe('DefenderIntegrationService', () => {
    let service: DefenderIntegrationService;
    let mockGraphClient: jest.Mocked<MicrosoftGraphClient>;
    let config: DefenderIntegrationConfig;

    beforeEach(() => {
        jest.clearAllMocks();

        config = {
            tenantId: 'test-tenant-id',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            authority: 'https://login.microsoftonline.com/test-tenant-id',
            scope: ['https://graph.microsoft.com/.default'],
        };

        // Create mock instance
        mockGraphClient = {
            authenticate: jest.fn(),
            getDefenderAlerts: jest.fn(),
            getDefenderDevices: jest.fn(),
        } as any;

        MockedMicrosoftGraphClient.mockImplementation(() => mockGraphClient);

        service = new DefenderIntegrationService(config);
    });

    describe('Constructor and Factory', () => {
        it('should create service instance with correct configuration', () => {
            expect(service).toBeInstanceOf(DefenderIntegrationService);
            expect(MockedMicrosoftGraphClient).toHaveBeenCalledWith({
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                tenantId: config.tenantId,
            });
        });

        it('should create service using factory function', () => {
            const factoryService = createDefenderIntegrationService(config);
            expect(factoryService).toBeInstanceOf(DefenderIntegrationService);
        });
    });

    describe('enrichAlertWithDefenderContext', () => {
        const mockEDRAlert: SecurityAlert = {
            id: 'alert-123',
            tenantId: 'tenant-123',
            sourceSystem: 'edr',
            sourceId: 'defender-alert-456',
            alertType: 'edr_alert',
            classification: 'malware',
            severity: 'high',
            title: 'Malware Detected',
            description: 'Suspicious file detected',
            metadata: {},
            seenCount: 1,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            defenderIncidentId: 'incident-789',
            defenderAlertId: 'alert-456',
            defenderSeverity: 'High',
            threatName: 'Trojan:Win32/Malware',
            affectedDevice: 'DESKTOP-ABC123',
            affectedUser: 'user@company.com',
            status: 'open',
            assignedTo: null,
            assignedAt: null,
            detectedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const mockNonEDRAlert: SecurityAlert = {
            ...mockEDRAlert,
            id: 'alert-456',
            sourceSystem: 'firewall',
            defenderIncidentId: null,
            defenderAlertId: null,
            defenderSeverity: null,
            threatName: null,
            affectedDevice: null,
            affectedUser: null,
        };

        it('should enrich EDR alert with full Defender context when API is available', async () => {
            // Mock successful authentication
            mockGraphClient.authenticate.mockResolvedValue('mock-token');

            // Mock Defender alert response
            const mockDefenderAlert: DefenderAlert = {
                id: 'alert-456',
                severity: 'High',
                title: 'Malware Detected',
                category: 'Malware',
                status: 'New',
                description: 'Suspicious file detected',
                detectionSource: 'WindowsDefenderAv',
                createdDateTime: '2024-01-15T10:00:00Z',
                classification: 'TruePositive',
                determination: 'Malware',
                investigationState: 'Running',
                assignedTo: 'analyst@company.com',
            };

            mockGraphClient.getDefenderAlerts.mockResolvedValue([mockDefenderAlert]);

            // Mock device response
            const mockDevice: DefenderDevice = {
                id: 'device-123',
                computerDnsName: 'DESKTOP-ABC123',
                osPlatform: 'Windows10',
                osVersion: '10.0.19041.1234',
                lastSeen: '2024-01-15T10:00:00Z',
                healthStatus: 'Active',
                riskScore: 75,
                exposureLevel: 'Medium',
            };

            mockGraphClient.getDefenderDevices.mockResolvedValue([mockDevice]);

            const result = await service.enrichAlertWithDefenderContext(mockEDRAlert);

            expect(result).toBeDefined();
            expect(result!.incidentId).toBe('incident-789');
            expect(result!.alertId).toBe('alert-456');
            expect(result!.severity).toBe('High');
            expect(result!.threatName).toBe('Trojan:Win32/Malware');
            expect(result!.affectedDevice).toBe('DESKTOP-ABC123');
            expect(result!.affectedUser).toBe('user@company.com');
            expect(result!.deepLink).toBe('https://security.microsoft.com/alerts/alert-456?tid=test-tenant-id');
            expect(result!.connectionStatus.isConnected).toBe(true);

            // Check detailed context
            expect(result!.status).toBe('New');
            expect(result!.classification).toBe('TruePositive');
            expect(result!.determination).toBe('Malware');
            expect(result!.investigationState).toBe('Running');
            expect(result!.assignedTo).toBe('analyst@company.com');

            // Check device info
            expect(result!.deviceInfo).toBeDefined();
            expect(result!.deviceInfo!.computerDnsName).toBe('DESKTOP-ABC123');
            expect(result!.deviceInfo!.osPlatform).toBe('Windows10');
            expect(result!.deviceInfo!.healthStatus).toBe('Active');
            expect(result!.deviceInfo!.riskScore).toBe(75);
        });

        it('should return null for non-EDR alerts', async () => {
            const result = await service.enrichAlertWithDefenderContext(mockNonEDRAlert);
            expect(result).toBeNull();
        });

        it('should return null for EDR alerts without Defender context', async () => {
            const alertWithoutContext: SecurityAlert = {
                ...mockEDRAlert,
                defenderIncidentId: null,
                defenderAlertId: null,
            };

            const result = await service.enrichAlertWithDefenderContext(alertWithoutContext);
            expect(result).toBeNull();
        });

        it('should return basic context when API is unavailable', async () => {
            // Mock authentication failure
            mockGraphClient.authenticate.mockRejectedValue(new Error('Authentication failed'));

            const result = await service.enrichAlertWithDefenderContext(mockEDRAlert);

            expect(result).toBeDefined();
            expect(result!.incidentId).toBe('incident-789');
            expect(result!.alertId).toBe('alert-456');
            expect(result!.connectionStatus.isConnected).toBe(false);
            expect(result!.connectionStatus.error).toBe('Authentication failed');
            expect(result!.deepLink).toBe('https://security.microsoft.com/alerts/alert-456?tid=test-tenant-id');
        });

        it('should handle missing Defender alert gracefully', async () => {
            // Mock successful authentication but no matching alert
            mockGraphClient.authenticate.mockResolvedValue('mock-token');
            mockGraphClient.getDefenderAlerts.mockResolvedValue([]);
            mockGraphClient.getDefenderDevices.mockResolvedValue([]);

            const result = await service.enrichAlertWithDefenderContext(mockEDRAlert);

            expect(result).toBeDefined();
            expect(result!.status).toBeUndefined();
            expect(result!.deviceInfo).toBeUndefined();
            expect(result!.connectionStatus.isConnected).toBe(true);
        });
    });

    describe('enrichAlertsWithDefenderContext', () => {
        it('should process multiple alerts in batches', async () => {
            const alerts: SecurityAlert[] = Array.from({ length: 12 }, (_, i) => ({
                id: `alert-${i}`,
                tenantId: 'tenant-123',
                sourceSystem: 'edr',
                sourceId: `defender-alert-${i}`,
                alertType: 'edr_alert',
                classification: 'malware',
                severity: 'high',
                title: `Alert ${i}`,
                description: 'Test alert',
                metadata: {},
                seenCount: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                defenderIncidentId: `incident-${i}`,
                defenderAlertId: `alert-${i}`,
                defenderSeverity: 'High',
                threatName: 'Test Threat',
                affectedDevice: `DEVICE-${i}`,
                affectedUser: `user${i}@company.com`,
                status: 'open',
                assignedTo: null,
                assignedAt: null,
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            // Mock successful authentication
            mockGraphClient.authenticate.mockResolvedValue('mock-token');
            mockGraphClient.getDefenderAlerts.mockResolvedValue([]);
            mockGraphClient.getDefenderDevices.mockResolvedValue([]);

            const result = await service.enrichAlertsWithDefenderContext(alerts);

            expect(result.size).toBe(12);
            expect(mockGraphClient.authenticate).toHaveBeenCalled();

            // Verify all alerts were processed
            for (let i = 0; i < 12; i++) {
                expect(result.has(`alert-${i}`)).toBe(true);
            }
        });
    });

    describe('generateDeepLink', () => {
        it('should generate correct deep-link for alert', () => {
            const link = service.generateDeepLink('incident-123', 'alert-456');
            expect(link).toBe('https://security.microsoft.com/alerts/alert-456?tid=test-tenant-id');
        });

        it('should generate correct deep-link for incident only', () => {
            const link = service.generateDeepLink('incident-123');
            expect(link).toBe('https://security.microsoft.com/incidents/incident-123?tid=test-tenant-id');
        });
    });

    describe('generateDeviceDeepLink', () => {
        it('should generate correct device deep-link', () => {
            const link = service.generateDeviceDeepLink('device-123');
            expect(link).toBe('https://security.microsoft.com/machines/device-123?tid=test-tenant-id');
        });
    });

    describe('checkConnectionStatus', () => {
        it('should return connected status when authentication succeeds', async () => {
            mockGraphClient.authenticate.mockResolvedValue('mock-token');

            const status = await service.checkConnectionStatus();

            expect(status.isConnected).toBe(true);
            expect(status.error).toBeUndefined();
            expect(status.latencyMs).toBeDefined();
            expect(status.lastChecked).toBeInstanceOf(Date);
        });

        it('should return disconnected status when authentication fails', async () => {
            mockGraphClient.authenticate.mockRejectedValue(new Error('Auth failed'));

            const status = await service.checkConnectionStatus();

            expect(status.isConnected).toBe(false);
            expect(status.error).toBe('Auth failed');
            expect(status.latencyMs).toBeDefined();
            expect(status.lastChecked).toBeInstanceOf(Date);
        });
    });

    describe('getConnectionStatus', () => {
        it('should return current connection status without new check', async () => {
            // First, set a status
            mockGraphClient.authenticate.mockResolvedValue('mock-token');
            await service.checkConnectionStatus();

            // Then get status without new check
            const status = service.getConnectionStatus();
            expect(status.isConnected).toBe(true);
        });
    });
});

describe('Helper Functions', () => {
    describe('hasDefenderContext', () => {
        it('should return true for EDR alert with Defender context', () => {
            const alert: SecurityAlert = {
                id: 'alert-123',
                tenantId: 'tenant-123',
                sourceSystem: 'edr',
                sourceId: 'defender-alert-456',
                alertType: 'edr_alert',
                classification: 'malware',
                severity: 'high',
                title: 'Test Alert',
                description: 'Test description',
                metadata: {},
                seenCount: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                defenderIncidentId: 'incident-789',
                defenderAlertId: 'alert-456',
                defenderSeverity: 'High',
                threatName: 'Test Threat',
                affectedDevice: 'DEVICE-123',
                affectedUser: 'user@company.com',
                status: 'open',
                assignedTo: null,
                assignedAt: null,
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            expect(hasDefenderContext(alert)).toBe(true);
        });

        it('should return false for non-EDR alert', () => {
            const alert: SecurityAlert = {
                id: 'alert-123',
                tenantId: 'tenant-123',
                sourceSystem: 'firewall',
                sourceId: 'firewall-alert-456',
                alertType: 'firewall_alert',
                classification: 'intrusion',
                severity: 'medium',
                title: 'Test Alert',
                description: 'Test description',
                metadata: {},
                seenCount: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                defenderIncidentId: null,
                defenderAlertId: null,
                defenderSeverity: null,
                threatName: null,
                affectedDevice: null,
                affectedUser: null,
                status: 'open',
                assignedTo: null,
                assignedAt: null,
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            expect(hasDefenderContext(alert)).toBe(false);
        });

        it('should return false for EDR alert without Defender IDs', () => {
            const alert: SecurityAlert = {
                id: 'alert-123',
                tenantId: 'tenant-123',
                sourceSystem: 'edr',
                sourceId: 'edr-alert-456',
                alertType: 'edr_alert',
                classification: 'malware',
                severity: 'high',
                title: 'Test Alert',
                description: 'Test description',
                metadata: {},
                seenCount: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                defenderIncidentId: null,
                defenderAlertId: null,
                defenderSeverity: null,
                threatName: null,
                affectedDevice: null,
                affectedUser: null,
                status: 'open',
                assignedTo: null,
                assignedAt: null,
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            expect(hasDefenderContext(alert)).toBe(false);
        });
    });

    describe('extractDefenderContextFromAlert', () => {
        it('should extract Defender context from alert', () => {
            const alert: SecurityAlert = {
                id: 'alert-123',
                tenantId: 'tenant-123',
                sourceSystem: 'edr',
                sourceId: 'defender-alert-456',
                alertType: 'edr_alert',
                classification: 'malware',
                severity: 'high',
                title: 'Test Alert',
                description: 'Test description',
                metadata: {},
                seenCount: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                defenderIncidentId: 'incident-789',
                defenderAlertId: 'alert-456',
                defenderSeverity: 'High',
                threatName: 'Trojan:Win32/Test',
                affectedDevice: 'DEVICE-123',
                affectedUser: 'user@company.com',
                status: 'open',
                assignedTo: null,
                assignedAt: null,
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const context = extractDefenderContextFromAlert(alert);

            expect(context).toBeDefined();
            expect(context!.incidentId).toBe('incident-789');
            expect(context!.alertId).toBe('alert-456');
            expect(context!.severity).toBe('High');
            expect(context!.threatName).toBe('Trojan:Win32/Test');
            expect(context!.affectedDevice).toBe('DEVICE-123');
            expect(context!.affectedUser).toBe('user@company.com');
            expect(context!.deepLink).toBe('https://security.microsoft.com/incidents/incident-789?tid=tenant-123');
        });

        it('should return null for alert without Defender context', () => {
            const alert: SecurityAlert = {
                id: 'alert-123',
                tenantId: 'tenant-123',
                sourceSystem: 'firewall',
                sourceId: 'firewall-alert-456',
                alertType: 'firewall_alert',
                classification: 'intrusion',
                severity: 'medium',
                title: 'Test Alert',
                description: 'Test description',
                metadata: {},
                seenCount: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                defenderIncidentId: null,
                defenderAlertId: null,
                defenderSeverity: null,
                threatName: null,
                affectedDevice: null,
                affectedUser: null,
                status: 'open',
                assignedTo: null,
                assignedAt: null,
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const context = extractDefenderContextFromAlert(alert);
            expect(context).toBeNull();
        });

        it('should handle missing optional fields gracefully', () => {
            const alert: SecurityAlert = {
                id: 'alert-123',
                tenantId: 'tenant-123',
                sourceSystem: 'edr',
                sourceId: 'defender-alert-456',
                alertType: 'edr_alert',
                classification: 'malware',
                severity: 'high',
                title: 'Test Alert',
                description: 'Test description',
                metadata: {},
                seenCount: 1,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                defenderIncidentId: 'incident-789',
                defenderAlertId: 'alert-456',
                defenderSeverity: null,
                threatName: null,
                affectedDevice: null,
                affectedUser: null,
                status: 'open',
                assignedTo: null,
                assignedAt: null,
                detectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const context = extractDefenderContextFromAlert(alert);

            expect(context).toBeDefined();
            expect(context!.severity).toBe('unknown');
            expect(context!.threatName).toBe('Unknown Threat');
            expect(context!.affectedDevice).toBe('Unknown Device');
            expect(context!.affectedUser).toBe('Unknown User');
        });
    });
});