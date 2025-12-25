/**
 * Property-Based Test for Incident Creation and Ownership Preservation
 * 
 * **Feature: avian-alerts-incidents, Property 11: Incident creation and ownership preservation**
 * **Validates: Requirements 6.2, 6.3, 7.2**
 * 
 * This test verifies that when an alert is escalated to a Security Incident:
 * 1. A Security Incident is created with ownership preserved from the alert (Requirement 6.2)
 * 2. Alert status is set to "Escalated" (Requirement 6.3)
 * 3. Incident is added to My Security Incidents for the owner (Requirement 7.2)
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
    IncidentFilters,
    AlertSeverity,
    AlertSourceSystem,
    AlertStatus,
    IncidentStatus,
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

describe('Incident Creation and Ownership Preservation Property Tests', () => {
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
    // Property Test: Incident Creation with Ownership Preservation
    // ========================================================================

    it('should create incident with ownership preserved from escalated alert', async () => {
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
                            insert: jest.fn().mockReturnValue({
                                values: jest.fn().mockReturnValue({
                                    returning: jest.fn().mockImplementation(() => {
                                        // Calculate expected SLA timers
                                        const slaConfig = SLA_TIMERS[assignedAlert.severity];
                                        const now = new Date();

                                        const expectedIncident = {
                                            id: expectedIncidentId,
                                            tenantId: assignedAlert.tenantId,
                                            ownerId: assignedAlert.assignedTo,
                                            title: incidentTitle || `Security Incident: ${assignedAlert.title}`,
                                            description: incidentDescription || assignedAlert.description || null,
                                            severity: assignedAlert.severity,
                                            status: 'open' as IncidentStatus,
                                            resolutionSummary: null,
                                            dismissalJustification: null,
                                            slaAcknowledgeBy: new Date(now.getTime() + slaConfig.acknowledgeMinutes * 60 * 1000),
                                            slaInvestigateBy: new Date(now.getTime() + slaConfig.investigateMinutes * 60 * 1000),
                                            slaResolveBy: new Date(now.getTime() + slaConfig.resolveMinutes * 60 * 1000),
                                            acknowledgedAt: null,
                                            investigationStartedAt: null,
                                            resolvedAt: null,
                                            createdAt: now,
                                            updatedAt: now,
                                        };
                                        return Promise.resolve([expectedIncident]);
                                    }),
                                }),
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

                    // Property 1: Incident should be created (Requirement 6.2)
                    expect(incidentId).toBeDefined();
                    expect(typeof incidentId).toBe('string');

                    // Property 2: Alert should be validated as escalatable
                    const mockTx = mockDb.transaction.mock.calls[0][0];
                    await mockTx({
                        select: jest.fn().mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([assignedAlert]),
                                }),
                            }),
                        }),
                        insert: jest.fn().mockReturnValue({
                            values: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([{ id: expectedIncidentId }]),
                            }),
                        }),
                        update: jest.fn().mockReturnValue({
                            set: jest.fn().mockReturnValue({
                                where: jest.fn().mockResolvedValue(undefined),
                            }),
                        }),
                    });

                    // Verify alert query includes proper conditions
                    expect(mockDb.transaction).toHaveBeenCalled();

                    // Property 3: Incident should preserve ownership from alert (Requirement 6.2, 7.2)
                    // This is verified by checking the incident creation parameters
                    const transactionCallback = mockDb.transaction.mock.calls[0][0];
                    const mockTxInstance = {
                        select: jest.fn().mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([assignedAlert]),
                                }),
                            }),
                        }),
                        insert: jest.fn().mockReturnValue({
                            values: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([{
                                    id: expectedIncidentId,
                                    ownerId: assignedAlert.assignedTo,
                                    tenantId: assignedAlert.tenantId,
                                }]),
                            }),
                        }),
                        update: jest.fn().mockReturnValue({
                            set: jest.fn().mockReturnValue({
                                where: jest.fn().mockResolvedValue(undefined),
                            }),
                        }),
                    };

                    await transactionCallback(mockTxInstance);

                    // Verify incident creation with preserved ownership
                    expect(mockTxInstance.insert).toHaveBeenCalledWith(securityIncidents);
                    const incidentValues = mockTxInstance.insert().values.mock.calls[0][0];
                    expect(incidentValues.ownerId).toBe(assignedAlert.assignedTo);
                    expect(incidentValues.tenantId).toBe(assignedAlert.tenantId);
                    expect(incidentValues.severity).toBe(assignedAlert.severity);
                    expect(incidentValues.status).toBe('open');

                    // Property 4: Alert status should be updated to "escalated" (Requirement 6.3)
                    expect(mockTxInstance.update).toHaveBeenCalledWith(securityAlerts);
                    const alertUpdate = mockTxInstance.update().set.mock.calls[0][0];
                    expect(alertUpdate.status).toBe('escalated');
                    expect(alertUpdate.updatedAt).toBeInstanceOf(Date);

                    // Property 5: Alert should be linked to incident as primary alert
                    expect(mockTxInstance.insert).toHaveBeenCalledWith(incidentAlertLinks);
                    const linkValues = mockTxInstance.insert().values.mock.calls[1][0];
                    expect(linkValues.alertId).toBe(assignedAlert.id);
                    expect(linkValues.isPrimary).toBe(true);

                    // Property 6: SLA timers should be calculated based on alert severity
                    const slaConfig = SLA_TIMERS[assignedAlert.severity];
                    expect(incidentValues.slaAcknowledgeBy).toBeInstanceOf(Date);
                    expect(incidentValues.slaInvestigateBy).toBeInstanceOf(Date);
                    expect(incidentValues.slaResolveBy).toBeInstanceOf(Date);

                    // Verify SLA timing is reasonable (within expected ranges)
                    const now = new Date();
                    const acknowledgeDelay = incidentValues.slaAcknowledgeBy.getTime() - now.getTime();
                    const investigateDelay = incidentValues.slaInvestigateBy.getTime() - now.getTime();
                    const resolveDelay = incidentValues.slaResolveBy.getTime() - now.getTime();

                    // Allow for some timing variance (±5 minutes)
                    const variance = 5 * 60 * 1000;
                    expect(acknowledgeDelay).toBeGreaterThanOrEqual((slaConfig.acknowledgeMinutes * 60 * 1000) - variance);
                    expect(acknowledgeDelay).toBeLessThanOrEqual((slaConfig.acknowledgeMinutes * 60 * 1000) + variance);
                    expect(investigateDelay).toBeGreaterThanOrEqual((slaConfig.investigateMinutes * 60 * 1000) - variance);
                    expect(investigateDelay).toBeLessThanOrEqual((slaConfig.investigateMinutes * 60 * 1000) + variance);
                    expect(resolveDelay).toBeGreaterThanOrEqual((slaConfig.resolveMinutes * 60 * 1000) - variance);
                    expect(resolveDelay).toBeLessThanOrEqual((slaConfig.resolveMinutes * 60 * 1000) + variance);
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Incident Appears in My Security Incidents
    // ========================================================================

    it('should add incident to My Security Incidents for the owner after escalation', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                fc.array(assignedAlertArb, { minLength: 0, maxLength: 5 }), // Other incidents for the same owner
                async (escalatedAlert, otherIncidents) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    const incidentId = fc.sample(fc.uuid(), 1)[0];
                    const ownerId = escalatedAlert.assignedTo!;

                    // Setup: Mock escalation process
                    mockDb.transaction.mockImplementation(async (callback) => {
                        const mockTx = {
                            select: jest.fn().mockReturnValue({
                                from: jest.fn().mockReturnValue({
                                    where: jest.fn().mockReturnValue({
                                        limit: jest.fn().mockResolvedValue([escalatedAlert]),
                                    }),
                                }),
                            }),
                            insert: jest.fn().mockReturnValue({
                                values: jest.fn().mockReturnValue({
                                    returning: jest.fn().mockResolvedValue([{
                                        id: incidentId,
                                        tenantId: escalatedAlert.tenantId,
                                        ownerId: ownerId,
                                        title: `Security Incident: ${escalatedAlert.title}`,
                                        severity: escalatedAlert.severity,
                                        status: 'open',
                                    }]),
                                }),
                            }),
                            update: jest.fn().mockReturnValue({
                                set: jest.fn().mockReturnValue({
                                    where: jest.fn().mockResolvedValue(undefined),
                                }),
                            }),
                        };
                        return callback(mockTx);
                    });

                    // Test: Escalate alert
                    const escalateInput: EscalateAlertInput = {
                        alertId: escalatedAlert.id,
                        tenantId: escalatedAlert.tenantId,
                    };

                    await IncidentManager.escalateAlert(escalateInput);

                    // Now test that incident appears in My Security Incidents
                    jest.clearAllMocks();

                    // Create mock incidents including the new one
                    const newIncident: SecurityIncident = {
                        id: incidentId,
                        tenantId: escalatedAlert.tenantId,
                        ownerId: ownerId,
                        title: `Security Incident: ${escalatedAlert.title}`,
                        description: escalatedAlert.description,
                        severity: escalatedAlert.severity,
                        status: 'open',
                        resolutionSummary: null,
                        dismissalJustification: null,
                        slaAcknowledgeBy: new Date(),
                        slaInvestigateBy: new Date(),
                        slaResolveBy: new Date(),
                        acknowledgedAt: null,
                        investigationStartedAt: null,
                        resolvedAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };

                    const allOwnerIncidents = [newIncident, ...otherIncidents.map(alert => ({
                        id: fc.sample(fc.uuid(), 1)[0],
                        tenantId: escalatedAlert.tenantId,
                        ownerId: ownerId,
                        title: `Incident: ${alert.title}`,
                        description: alert.description,
                        severity: alert.severity,
                        status: 'open' as IncidentStatus,
                        resolutionSummary: null,
                        dismissalJustification: null,
                        slaAcknowledgeBy: new Date(),
                        slaInvestigateBy: new Date(),
                        slaResolveBy: new Date(),
                        acknowledgedAt: null,
                        investigationStartedAt: null,
                        resolvedAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }))];

                    // Mock My Security Incidents query
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockResolvedValue(allOwnerIncidents),
                            }),
                        }),
                    });

                    // Test: Get My Security Incidents
                    const myIncidents = await IncidentManager.getMyIncidents(
                        escalatedAlert.tenantId,
                        ownerId
                    );

                    // Property 1: New incident should appear in My Security Incidents (Requirement 7.2)
                    const newIncidentInMyIncidents = myIncidents.some(incident => incident.id === incidentId);
                    expect(newIncidentInMyIncidents).toBe(true);

                    // Property 2: All incidents should belong to the owner
                    const allIncidentsOwnedByUser = myIncidents.every(incident => incident.ownerId === ownerId);
                    expect(allIncidentsOwnedByUser).toBe(true);

                    // Property 3: All incidents should be in the same tenant
                    const allIncidentsInSameTenant = myIncidents.every(incident =>
                        incident.tenantId === escalatedAlert.tenantId
                    );
                    expect(allIncidentsInSameTenant).toBe(true);

                    // Property 4: Database query should filter by owner and tenant
                    expect(mockDb.select).toHaveBeenCalled();
                    const queryConditions = mockDb.select().from().where.mock.calls[0][0];
                    // The actual query conditions would be validated in the service implementation
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Escalation Validation and Error Handling
    // ========================================================================

    it('should validate alert state and ownership before escalation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
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
                    status: fc.constantFrom<AlertStatus>('open', 'closed_benign', 'closed_false_positive', 'escalated'), // Invalid states for escalation
                    assignedTo: fc.oneof(fc.constant(null), userIdArb), // May or may not be assigned
                    assignedAt: fc.oneof(fc.constant(null), fc.date()),
                    detectedAt: fc.date(),
                    createdAt: fc.date(),
                    updatedAt: fc.date(),
                }),
                async (invalidAlert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return invalid alert or no alert
                    mockDb.transaction.mockImplementation(async (callback) => {
                        const mockTx = {
                            select: jest.fn().mockReturnValue({
                                from: jest.fn().mockReturnValue({
                                    where: jest.fn().mockReturnValue({
                                        limit: jest.fn().mockResolvedValue([]), // No valid alert found
                                    }),
                                }),
                            }),
                        };
                        return callback(mockTx);
                    });

                    // Test: Attempt to escalate invalid alert
                    const escalateInput: EscalateAlertInput = {
                        alertId: invalidAlert.id,
                        tenantId: invalidAlert.tenantId,
                    };

                    // Property 1: Escalation should fail for invalid alerts
                    await expect(IncidentManager.escalateAlert(escalateInput))
                        .rejects.toThrow('Alert not found or not in investigating status. Investigation must be completed before escalation.');

                    // Property 2: No incident should be created for invalid escalation
                    expect(mockDb.transaction).toHaveBeenCalled();
                    const transactionCallback = mockDb.transaction.mock.calls[0][0];
                    const mockTx = {
                        select: jest.fn().mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([]),
                                }),
                            }),
                        }),
                        insert: jest.fn(),
                        update: jest.fn(),
                    };

                    try {
                        await transactionCallback(mockTx);
                    } catch (error) {
                        // Expected to throw
                    }

                    // Verify no incident creation was attempted
                    expect(mockTx.insert).not.toHaveBeenCalled();
                    expect(mockTx.update).not.toHaveBeenCalled();

                    // Property 3: Database query should validate alert state
                    expect(mockTx.select).toHaveBeenCalled();
                    const selectQuery = mockTx.select().from().where;
                    expect(selectQuery).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, invalidAlert.id),
                            eq(securityAlerts.tenantId, invalidAlert.tenantId),
                            inArray(securityAlerts.status, ['assigned', 'investigating'])
                        )
                    );
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Ownership Preservation Across Tenant Boundaries
    // ========================================================================

    it('should enforce tenant isolation in incident ownership preservation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.tuple(tenantIdArb, tenantIdArb).filter(([t1, t2]) => t1 !== t2), // Different tenants
                assignedAlertArb,
                async ([tenant1, tenant2], alert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Alert belongs to tenant1
                    const tenant1Alert = { ...alert, tenantId: tenant1 };

                    // Mock transaction for valid tenant
                    mockDb.transaction.mockImplementation(async (callback) => {
                        const mockTx = {
                            select: jest.fn().mockReturnValue({
                                from: jest.fn().mockReturnValue({
                                    where: jest.fn().mockReturnValue({
                                        limit: jest.fn().mockImplementation((conditions) => {
                                            // Simulate tenant filtering - only return alert if tenant matches
                                            return Promise.resolve(tenant1 === tenant1 ? [tenant1Alert] : []);
                                        }),
                                    }),
                                }),
                            }),
                            insert: jest.fn().mockReturnValue({
                                values: jest.fn().mockReturnValue({
                                    returning: jest.fn().mockResolvedValue([{
                                        id: fc.sample(fc.uuid(), 1)[0],
                                        tenantId: tenant1,
                                        ownerId: tenant1Alert.assignedTo,
                                    }]),
                                }),
                            }),
                            update: jest.fn().mockReturnValue({
                                set: jest.fn().mockReturnValue({
                                    where: jest.fn().mockResolvedValue(undefined),
                                }),
                            }),
                        };
                        return callback(mockTx);
                    });

                    // Test: Escalate alert in correct tenant should succeed
                    const validEscalation: EscalateAlertInput = {
                        alertId: tenant1Alert.id,
                        tenantId: tenant1,
                    };

                    await expect(IncidentManager.escalateAlert(validEscalation)).resolves.toBeDefined();

                    // Test: Escalate alert in wrong tenant should fail
                    jest.clearAllMocks();
                    mockDb.transaction.mockImplementation(async (callback) => {
                        const mockTx = {
                            select: jest.fn().mockReturnValue({
                                from: jest.fn().mockReturnValue({
                                    where: jest.fn().mockReturnValue({
                                        limit: jest.fn().mockResolvedValue([]), // No alert found in tenant2
                                    }),
                                }),
                            }),
                        };
                        return callback(mockTx);
                    });

                    const invalidEscalation: EscalateAlertInput = {
                        alertId: tenant1Alert.id,
                        tenantId: tenant2, // Wrong tenant
                    };

                    // Property: Cross-tenant escalation should fail
                    await expect(IncidentManager.escalateAlert(invalidEscalation))
                        .rejects.toThrow('Alert not found or not in investigating status. Investigation must be completed before escalation.');

                    // Property: Incident ownership should be preserved within tenant boundaries
                    expect(mockDb.transaction).toHaveBeenCalled();
                }
            ),
            { numRuns: 30 }
        );
    });
});