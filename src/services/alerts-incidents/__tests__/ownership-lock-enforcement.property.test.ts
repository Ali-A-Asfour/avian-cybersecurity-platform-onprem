/**
 * Property-Based Test for Ownership Lock Enforcement
 * 
 * **Feature: avian-alerts-incidents, Property 6: Ownership lock enforcement**
 * **Validates: Requirements 2.4, 2.5, 3.4**
 * 
 * This test verifies that for any assigned alert, attempts to reassign should fail 
 * and ownership should remain unchanged throughout the investigation lifecycle.
 */

import * as fc from 'fast-check';
import { OwnershipEnforcementService } from '../OwnershipEnforcementService';
import { AlertManager } from '../AlertManager';
import { IncidentManager } from '../IncidentManager';
import { db } from '../../../lib/database';
import { securityAlerts, securityIncidents } from '../../../../database/schemas/alerts-incidents';
import { eq, and, isNull } from 'drizzle-orm';
import {
    SecurityAlert,
    SecurityIncident,
    AssignAlertInput,
    AlertStatus,
    IncidentStatus,
    AlertSeverity,
    AlertSourceSystem,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        select: jest.fn(),
        update: jest.fn(),
        insert: jest.fn(),
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
        createAuditLog: jest.fn().mockResolvedValue('audit-log-123'),
    },
}));

