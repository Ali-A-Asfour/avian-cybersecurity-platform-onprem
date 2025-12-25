/**
 * Property-Based Test for Investigation Status Transitions
 * 
 * **Feature: avian-alerts-incidents, Property 7: Investigation status transitions**
 * **Validates: Requirements 4.2**
 * 
 * This test verifies that when an assigned alert investigation begins:
 * 1. The alert status automatically changes from "Assigned" to "Investigating"
 * 2. The alert must be assigned to the user starting the investigation
 * 3. The status transition is atomic and prevents race conditions
 * 4. Proper audit logging occurs for the status change
 */

import * as fc from 'fast-check';
import { AlertManager } from '../AlertManager';
import { db } from '../../../lib/database';
import { securityAlerts } from '../../../../database/schemas/alerts-incidents';
import { eq, and } from 'drizzle-orm';
import {
    SecurityAlert,
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
        logAlertInvestigationStarted: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../OwnershipEnforcementService', () => ({
    OwnershipEnforcementService: {
        validateAlertOwnership: jest.fn().mockResolvedValue({ isValid: true }),
    },
}));

describe('Investigation Status Transitions Property Tests', () => {
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

    // Generate assigned security alert data (ready for investigation)
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
        status: fc.constant('assigned' as AlertStatus), // Always assigned
        assignedTo: userIdArb, // Always assigned to a user
        assignedAt: fc.date(),
        detectedAt: fc.date(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: Investigation Status Transition
    // ========================================================================

    it('should automatically change status from "assigned" to "investigating" when investigation begins', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                async (assignedAlert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return assigned alert for validation
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Mock successful status update
                    const investigatingAlert = {
                        ...assignedAlert,
                        status: 'investigating' as AlertStatus,
                        updatedAt: new Date(),
                    };

                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([investigatingAlert]),
                            }),
                        }),
                    });

                    // Test: Start investigation
                    await AlertManager.startInvestigation(
                        assignedAlert.id,
                        assignedAlert.tenantId,
                        assignedAlert.assignedTo!
                    );

                    // Property 1: Alert should be validated as assigned to the user (Requirement 4.2)
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectCall = mockDb.select().from().where;
                    expect(selectCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, assignedAlert.id),
                            eq(securityAlerts.tenantId, assignedAlert.tenantId),
                            eq(securityAlerts.status, 'assigned'),
                            eq(securityAlerts.assignedTo, assignedAlert.assignedTo)
                        )
                    );

                    // Property 2: Alert status should be updated to "investigating" (Requirement 4.2)
                    expect(mockDb.update).toHaveBeenCalled();
                    const updateCall = mockDb.update().set;
                    expect(updateCall).toHaveBeenCalledWith(
                        expect.objectContaining({
                            status: 'investigating',
                            updatedAt: expect.any(Date),
                        })
                    );

                    // Property 3: Update should include atomic conditions to prevent race conditions
                    const whereCall = updateCall().where;
                    expect(whereCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, assignedAlert.id),
                            eq(securityAlerts.tenantId, assignedAlert.tenantId),
                            eq(securityAlerts.status, 'assigned'), // Ensure still assigned
                            eq(securityAlerts.assignedTo, assignedAlert.assignedTo) // Ensure ownership
                        )
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Ownership Validation for Investigation
    // ========================================================================

    it('should only allow investigation by the assigned user', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                userIdArb, // Different user
                async (assignedAlert, differentUserId) => {
                    // Ensure we have a different user
                    if (assignedAlert.assignedTo === differentUserId) {
                        return; // Skip this iteration
                    }

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return empty result (alert not assigned to this user)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // No alert found for this user
                            }),
                        }),
                    });

                    // Test: Attempt investigation by non-assigned user should fail
                    await expect(AlertManager.startInvestigation(
                        assignedAlert.id,
                        assignedAlert.tenantId,
                        differentUserId
                    )).rejects.toThrow('Alert not found, not assigned to user, or not in assigned status');

                    // Property 1: Database should be queried with correct ownership conditions
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectCall = mockDb.select().from().where;
                    expect(selectCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, assignedAlert.id),
                            eq(securityAlerts.tenantId, assignedAlert.tenantId),
                            eq(securityAlerts.status, 'assigned'),
                            eq(securityAlerts.assignedTo, differentUserId) // Wrong user
                        )
                    );

                    // Property 2: Update should not be attempted for unauthorized user
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Status Transition Atomicity
    // ========================================================================

    it('should ensure investigation status transitions are atomic and prevent race conditions', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                async (assignedAlert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return assigned alert for validation
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([assignedAlert]),
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

                    // Test: Investigation with race condition should fail
                    await expect(AlertManager.startInvestigation(
                        assignedAlert.id,
                        assignedAlert.tenantId,
                        assignedAlert.assignedTo!
                    )).rejects.toThrow('Alert update failed - alert may have been modified by another user');

                    // Property 1: Update should use atomic conditions to prevent race conditions
                    expect(mockDb.update).toHaveBeenCalled();
                    const updateCall = mockDb.update().set().where;
                    expect(updateCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, assignedAlert.id),
                            eq(securityAlerts.tenantId, assignedAlert.tenantId),
                            eq(securityAlerts.status, 'assigned'), // Ensure still assigned
                            eq(securityAlerts.assignedTo, assignedAlert.assignedTo) // Ensure ownership unchanged
                        )
                    );

                    // Property 2: Failed update should be detected and handled appropriately
                    // (This is implicitly tested by the exception being thrown)
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Investigation from Invalid States
    // ========================================================================

    it('should reject investigation attempts from non-assigned status', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                fc.constantFrom<AlertStatus>('open', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive'),
                async (baseAlert, invalidStatus) => {
                    // Skip if status is already assigned (valid case)
                    if (invalidStatus === 'assigned') {
                        return;
                    }

                    // Create alert with invalid status for investigation
                    const invalidAlert = {
                        ...baseAlert,
                        status: invalidStatus,
                    };

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return empty result (no alert in assigned status)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // No alert found in assigned status
                            }),
                        }),
                    });

                    // Test: Investigation from invalid status should fail
                    await expect(AlertManager.startInvestigation(
                        invalidAlert.id,
                        invalidAlert.tenantId,
                        invalidAlert.assignedTo!
                    )).rejects.toThrow('Alert not found, not assigned to user, or not in assigned status');

                    // Property 1: Database should be queried for assigned status only
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectCall = mockDb.select().from().where;
                    expect(selectCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, invalidAlert.id),
                            eq(securityAlerts.tenantId, invalidAlert.tenantId),
                            eq(securityAlerts.status, 'assigned'), // Only assigned status allowed
                            eq(securityAlerts.assignedTo, invalidAlert.assignedTo)
                        )
                    );

                    // Property 2: Update should not be attempted for invalid status
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Tenant Isolation in Investigation
    // ========================================================================

    it('should enforce tenant isolation during investigation status transitions', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                tenantIdArb, // Different tenant
                async (assignedAlert, differentTenantId) => {
                    // Ensure we have a different tenant
                    if (assignedAlert.tenantId === differentTenantId) {
                        return; // Skip this iteration
                    }

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return empty result (alert not in this tenant)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // No alert found in different tenant
                            }),
                        }),
                    });

                    // Test: Investigation across tenant boundaries should fail
                    await expect(AlertManager.startInvestigation(
                        assignedAlert.id,
                        differentTenantId, // Wrong tenant
                        assignedAlert.assignedTo!
                    )).rejects.toThrow('Alert not found, not assigned to user, or not in assigned status');

                    // Property 1: Database should be queried with correct tenant isolation
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectCall = mockDb.select().from().where;
                    expect(selectCall).toHaveBeenCalledWith(
                        and(
                            eq(securityAlerts.id, assignedAlert.id),
                            eq(securityAlerts.tenantId, differentTenantId), // Wrong tenant
                            eq(securityAlerts.status, 'assigned'),
                            eq(securityAlerts.assignedTo, assignedAlert.assignedTo)
                        )
                    );

                    // Property 2: Update should not be attempted for cross-tenant access
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Investigation Audit Trail
    // ========================================================================

    it('should create proper audit trail when investigation status transitions occur', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                async (assignedAlert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return assigned alert for validation
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Mock successful status update
                    const investigatingAlert = {
                        ...assignedAlert,
                        status: 'investigating' as AlertStatus,
                        updatedAt: new Date(),
                    };

                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([investigatingAlert]),
                            }),
                        }),
                    });

                    // Mock AuditService
                    const { AuditService } = require('../AuditService');

                    // Test: Start investigation
                    await AlertManager.startInvestigation(
                        assignedAlert.id,
                        assignedAlert.tenantId,
                        assignedAlert.assignedTo!
                    );

                    // Property 1: Audit log should be created for status transition
                    expect(AuditService.logAlertInvestigationStarted).toHaveBeenCalledWith(
                        assignedAlert.tenantId,
                        assignedAlert.assignedTo,
                        assignedAlert.id,
                        expect.objectContaining({
                            id: assignedAlert.id,
                            status: 'assigned', // Previous status
                            assignedTo: assignedAlert.assignedTo,
                        }),
                        expect.objectContaining({
                            id: assignedAlert.id,
                            status: 'investigating', // New status
                            assignedTo: assignedAlert.assignedTo,
                        }),
                        undefined // No context provided
                    );

                    // Property 2: Audit log should capture the complete state transition
                    const auditCall = AuditService.logAlertInvestigationStarted.mock.calls[0];
                    const [tenantId, userId, alertId, previousState, newState] = auditCall;

                    expect(tenantId).toBe(assignedAlert.tenantId);
                    expect(userId).toBe(assignedAlert.assignedTo);
                    expect(alertId).toBe(assignedAlert.id);
                    expect(previousState.status).toBe('assigned');
                    expect(newState.status).toBe('investigating');
                }
            ),
            { numRuns: 50 }
        );
    });
});