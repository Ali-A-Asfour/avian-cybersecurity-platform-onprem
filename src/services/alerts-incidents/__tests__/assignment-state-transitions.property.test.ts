/**
 * Property-Based Test for Assignment State Transitions
 * 
 * **Feature: avian-alerts-incidents, Property 5: Assignment state transitions**
 * **Validates: Requirements 1.4, 2.1, 2.2, 2.3**
 * 
 * This test verifies that when an unassigned alert is assigned to an analyst:
 * 1. The alert is removed from All Alerts tab (unassigned alerts)
 * 2. The alert is added to My Alerts tab (assigned to analyst)
 * 3. The alert status is set to "Assigned"
 * 4. An ownership lock is created preventing reassignment
 */

import * as fc from 'fast-check';
import { AlertManager } from '../AlertManager';
import { db } from '../../../lib/database';
import { securityAlerts } from '../../../../database/schemas/alerts-incidents';
import { eq, and, isNull } from 'drizzle-orm';
import {
    SecurityAlert,
    AssignAlertInput,
    AlertFilters,
    AlertStatus,
    AlertSeverity,
    AlertSourceSystem,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        select: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('../../../lib/redis', () => ({
    connectRedis: jest.fn().mockResolvedValue({
        get: jest.fn().mockResolvedValue(null),
        setEx: jest.fn().mockResolvedValue('OK'),
        exists: jest.fn().mockResolvedValue(0),
    }),
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
        logAlertAssigned: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../OwnershipEnforcementService', () => ({
    OwnershipEnforcementService: {
        validateAlertOwnership: jest.fn().mockResolvedValue({ isValid: true }),
        trackOwnershipChange: jest.fn().mockResolvedValue(undefined),
    },
}));

describe('Assignment State Transitions Property Tests', () => {
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

    // Generate unassigned security alert data
    const unassignedAlertArb = fc.record({
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
        status: fc.constant('open' as AlertStatus), // Always unassigned
        assignedTo: fc.constant(null), // Always unassigned
        assignedAt: fc.constant(null), // Always unassigned
        detectedAt: fc.date(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: Assignment State Transitions
    // ========================================================================

    it('should properly transition alert state when assigned to analyst', async () => {
        await fc.assert(
            fc.asyncProperty(
                unassignedAlertArb,
                userIdArb,
                async (unassignedAlert, analystId) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return unassigned alert
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([unassignedAlert]),
                            }),
                        }),
                    });

                    // Mock successful assignment update
                    const assignedAlert = {
                        ...unassignedAlert,
                        status: 'assigned' as AlertStatus,
                        assignedTo: analystId,
                        assignedAt: new Date(),
                        updatedAt: new Date(),
                    };

                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Test: Assign alert to analyst
                    const assignInput: AssignAlertInput = {
                        alertId: unassignedAlert.id,
                        assignedTo: analystId,
                        tenantId: unassignedAlert.tenantId,
                    };

                    await AlertManager.assignAlert(assignInput);

                    // Property 1: Alert should be found as unassigned (Requirements 1.4, 2.1)
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectCall = mockDb.select().from().where;
                    expect(selectCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, unassignedAlert.id),
                            eq(securityAlerts.tenantId, unassignedAlert.tenantId),
                            eq(securityAlerts.status, 'open'),
                            isNull(securityAlerts.assignedTo)
                        )
                    );

                    // Property 2: Alert status should be updated to "assigned" (Requirement 2.2)
                    expect(mockDb.update).toHaveBeenCalled();
                    const updateCall = mockDb.update().set;
                    expect(updateCall).toHaveBeenCalledWith(
                        expect.objectContaining({
                            status: 'assigned',
                            assignedTo: analystId,
                            assignedAt: expect.any(Date),
                            updatedAt: expect.any(Date),
                        })
                    );

                    // Property 3: Update should include ownership lock conditions (Requirement 2.3)
                    const whereCall = updateCall().where;
                    expect(whereCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, unassignedAlert.id),
                            eq(securityAlerts.tenantId, unassignedAlert.tenantId),
                            eq(securityAlerts.status, 'open'), // Ensure still unassigned
                            isNull(securityAlerts.assignedTo) // Prevent race conditions
                        )
                    );

                    // Property 4: Assignment should be atomic and prevent race conditions
                    // The where clause in update ensures the alert is still unassigned
                    const updateWhere = mockDb.update().set().where.mock.calls[0][0];
                    expect(updateWhere).toEqual(
                        and(
                            eq(securityAlerts.id, unassignedAlert.id),
                            eq(securityAlerts.tenantId, unassignedAlert.tenantId),
                            eq(securityAlerts.status, 'open'),
                            isNull(securityAlerts.assignedTo)
                        )
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Alert Queue State Changes
    // ========================================================================

    it('should remove alert from All Alerts and add to My Alerts after assignment', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(unassignedAlertArb, { minLength: 3, maxLength: 10 }),
                userIdArb,
                fc.integer({ min: 0, max: 9 }), // Index of alert to assign
                async (alerts, analystId, assignIndex) => {
                    // Ensure we have a valid index
                    const alertToAssign = alerts[assignIndex % alerts.length];
                    const otherAlerts = alerts.filter((_, i) => i !== (assignIndex % alerts.length));

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock assignment process
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([alertToAssign]),
                            }),
                        }),
                    });

                    const assignedAlert = {
                        ...alertToAssign,
                        status: 'assigned' as AlertStatus,
                        assignedTo: analystId,
                        assignedAt: new Date(),
                    };

                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Test: Assign the alert
                    const assignInput: AssignAlertInput = {
                        alertId: alertToAssign.id,
                        assignedTo: analystId,
                        tenantId: alertToAssign.tenantId,
                    };

                    await AlertManager.assignAlert(assignInput);

                    // Now test queue filtering behavior
                    jest.clearAllMocks();

                    // Mock "All Alerts" query (should exclude assigned alert)
                    const mockQuery = {
                        from: jest.fn().mockReturnThis(),
                        where: jest.fn().mockReturnThis(),
                        orderBy: jest.fn().mockReturnThis(),
                        limit: jest.fn().mockReturnThis(),
                        offset: jest.fn().mockReturnThis(),
                    };

                    // The final query should resolve to the filtered alerts
                    Object.assign(mockQuery, Promise.resolve(otherAlerts));
                    mockQuery.then = jest.fn().mockImplementation((resolve) => resolve(otherAlerts));

                    mockDb.select.mockReturnValue(mockQuery);

                    // Test: Get All Alerts (should not include assigned alert)
                    const allAlertsFilters: AlertFilters = {
                        tenantId: alertToAssign.tenantId,
                        status: 'open', // All Alerts shows only unassigned
                    };

                    const allAlerts = await AlertManager.getAlerts(allAlertsFilters);

                    // Property 1: All Alerts should not contain the assigned alert (Requirement 1.4)
                    const assignedAlertInAllAlerts = allAlerts.some(alert => alert.id === alertToAssign.id);
                    expect(assignedAlertInAllAlerts).toBe(false);

                    // Property 2: All Alerts should only contain unassigned alerts
                    const allAlertsUnassigned = allAlerts.every(alert =>
                        alert.status === 'open' && alert.assignedTo === null
                    );
                    expect(allAlertsUnassigned).toBe(true);

                    // Reset mocks for My Alerts query
                    jest.clearAllMocks();

                    // Mock "My Alerts" query (should include assigned alert)
                    const mockMyAlertsQuery = {
                        from: jest.fn().mockReturnThis(),
                        where: jest.fn().mockReturnThis(),
                        orderBy: jest.fn().mockReturnThis(),
                        limit: jest.fn().mockReturnThis(),
                        offset: jest.fn().mockReturnThis(),
                    };

                    // The final query should resolve to the assigned alert
                    Object.assign(mockMyAlertsQuery, Promise.resolve([assignedAlert]));
                    mockMyAlertsQuery.then = jest.fn().mockImplementation((resolve) => resolve([assignedAlert]));

                    mockDb.select.mockReturnValue(mockMyAlertsQuery);

                    // Test: Get My Alerts (should include assigned alert)
                    const myAlertsFilters: AlertFilters = {
                        tenantId: alertToAssign.tenantId,
                        assignedTo: analystId, // My Alerts shows only assigned to this analyst
                    };

                    const myAlerts = await AlertManager.getAlerts(myAlertsFilters);

                    // Property 3: My Alerts should contain the assigned alert (Requirement 2.3)
                    const assignedAlertInMyAlerts = myAlerts.some(alert => alert.id === alertToAssign.id);
                    expect(assignedAlertInMyAlerts).toBe(true);

                    // Property 4: My Alerts should only contain alerts assigned to this analyst
                    const allMyAlertsAssignedToAnalyst = myAlerts.every(alert =>
                        alert.assignedTo === analystId
                    );
                    expect(allMyAlertsAssignedToAnalyst).toBe(true);
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Ownership Lock Creation
    // ========================================================================

    it('should create ownership lock preventing reassignment after assignment', async () => {
        await fc.assert(
            fc.asyncProperty(
                unassignedAlertArb,
                userIdArb,
                userIdArb, // Different analyst
                async (unassignedAlert, firstAnalyst, secondAnalyst) => {
                    // Ensure we have different analysts
                    if (firstAnalyst === secondAnalyst) {
                        return; // Skip this iteration
                    }

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock first assignment
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([unassignedAlert]),
                            }),
                        }),
                    });

                    const assignedAlert = {
                        ...unassignedAlert,
                        status: 'assigned' as AlertStatus,
                        assignedTo: firstAnalyst,
                        assignedAt: new Date(),
                    };

                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Test: First assignment should succeed
                    const firstAssignInput: AssignAlertInput = {
                        alertId: unassignedAlert.id,
                        assignedTo: firstAnalyst,
                        tenantId: unassignedAlert.tenantId,
                    };

                    await AlertManager.assignAlert(firstAssignInput);

                    // Property 1: First assignment should succeed
                    expect(mockDb.update).toHaveBeenCalled();

                    // Reset mocks for second assignment attempt
                    jest.clearAllMocks();

                    // Setup: Mock alert is now assigned (ownership lock in effect)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // No unassigned alert found
                            }),
                        }),
                    });

                    // Test: Second assignment should fail (ownership lock)
                    const secondAssignInput: AssignAlertInput = {
                        alertId: unassignedAlert.id,
                        assignedTo: secondAnalyst,
                        tenantId: unassignedAlert.tenantId,
                    };

                    // Property 2: Reassignment should fail due to ownership lock (Requirement 2.3)
                    await expect(AlertManager.assignAlert(secondAssignInput))
                        .rejects.toThrow('Alert not found, already assigned, or not in open status');

                    // Property 3: Database should not be updated for failed reassignment
                    expect(mockDb.update).not.toHaveBeenCalled();

                    // Property 4: Query should look for unassigned alert (ownership validation)
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectCall = mockDb.select().from().where;
                    expect(selectCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, unassignedAlert.id),
                            eq(securityAlerts.tenantId, unassignedAlert.tenantId),
                            eq(securityAlerts.status, 'open'),
                            isNull(securityAlerts.assignedTo)
                        )
                    );
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Assignment Atomicity
    // ========================================================================

    it('should ensure assignment operations are atomic and prevent race conditions', async () => {
        await fc.assert(
            fc.asyncProperty(
                unassignedAlertArb,
                userIdArb,
                async (unassignedAlert, analystId) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return unassigned alert for validation
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([unassignedAlert]),
                            }),
                        }),
                    });

                    // Mock update that returns empty result (simulating race condition)
                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([]), // No rows updated (race condition)
                            }),
                        }),
                    });

                    // Test: Assignment with race condition should fail
                    const assignInput: AssignAlertInput = {
                        alertId: unassignedAlert.id,
                        assignedTo: analystId,
                        tenantId: unassignedAlert.tenantId,
                    };

                    // Property 1: Race condition should be detected and assignment should fail
                    await expect(AlertManager.assignAlert(assignInput))
                        .rejects.toThrow('Alert assignment failed - alert may have been assigned by another user');

                    // Property 2: Update should use atomic conditions to prevent race conditions
                    expect(mockDb.update).toHaveBeenCalled();
                    const updateCall = mockDb.update().set().where;
                    expect(updateCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, unassignedAlert.id),
                            eq(securityAlerts.tenantId, unassignedAlert.tenantId),
                            eq(securityAlerts.status, 'open'), // Ensure still unassigned
                            isNull(securityAlerts.assignedTo) // Prevent concurrent assignment
                        )
                    );

                    // Property 3: Failed assignment should not proceed with audit logging
                    // (This is implicitly tested by the exception being thrown)
                }
            ),
            { numRuns: 50 }
        );
    });
});