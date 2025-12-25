/**
 * Property-Based Test for Microsoft Defender Context Display
 * 
 * **Feature: avian-alerts-incidents, Property 8: Microsoft Defender context display**
 * **Validates: Requirements 4.3, 4.4, 4.5**
 * 
 * This test verifies that Microsoft Defender alerts display all required context
 * information including Defender Incident ID, Alert ID, severity, threat name,
 * affected device and user, with a new-tab link and no embedded content.
 */

import * as fc from 'fast-check';
import { DefenderIntegrationService, hasDefenderContext, extractDefenderContextFromAlert } from '../DefenderIntegrationService';
import { MicrosoftGraphClient } from '../../../lib/microsoft-graph-client';
import type {
    SecurityAlert,
    DefenderIntegrationConfig,
    AlertSeverity,
    AlertSourceSystem,
    AlertStatus,
} from '../../../types/alerts-incidents';
import type {
    DefenderDevice,
    DefenderAlert,
} from '../../../types/edr';

// Mock dependencies
jest.mock('../../../lib/microsoft-graph-client');
jest.mock('../../../lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

describe('Microsoft Defender Context Display Property Tests', () => {
    let service: DefenderIntegrationService;
    let mockGraphClient: jest.Mocked<MicrosoftGraphClient>;

    const mockConfig: DefenderIntegrationConfig = {
        tenantId: 'test-tenant-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authority: 'https://login.microsoftonline.com/test-tenant-id',
        scope: ['https://graph.microsoft.com/.default'],
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock MicrosoftGraphClient
        mockGraphClient = {
            authenticate: jest.fn().mockResolvedValue(undefined),
            getDefenderAlerts: jest.fn().mockResolvedValue([]),
            getDefenderDevices: jest.fn().mockResolvedValue([]),
        } as any;

        (MicrosoftGraphClient as jest.MockedClass<typeof MicrosoftGraphClient>).mockImplementation(
            () => mockGraphClient
        );

        service = new DefenderIntegrationService(mockConfig);
    });

    // ========================================================================
    // Property Test Generators
    // ========================================================================

    // Generate valid tenant IDs
    const tenantIdArb = fc.uuid();

    // Generate alert severities
    const alertSeverityArb = fc.constantFrom<AlertSeverity>('critical', 'high', 'medium', 'low');

    // Generate alert source systems
    const alertSourceSystemArb = fc.constantFrom<AlertSourceSystem>('edr', 'firewall', 'email');

    // Generate alert statuses
    const alertStatusArb = fc.constantFrom<AlertStatus>(
        'open', 'assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive'
    );

    // Generate Microsoft Defender alert data
    const defenderAlertArb = fc.record({
        id: fc.string({ minLength: 1, maxLength: 100 }),
        incidentId: fc.string({ minLength: 1, maxLength: 100 }),
        severity: fc.constantFrom('Critical', 'High', 'Medium', 'Low', 'Informational'),
        title: fc.string({ minLength: 1, maxLength: 500 }),
        description: fc.string({ minLength: 1, maxLength: 1000 }),
        status: fc.constantFrom('New', 'InProgress', 'Resolved'),
        classification: fc.oneof(
            fc.constant(null),
            fc.constantFrom('TruePositive', 'FalsePositive', 'BenignPositive')
        ),
        determination: fc.oneof(
            fc.constant(null),
            fc.constantFrom('Malware', 'Phishing', 'SuspiciousActivity', 'Unwanted')
        ),
        investigationState: fc.constantFrom('Unknown', 'Terminated', 'SuccessfullyRemediated', 'Benign'),
        assignedTo: fc.oneof(fc.constant(null), fc.emailAddress()),
        threatName: fc.string({ minLength: 1, maxLength: 200 }),
        affectedDevice: fc.string({ minLength: 1, maxLength: 100 }),
        affectedUser: fc.string({ minLength: 1, maxLength: 100 }),
    });

    // Generate Microsoft Defender device data
    const defenderDeviceArb = fc.record({
        id: fc.string({ minLength: 1, maxLength: 100 }),
        computerDnsName: fc.domain(),
        osPlatform: fc.constantFrom('Windows10', 'Windows11', 'WindowsServer2019', 'WindowsServer2022'),
        osVersion: fc.string({ minLength: 1, maxLength: 50 }),
        healthStatus: fc.constantFrom('Active', 'Inactive', 'ImpairedCommunication', 'NoSensorData'),
        riskScore: fc.integer({ min: 0, max: 100 }),
        exposureLevel: fc.constantFrom('Low', 'Medium', 'High'),
    });

    // Generate EDR alerts with Defender context
    const edrAlertWithDefenderContextArb = fc.record({
        id: fc.uuid(),
        tenantId: tenantIdArb,
        sourceSystem: fc.constant<AlertSourceSystem>('edr'),
        sourceId: fc.string({ minLength: 1, maxLength: 255 }),
        alertType: fc.string({ minLength: 1, maxLength: 100 }),
        classification: fc.string({ minLength: 1, maxLength: 100 }),
        severity: alertSeverityArb,
        title: fc.string({ minLength: 1, maxLength: 500 }),
        description: fc.oneof(fc.constant(null), fc.string({ maxLength: 1000 })),
        metadata: fc.dictionary(fc.string(), fc.anything()),
        seenCount: fc.integer({ min: 1, max: 1000 }),
        firstSeenAt: fc.date(),
        lastSeenAt: fc.date(),
        // Required Defender context fields
        defenderIncidentId: fc.string({ minLength: 1, maxLength: 100 }),
        defenderAlertId: fc.string({ minLength: 1, maxLength: 100 }),
        defenderSeverity: fc.constantFrom('Critical', 'High', 'Medium', 'Low', 'Informational'),
        threatName: fc.string({ minLength: 1, maxLength: 200 }),
        affectedDevice: fc.string({ minLength: 1, maxLength: 100 }),
        affectedUser: fc.string({ minLength: 1, maxLength: 100 }),
        status: alertStatusArb,
        assignedTo: fc.oneof(fc.constant(null), fc.uuid()),
        assignedAt: fc.oneof(fc.constant(null), fc.date()),
        detectedAt: fc.date(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    // Generate non-EDR alerts (should not have Defender context)
    const nonEdrAlertArb = fc.record({
        id: fc.uuid(),
        tenantId: tenantIdArb,
        sourceSystem: fc.constantFrom<AlertSourceSystem>('firewall', 'email'),
        sourceId: fc.string({ minLength: 1, maxLength: 255 }),
        alertType: fc.string({ minLength: 1, maxLength: 100 }),
        classification: fc.string({ minLength: 1, maxLength: 100 }),
        severity: alertSeverityArb,
        title: fc.string({ minLength: 1, maxLength: 500 }),
        description: fc.oneof(fc.constant(null), fc.string({ maxLength: 1000 })),
        metadata: fc.dictionary(fc.string(), fc.anything()),
        seenCount: fc.integer({ min: 1, max: 1000 }),
        firstSeenAt: fc.date(),
        lastSeenAt: fc.date(),
        // No Defender context for non-EDR alerts
        defenderIncidentId: fc.constant(null),
        defenderAlertId: fc.constant(null),
        defenderSeverity: fc.constant(null),
        threatName: fc.constant(null),
        affectedDevice: fc.constant(null),
        affectedUser: fc.constant(null),
        status: alertStatusArb,
        assignedTo: fc.oneof(fc.constant(null), fc.uuid()),
        assignedAt: fc.oneof(fc.constant(null), fc.date()),
        detectedAt: fc.date(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    // ========================================================================
    // Property Test: Defender Context Display Requirements
    // ========================================================================

    it('should display all required Defender context fields for EDR alerts', async () => {
        await fc.assert(
            fc.asyncProperty(
                edrAlertWithDefenderContextArb,
                defenderAlertArb,
                defenderDeviceArb,
                async (alert, defenderAlert, defenderDevice) => {
                    // Setup: Mock successful API responses
                    mockGraphClient.authenticate.mockResolvedValue(undefined);
                    mockGraphClient.getDefenderAlerts.mockResolvedValue([{
                        ...defenderAlert,
                        id: alert.defenderAlertId!,
                    }]);

                    // Ensure device matches the alert's affected device
                    const matchingDevice = {
                        ...defenderDevice,
                        computerDnsName: alert.affectedDevice!,
                    };
                    mockGraphClient.getDefenderDevices.mockResolvedValue([matchingDevice]);

                    // Test: Enrich alert with Defender context
                    const context = await service.enrichAlertWithDefenderContext(alert);

                    // Property: Context must be returned for EDR alerts with Defender data
                    expect(context).toBeDefined();
                    expect(context).not.toBeNull();

                    if (context) {
                        // Property: All required Defender metadata must be present
                        // Requirement 4.3: Display Defender Incident ID, Alert ID, severity, threat name, affected device and user
                        expect(context.incidentId).toBe(alert.defenderIncidentId);
                        expect(context.alertId).toBe(alert.defenderAlertId);
                        expect(context.severity).toBeDefined();
                        expect(context.threatName).toBeDefined();
                        expect(context.affectedDevice).toBeDefined();
                        expect(context.affectedUser).toBeDefined();

                        // Property: Deep-link must be generated for external navigation
                        // Requirement 4.4: Provide "View in Microsoft Defender" link that opens in new browser tab
                        expect(context.deepLink).toBeDefined();
                        expect(context.deepLink).toContain('https://security.microsoft.com');
                        expect(context.deepLink).toContain(alert.defenderAlertId);
                        expect(context.deepLink).toContain(`tid=${mockConfig.tenantId}`);

                        // Property: Connection status must be included
                        // Requirement 4.5: Handle API failures gracefully with connection status indicators
                        expect(context.connectionStatus).toBeDefined();
                        expect(context.connectionStatus.isConnected).toBe(true);
                        expect(context.connectionStatus.lastChecked).toBeInstanceOf(Date);

                        // Property: Additional Defender alert context should be included when available
                        if (defenderAlert) {
                            expect(context.status).toBe(defenderAlert.status);
                            expect(context.classification).toBe(defenderAlert.classification);
                            expect(context.determination).toBe(defenderAlert.determination);
                            expect(context.investigationState).toBe(defenderAlert.investigationState);
                            expect(context.assignedTo).toBe(defenderAlert.assignedTo);
                        }

                        // Property: Device information should be included when available
                        if (context.deviceInfo) {
                            // Device info should match the mocked device that was set up to match the alert's affected device
                            expect(context.deviceInfo.computerDnsName).toBe(alert.affectedDevice);
                            expect(context.deviceInfo.osPlatform).toBe(defenderDevice.osPlatform);
                            expect(context.deviceInfo.osVersion).toBe(defenderDevice.osVersion);
                            expect(context.deviceInfo.healthStatus).toBe(defenderDevice.healthStatus);
                            expect(context.deviceInfo.riskScore).toBe(defenderDevice.riskScore);
                            expect(context.deviceInfo.exposureLevel).toBe(defenderDevice.exposureLevel);
                        }
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Non-EDR Alerts Should Not Have Defender Context
    // ========================================================================

    it('should return null for non-EDR alerts or alerts without Defender context', async () => {
        await fc.assert(
            fc.asyncProperty(
                nonEdrAlertArb,
                async (alert) => {
                    // Test: Attempt to enrich non-EDR alert
                    const context = await service.enrichAlertWithDefenderContext(alert);

                    // Property: Non-EDR alerts should not have Defender context
                    expect(context).toBeNull();

                    // Property: hasDefenderContext helper should return false
                    expect(hasDefenderContext(alert)).toBe(false);

                    // Property: extractDefenderContextFromAlert should return null
                    expect(extractDefenderContextFromAlert(alert)).toBeNull();
                }
            ),
            { numRuns: 30 }
        );
    });

    // ========================================================================
    // Property Test: Deep-Link Generation Consistency
    // ========================================================================

    it('should generate consistent deep-links for Defender navigation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 100 }), // incidentId
                fc.string({ minLength: 1, maxLength: 100 }), // alertId
                (incidentId, alertId) => {
                    // Test: Generate deep-link with both incident and alert IDs
                    const deepLinkWithAlert = service.generateDeepLink(incidentId, alertId);

                    // Property: Deep-link must contain Microsoft Security Center base URL
                    // Requirement 4.4: Link opens in new browser tab (external navigation)
                    expect(deepLinkWithAlert).toContain('https://security.microsoft.com');

                    // Property: Deep-link must contain alert ID when provided
                    expect(deepLinkWithAlert).toContain(`/alerts/${alertId}`);

                    // Property: Deep-link must contain tenant ID parameter
                    expect(deepLinkWithAlert).toContain(`tid=${mockConfig.tenantId}`);

                    // Test: Generate deep-link with only incident ID
                    const deepLinkIncidentOnly = service.generateDeepLink(incidentId);

                    // Property: Incident-only deep-link should point to incident overview
                    expect(deepLinkIncidentOnly).toContain('https://security.microsoft.com');
                    expect(deepLinkIncidentOnly).toContain(`/incidents/${incidentId}`);
                    expect(deepLinkIncidentOnly).toContain(`tid=${mockConfig.tenantId}`);

                    // Property: Different link formats for alert vs incident
                    expect(deepLinkWithAlert).not.toBe(deepLinkIncidentOnly);
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: API Failure Handling with Connection Status
    // ========================================================================

    it('should handle API failures gracefully and provide connection status indicators', async () => {
        await fc.assert(
            fc.asyncProperty(
                edrAlertWithDefenderContextArb,
                fc.constantFrom(
                    'Authentication failed',
                    'Network timeout',
                    'Service unavailable',
                    'Rate limit exceeded'
                ),
                async (alert, errorMessage) => {
                    // Setup: Mock API failure
                    mockGraphClient.authenticate.mockRejectedValue(new Error(errorMessage));

                    // Test: Attempt to enrich alert during API failure
                    const context = await service.enrichAlertWithDefenderContext(alert);

                    // Property: Context should still be returned with basic information
                    // Requirement 4.5: Handle API failures gracefully with connection status indicators
                    expect(context).toBeDefined();
                    expect(context).not.toBeNull();

                    if (context) {
                        // Property: Basic Defender metadata should be preserved from alert
                        expect(context.incidentId).toBe(alert.defenderIncidentId);
                        expect(context.alertId).toBe(alert.defenderAlertId);
                        expect(context.severity).toBe(alert.defenderSeverity || 'unknown');
                        expect(context.threatName).toBe(alert.threatName || 'Unknown Threat');
                        expect(context.affectedDevice).toBe(alert.affectedDevice || 'Unknown Device');
                        expect(context.affectedUser).toBe(alert.affectedUser || 'Unknown User');

                        // Property: Deep-link should still be generated
                        expect(context.deepLink).toBeDefined();
                        expect(context.deepLink).toContain('https://security.microsoft.com');

                        // Property: Connection status should indicate failure
                        expect(context.connectionStatus).toBeDefined();
                        expect(context.connectionStatus.isConnected).toBe(false);
                        expect(context.connectionStatus.error).toBe(errorMessage);
                        expect(context.connectionStatus.lastChecked).toBeInstanceOf(Date);

                        // Property: Enhanced context should not be available during failures
                        expect(context.status).toBeUndefined();
                        expect(context.classification).toBeUndefined();
                        expect(context.determination).toBeUndefined();
                        expect(context.deviceInfo).toBeUndefined();
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    // ========================================================================
    // Property Test: Batch Processing Consistency
    // ========================================================================

    it('should maintain consistency when processing multiple alerts in batch', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(edrAlertWithDefenderContextArb, { minLength: 1, maxLength: 10 }),
                fc.array(nonEdrAlertArb, { minLength: 1, maxLength: 5 }),
                async (edrAlerts, nonEdrAlerts) => {
                    const allAlerts = [...edrAlerts, ...nonEdrAlerts];

                    // Setup: Mock successful API responses for EDR alerts
                    mockGraphClient.authenticate.mockResolvedValue(undefined);
                    mockGraphClient.getDefenderAlerts.mockResolvedValue(
                        edrAlerts.map(alert => ({
                            id: alert.defenderAlertId!,
                            incidentId: alert.defenderIncidentId!,
                            severity: alert.defenderSeverity!,
                            title: alert.title,
                            description: alert.description || '',
                            status: 'New',
                            classification: null,
                            determination: null,
                            investigationState: 'Unknown',
                            assignedTo: null,
                            threatName: alert.threatName!,
                            affectedDevice: alert.affectedDevice!,
                            affectedUser: alert.affectedUser!,
                        }))
                    );
                    mockGraphClient.getDefenderDevices.mockResolvedValue([]);

                    // Test: Process alerts in batch
                    const contextMap = await service.enrichAlertsWithDefenderContext(allAlerts);

                    // Property: Context map should contain entries for all alerts
                    expect(contextMap.size).toBe(allAlerts.length);

                    // Property: EDR alerts should have context, non-EDR should not
                    for (const alert of allAlerts) {
                        const context = contextMap.get(alert.id);

                        if (alert.sourceSystem === 'edr' && alert.defenderAlertId && alert.defenderIncidentId) {
                            // EDR alerts with Defender context should have enriched context
                            expect(context).toBeDefined();
                            expect(context).not.toBeNull();

                            if (context) {
                                expect(context.incidentId).toBe(alert.defenderIncidentId);
                                expect(context.alertId).toBe(alert.defenderAlertId);
                                expect(context.deepLink).toContain('https://security.microsoft.com');
                                expect(context.connectionStatus.isConnected).toBe(true);
                            }
                        } else {
                            // Non-EDR alerts should not have context
                            expect(context).toBeNull();
                        }
                    }
                }
            ),
            { numRuns: 25 }
        );
    });

    // ========================================================================
    // Property Test: No Embedded Content Requirement
    // ========================================================================

    it('should never embed external content and only provide deep-links', async () => {
        await fc.assert(
            fc.asyncProperty(
                edrAlertWithDefenderContextArb,
                async (alert) => {
                    // Setup: Mock successful API responses
                    mockGraphClient.authenticate.mockResolvedValue(undefined);
                    mockGraphClient.getDefenderAlerts.mockResolvedValue([]);
                    mockGraphClient.getDefenderDevices.mockResolvedValue([]);

                    // Test: Enrich alert with Defender context
                    const context = await service.enrichAlertWithDefenderContext(alert);

                    if (context) {
                        // Property: No embedded iframe or external content should be present
                        // Requirement 4.5: Do not embed or iframe Microsoft Defender content
                        expect(context.deepLink).not.toContain('<iframe');
                        expect(context.deepLink).not.toContain('<embed');
                        expect(context.deepLink).not.toContain('<object');

                        // Property: Deep-link should be a simple URL string
                        expect(typeof context.deepLink).toBe('string');
                        expect(context.deepLink).toMatch(/^https:\/\/security\.microsoft\.com/);

                        // Property: Context should only contain metadata, not embedded content
                        const contextKeys = Object.keys(context);
                        const allowedKeys = [
                            'incidentId', 'alertId', 'severity', 'threatName', 'affectedDevice',
                            'affectedUser', 'deepLink', 'status', 'classification', 'determination',
                            'investigationState', 'assignedTo', 'deviceInfo', 'connectionStatus'
                        ];

                        for (const key of contextKeys) {
                            expect(allowedKeys).toContain(key);
                        }

                        // Property: No HTML content or scripts should be present in any field
                        const stringFields = [
                            context.incidentId, context.alertId, context.severity,
                            context.threatName, context.affectedDevice, context.affectedUser,
                            context.deepLink, context.status, context.classification,
                            context.determination, context.investigationState, context.assignedTo
                        ].filter(field => typeof field === 'string');

                        for (const field of stringFields) {
                            expect(field).not.toContain('<script');
                            expect(field).not.toContain('javascript:');
                            expect(field).not.toContain('data:text/html');
                        }
                    }
                }
            ),
            { numRuns: 30 }
        );
    });
});