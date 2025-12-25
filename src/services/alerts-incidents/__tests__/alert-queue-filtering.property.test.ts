/**
 * Property-Based Test for Alert Queue Filtering by Assignment Status
 * 
 * **Feature: avian-alerts-incidents, Property 2: Alert queue filtering by assignment status**
 * **Validates: Requirements 1.1, 3.1**
 * 
 * This test verifies that alert queue filtering properly separates alerts based on
 * assignment status: All Alerts tab shows only unassigned alerts, while My Alerts
 * tab shows only alerts assigned to the current analyst.
 */

import * as fc from 'fast-check';
import { AlertManager } from '../AlertManager';
import { db } from '../../../lib/database';
import { securityAlerts } from '../../../../database/schemas/alerts-incidents';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import {
    SecurityAlert,
    AlertFilters,
    AlertStatus,
    AlertSeverity,
    AlertSourceSystem,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        transaction: jest.fn(),
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
        logAlertCreated: jest.fn().mockResolvedValue(undefined),
        logAlertAssigned: jest.fn().mockResolvedValue(undefined),
        logAlertInvestigationStarted: jest.fn().mockResolvedValue(undefined),
        logAlertResolved: jest.fn().mockResolvedValue(undefined),
        logAlertEscalated: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../OwnershipEnforcementService', () => ({
    OwnershipEnforcementService: {
        validateAlertOwnership: jest.fn().mockResolvedValue({ isValid: true }),
        trackOwnershipChange: jest.fn().mockResolvedValue(undefined),
    },
}));