describe('Ownership Lock Enforcement Property Tests', () => {
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

    // Generate alert statuses that indicate assignment
    const assignedAlertStatusArb = fc.constantFrom<AlertStatus>('assigned', 'investigating', 'escalated');

    // Generate assigned security alert data
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
        status: assignedAlertStatusArb, // Always assigned
        assignedTo: userIdArb, // Always has an owner
        assignedAt: fc.date(),
        detectedAt: fc.date(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    // Generate security incident data
    const securityIncidentArb = fc.record({
        id: fc.uuid(),
        tenantId: tenantIdArb,
        ownerId: userIdArb,
        title: fc.string({ minLength: 1, maxLength: 500 }),
        description: fc.oneof(fc.constant(null), fc.string({ maxLength: 1000 })),
        severity: alertSeverityArb,
        status: fc.constantFrom<IncidentStatus>('open', 'in_progress'),
        resolutionSummary: fc.constant(null),
        dismissalJustification: fc.constant(null),
        slaAcknowledgeBy: fc.date(),
        slaInvestigateBy: fc.date(),
        slaResolveBy: fc.date(),
        acknowledgedAt: fc.oneof(fc.constant(null), fc.date()),
        investigationStartedAt: fc.oneof(fc.constant(null), fc.date()),
        resolvedAt: fc.constant(null),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: Alert Ownership Lock Enforcement
    // ========================================================================

    it('should prevent reassignment of assigned alerts and maintain ownership lock', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                userIdArb, // Different user attempting reassignment
                async (assignedAlert, attemptingUserId) => {
                    // Ensure we have a different user attempting reassignment
                    if (assignedAlert.assignedTo === attemptingUserId) {
                        return; // Skip this iteration
                    }

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return assigned alert
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Test: Validate ownership for assignment operation
                    const ownershipValidation = await OwnershipEnforcementService.validateAlertOwnership(
                        assignedAlert.id,
                        assignedAlert.tenantId,
                        attemptingUserId,
                        'assign'
                    );

                    // Property 1: Assignment validation should fail for assigned alerts (Requirement 2.4)
                    expect(ownershipValidation.isValid).toBe(false);
                    expect(ownershipValidation.reason).toContain('cannot be assigned');
                    expect(ownershipValidation.currentOwner).toBe(assignedAlert.assignedTo);

                    // Property 2: Ownership information should be preserved in validation result
                    expect(ownershipValidation.currentOwner).toBe(assignedAlert.assignedTo);

                    // Reset mocks for reassignment attempt
                    jest.clearAllMocks();

                    // Setup: Mock assignment attempt (should fail to find unassigned alert)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // No unassigned alert found
                            }),
                        }),
                    });

                    // Test: Attempt to reassign alert should fail
                    const reassignInput: AssignAlertInput = {
                        alertId: assignedAlert.id,
                        assignedTo: attemptingUserId,
                        tenantId: assignedAlert.tenantId,
                    };

                    // Property 3: Reassignment attempt should fail (Requirement 2.5)
                    await expect(AlertManager.assignAlert(reassignInput))
                        .rejects.toThrow('Assignment denied');

                    // Property 4: Database update should not be called for failed reassignment
                    expect(mockDb.update).not.toHaveBeenCalled();

                    // Property 5: Database should be queried for ownership validation
                    expect(mockDb.select).toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Alert Investigation Ownership Enforcement
    // ========================================================================

    it('should enforce ownership for alert investigation operations', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                userIdArb, // Different user attempting investigation
                fc.constantFrom('investigate', 'resolve', 'escalate'),
                async (assignedAlert, attemptingUserId, operation) => {
                    // Ensure we have a different user attempting the operation
                    if (assignedAlert.assignedTo === attemptingUserId) {
                        return; // Skip this iteration
                    }

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return assigned alert
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Test: Validate ownership for investigation operation
                    const ownershipValidation = await OwnershipEnforcementService.validateAlertOwnership(
                        assignedAlert.id,
                        assignedAlert.tenantId,
                        attemptingUserId,
                        operation as any
                    );

                    // Property 1: Investigation operations should fail for non-owners (Requirement 3.4)
                    expect(ownershipValidation.isValid).toBe(false);
                    expect(ownershipValidation.reason).toContain('assigned to another analyst');
                    expect(ownershipValidation.currentOwner).toBe(assignedAlert.assignedTo);

                    // Property 2: Current owner information should be preserved
                    expect(ownershipValidation.currentOwner).toBe(assignedAlert.assignedTo);

                    // Reset mocks for owner validation
                    jest.clearAllMocks();

                    // Setup: Mock database to return assigned alert for owner
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Test: Validate ownership for actual owner
                    const ownerValidation = await OwnershipEnforcementService.validateAlertOwnership(
                        assignedAlert.id,
                        assignedAlert.tenantId,
                        assignedAlert.assignedTo,
                        operation as any
                    );

                    // Property 3: Operations should succeed for actual owner (when status allows)
                    const validStatuses = getValidAlertStatusesForOperation(operation);
                    if (validStatuses.includes(assignedAlert.status)) {
                        expect(ownerValidation.isValid).toBe(true);
                    } else {
                        expect(ownerValidation.isValid).toBe(false);
                        expect(ownerValidation.reason).toContain('not allowed for alert status');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Incident Ownership Lock Enforcement
    // ========================================================================

    it('should prevent unauthorized incident ownership changes', async () => {
        await fc.assert(
            fc.asyncProperty(
                securityIncidentArb,
                userIdArb, // Different user attempting operations
                fc.constantFrom('start_work', 'resolve', 'dismiss'),
                async (incident, attemptingUserId, operation) => {
                    // Ensure we have a different user attempting the operation
                    if (incident.ownerId === attemptingUserId) {
                        return; // Skip this iteration
                    }

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return incident
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([incident]),
                            }),
                        }),
                    });

                    // Test: Validate ownership for incident operation
                    const ownershipValidation = await OwnershipEnforcementService.validateIncidentOwnership(
                        incident.id,
                        incident.tenantId,
                        attemptingUserId,
                        operation as any
                    );

                    // Property 1: Incident operations should fail for non-owners (Requirement 3.4)
                    expect(ownershipValidation.isValid).toBe(false);
                    expect(ownershipValidation.reason).toContain('owned by another analyst');
                    expect(ownershipValidation.currentOwner).toBe(incident.ownerId);

                    // Property 2: Current owner information should be preserved
                    expect(ownershipValidation.currentOwner).toBe(incident.ownerId);

                    // Reset mocks for owner validation
                    jest.clearAllMocks();

                    // Setup: Mock database to return incident for owner
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([incident]),
                            }),
                        }),
                    });

                    // Test: Validate ownership for actual owner
                    const ownerValidation = await OwnershipEnforcementService.validateIncidentOwnership(
                        incident.id,
                        incident.tenantId,
                        incident.ownerId,
                        operation as any
                    );

                    // Property 3: Operations should succeed for actual owner (when status allows)
                    const validStatuses = getValidIncidentStatusesForOperation(operation);
                    if (validStatuses.includes(incident.status)) {
                        expect(ownerValidation.isValid).toBe(true);
                    } else {
                        expect(ownerValidation.isValid).toBe(false);
                        expect(ownerValidation.reason).toContain('not allowed for incident status');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Ownership Transfer Prevention
    // ========================================================================

    it('should prevent all ownership transfers to maintain accountability', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('alert', 'incident'),
                fc.uuid(), // Entity ID
                tenantIdArb,
                userIdArb, // Current owner
                userIdArb, // Attempted new owner
                fc.string({ minLength: 1, maxLength: 200 }), // Reason
                fc.boolean(), // Admin override
                async (entityType, entityId, tenantId, currentOwner, newOwner, reason, adminOverride) => {
                    // Ensure we have different users
                    if (currentOwner === newOwner) {
                        return; // Skip this iteration
                    }

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Test: Attempt ownership transfer
                    const transferRequest = {
                        entityType,
                        entityId,
                        tenantId,
                        currentUserId: currentOwner,
                        newOwnerId: newOwner,
                        reason,
                        adminOverride,
                    };

                    const transferResult = await OwnershipEnforcementService.preventOwnershipTransfer(transferRequest);

                    // Property 1: All ownership transfers should be denied (Requirements 2.4, 2.5)
                    expect(transferResult.allowed).toBe(false);

                    // Property 2: Denial reason should be provided
                    expect(transferResult.reason).toBeDefined();
                    expect(transferResult.reason.length).toBeGreaterThan(0);

                    // Property 3: Admin override should also be denied (not implemented in MVP)
                    if (adminOverride) {
                        expect(transferResult.reason).toContain('not implemented');
                    } else {
                        expect(transferResult.reason).toContain('not permitted');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Ownership Persistence Throughout Lifecycle
    // ========================================================================

    it('should maintain ownership throughout alert and incident lifecycle', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                async (assignedAlert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return assigned alert
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([assignedAlert]),
                            }),
                        }),
                    });

                    // Test: Validate ownership at different lifecycle stages
                    const lifecycleOperations = ['investigate', 'resolve', 'escalate'];

                    for (const operation of lifecycleOperations) {
                        // Reset mocks for each operation
                        jest.clearAllMocks();

                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    limit: jest.fn().mockResolvedValue([assignedAlert]),
                                }),
                            }),
                        });

                        // Test ownership validation for the assigned owner
                        const ownershipValidation = await OwnershipEnforcementService.validateAlertOwnership(
                            assignedAlert.id,
                            assignedAlert.tenantId,
                            assignedAlert.assignedTo,
                            operation as any
                        );

                        // Property 1: Owner should always be able to perform valid operations (Requirement 3.4)
                        const validStatuses = getValidAlertStatusesForOperation(operation);
                        if (validStatuses.includes(assignedAlert.status)) {
                            expect(ownershipValidation.isValid).toBe(true);
                        }

                        // Property 2: Ownership information should be consistent
                        if (!ownershipValidation.isValid && ownershipValidation.currentOwner) {
                            expect(ownershipValidation.currentOwner).toBe(assignedAlert.assignedTo);
                        }
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Tenant Isolation in Ownership Enforcement
    // ========================================================================

    it('should enforce tenant isolation in ownership validation', async () => {
        await fc.assert(
            fc.asyncProperty(
                assignedAlertArb,
                tenantIdArb, // Different tenant ID
                async (assignedAlert, differentTenantId) => {
                    // Ensure we have a different tenant
                    if (assignedAlert.tenantId === differentTenantId) {
                        return; // Skip this iteration
                    }

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return empty result (tenant isolation)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // No alert found due to tenant isolation
                            }),
                        }),
                    });

                    // Test: Validate ownership with wrong tenant ID
                    const ownershipValidation = await OwnershipEnforcementService.validateAlertOwnership(
                        assignedAlert.id,
                        differentTenantId, // Wrong tenant
                        assignedAlert.assignedTo,
                        'investigate'
                    );

                    // Property 1: Cross-tenant access should be denied (Requirement 3.4)
                    expect(ownershipValidation.isValid).toBe(false);
                    expect(ownershipValidation.reason).toContain('not found or access denied due to tenant isolation');

                    // Property 2: Database should be queried with tenant isolation
                    expect(mockDb.select).toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });
});

// ========================================================================
// Helper Functions
// ========================================================================

/**
 * Get valid alert statuses for operation (mirrors OwnershipEnforcementService logic)
 */
function getValidAlertStatusesForOperation(operation: string): AlertStatus[] {
    switch (operation) {
        case 'investigate':
            return ['assigned'];
        case 'resolve':
        case 'escalate':
            return ['assigned', 'investigating'];
        default:
            return [];
    }
}

/**
 * Get valid incident statuses for operation (mirrors OwnershipEnforcementService logic)
 */
function getValidIncidentStatusesForOperation(operation: string): IncidentStatus[] {
    switch (operation) {
        case 'start_work':
            return ['open', 'in_progress'];
        case 'resolve':
        case 'dismiss':
            return ['open', 'in_progress'];
        default:
            return [];
    }
}