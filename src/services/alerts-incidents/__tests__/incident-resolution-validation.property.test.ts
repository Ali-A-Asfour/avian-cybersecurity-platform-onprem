/**
 * Property-Based Test for Incident Resolution Validation
 * 
 * **Feature: avian-alerts-incidents, Property 12: Incident resolution validation**
 * **Validates: Requirements 7.4, 7.5**
 * 
 * This test verifies that when resolving incidents:
 * - "Resolved" status requires a summary and no justification (Requirement 7.4)
 * - "Dismissed" status requires a justification and no summary (Requirement 7.5)
 */

import * as fc from 'fast-check';
import { IncidentManager } from '../IncidentManager';
import { db } from '../../../lib/database';
import { securityIncidents } from '../../../../database/schemas/alerts-incidents';
import { eq, and, inArray } from 'drizzle-orm';
import {
    SecurityIncident,
    ResolveIncidentInput,
    AlertSeverity,
    IncidentStatus,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        select: jest.fn(),
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
        logIncidentResolved: jest.fn().mockResolvedValue(undefined),
        logIncidentDismissed: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../OwnershipEnforcementService', () => ({
    OwnershipEnforcementService: {
        validateIncidentOwnership: jest.fn().mockResolvedValue({
            isValid: true,
            reason: null,
        }),
    },
}));

