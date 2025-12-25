/**
 * Property-Based Test for Alert Deduplication Intelligence Preservation
 * 
 * **Feature: avian-alerts-incidents, Property 15: Alert ingestion normalization**
 * **Validates: Requirements 12.1, 12.2, 12.4**
 * 
 * This test verifies that:
 * 1. All external system data is ingested as alerts regardless of source classification
 * 2. Microsoft Defender incidents are treated as metadata-only context for AVIAN alerts
 * 3. Alert normalization works correctly across all source systems
 * 4. Deduplication preserves reporting intelligence (seenCount, firstSeenAt, lastSeenAt)
 */

import * as fc from 'fast-check';
import { AlertManager } from '../AlertManager';
import { db } from '../../../lib/database';
import { connectRedis } from '../../../lib/redis';
import { securityAlerts } from '../../../../database/schemas/alerts-incidents';
import {
    EDRAlertInput,
    FirewallAlertInput,
    EmailAlertInput,
    AlertSeverity,
    AlertSourceSystem,
    NormalizedAlert,
    SecurityAlert,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        insert: jest.fn(),
        select: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('../../../lib/redis', () => ({
    connectRedis: jest.fn(),
}));

jest.mock('../../../lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('../AuditService', () => ({
    AuditService: {
        logAlertCreated: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../OwnershipEnforcementService', () => ({
    OwnershipEnforcementService: {
        validateAlertOwnership: jest.fn().mockResolvedValue({ isValid: true }),
    },
}));

