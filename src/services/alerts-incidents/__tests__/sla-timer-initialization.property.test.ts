/**
 * Property-Based Test for SLA Timer Initialization
 * 
 * **Feature: avian-alerts-incidents, Property 14: SLA timer initialization**
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**
 * 
 * This test verifies that when an incident is created, SLA timers are set based on severity:
 * - Critical: acknowledge 15m, investigate 1h, resolve 4h
 * - High: acknowledge 30m, investigate 2h, resolve 8h  
 * - Medium: acknowledge 1h, investigate 4h, resolve 24h
 * - Low: acknowledge 4h, investigate 8h, resolve 72h
 */

import * as fc from 'fast-check';
import { IncidentManager } from '../IncidentManager';
import { db } from '../../../lib/database';
import { securityIncidents, securityAlerts, incidentAlertLinks } from '../../../../database/schemas/alerts-incidents';
import { eq, and, inArray } from 'drizzle-orm';
import {
    SecurityAlert,
    SecurityIncident,
    EscalateAlertInput,
    AlertSeverity,
    AlertSourceSystem,
    AlertStatus,
    SLA_TIMERS,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        transaction: jest.fn(),
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
    },
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
        logIncidentCreated: jest.fn().mockResolvedValue(undefined),
        logAlertEscalated: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../OwnershipEnforcementService', () => ({
    OwnershipEnforcementService: {
        trackOwnershipChange: jest.fn().mockResolvedValue(undefined),
    },
}));

