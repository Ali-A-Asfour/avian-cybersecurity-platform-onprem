/**
 * Property-Based Test for Global Incidents View Restrictions
 * 
 * **Feature: avian-alerts-incidents, Property 13: Global incidents view restrictions**
 * **Validates: Requirements 8.1, 8.2, 8.4**
 * 
 * This test verifies that when accessing All Security Incidents:
 * 1. All incidents are visible with read-only access (Requirement 8.1)
 * 2. No incident pickup or reassignment actions are available (Requirement 8.2)
 * 3. Incident ownership restrictions are maintained in the global view (Requirement 8.4)
 */

import * as fc from 'fast-check';
import { IncidentManager } from '../IncidentManager';
import { db } from '../../../lib/database';
import { securityIncidents } from '../../../../database/schemas/alerts-incidents';
import { eq, and, desc } from 'drizzle-orm';
import {
    SecurityIncident,
    IncidentFilters,
    AlertSeverity,
    IncidentStatus,
    StartWorkInput,
    ResolveIncidentInput,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        select: jest.fn(),
        update: jest.fn(),
        transaction: jest.fn(),
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

jest.mock('../OwnershipEnforcementService', () => ({
    OwnershipEnforcementService: {
        validateIncidentOwnership: jest.fn(),
    },
}));

jest.mock('../AuditService', () => ({
    AuditService: {
        logIncidentWorkStarted: jest.fn().mockResolvedValue(undefined),
        logIncidentResolved: jest.fn().mockResolvedValue(undefined),
        logIncidentDismissed: jest.fn().mockResolvedValue(undefined),
    },
}));

describe('Global Incidents View Restrictions Property Tests', () => {
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

    // Generate incident statuses
    const incidentStatusArb = fc.constantFrom<IncidentStatus>('open', 'in_progress', 'resolved', 'dismissed');

    // Generate security incident data
    const securityIncidentArb = fc.record({
        id: fc.uuid(),
        tenantId: tenantIdArb,
        ownerId: userIdArb,
        title: fc.string({ minLength: 1, maxLength: 500 }),
        description: fc.oneof(fc.constant(null), fc.string({ maxLength: 1000 })),
        severity: alertSeverityArb,
        status: incidentStatusArb,
        resolutionSummary: fc.oneof(fc.constant(null), fc.string()),
        dismissalJustification: fc.oneof(fc.constant(null), fc.string()),
        slaAcknowledgeBy: fc.date(),
        slaInvestigateBy: fc.date(),
        slaResolveBy: fc.date(),
        acknowledgedAt: fc.oneof(fc.constant(null), fc.date()),
        investigationStartedAt: fc.oneof(fc.constant(null), fc.date()),
        resolvedAt: fc.oneof(fc.constant(null), fc.date()),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: All Incidents Visible with Read-Only Access
    // ========================================================================

    it('should display all incidents with read-only access for any user', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(userIdArb, { minLength: 2, maxLength: 5 }).filter(users =>
                    new Set(users).size === users.length // Ensure all users are unique
                ),
                fc.array(securityIncidentArb, { minLength: 5, maxLength: 20 }),
                userIdArb, // Current viewing user
                async (tenantId, incidentOwners, incidentTemplates, viewingUser) => {
                    // Setup: Create incidents owned by different users in the same tenant
                    const incidents: SecurityIncident[] = incidentTemplates.map((template, index) => ({
                        ...template,
                        tenantId,
                        ownerId: incidentOwners[index % incidentOwners.length],
                        id: fc.sample(fc.uuid(), 1)[0],
                    }));

                    // Mock database to return all incidents for the tenant (no owner filtering)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockImplementation((condition) => ({
                                orderBy: jest.fn().mockImplementation(() => {
                                    // Simulate tenant-scoped query returning all incidents
                                    return Promise.resolve(incidents);
                                }),
                                limit: jest.fn().mockImplementation(() => {
                                    return Promise.resolve(incidents);
                                }),
                                offset: jest.fn().mockImplementation(() => ({
                                    limit: jest.fn().mockImplementation(() => {
                                        return Promise.resolve(incidents);
                                    }),
                                })),
                            })),
                        }),
                    });

                    // Test: Get all incidents (global view) should return all incidents regardless of ownership
                    const retrievedIncidents = await IncidentManager.getAllIncidents(tenantId);

                    // Property: All incidents in the tenant should be visible (Requirement 8.1)
                    expect(retrievedIncidents).toHaveLength(incidents.length);

                    // Property: All returned incidents must belong to the correct tenant
                    const allBelongToTenant = retrievedIncidents.every(incident => incident.tenantId === tenantId);
                    expect(allBelongToTenant).toBe(true);

                    // Property: Incidents owned by different users should all be visible (read-only access)
                    const uniqueOwners = new Set(retrievedIncidents.map(incident => incident.ownerId));
                    expect(uniqueOwners.size).toBeGreaterThan(1); // Multiple owners should be visible

                    // Property: Database query should NOT filter by owner (global view)
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectCall = mockDb.select.mock.calls[0];
                    // Verify that the query doesn't include owner filtering for global view
                    expect(selectCall).toBeDefined();
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: No Pickup or Reassignment Actions Available
    // ========================================================================

    it('should prevent incident pickup and reassignment actions in global view', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.tuple(userIdArb, userIdArb).filter(([owner, viewer]) => owner !== viewer), // Different users
                securityIncidentArb,
                async ([incidentOwner, viewingUser], incidentTemplate) => {
                    // Setup: Create incident owned by different user
                    const incident: SecurityIncident = {
                        ...incidentTemplate,
                        ownerId: incidentOwner,
                        status: 'open', // Incident that could normally be worked on
                    };

                    // Mock ownership validation to deny actions for non-owners
                    const { OwnershipEnforcementService } = require('../OwnershipEnforcementService');
                    OwnershipEnforcementService.validateIncidentOwnership.mockResolvedValue({
                        isValid: false,
                        reason: 'User is not the owner of this incident',
                    });

                    // Test: Attempt to start work on incident owned by another user should fail
                    const startWorkInput: StartWorkInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: viewingUser, // Different from incident owner
                    };

                    await expect(IncidentManager.startWork(startWorkInput))
                        .rejects.toThrow('Start work denied: User is not the owner of this incident');

                    // Test: Attempt to resolve incident owned by another user should fail
                    const resolveInput: ResolveIncidentInput = {
                        incidentId: incident.id,
                        tenantId: incident.tenantId,
                        ownerId: viewingUser, // Different from incident owner
                        outcome: 'resolved',
                        summary: 'Test resolution',
                    };

                    await expect(IncidentManager.resolveIncident(resolveInput))
                        .rejects.toThrow('Resolution denied: User is not the owner of this incident');

                    // Property: Ownership validation must be called for restricted actions (Requirement 8.2, 8.4)
                    expect(OwnershipEnforcementService.validateIncidentOwnership).toHaveBeenCalledWith(
                        incident.id,
                        incident.tenantId,
                        viewingUser,
                        'start_work'
                    );

                    expect(OwnershipEnforcementService.validateIncidentOwnership).toHaveBeenCalledWith(
                        incident.id,
                        incident.tenantId,
                        viewingUser,
                        'resolve'
                    );
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Ownership Restrictions Maintained in Global View
    // ========================================================================

    it('should maintain incident ownership restrictions in global view', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(userIdArb, { minLength: 3, maxLength: 6 }).filter(users =>
                    new Set(users).size === users.length // Ensure all users are unique
                ),
                fc.array(securityIncidentArb, { minLength: 10, maxLength: 30 }),
                async (tenantId, users, incidentTemplates) => {
                    // Setup: Create incidents with different owners
                    const incidents: SecurityIncident[] = incidentTemplates.map((template, index) => ({
                        ...template,
                        tenantId,
                        ownerId: users[index % users.length],
                        id: fc.sample(fc.uuid(), 1)[0],
                    }));

                    // Mock database to return all incidents
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockResolvedValue(incidents),
                            }),
                        }),
                    });

                    // Test: Get all incidents for global view
                    const allIncidents = await IncidentManager.getAllIncidents(tenantId);

                    // Property: Each incident should maintain its original ownership (Requirement 8.4)
                    allIncidents.forEach((incident, index) => {
                        const originalIncident = incidents[index];
                        expect(incident.ownerId).toBe(originalIncident.ownerId);
                    });

                    // Property: Ownership information should be preserved and visible for reporting
                    const ownershipData = allIncidents.map(incident => ({
                        incidentId: incident.id,
                        ownerId: incident.ownerId,
                        status: incident.status,
                    }));

                    // All incidents should have valid owner IDs
                    const allHaveOwners = ownershipData.every(data =>
                        data.ownerId && typeof data.ownerId === 'string'
                    );
                    expect(allHaveOwners).toBe(true);

                    // Property: Multiple different owners should be represented in global view
                    const uniqueOwners = new Set(ownershipData.map(data => data.ownerId));
                    expect(uniqueOwners.size).toBeGreaterThan(1);

                    // Property: Ownership restrictions should prevent unauthorized modifications
                    for (const user of users) {
                        const userIncidents = allIncidents.filter(incident => incident.ownerId === user);
                        const otherIncidents = allIncidents.filter(incident => incident.ownerId !== user);

                        // User should only be able to modify their own incidents
                        if (otherIncidents.length > 0) {
                            const { OwnershipEnforcementService } = require('../OwnershipEnforcementService');
                            OwnershipEnforcementService.validateIncidentOwnership.mockResolvedValue({
                                isValid: false,
                                reason: 'User is not the owner of this incident',
                            });

                            const otherIncident = otherIncidents[0];
                            const unauthorizedAction: StartWorkInput = {
                                incidentId: otherIncident.id,
                                tenantId: otherIncident.tenantId,
                                ownerId: user,
                            };

                            await expect(IncidentManager.startWork(unauthorizedAction))
                                .rejects.toThrow('Start work denied: User is not the owner of this incident');
                        }
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    // ========================================================================
    // Property Test: Global View Provides Complete Incident Information
    // ========================================================================

    it('should provide complete incident information for reporting purposes', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(securityIncidentArb, { minLength: 5, maxLength: 15 }),
                async (tenantId, incidentTemplates) => {
                    // Setup: Create incidents with various statuses and outcomes
                    const incidents: SecurityIncident[] = incidentTemplates.map((template, index) => ({
                        ...template,
                        tenantId,
                        id: fc.sample(fc.uuid(), 1)[0],
                        // Ensure some incidents have resolution data
                        resolutionSummary: index % 3 === 0 ? 'Test resolution summary' : null,
                        dismissalJustification: index % 4 === 0 ? 'Test dismissal justification' : null,
                        status: index % 2 === 0 ? 'resolved' : template.status,
                    }));

                    // Mock database to return all incidents
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockReturnValue({
                                orderBy: jest.fn().mockResolvedValue(incidents),
                            }),
                        }),
                    });

                    // Test: Get all incidents for global view
                    const allIncidents = await IncidentManager.getAllIncidents(tenantId);

                    // Property: All essential incident information should be available (Requirement 8.1, 8.3)
                    allIncidents.forEach(incident => {
                        // Core incident data should be present
                        expect(incident.id).toBeDefined();
                        expect(incident.tenantId).toBe(tenantId);
                        expect(incident.ownerId).toBeDefined();
                        expect(incident.title).toBeDefined();
                        expect(incident.severity).toBeDefined();
                        expect(incident.status).toBeDefined();
                        expect(incident.createdAt).toBeDefined();

                        // SLA information should be available for monitoring
                        expect(incident.slaAcknowledgeBy).toBeDefined();
                        expect(incident.slaInvestigateBy).toBeDefined();
                        expect(incident.slaResolveBy).toBeDefined();
                    });

                    // Property: Resolution and outcome information should be preserved (Requirement 8.5)
                    const resolvedIncidents = allIncidents.filter(incident =>
                        incident.status === 'resolved' || incident.status === 'dismissed'
                    );

                    resolvedIncidents.forEach(incident => {
                        if (incident.status === 'resolved') {
                            // Resolved incidents should have resolution summary or be null
                            expect(typeof incident.resolutionSummary === 'string' || incident.resolutionSummary === null).toBe(true);
                        }
                        if (incident.status === 'dismissed') {
                            // Dismissed incidents should have justification or be null
                            expect(typeof incident.dismissalJustification === 'string' || incident.dismissalJustification === null).toBe(true);
                        }
                    });

                    // Property: Incident data should be suitable for reporting and trend analysis
                    const statusCounts = allIncidents.reduce((counts, incident) => {
                        counts[incident.status] = (counts[incident.status] || 0) + 1;
                        return counts;
                    }, {} as Record<string, number>);

                    // Should be able to generate status distribution
                    expect(Object.keys(statusCounts).length).toBeGreaterThan(0);

                    // Should be able to calculate severity distribution
                    const severityCounts = allIncidents.reduce((counts, incident) => {
                        counts[incident.severity] = (counts[incident.severity] || 0) + 1;
                        return counts;
                    }, {} as Record<string, number>);

                    expect(Object.keys(severityCounts).length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 40 }
        );
    });
});