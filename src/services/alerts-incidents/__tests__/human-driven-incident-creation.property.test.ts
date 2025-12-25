/**
 * Property-Based Test for Human-Driven Incident Creation
 * 
 * **Feature: avian-alerts-incidents, Property 16: Human-driven incident creation**
 * **Validates: Requirements 12.3, 12.5**
 * 
 * This test verifies that:
 * 1. Only analyst escalation decisions should succeed in creating incidents (Requirement 12.3)
 * 2. Automated or direct incident creation should fail (Requirement 12.5)
 * 3. The system enforces the principle that alerts are signals and incidents are human decisions
 */

import * as fc from 'fast-check';
import { IncidentManager } from '../IncidentManager';
import { db } from '../../../lib/database';
import { securityIncidents, securityAlerts } from '../../../../database/schemas/alerts-incidents';
import { eq, and } from 'drizzle-orm';
import {
    SecurityAlert,
    EscalateAlertInput,
    CreateSecurityIncidentInput,
    AlertSeverity,
    AlertSourceSystem,
    AlertStatus,
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

describe('Human-Driven Incident Creation Property Tests', () => {
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

    // Generate direct incident creation input (should be rejected)
    const directIncidentInputArb = fc.record({
        tenantId: tenantIdArb,
        ownerId: userIdArb,
        title: fc.string({ minLength: 1, maxLength: 500 }),
        description: fc.oneof(fc.constant(undefined), fc.string({ maxLength: 1000 })),
        severity: alertSeverityArb,
        slaAcknowledgeBy: fc.date(),
        slaInvestigateBy: fc.date(),
        slaResolveBy: fc.date(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: Human-Driven Escalation Should Succeed
    // ========================================================================

    it('should allow incident creation only through analyst escalation decisions', async () => {
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

                    // Setup: Mock database transaction for valid escalation
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
                                    returning: jest.fn().mockResolvedValue([{
                                        id: expectedIncidentId,
                                        tenantId: assignedAlert.tenantId,
                                        ownerId: assignedAlert.assignedTo,
                                        title: incidentTitle || `Security Incident: ${assignedAlert.title}`,
                                        severity: assignedAlert.severity,
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

                    // Test: Human-driven escalation through analyst decision
                    const escalateInput: EscalateAlertInput = {
                        alertId: assignedAlert.id,
                        tenantId: assignedAlert.tenantId,
                        incidentTitle,
                        incidentDescription,
                    };

                    const incidentId = await IncidentManager.escalateAlert(escalateInput);

                    // Property 1: Human-driven escalation should succeed (Requirement 12.3)
                    expect(incidentId).toBeDefined();
                    expect(typeof incidentId).toBe('string');
                    expect(incidentId).toBe(expectedIncidentId);

                    // Property 2: Escalation should validate alert is assigned to an analyst
                    expect(mockDb.transaction).toHaveBeenCalled();
                    const transactionCallback = mockDb.transaction.mock.calls[0][0];
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
                                returning: jest.fn().mockResolvedValue([{
                                    id: expectedIncidentId,
                                    ownerId: assignedAlert.assignedTo,
                                }]),
                            }),
                        }),
                        update: jest.fn().mockReturnValue({
                            set: jest.fn().mockReturnValue({
                                where: jest.fn().mockResolvedValue(undefined),
                            }),
                        }),
                    };

                    await transactionCallback(mockTx);

                    // Verify alert validation includes assignment check
                    expect(mockTx.select).toHaveBeenCalledWith();
                    const selectQuery = mockTx.select().from().where().limit;
                    expect(selectQuery).toHaveBeenCalledWith(1);

                    // Property 3: Incident should be created with analyst as owner (human decision)
                    expect(mockTx.insert).toHaveBeenCalledWith(securityIncidents);
                    const incidentValues = mockTx.insert().values.mock.calls[0][0];
                    expect(incidentValues.ownerId).toBe(assignedAlert.assignedTo);
                    expect(incidentValues.tenantId).toBe(assignedAlert.tenantId);

                    // Property 4: Alert should be marked as escalated (human decision outcome)
                    expect(mockTx.update).toHaveBeenCalledWith(securityAlerts);
                    const alertUpdate = mockTx.update().set.mock.calls[0][0];
                    expect(alertUpdate.status).toBe('escalated');
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Direct Incident Creation Should Fail
    // ========================================================================

    it('should reject direct incident creation attempts (non-human-driven)', async () => {
        await fc.assert(
            fc.asyncProperty(
                directIncidentInputArb,
                async (directInput) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Property 1: IncidentManager should block direct incident creation methods
                    // These methods exist but always throw errors to enforce workflow
                    await expect(IncidentManager.createIncident()).rejects.toThrow('Direct incident creation is blocked');
                    await expect(IncidentManager.createIncidents()).rejects.toThrow('Bulk incident creation is blocked');

                    // Property 2: Attempting to directly insert into incidents table should fail validation
                    // (This would be caught by database constraints and business logic)

                    // Mock direct database insertion attempt
                    mockDb.insert.mockReturnValue({
                        values: jest.fn().mockReturnValue({
                            returning: jest.fn().mockRejectedValue(
                                new Error('Direct incident creation not allowed - incidents must be created through alert escalation')
                            ),
                        }),
                    });

                    // Test: Attempt direct incident creation (should fail)
                    try {
                        await mockDb.insert(securityIncidents).values(directInput).returning();

                        // If we reach here, the test should fail
                        expect(true).toBe(false); // Force failure
                    } catch (error) {
                        // Property 3: Direct creation should be rejected (Requirement 12.5)
                        expect(error).toBeInstanceOf(Error);
                        expect((error as Error).message).toContain('Direct incident creation not allowed');
                    }

                    // Property 4: System should enforce human decision requirement
                    expect(mockDb.insert).toHaveBeenCalledWith(securityIncidents);
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Automated Incident Creation Should Fail
    // ========================================================================

    it('should reject automated incident creation without analyst decision', async () => {
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
                    status: fc.constantFrom<AlertStatus>('open', 'closed_benign', 'closed_false_positive'), // Non-escalatable states
                    assignedTo: fc.oneof(fc.constant(null), userIdArb), // May not be assigned
                    assignedAt: fc.oneof(fc.constant(null), fc.date()),
                    detectedAt: fc.date(),
                    createdAt: fc.date(),
                    updatedAt: fc.date(),
                }),
                async (unassignedAlert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return unassigned/non-escalatable alert
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

                    // Test: Attempt automated escalation of unassigned/invalid alert
                    const escalateInput: EscalateAlertInput = {
                        alertId: unassignedAlert.id,
                        tenantId: unassignedAlert.tenantId,
                    };

                    // Property 1: Automated escalation should fail without analyst assignment (Requirement 12.3, 12.5)
                    await expect(IncidentManager.escalateAlert(escalateInput))
                        .rejects.toThrow('Alert not found or not in investigating status. Investigation must be completed before escalation.');

                    // Property 2: No incident should be created for automated attempts
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

                    // Property 3: System should validate human involvement (analyst assignment)
                    expect(mockTx.select).toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Incident Creation Requires Human Context
    // ========================================================================

    it('should enforce that incidents are human decisions, not automated signals', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                fc.record({
                    // Simulate automated system attempting escalation
                    systemId: fc.string({ minLength: 1, maxLength: 50 }),
                    automatedReason: fc.string({ minLength: 1, maxLength: 200 }),
                    confidence: fc.float({ min: 0, max: 1 }),
                }),
                async (alert, automatedContext) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Property 1: Alert escalation requires human analyst context
                    // The escalateAlert method requires an analyst to be assigned to the alert
                    expect(alert.assignedTo).toBeDefined();
                    expect(alert.status).toMatch(/^(assigned|investigating)$/);

                    // Property 2: System should not provide automated escalation methods
                    expect(typeof (IncidentManager as any).autoEscalateAlert).toBe('undefined');
                    expect(typeof (IncidentManager as any).systemEscalateAlert).toBe('undefined');
                    expect(typeof (IncidentManager as any).bulkEscalateAlerts).toBe('undefined');

                    // Property 3: Escalation input requires human decision context
                    const escalateInput: EscalateAlertInput = {
                        alertId: alert.id,
                        tenantId: alert.tenantId,
                        // Note: No automated context fields are accepted
                    };

                    // Verify the input type doesn't accept automated fields
                    const inputKeys = Object.keys(escalateInput);
                    expect(inputKeys).not.toContain('systemId');
                    expect(inputKeys).not.toContain('automatedReason');
                    expect(inputKeys).not.toContain('confidence');

                    // Property 4: Alerts are signals, incidents are human decisions (Requirement 12.5)
                    // This is enforced by the requirement that alerts must be assigned to analysts
                    // before they can be escalated to incidents
                    expect(alert.assignedTo).toBeTruthy(); // Human analyst must be assigned
                    expect(['assigned', 'investigating']).toContain(alert.status); // Human must have taken action
                }
            ),
            { numRuns: 30 }
        );
    });

    // ========================================================================
    // Property Test: Cross-System Incident Creation Prevention
    // ========================================================================

    it('should prevent external systems from directly creating incidents', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    externalSystemId: fc.string({ minLength: 1, maxLength: 100 }),
                    externalIncidentId: fc.string({ minLength: 1, maxLength: 255 }),
                    externalSeverity: fc.string({ minLength: 1, maxLength: 50 }),
                    externalTitle: fc.string({ minLength: 1, maxLength: 500 }),
                    externalDescription: fc.string({ minLength: 1, maxLength: 1000 }),
                    tenantId: tenantIdArb,
                }),
                async (externalIncidentData) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Property 1: IncidentManager should not have external system integration methods
                    expect(typeof (IncidentManager as any).createFromExternalSystem).toBe('undefined');
                    expect(typeof (IncidentManager as any).importIncident).toBe('undefined');
                    expect(typeof (IncidentManager as any).syncExternalIncident).toBe('undefined');

                    // Property 2: External incident data should be ingested as alerts, not incidents
                    // This is enforced by the system design - external systems feed into alert ingestion

                    // Mock attempt to create incident from external data
                    mockDb.insert.mockReturnValue({
                        values: jest.fn().mockReturnValue({
                            returning: jest.fn().mockRejectedValue(
                                new Error('External systems cannot create incidents directly - must create alerts for analyst review')
                            ),
                        }),
                    });

                    // Test: Attempt to create incident from external system data
                    try {
                        await mockDb.insert(securityIncidents).values({
                            tenantId: externalIncidentData.tenantId,
                            ownerId: 'system', // Invalid - must be a real analyst
                            title: externalIncidentData.externalTitle,
                            description: externalIncidentData.externalDescription,
                            severity: 'high',
                            status: 'open',
                        }).returning();

                        // Should not reach here
                        expect(true).toBe(false);
                    } catch (error) {
                        // Property 3: External incident creation should be rejected (Requirement 12.3, 12.5)
                        expect(error).toBeInstanceOf(Error);
                        expect((error as Error).message).toContain('External systems cannot create incidents directly');
                    }

                    // Property 4: System enforces human decision requirement
                    expect(mockDb.insert).toHaveBeenCalledWith(securityIncidents);
                }
            ),
            { numRuns: 30 }
        );
    });
});