describe('Alert Deduplication Intelligence Property Tests', () => {
    const mockDb = db as any;
    const mockConnectRedis = connectRedis as jest.MockedFunction<typeof connectRedis>;

    // ========================================================================
    // Property Test Generators
    // ========================================================================

    // Generate valid tenant IDs
    const tenantIdArb = fc.uuid();

    // Generate alert severities
    const alertSeverityArb = fc.constantFrom<AlertSeverity>('critical', 'high', 'medium', 'low');

    // Generate EDR alert inputs
    const edrAlertInputArb = fc.record({
        incidentId: fc.string({ minLength: 1, maxLength: 100 }),
        alertId: fc.string({ minLength: 1, maxLength: 100 }),
        severity: fc.constantFrom('Critical', 'High', 'Medium', 'Low', 'Informational'),
        title: fc.string({ minLength: 1, maxLength: 500 }),
        description: fc.string({ minLength: 1, maxLength: 1000 }),
        threatName: fc.string({ minLength: 1, maxLength: 255 }),
        affectedDevice: fc.string({ minLength: 1, maxLength: 255 }),
        affectedUser: fc.string({ minLength: 1, maxLength: 255 }),
        detectedAt: fc.date(),
        metadata: fc.dictionary(fc.string(), fc.anything()),
    });

    // Generate Firewall alert inputs
    const firewallAlertInputArb = fc.record({
        deviceId: fc.uuid(),
        alertType: fc.constantFrom('ips_alert', 'malware_detected', 'botnet_activity', 'content_filter', 'vpn_alert'),
        severity: alertSeverityArb,
        message: fc.string({ minLength: 1, maxLength: 500 }),
        metadata: fc.dictionary(fc.string(), fc.anything()),
        detectedAt: fc.date(),
    });

    // Generate Email alert inputs
    const emailAlertInputArb = fc.record({
        subject: fc.string({ minLength: 1, maxLength: 500 }),
        body: fc.string({ minLength: 1, maxLength: 2000 }),
        sender: fc.emailAddress(),
        receivedAt: fc.date(),
        deviceIdentifier: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 255 })),
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Default Redis mock - no existing duplicates
        mockConnectRedis.mockResolvedValue({
            get: jest.fn().mockResolvedValue(null),
            setEx: jest.fn().mockResolvedValue('OK'),
            exists: jest.fn().mockResolvedValue(0),
        } as any);
    });

    // ========================================================================
    // Property Test: Alert Ingestion Normalization
    // ========================================================================

    it('should normalize all external system data as alerts regardless of source classification', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.oneof(
                    fc.record({ type: fc.constant('edr' as const), data: edrAlertInputArb }),
                    fc.record({ type: fc.constant('firewall' as const), data: firewallAlertInputArb }),
                    fc.record({ type: fc.constant('email' as const), data: emailAlertInputArb })
                ),
                async (tenantId, alertInput) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database insert for each iteration
                    const mockAlertId = fc.sample(fc.uuid(), 1)[0];

                    // Mock no existing duplicates
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]),
                            }),
                        }),
                    });

                    mockDb.insert.mockReturnValue({
                        values: jest.fn().mockReturnValue({
                            returning: jest.fn().mockResolvedValue([{
                                id: mockAlertId,
                                tenantId,
                                sourceSystem: alertInput.type,
                            }]),
                        }),
                    });

                    // Test: Ingest alert based on type
                    let alertId: string | null = null;

                    switch (alertInput.type) {
                        case 'edr':
                            alertId = await AlertManager.ingestEDRAlert(tenantId, alertInput.data as EDRAlertInput);
                            break;
                        case 'firewall':
                            alertId = await AlertManager.ingestFirewallAlert(tenantId, alertInput.data as FirewallAlertInput);
                            break;
                        case 'email':
                            alertId = await AlertManager.ingestEmailAlert(tenantId, alertInput.data as EmailAlertInput);
                            break;
                    }

                    // Property 1: Alert should always be created (Requirements 12.1, 12.2)
                    expect(alertId).toBe(mockAlertId);
                    expect(alertId).not.toBeNull();

                    // Property 2: All data should be ingested as alerts, not incidents (Requirement 12.1)
                    expect(mockDb.insert).toHaveBeenCalledWith(securityAlerts);

                    // Property 3: Alert should have proper AVIAN structure
                    const insertCall = mockDb.insert().values;
                    expect(insertCall).toHaveBeenCalled();
                    const insertedValues = insertCall.mock.calls[0][0];

                    // Common alert properties
                    expect(insertedValues.tenantId).toBe(tenantId);
                    expect(['edr', 'firewall', 'email']).toContain(insertedValues.sourceSystem);
                    expect(typeof insertedValues.sourceId).toBe('string');
                    expect(insertedValues.sourceId.length).toBeGreaterThan(0);
                    expect(typeof insertedValues.alertType).toBe('string');
                    expect(insertedValues.alertType.length).toBeGreaterThan(0);
                    expect(typeof insertedValues.classification).toBe('string');
                    expect(insertedValues.classification.length).toBeGreaterThan(0);
                    expect(['critical', 'high', 'medium', 'low']).toContain(insertedValues.severity);
                    expect(insertedValues.seenCount).toBe(1);
                    expect(insertedValues.status).toBe('open');
                    expect(insertedValues.assignedTo).toBeNull();

                    // Property 4: Microsoft Defender context preserved as metadata (Requirement 12.4)
                    if (alertInput.type === 'edr') {
                        const edrData = alertInput.data as EDRAlertInput;
                        expect(insertedValues.defenderIncidentId).toBe(edrData.incidentId);
                        expect(insertedValues.defenderAlertId).toBe(edrData.alertId);
                        expect(insertedValues.defenderSeverity).toBe(edrData.severity);
                        expect(insertedValues.threatName).toBe(edrData.threatName);
                        expect(insertedValues.affectedDevice).toBe(edrData.affectedDevice);
                        expect(insertedValues.affectedUser).toBe(edrData.affectedUser);

                        // Defender context also in metadata
                        expect(insertedValues.metadata).toEqual(expect.objectContaining({
                            defenderIncidentId: edrData.incidentId,
                            defenderAlertId: edrData.alertId,
                            defenderSeverity: edrData.severity,
                            threatName: edrData.threatName,
                            affectedDevice: edrData.affectedDevice,
                            affectedUser: edrData.affectedUser,
                        }));
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Deduplication Intelligence Preservation
    // ========================================================================

    it('should preserve deduplication intelligence when processing duplicate alerts', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                edrAlertInputArb,
                fc.integer({ min: 1, max: 50 }), // existing seenCount
                fc.date(), // firstSeenAt
                async (tenantId, edrAlert, existingSeenCount, firstSeenAt) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock existing alert for deduplication
                    const existingAlertId = fc.sample(fc.uuid(), 1)[0];
                    const existingAlert = {
                        id: existingAlertId,
                        tenantId,
                        sourceSystem: 'edr',
                        sourceId: edrAlert.alertId,
                        alertType: 'edr_alert',
                        classification: 'security_alert',
                        seenCount: existingSeenCount,
                        firstSeenAt,
                        lastSeenAt: new Date(firstSeenAt.getTime() + 60000), // 1 minute later
                    };

                    // Mock Redis to return existing alert ID (indicating duplicate)
                    mockConnectRedis.mockResolvedValue({
                        get: jest.fn().mockResolvedValue(existingAlertId),
                        setEx: jest.fn().mockResolvedValue('OK'),
                        exists: jest.fn().mockResolvedValue(1),
                    } as any);

                    // Mock database to return existing alert
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([existingAlert]),
                            }),
                        }),
                    });

                    // Mock database update for seenCount increment
                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(undefined),
                        }),
                    });

                    // Test: Ingest duplicate EDR alert
                    const alertId = await AlertManager.ingestEDRAlert(tenantId, edrAlert);

                    // Property 1: Should return existing alert ID (deduplication occurred)
                    expect(alertId).toBe(existingAlertId);

                    // Property 2: Should not create new alert (no insert call)
                    expect(mockDb.insert).not.toHaveBeenCalled();

                    // Property 3: Should update seenCount and lastSeenAt of existing alert
                    expect(mockDb.update).toHaveBeenCalled();
                    const updateCall = mockDb.update().set;
                    expect(updateCall).toHaveBeenCalledWith(expect.objectContaining({
                        lastSeenAt: expect.any(Date),
                        updatedAt: expect.any(Date),
                    }));

                    // Property 4: seenCount should be incremented (SQL increment expression)
                    const setCall = updateCall.mock.calls[0][0];
                    expect(setCall.seenCount).toBeDefined(); // SQL expression for increment

                    // Property 5: firstSeenAt should be preserved (not updated)
                    expect(setCall.firstSeenAt).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Microsoft Defender Context Preservation
    // ========================================================================

    it('should treat Microsoft Defender incidents as metadata-only context', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                edrAlertInputArb,
                async (tenantId, edrAlert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database insert
                    const mockAlertId = fc.sample(fc.uuid(), 1)[0];

                    // Mock no existing duplicates
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]),
                            }),
                        }),
                    });

                    mockDb.insert.mockReturnValue({
                        values: jest.fn().mockReturnValue({
                            returning: jest.fn().mockResolvedValue([{
                                id: mockAlertId,
                                tenantId,
                                sourceSystem: 'edr',
                                defenderIncidentId: edrAlert.incidentId,
                                defenderAlertId: edrAlert.alertId,
                                status: 'open',
                            }]),
                        }),
                    });

                    // Test: Ingest EDR alert with Defender incident context
                    const alertId = await AlertManager.ingestEDRAlert(tenantId, edrAlert);

                    // Property 1: Alert should be created (not incident) - Requirement 12.4
                    expect(alertId).toBe(mockAlertId);

                    // Property 2: Alert should be inserted into security_alerts table
                    expect(mockDb.insert).toHaveBeenCalledWith(securityAlerts);

                    // Property 3: Defender incident context should be preserved as metadata
                    const insertCall = mockDb.insert().values;
                    expect(insertCall).toHaveBeenCalled();
                    const insertedValues = insertCall.mock.calls[0][0];

                    expect(insertedValues.defenderIncidentId).toBe(edrAlert.incidentId);
                    expect(insertedValues.defenderAlertId).toBe(edrAlert.alertId);
                    expect(insertedValues.defenderSeverity).toBe(edrAlert.severity);
                    expect(insertedValues.threatName).toBe(edrAlert.threatName);
                    expect(insertedValues.affectedDevice).toBe(edrAlert.affectedDevice);
                    expect(insertedValues.affectedUser).toBe(edrAlert.affectedUser);

                    // Property 4: Alert should start in 'open' status (not escalated)
                    expect(insertedValues.status).toBe('open');

                    // Property 5: Microsoft Defender state should be read-only context
                    expect(insertedValues.metadata).toEqual(expect.objectContaining({
                        defenderIncidentId: edrAlert.incidentId,
                        defenderAlertId: edrAlert.alertId,
                        defenderSeverity: edrAlert.severity,
                        threatName: edrAlert.threatName,
                        affectedDevice: edrAlert.affectedDevice,
                        affectedUser: edrAlert.affectedUser,
                    }));
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Source System Normalization Consistency
    // ========================================================================

    it('should normalize alerts consistently across different source systems', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                edrAlertInputArb,
                firewallAlertInputArb,
                emailAlertInputArb,
                async (tenantId, edrAlert, firewallAlert, emailAlert) => {
                    // Test each source system independently to avoid mock accumulation
                    const testSources = [
                        { type: 'edr' as const, data: edrAlert },
                        { type: 'firewall' as const, data: firewallAlert },
                        { type: 'email' as const, data: emailAlert }
                    ];

                    const results: any[] = [];

                    for (const source of testSources) {
                        // Reset mocks for each source
                        jest.clearAllMocks();

                        const mockAlertId = fc.sample(fc.uuid(), 1)[0];

                        // Mock no existing duplicates
                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([]),
                                }),
                            }),
                        });

                        mockDb.insert.mockReturnValue({
                            values: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([{
                                    id: mockAlertId,
                                    tenantId,
                                    sourceSystem: source.type,
                                }]),
                            }),
                        });

                        // Test ingestion
                        let alertId: string | null = null;
                        switch (source.type) {
                            case 'edr':
                                alertId = await AlertManager.ingestEDRAlert(tenantId, source.data as EDRAlertInput);
                                break;
                            case 'firewall':
                                alertId = await AlertManager.ingestFirewallAlert(tenantId, source.data as FirewallAlertInput);
                                break;
                            case 'email':
                                alertId = await AlertManager.ingestEmailAlert(tenantId, source.data as EmailAlertInput);
                                break;
                        }

                        // Collect results for comparison
                        const insertCall = mockDb.insert().values;
                        const insertedValues = insertCall.mock.calls[0][0];
                        results.push({
                            alertId,
                            sourceSystem: source.type,
                            insertedValues
                        });
                    }

                    // Property 1: All alerts should be created successfully (Requirements 12.1, 12.2)
                    results.forEach(result => {
                        expect(result.alertId).not.toBeNull();
                        expect(typeof result.alertId).toBe('string');
                    });

                    // Property 2: All alerts should have consistent AVIAN structure
                    results.forEach(result => {
                        const values = result.insertedValues;

                        // Common required fields for all source systems
                        expect(values.tenantId).toBe(tenantId);
                        expect(['edr', 'firewall', 'email']).toContain(values.sourceSystem);
                        expect(typeof values.sourceId).toBe('string');
                        expect(values.sourceId.length).toBeGreaterThan(0);
                        expect(typeof values.alertType).toBe('string');
                        expect(values.alertType.length).toBeGreaterThan(0);
                        expect(typeof values.classification).toBe('string');
                        expect(values.classification.length).toBeGreaterThan(0);
                        expect(['critical', 'high', 'medium', 'low']).toContain(values.severity);
                        expect(values.seenCount).toBe(1);
                        expect(values.status).toBe('open');
                        expect(values.assignedTo).toBeNull();
                        expect(values.assignedAt).toBeNull();
                        expect(values.detectedAt).toBeInstanceOf(Date);
                    });

                    // Property 3: Source-specific context should be preserved appropriately
                    const edrResult = results.find(r => r.sourceSystem === 'edr');
                    const firewallResult = results.find(r => r.sourceSystem === 'firewall');
                    const emailResult = results.find(r => r.sourceSystem === 'email');

                    if (edrResult) {
                        expect(edrResult.insertedValues.defenderIncidentId).toBe(edrAlert.incidentId);
                        expect(edrResult.insertedValues.defenderAlertId).toBe(edrAlert.alertId);
                    }

                    if (firewallResult) {
                        expect(firewallResult.insertedValues.metadata.deviceId).toBe(firewallAlert.deviceId);
                    }

                    if (emailResult) {
                        expect(emailResult.insertedValues.metadata.sender).toBe(emailAlert.sender);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });
});