describe('SLA Timer Initialization Property Tests', () => {
    const mockDb = db as any;

    // ========================================================================
    // Property Test Generators
    // ========================================================================

    // Generate valid tenant IDs
    const tenantIdArb = fc.uuid();

    // Generate valid user IDs
    const userIdArb = fc.uuid();

    // Generate alert severities
    const alertSeverityArb = fc.constantFrom<AlertSeverity>('critical', 'high', 'medium', 'low');

    // Generate alert source systems
    const alertSourceSystemArb = fc.constantFrom<AlertSourceSystem>('edr', 'firewall', 'email');

    // Generate escalatable alert statuses
    const escalatableStatusArb = fc.constantFrom<AlertStatus>('assigned', 'investigating');

    // Generate assigned security alert data (ready for escalation)
    const assignedAlertArb = fc.record({
        id: fc.uuid(),
        tenantId: tenantIdArb,
        sourceSystem: alertSourceSystemArb,
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
        defenderIncidentId: fc.oneof(fc.constant(null), fc.string()),
        defenderAlertId: fc.oneof(fc.constant(null), fc.string()),
        defenderSeverity: fc.oneof(fc.constant(null), fc.string()),
        threatName: fc.oneof(fc.constant(null), fc.string()),
        affectedDevice: fc.oneof(fc.constant(null), fc.string()),
        affectedUser: fc.oneof(fc.constant(null), fc.string()),
        status: escalatableStatusArb, // Must be assigned or investigating
        assignedTo: userIdArb, // Must be assigned to someone
        assignedAt: fc.date(),
        detectedAt: fc.date(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: SLA Timer Initialization Based on Severity
    // ========================================================================

    it('should initialize SLA timers correctly based on incident severity', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 500 })), // Optional incident title
                fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 1000 })), // Optional incident description
                async (assignedAlert, incidentTitle, incidentDescription) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Generate expected incident ID
                    const expectedIncidentId = fc.sample(fc.uuid(), 1)[0];

                    // Capture the current time for SLA calculations
                    const testStartTime = new Date();

                    // Setup: Mock database transaction
                    let capturedIncidentValues: any = null;

                    mockDb.transaction.mockImplementation(async (callback) => {
                        const mockTx = {
                            select: jest.fn().mockReturnValue({
                                from: jest.fn().mockReturnValue({
                                    where: jest.fn().mockReturnValue({
                                        limit: jest.fn().mockResolvedValue([assignedAlert]),
                                    }),
                                }),
                            }),
                            insert: jest.fn().mockImplementation((table) => {
                                if (table === securityIncidents) {
                                    return {
                                        values: jest.fn().mockImplementation((values) => {
                                            capturedIncidentValues = values;
                                            return {
                                                returning: jest.fn().mockResolvedValue([{
                                                    id: expectedIncidentId,
                                                    ...values,
                                                }]),
                                            };
                                        }),
                                    };
                                } else {
                                    // For incident alert links
                                    return {
                                        values: jest.fn().mockReturnValue({
                                            returning: jest.fn().mockResolvedValue([{}]),
                                        }),
                                    };
                                }
                            }),
                            update: jest.fn().mockReturnValue({
                                set: jest.fn().mockReturnValue({
                                    where: jest.fn().mockResolvedValue(undefined),
                                }),
                            }),
                        };
                        return callback(mockTx);
                    });

                    // Test: Escalate alert to incident
                    const escalateInput: EscalateAlertInput = {
                        alertId: assignedAlert.id,
                        tenantId: assignedAlert.tenantId,
                        incidentTitle,
                        incidentDescription,
                    };

                    const incidentId = await IncidentManager.escalateAlert(escalateInput);

                    // Property 1: Incident should be created successfully
                    expect(incidentId).toBeDefined();
                    expect(typeof incidentId).toBe('string');
                    expect(capturedIncidentValues).toBeDefined();

                    // Property 2: SLA timers should be set based on alert severity (Requirements 10.1, 10.2, 10.3, 10.4, 10.5)
                    const slaConfig = SLA_TIMERS[assignedAlert.severity];

                    expect(capturedIncidentValues.slaAcknowledgeBy).toBeInstanceOf(Date);
                    expect(capturedIncidentValues.slaInvestigateBy).toBeInstanceOf(Date);
                    expect(capturedIncidentValues.slaResolveBy).toBeInstanceOf(Date);

                    // Property 3: SLA acknowledge timer should match severity configuration
                    const acknowledgeDelay = capturedIncidentValues.slaAcknowledgeBy.getTime() - testStartTime.getTime();
                    const expectedAcknowledgeDelay = slaConfig.acknowledgeMinutes * 60 * 1000;

                    // Allow for timing variance (±10 seconds for test execution time)
                    const variance = 10 * 1000;
                    expect(acknowledgeDelay).toBeGreaterThanOrEqual(expectedAcknowledgeDelay - variance);
                    expect(acknowledgeDelay).toBeLessThanOrEqual(expectedAcknowledgeDelay + variance);

                    // Property 4: SLA investigate timer should match severity configuration
                    const investigateDelay = capturedIncidentValues.slaInvestigateBy.getTime() - testStartTime.getTime();
                    const expectedInvestigateDelay = slaConfig.investigateMinutes * 60 * 1000;

                    expect(investigateDelay).toBeGreaterThanOrEqual(expectedInvestigateDelay - variance);
                    expect(investigateDelay).toBeLessThanOrEqual(expectedInvestigateDelay + variance);

                    // Property 5: SLA resolve timer should match severity configuration
                    const resolveDelay = capturedIncidentValues.slaResolveBy.getTime() - testStartTime.getTime();
                    const expectedResolveDelay = slaConfig.resolveMinutes * 60 * 1000;

                    expect(resolveDelay).toBeGreaterThanOrEqual(expectedResolveDelay - variance);
                    expect(resolveDelay).toBeLessThanOrEqual(expectedResolveDelay + variance);

                    // Property 6: SLA timers should be in chronological order (acknowledge <= investigate <= resolve)
                    expect(capturedIncidentValues.slaAcknowledgeBy.getTime()).toBeLessThanOrEqual(
                        capturedIncidentValues.slaInvestigateBy.getTime()
                    );
                    expect(capturedIncidentValues.slaInvestigateBy.getTime()).toBeLessThanOrEqual(
                        capturedIncidentValues.slaResolveBy.getTime()
                    );

                    // Property 7: All SLA timers should be in the future
                    expect(capturedIncidentValues.slaAcknowledgeBy.getTime()).toBeGreaterThan(testStartTime.getTime());
                    expect(capturedIncidentValues.slaInvestigateBy.getTime()).toBeGreaterThan(testStartTime.getTime());
                    expect(capturedIncidentValues.slaResolveBy.getTime()).toBeGreaterThan(testStartTime.getTime());
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: SLA Timer Configuration Consistency
    // ========================================================================

    it('should use consistent SLA timer configuration across all severity levels', async () => {
        await fc.assert(
            fc.asyncProperty(
                alertSeverityArb,
                async (severity) => {
                    // Property 1: SLA configuration should exist for all severity levels
                    const slaConfig = SLA_TIMERS[severity];
                    expect(slaConfig).toBeDefined();
                    expect(slaConfig.acknowledgeMinutes).toBeGreaterThan(0);
                    expect(slaConfig.investigateMinutes).toBeGreaterThan(0);
                    expect(slaConfig.resolveMinutes).toBeGreaterThan(0);

                    // Property 2: SLA timers should be in logical order (acknowledge <= investigate <= resolve)
                    expect(slaConfig.acknowledgeMinutes).toBeLessThanOrEqual(slaConfig.investigateMinutes);
                    expect(slaConfig.investigateMinutes).toBeLessThanOrEqual(slaConfig.resolveMinutes);

                    // Property 3: Critical incidents should have the shortest SLA timers
                    const criticalConfig = SLA_TIMERS.critical;
                    if (severity !== 'critical') {
                        expect(slaConfig.acknowledgeMinutes).toBeGreaterThanOrEqual(criticalConfig.acknowledgeMinutes);
                        expect(slaConfig.investigateMinutes).toBeGreaterThanOrEqual(criticalConfig.investigateMinutes);
                        expect(slaConfig.resolveMinutes).toBeGreaterThanOrEqual(criticalConfig.resolveMinutes);
                    }

                    // Property 4: Low incidents should have the longest SLA timers
                    const lowConfig = SLA_TIMERS.low;
                    if (severity !== 'low') {
                        expect(slaConfig.acknowledgeMinutes).toBeLessThanOrEqual(lowConfig.acknowledgeMinutes);
                        expect(slaConfig.investigateMinutes).toBeLessThanOrEqual(lowConfig.investigateMinutes);
                        expect(slaConfig.resolveMinutes).toBeLessThanOrEqual(lowConfig.resolveMinutes);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: SLA Timer Precision and Accuracy
    // ========================================================================

    it('should calculate SLA timers with precise timing based on creation time', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                fc.integer({ min: 0, max: 3600000 }), // Random delay up to 1 hour in milliseconds
                async (assignedAlert, creationDelay) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Simulate incident creation at a specific time
                    const simulatedCreationTime = new Date(Date.now() + creationDelay);

                    // Mock Date.now to return our simulated time
                    const originalNow = Date.now;
                    Date.now = jest.fn().mockReturnValue(simulatedCreationTime.getTime());

                    // Also mock Date constructor
                    const originalDate = global.Date;
                    global.Date = jest.fn().mockImplementation((arg) => {
                        if (arg === undefined) {
                            return new originalDate(simulatedCreationTime.getTime());
                        }
                        return new originalDate(arg);
                    }) as any;
                    global.Date.now = Date.now;

                    let capturedIncidentValues: any = null;

                    try {
                        // Setup: Mock database transaction
                        mockDb.transaction.mockImplementation(async (callback) => {
                            const mockTx = {
                                select: jest.fn().mockReturnValue({
                                    from: jest.fn().mockReturnValue({
                                        where: jest.fn().mockReturnValue({
                                            limit: jest.fn().mockResolvedValue([assignedAlert]),
                                        }),
                                    }),
                                }),
                                insert: jest.fn().mockImplementation((table) => {
                                    if (table === securityIncidents) {
                                        return {
                                            values: jest.fn().mockImplementation((values) => {
                                                capturedIncidentValues = values;
                                                return {
                                                    returning: jest.fn().mockResolvedValue([{
                                                        id: fc.sample(fc.uuid(), 1)[0],
                                                        ...values,
                                                    }]),
                                                };
                                            }),
                                        };
                                    } else {
                                        return {
                                            values: jest.fn().mockReturnValue({
                                                returning: jest.fn().mockResolvedValue([{}]),
                                            }),
                                        };
                                    }
                                }),
                                update: jest.fn().mockReturnValue({
                                    set: jest.fn().mockReturnValue({
                                        where: jest.fn().mockResolvedValue(undefined),
                                    }),
                                }),
                            };
                            return callback(mockTx);
                        });

                        // Test: Escalate alert to incident
                        const escalateInput: EscalateAlertInput = {
                            alertId: assignedAlert.id,
                            tenantId: assignedAlert.tenantId,
                        };

                        await IncidentManager.escalateAlert(escalateInput);

                        // Property 1: SLA timers should be calculated from the exact creation time
                        expect(capturedIncidentValues).toBeDefined();

                        const slaConfig = SLA_TIMERS[assignedAlert.severity];

                        // Property 2: Acknowledge timer should be exactly creation time + acknowledge minutes
                        const expectedAcknowledgeTime = simulatedCreationTime.getTime() + (slaConfig.acknowledgeMinutes * 60 * 1000);
                        expect(capturedIncidentValues.slaAcknowledgeBy.getTime()).toBe(expectedAcknowledgeTime);

                        // Property 3: Investigate timer should be exactly creation time + investigate minutes
                        const expectedInvestigateTime = simulatedCreationTime.getTime() + (slaConfig.investigateMinutes * 60 * 1000);
                        expect(capturedIncidentValues.slaInvestigateBy.getTime()).toBe(expectedInvestigateTime);

                        // Property 4: Resolve timer should be exactly creation time + resolve minutes
                        const expectedResolveTime = simulatedCreationTime.getTime() + (slaConfig.resolveMinutes * 60 * 1000);
                        expect(capturedIncidentValues.slaResolveBy.getTime()).toBe(expectedResolveTime);

                        // Property 5: SLA timers should maintain their relative intervals regardless of creation time
                        const acknowledgeInterval = capturedIncidentValues.slaAcknowledgeBy.getTime() - simulatedCreationTime.getTime();
                        const investigateInterval = capturedIncidentValues.slaInvestigateBy.getTime() - simulatedCreationTime.getTime();
                        const resolveInterval = capturedIncidentValues.slaResolveBy.getTime() - simulatedCreationTime.getTime();

                        expect(acknowledgeInterval).toBe(slaConfig.acknowledgeMinutes * 60 * 1000);
                        expect(investigateInterval).toBe(slaConfig.investigateMinutes * 60 * 1000);
                        expect(resolveInterval).toBe(slaConfig.resolveMinutes * 60 * 1000);

                    } finally {
                        // Restore original Date functions
                        Date.now = originalNow;
                        global.Date = originalDate;
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: SLA Timer Values Match Requirements
    // ========================================================================

    it('should set SLA timers according to exact requirement specifications', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom<AlertSeverity>('critical', 'high', 'medium', 'low'),
                async (severity) => {
                    // Property 1: SLA configuration should match exact requirements (Requirements 10.2, 10.3, 10.4, 10.5)
                    const slaConfig = SLA_TIMERS[severity];

                    switch (severity) {
                        case 'critical':
                            // Requirement 10.2: Critical incidents - acknowledge 15m, investigate 1h, resolve 4h
                            expect(slaConfig.acknowledgeMinutes).toBe(15);
                            expect(slaConfig.investigateMinutes).toBe(60);
                            expect(slaConfig.resolveMinutes).toBe(240); // 4 hours
                            break;

                        case 'high':
                            // Requirement 10.3: High incidents - acknowledge 30m, investigate 2h, resolve 8h
                            expect(slaConfig.acknowledgeMinutes).toBe(30);
                            expect(slaConfig.investigateMinutes).toBe(120); // 2 hours
                            expect(slaConfig.resolveMinutes).toBe(480); // 8 hours
                            break;

                        case 'medium':
                            // Requirement 10.4: Medium incidents - acknowledge 1h, investigate 4h, resolve 24h
                            expect(slaConfig.acknowledgeMinutes).toBe(60); // 1 hour
                            expect(slaConfig.investigateMinutes).toBe(240); // 4 hours
                            expect(slaConfig.resolveMinutes).toBe(1440); // 24 hours
                            break;

                        case 'low':
                            // Requirement 10.5: Low incidents - acknowledge 4h, investigate 8h, resolve 72h
                            expect(slaConfig.acknowledgeMinutes).toBe(240); // 4 hours
                            expect(slaConfig.investigateMinutes).toBe(480); // 8 hours
                            expect(slaConfig.resolveMinutes).toBe(4320); // 72 hours
                            break;
                    }

                    // Property 2: All SLA timers should be positive values
                    expect(slaConfig.acknowledgeMinutes).toBeGreaterThan(0);
                    expect(slaConfig.investigateMinutes).toBeGreaterThan(0);
                    expect(slaConfig.resolveMinutes).toBeGreaterThan(0);

                    // Property 3: SLA timers should follow logical progression
                    expect(slaConfig.acknowledgeMinutes).toBeLessThan(slaConfig.investigateMinutes);
                    expect(slaConfig.investigateMinutes).toBeLessThan(slaConfig.resolveMinutes);
                }
            ),
            { numRuns: 20 } // Lower runs since we're testing all 4 severity levels
        );
    });
});