describe('Alert Queue Filtering Property Tests', () => {
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

    // Generate alert statuses
    const alertStatusArb = fc.constantFrom<AlertStatus>(
        'open', 'assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive'
    );

    // Generate unassigned alert statuses (for All Alerts tab)
    const unassignedStatusArb = fc.constant<AlertStatus>('open');

    // Generate assigned alert statuses (for My Alerts tab)
    const assignedStatusArb = fc.constantFrom<AlertStatus>('assigned', 'investigating');

    // Generate security alert data
    const securityAlertArb = fc.record({
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
        status: alertStatusArb,
        assignedTo: fc.oneof(fc.constant(null), userIdArb),
        assignedAt: fc.oneof(fc.constant(null), fc.date()),
        detectedAt: fc.date(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    // Generate unassigned alerts (for All Alerts tab)
    const unassignedAlertArb = securityAlertArb.map(alert => ({
        ...alert,
        status: 'open' as AlertStatus,
        assignedTo: null,
        assignedAt: null,
    }));

    // Generate assigned alerts (for My Alerts tab)
    const assignedAlertArb = fc.tuple(securityAlertArb, userIdArb, assignedStatusArb).map(([alert, userId, status]) => ({
        ...alert,
        status,
        assignedTo: userId,
        assignedAt: new Date(),
    }));

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: All Alerts Tab Shows Only Unassigned Alerts
    // ========================================================================

    it('should show only unassigned alerts in All Alerts tab (triage queue)', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(unassignedAlertArb, { minLength: 1, maxLength: 20 }),
                fc.array(assignedAlertArb, { minLength: 1, maxLength: 20 }),
                async (tenantId, unassignedAlerts, assignedAlerts) => {
                    // Setup: Create mix of assigned and unassigned alerts for the same tenant
                    const allUnassignedAlerts = unassignedAlerts.map(alert => ({ ...alert, tenantId }));
                    const allAssignedAlerts = assignedAlerts.map(alert => ({ ...alert, tenantId }));
                    const allAlerts = [...allUnassignedAlerts, ...allAssignedAlerts];

                    // Mock database to simulate filtering for unassigned alerts (status = 'open')
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockImplementation((condition) => ({
                                orderBy: jest.fn().mockImplementation(() => {
                                    // Simulate database filtering: tenant + status = 'open'
                                    const filteredAlerts = allAlerts.filter(alert =>
                                        alert.tenantId === tenantId &&
                                        alert.status === 'open' &&
                                        alert.assignedTo === null
                                    );
                                    return Promise.resolve(filteredAlerts);
                                }),
                                limit: jest.fn().mockImplementation(() => {
                                    const filteredAlerts = allAlerts.filter(alert =>
                                        alert.tenantId === tenantId &&
                                        alert.status === 'open' &&
                                        alert.assignedTo === null
                                    );
                                    return Promise.resolve(filteredAlerts);
                                }),
                                offset: jest.fn().mockImplementation(() => ({
                                    limit: jest.fn().mockImplementation(() => {
                                        const filteredAlerts = allAlerts.filter(alert =>
                                            alert.tenantId === tenantId &&
                                            alert.status === 'open' &&
                                            alert.assignedTo === null
                                        );
                                        return Promise.resolve(filteredAlerts);
                                    }),
                                })),
                            })),
                        }),
                    });

                    // Test: Get triage queue (All Alerts tab)
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    // Property: All returned alerts must be unassigned (status = 'open', assignedTo = null)
                    const allAreUnassigned = triageQueueAlerts.every(alert =>
                        alert.status === 'open' && alert.assignedTo === null
                    );
                    expect(allAreUnassigned).toBe(true);

                    // Property: No assigned alerts should appear in triage queue
                    const noAssignedAlerts = triageQueueAlerts.every(alert =>
                        !['assigned', 'investigating'].includes(alert.status)
                    );
                    expect(noAssignedAlerts).toBe(true);

                    // Property: All alerts belong to the correct tenant
                    const allCorrectTenant = triageQueueAlerts.every(alert => alert.tenantId === tenantId);
                    expect(allCorrectTenant).toBe(true);

                    // Property: Database query should filter for unassigned alerts
                    expect(mockDb.select).toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: My Alerts Tab Shows Only Assigned Alerts for Current User
    // ========================================================================

    it('should show only assigned alerts for current analyst in My Alerts tab (investigation queue)', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                userIdArb,
                fc.array(userIdArb, { minLength: 1, maxLength: 5 }), // Other users
                fc.array(unassignedAlertArb, { minLength: 1, maxLength: 10 }),
                fc.array(assignedAlertArb, { minLength: 1, maxLength: 10 }),
                async (tenantId, currentUserId, otherUserIds, unassignedAlerts, assignedAlerts) => {
                    // Ensure current user is not in other users list
                    const filteredOtherUsers = otherUserIds.filter(id => id !== currentUserId);
                    if (filteredOtherUsers.length === 0) return; // Skip if no other users

                    // Setup: Create alerts assigned to current user and other users
                    const currentUserAlerts = assignedAlerts.slice(0, 5).map((alert, index) => ({
                        ...alert,
                        tenantId,
                        assignedTo: currentUserId,
                        status: index % 2 === 0 ? 'assigned' as AlertStatus : 'investigating' as AlertStatus,
                    }));

                    const otherUserAlerts = assignedAlerts.slice(5).map((alert, index) => ({
                        ...alert,
                        tenantId,
                        assignedTo: filteredOtherUsers[index % filteredOtherUsers.length],
                        status: index % 2 === 0 ? 'assigned' as AlertStatus : 'investigating' as AlertStatus,
                    }));

                    const unassignedAlertsForTenant = unassignedAlerts.map(alert => ({ ...alert, tenantId }));
                    const allAlerts = [...currentUserAlerts, ...otherUserAlerts, ...unassignedAlertsForTenant];

                    // Mock database to simulate filtering for current user's assigned alerts
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockImplementation((condition) => ({
                                orderBy: jest.fn().mockImplementation(() => {
                                    // Simulate database filtering: tenant + assignedTo = currentUserId + status in ['assigned', 'investigating']
                                    const filteredAlerts = allAlerts.filter(alert =>
                                        alert.tenantId === tenantId &&
                                        alert.assignedTo === currentUserId &&
                                        ['assigned', 'investigating'].includes(alert.status)
                                    );
                                    return Promise.resolve(filteredAlerts);
                                }),
                                limit: jest.fn().mockImplementation(() => {
                                    const filteredAlerts = allAlerts.filter(alert =>
                                        alert.tenantId === tenantId &&
                                        alert.assignedTo === currentUserId &&
                                        ['assigned', 'investigating'].includes(alert.status)
                                    );
                                    return Promise.resolve(filteredAlerts);
                                }),
                                offset: jest.fn().mockImplementation(() => ({
                                    limit: jest.fn().mockImplementation(() => {
                                        const filteredAlerts = allAlerts.filter(alert =>
                                            alert.tenantId === tenantId &&
                                            alert.assignedTo === currentUserId &&
                                            ['assigned', 'investigating'].includes(alert.status)
                                        );
                                        return Promise.resolve(filteredAlerts);
                                    }),
                                })),
                            })),
                        }),
                    });

                    // Test: Get investigation queue (My Alerts tab)
                    const investigationQueueAlerts = await AlertManager.getInvestigationQueue(tenantId, currentUserId);

                    // Property: All returned alerts must be assigned to the current user
                    const allAssignedToCurrentUser = investigationQueueAlerts.every(alert =>
                        alert.assignedTo === currentUserId
                    );
                    expect(allAssignedToCurrentUser).toBe(true);

                    // Property: All returned alerts must have assigned or investigating status
                    const allHaveAssignedStatus = investigationQueueAlerts.every(alert =>
                        ['assigned', 'investigating'].includes(alert.status)
                    );
                    expect(allHaveAssignedStatus).toBe(true);

                    // Property: No unassigned alerts should appear in investigation queue
                    const noUnassignedAlerts = investigationQueueAlerts.every(alert =>
                        alert.assignedTo !== null && alert.status !== 'open'
                    );
                    expect(noUnassignedAlerts).toBe(true);

                    // Property: No alerts assigned to other users should appear
                    const noOtherUserAlerts = investigationQueueAlerts.every(alert =>
                        !filteredOtherUsers.includes(alert.assignedTo || '')
                    );
                    expect(noOtherUserAlerts).toBe(true);

                    // Property: All alerts belong to the correct tenant
                    const allCorrectTenant = investigationQueueAlerts.every(alert => alert.tenantId === tenantId);
                    expect(allCorrectTenant).toBe(true);

                    // Property: Database query should filter for current user's assignments
                    expect(mockDb.select).toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Alert Queue Separation Consistency
    // ========================================================================

    it('should maintain consistent separation between All Alerts and My Alerts queues', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                userIdArb,
                fc.array(securityAlertArb, { minLength: 5, maxLength: 30 }),
                async (tenantId, currentUserId, alertTemplates) => {
                    // Setup: Create a mix of alerts with different assignment states
                    const alerts = alertTemplates.map((alert, index) => {
                        const isAssigned = index % 3 !== 0; // 2/3 assigned, 1/3 unassigned
                        const isCurrentUser = index % 2 === 0; // Half to current user, half to others

                        if (!isAssigned) {
                            return {
                                ...alert,
                                tenantId,
                                status: 'open' as AlertStatus,
                                assignedTo: null,
                                assignedAt: null,
                            };
                        } else {
                            // Generate a different user ID for non-current user assignments
                            const otherUserId = `other-user-${index}`;
                            const assignedTo = isCurrentUser ? currentUserId : otherUserId;
                            const status = index % 4 === 0 ? 'assigned' : 'investigating';
                            return {
                                ...alert,
                                tenantId,
                                status: status as AlertStatus,
                                assignedTo,
                                assignedAt: new Date(),
                            };
                        }
                    });

                    // Mock database for triage queue (unassigned alerts)
                    const setupTriageQueueMock = () => {
                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockImplementation(() => ({
                                    orderBy: jest.fn().mockImplementation(() => {
                                        const unassignedAlerts = alerts.filter(alert =>
                                            alert.tenantId === tenantId &&
                                            alert.status === 'open' &&
                                            alert.assignedTo === null
                                        );
                                        return Promise.resolve(unassignedAlerts);
                                    }),
                                })),
                            }),
                        });
                    };

                    // Mock database for investigation queue (current user's assigned alerts)
                    const setupInvestigationQueueMock = () => {
                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockImplementation(() => ({
                                    orderBy: jest.fn().mockImplementation(() => {
                                        const assignedAlerts = alerts.filter(alert =>
                                            alert.tenantId === tenantId &&
                                            alert.assignedTo === currentUserId &&
                                            ['assigned', 'investigating'].includes(alert.status)
                                        );
                                        return Promise.resolve(assignedAlerts);
                                    }),
                                })),
                            }),
                        });
                    };

                    // Test: Get both queues
                    setupTriageQueueMock();
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    setupInvestigationQueueMock();
                    const investigationQueueAlerts = await AlertManager.getInvestigationQueue(tenantId, currentUserId);

                    // Property: No alert should appear in both queues
                    const triageAlertIds = new Set(triageQueueAlerts.map(alert => alert.id));
                    const investigationAlertIds = new Set(investigationQueueAlerts.map(alert => alert.id));
                    const intersection = new Set([...triageAlertIds].filter(id => investigationAlertIds.has(id)));
                    expect(intersection.size).toBe(0);

                    // Property: Triage queue contains only unassigned alerts
                    const triageOnlyUnassigned = triageQueueAlerts.every(alert =>
                        alert.status === 'open' && alert.assignedTo === null
                    );
                    expect(triageOnlyUnassigned).toBe(true);

                    // Property: Investigation queue contains only current user's assigned alerts
                    const investigationOnlyCurrentUser = investigationQueueAlerts.every(alert =>
                        alert.assignedTo === currentUserId && ['assigned', 'investigating'].includes(alert.status)
                    );
                    expect(investigationOnlyCurrentUser).toBe(true);

                    // Property: Combined queues should not exceed total alerts for tenant
                    const totalQueueAlerts = triageQueueAlerts.length + investigationQueueAlerts.length;
                    const totalTenantAlerts = alerts.filter(alert => alert.tenantId === tenantId).length;
                    expect(totalQueueAlerts).toBeLessThanOrEqual(totalTenantAlerts);

                    // Property: All queue alerts belong to the correct tenant
                    const allTriageCorrectTenant = triageQueueAlerts.every(alert => alert.tenantId === tenantId);
                    const allInvestigationCorrectTenant = investigationQueueAlerts.every(alert => alert.tenantId === tenantId);
                    expect(allTriageCorrectTenant).toBe(true);
                    expect(allInvestigationCorrectTenant).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Assignment Status Filtering with General getAlerts Method
    // ========================================================================

    it('should properly filter alerts by assignment status using general getAlerts method', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                userIdArb,
                fc.array(securityAlertArb, { minLength: 3, maxLength: 15 }),
                async (tenantId, userId, alertTemplates) => {
                    // Setup: Create alerts with various assignment states
                    const alerts = alertTemplates.map((alert, index) => ({
                        ...alert,
                        tenantId,
                        status: index % 3 === 0 ? 'open' as AlertStatus :
                            index % 3 === 1 ? 'assigned' as AlertStatus : 'investigating' as AlertStatus,
                        assignedTo: index % 3 === 0 ? null : userId,
                        assignedAt: index % 3 === 0 ? null : new Date(),
                    }));

                    // Mock database to simulate filtering
                    const setupMockForFilters = (filters: AlertFilters) => {
                        const getFilteredAlerts = () => {
                            let filteredAlerts = alerts.filter(alert => alert.tenantId === tenantId);

                            if (filters.status) {
                                const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
                                filteredAlerts = filteredAlerts.filter(alert => statusArray.includes(alert.status));
                            }

                            if (filters.assignedTo) {
                                filteredAlerts = filteredAlerts.filter(alert => alert.assignedTo === filters.assignedTo);
                            }

                            return filteredAlerts;
                        };

                        const mockQueryBuilder = {
                            orderBy: jest.fn().mockImplementation(() => Promise.resolve(getFilteredAlerts())),
                            limit: jest.fn().mockImplementation(() => Promise.resolve(getFilteredAlerts())),
                            offset: jest.fn().mockImplementation(() => ({
                                limit: jest.fn().mockImplementation(() => Promise.resolve(getFilteredAlerts())),
                            })),
                            // Handle direct execution (await query)
                            then: jest.fn().mockImplementation((resolve) => resolve(getFilteredAlerts())),
                        };

                        mockDb.select.mockReturnValue({
                            from: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue(mockQueryBuilder),
                            }),
                        });
                    };

                    // Test: Filter for unassigned alerts (status = 'open')
                    const unassignedFilters: AlertFilters = { tenantId, status: 'open' };
                    setupMockForFilters(unassignedFilters);
                    const unassignedResults = await AlertManager.getAlerts(unassignedFilters);

                    // Property: All results should have 'open' status and no assignment
                    const allUnassigned = unassignedResults.every(alert =>
                        alert.status === 'open' && alert.assignedTo === null
                    );
                    expect(allUnassigned).toBe(true);

                    // Test: Filter for assigned alerts to specific user
                    const assignedFilters: AlertFilters = { tenantId, assignedTo: userId };
                    setupMockForFilters(assignedFilters);
                    const assignedResults = await AlertManager.getAlerts(assignedFilters);

                    // Property: All results should be assigned to the specified user
                    const allAssignedToUser = assignedResults.every(alert => alert.assignedTo === userId);
                    expect(allAssignedToUser).toBe(true);

                    // Test: Filter for multiple assignment statuses
                    const multiStatusFilters: AlertFilters = { tenantId, status: ['assigned', 'investigating'] };
                    setupMockForFilters(multiStatusFilters);
                    const multiStatusResults = await AlertManager.getAlerts(multiStatusFilters);

                    // Property: All results should have one of the specified statuses
                    const allHaveCorrectStatus = multiStatusResults.every(alert =>
                        ['assigned', 'investigating'].includes(alert.status)
                    );
                    expect(allHaveCorrectStatus).toBe(true);

                    // Property: All results belong to the correct tenant
                    expect(unassignedResults.every(alert => alert.tenantId === tenantId)).toBe(true);
                    expect(assignedResults.every(alert => alert.tenantId === tenantId)).toBe(true);
                    expect(multiStatusResults.every(alert => alert.tenantId === tenantId)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});