describe('Incident Resolution Validation Property Tests', () => {
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

    // Generate resolvable incident statuses
    const resolvableStatusArb = fc.constantFrom<IncidentStatus>('open', 'in_progress');

    // Generate valid security incident data (ready for resolution)
    const resolvableIncidentArb = fc.record({
        id: fc.uuid(),
        tenantId: tenantIdArb,
        ownerId: userIdArb,
        title: fc.string({ minLength: 1, maxLength: 500 }),
        description: fc.oneof(fc.constant(null), fc.string({ maxLength: 1000 })),
        severity: alertSeverityArb,
        status: resolvableStatusArb,
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

    // Generate non-empty summary text
    const validSummaryArb = fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0);

    // Generate non-empty justification text
    const validJustificationArb = fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0);

    // Generate empty or whitespace-only strings
    const emptyStringArb = fc.oneof(
        fc.constant(''),
        fc.constant('   '),
        fc.constant('\t\n  '),
        fc.constant(null),
        fc.constant(undefined)
    );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: Valid Resolution with Summary
    // ========================================================================

    it('should successfully resolve incident when outcome is "resolved" with valid summary and no justification', async () => {
        await fc.assert(
            fc.asyncProperty(
                resolvableIncidentArb,
                validSummaryArb,
                async (incident, summary) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return the incident and successful update
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([incident]),
                            }),
                        }),
                    });

                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([{
                                    ...incident,
                                    status: 'resolved',
                                    resolutionSummary: summary,
                                    dismissalJustification: null,
                                    resolvedAt: new Date(),
                                }]),
                            }),
                        }),
                    });

                    // Test: Resolve incident with valid summary
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: incident.ownerId,
                        outcome: 'resolved',
                        summary: summary,
                        // No justification provided (should be allowed)
                    };

                    // Property 1: Resolution should succeed with valid summary (Requirement 7.4)
                    await expect(IncidentManager.resolveIncident(resolveInput)).resolves.not.toThrow();

                    // Property 2: Database should be queried for incident validation
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectQuery = mockDb.select().from().where.mock.calls[0][0];
                    expect(selectQuery).toEqual(
                        and(
                            eq(securityIncidents.id, incident.id),
                            eq(securityIncidents.tenantId, incident.tenantId),
                            eq(securityIncidents.ownerId, incident.ownerId),
                            inArray(securityIncidents.status, ['open', 'in_progress'])
                        )
                    );

                    // Property 3: Database should be updated with resolution data
                    expect(mockDb.update).toHaveBeenCalledWith(securityIncidents);
                    const updateData = mockDb.update().set.mock.calls[0][0];
                    expect(updateData.status).toBe('resolved');
                    expect(updateData.resolutionSummary).toBe(summary);
                    expect(updateData.dismissalJustification).toBeNull();
                    expect(updateData.resolvedAt).toBeInstanceOf(Date);
                    expect(updateData.updatedAt).toBeInstanceOf(Date);

                    // Property 4: Update should include proper where conditions
                    const updateWhere = mockDb.update().set().where.mock.calls[0][0];
                    expect(updateWhere).toEqual(
                        and(
                            eq(securityIncidents.id, incident.id),
                            eq(securityIncidents.tenantId, incident.tenantId),
                            eq(securityIncidents.ownerId, incident.ownerId),
                            inArray(securityIncidents.status, ['open', 'in_progress'])
                        )
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Valid Dismissal with Justification
    // ========================================================================

    it('should successfully dismiss incident when outcome is "dismissed" with valid justification and no summary', async () => {
        await fc.assert(
            fc.asyncProperty(
                resolvableIncidentArb,
                validJustificationArb,
                async (incident, justification) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return the incident and successful update
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([incident]),
                            }),
                        }),
                    });

                    mockDb.update.mockReturnValue({
                        set: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                returning: jest.fn().mockResolvedValue([{
                                    ...incident,
                                    status: 'dismissed',
                                    resolutionSummary: null,
                                    dismissalJustification: justification,
                                    resolvedAt: new Date(),
                                }]),
                            }),
                        }),
                    });

                    // Test: Dismiss incident with valid justification
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: incident.ownerId,
                        outcome: 'dismissed',
                        justification: justification,
                        // No summary provided (should be allowed)
                    };

                    // Property 1: Dismissal should succeed with valid justification (Requirement 7.5)
                    await expect(IncidentManager.resolveIncident(resolveInput)).resolves.not.toThrow();

                    // Property 2: Database should be queried for incident validation
                    expect(mockDb.select).toHaveBeenCalled();

                    // Property 3: Database should be updated with dismissal data
                    expect(mockDb.update).toHaveBeenCalledWith(securityIncidents);
                    const updateData = mockDb.update().set.mock.calls[0][0];
                    expect(updateData.status).toBe('dismissed');
                    expect(updateData.resolutionSummary).toBeNull();
                    expect(updateData.dismissalJustification).toBe(justification);
                    expect(updateData.resolvedAt).toBeInstanceOf(Date);
                    expect(updateData.updatedAt).toBeInstanceOf(Date);
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Invalid Resolution - Missing Summary
    // ========================================================================

    it('should reject resolution when outcome is "resolved" but summary is missing or empty', async () => {
        await fc.assert(
            fc.asyncProperty(
                resolvableIncidentArb,
                emptyStringArb,
                fc.oneof(fc.constant(undefined), validJustificationArb), // May or may not have justification
                async (incident, emptySummary, justification) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Test: Attempt to resolve incident with empty/missing summary
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: incident.ownerId,
                        outcome: 'resolved',
                        summary: emptySummary as string,
                        justification: justification,
                    };

                    // Property 1: Resolution should fail when summary is missing (Requirement 7.4)
                    await expect(IncidentManager.resolveIncident(resolveInput))
                        .rejects.toThrow('Summary is required when resolving an incident');

                    // Property 2: No database operations should occur for invalid input
                    expect(mockDb.select).not.toHaveBeenCalled();
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Invalid Resolution - Justification Provided for Resolved
    // ========================================================================

    it('should reject resolution when outcome is "resolved" but justification is provided', async () => {
        await fc.assert(
            fc.asyncProperty(
                resolvableIncidentArb,
                validSummaryArb,
                validJustificationArb,
                async (incident, summary, justification) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Test: Attempt to resolve incident with both summary and justification
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: incident.ownerId,
                        outcome: 'resolved',
                        summary: summary,
                        justification: justification, // Should not be provided for resolved
                    };

                    // Property 1: Resolution should fail when justification is provided for resolved outcome
                    await expect(IncidentManager.resolveIncident(resolveInput))
                        .rejects.toThrow('Justification should not be provided when resolving an incident');

                    // Property 2: No database operations should occur for invalid input
                    expect(mockDb.select).not.toHaveBeenCalled();
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Invalid Dismissal - Missing Justification
    // ========================================================================

    it('should reject dismissal when outcome is "dismissed" but justification is missing or empty', async () => {
        await fc.assert(
            fc.asyncProperty(
                resolvableIncidentArb,
                emptyStringArb,
                fc.oneof(fc.constant(undefined), validSummaryArb), // May or may not have summary
                async (incident, emptyJustification, summary) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Test: Attempt to dismiss incident with empty/missing justification
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: incident.ownerId,
                        outcome: 'dismissed',
                        summary: summary,
                        justification: emptyJustification as string,
                    };

                    // Property 1: Dismissal should fail when justification is missing (Requirement 7.5)
                    await expect(IncidentManager.resolveIncident(resolveInput))
                        .rejects.toThrow('Justification is required when dismissing an incident');

                    // Property 2: No database operations should occur for invalid input
                    expect(mockDb.select).not.toHaveBeenCalled();
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Invalid Dismissal - Summary Provided for Dismissed
    // ========================================================================

    it('should reject dismissal when outcome is "dismissed" but summary is provided', async () => {
        await fc.assert(
            fc.asyncProperty(
                resolvableIncidentArb,
                validSummaryArb,
                validJustificationArb,
                async (incident, summary, justification) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Test: Attempt to dismiss incident with both summary and justification
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: incident.ownerId,
                        outcome: 'dismissed',
                        summary: summary, // Should not be provided for dismissed
                        justification: justification,
                    };

                    // Property 1: Dismissal should fail when summary is provided for dismissed outcome
                    await expect(IncidentManager.resolveIncident(resolveInput))
                        .rejects.toThrow('Summary should not be provided when dismissing an incident');

                    // Property 2: No database operations should occur for invalid input
                    expect(mockDb.select).not.toHaveBeenCalled();
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Invalid Outcome Values
    // ========================================================================

    it('should reject resolution with invalid outcome values', async () => {
        await fc.assert(
            fc.asyncProperty(
                resolvableIncidentArb,
                fc.string().filter(s => s !== 'resolved' && s !== 'dismissed'), // Invalid outcomes
                fc.oneof(fc.constant(undefined), validSummaryArb),
                fc.oneof(fc.constant(undefined), validJustificationArb),
                async (incident, invalidOutcome, summary, justification) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Test: Attempt to resolve incident with invalid outcome
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: incident.ownerId,
                        outcome: invalidOutcome as any,
                        summary: summary,
                        justification: justification,
                    };

                    // Property 1: Resolution should fail with invalid outcome
                    await expect(IncidentManager.resolveIncident(resolveInput))
                        .rejects.toThrow('Invalid outcome. Must be "resolved" or "dismissed"');

                    // Property 2: No database operations should occur for invalid input
                    expect(mockDb.select).not.toHaveBeenCalled();
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 30 }
        );
    });

    // ========================================================================
    // Property Test: Incident State Validation
    // ========================================================================

    it('should validate incident exists and is in resolvable state before resolution', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    id: fc.uuid(),
                    tenantId: tenantIdArb,
                    ownerId: userIdArb,
                    status: fc.constantFrom<IncidentStatus>('resolved', 'dismissed'), // Non-resolvable states
                }),
                validSummaryArb,
                async (nonResolvableIncident, summary) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database to return no incident (simulating non-resolvable state)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // No incident found
                            }),
                        }),
                    });

                    // Test: Attempt to resolve non-resolvable incident
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: nonResolvableIncident.id,
                        tenantId: nonResolvableIncident.tenantId,
                        ownerId: nonResolvableIncident.ownerId,
                        outcome: 'resolved',
                        summary: summary,
                    };

                    // Property 1: Resolution should fail for non-resolvable incidents
                    await expect(IncidentManager.resolveIncident(resolveInput))
                        .rejects.toThrow('Incident not found, not owned by user, or not in resolvable status');

                    // Property 2: Database should be queried for incident validation
                    expect(mockDb.select).toHaveBeenCalled();

                    // Property 3: No update should be attempted for non-existent/non-resolvable incident
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Tenant Isolation in Resolution
    // ========================================================================

    it('should enforce tenant isolation during incident resolution', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.tuple(tenantIdArb, tenantIdArb).filter(([t1, t2]) => t1 !== t2), // Different tenants
                resolvableIncidentArb,
                validSummaryArb,
                async ([tenant1, tenant2], incident, summary) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Incident belongs to tenant1
                    const tenant1Incident = { ...incident, tenantId: tenant1 };

                    // Mock database to enforce tenant isolation
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([]), // No incident found for wrong tenant
                            }),
                        }),
                    });

                    // Test: Attempt to resolve incident from wrong tenant context
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: tenant1Incident.id,
                        tenantId: tenant2, // Wrong tenant
                        ownerId: tenant1Incident.ownerId,
                        outcome: 'resolved',
                        summary: summary,
                    };

                    // Property 1: Cross-tenant resolution should fail
                    await expect(IncidentManager.resolveIncident(resolveInput))
                        .rejects.toThrow('Incident not found, not owned by user, or not in resolvable status');

                    // Property 2: Database query should include tenant filter
                    expect(mockDb.select).toHaveBeenCalled();
                    const queryConditions = mockDb.select().from().where.mock.calls[0][0];
                    expect(queryConditions).toEqual(
                        and(
                            eq(securityIncidents.id, tenant1Incident.id),
                            eq(securityIncidents.tenantId, tenant2), // Wrong tenant in query
                            eq(securityIncidents.ownerId, tenant1Incident.ownerId),
                            inArray(securityIncidents.status, ['open', 'in_progress'])
                        )
                    );

                    // Property 3: No update should occur for cross-tenant access
                    expect(mockDb.update).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 30 }
        );
    });
});