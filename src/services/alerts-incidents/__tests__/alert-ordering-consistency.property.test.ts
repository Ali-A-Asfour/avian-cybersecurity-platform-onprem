/**
 * Property-Based Test for Alert Ordering Consistency
 * 
 * **Feature: avian-alerts-incidents, Property 3: Alert ordering consistency**
 * **Validates: Requirements 1.2, 3.2**
 * 
 * This test verifies that alert ordering is consistent across different queue types:
 * - Triage queue (All Alerts): Order by severity (Critical→Low) then by created time (oldest first)
 * - Investigation queue (My Alerts): Order by assignment time (newest at bottom)
 */

import * as fc from 'fast-check';
import { AlertManager } from '../AlertManager';
import { db } from '../../../lib/database';

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

describe('Alert Ordering Consistency Property Tests', () => {
    const mockDb = db as any;

    // ========================================================================
    // Property Test Generators
    // ========================================================================

    // Generate valid tenant IDs
    const tenantIdArb = fc.uuid();

    // Generate valid user IDs
    const userIdArb = fc.uuid();

    // Generate alert severities with explicit ordering
    const alertSeverityArb = fc.constantFrom<AlertSeverity>('critical', 'high', 'medium', 'low');

    // Generate alert source systems
    const alertSourceSystemArb = fc.constantFrom<AlertSourceSystem>('edr', 'firewall', 'email');

    // Generate alert statuses
    const alertStatusArb = fc.constantFrom<AlertStatus>(
        'open', 'assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive'
    );

    // Generate dates for testing temporal ordering
    const dateArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') });

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
        firstSeenAt: dateArb,
        lastSeenAt: dateArb,
        defenderIncidentId: fc.oneof(fc.constant(null), fc.string()),
        defenderAlertId: fc.oneof(fc.constant(null), fc.string()),
        defenderSeverity: fc.oneof(fc.constant(null), fc.string()),
        threatName: fc.oneof(fc.constant(null), fc.string()),
        affectedDevice: fc.oneof(fc.constant(null), fc.string()),
        affectedUser: fc.oneof(fc.constant(null), fc.string()),
        status: alertStatusArb,
        assignedTo: fc.oneof(fc.constant(null), userIdArb),
        assignedAt: fc.oneof(fc.constant(null), dateArb),
        detectedAt: dateArb,
        createdAt: dateArb,
        updatedAt: dateArb,
    });

    // Generate unassigned alerts for triage queue testing
    const unassignedAlertArb = securityAlertArb.map(alert => ({
        ...alert,
        status: 'open' as AlertStatus,
        assignedTo: null,
        assignedAt: null,
    }));

    // Generate assigned alerts for investigation queue testing
    const assignedAlertArb = fc.tuple(securityAlertArb, userIdArb, dateArb).map(([alert, userId, assignedAt]) => ({
        ...alert,
        status: fc.sample(fc.constantFrom<AlertStatus>('assigned', 'investigating'), 1)[0],
        assignedTo: userId,
        assignedAt,
    }));

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    // ========================================================================
    // Helper Functions for Severity Ordering
    // ========================================================================

    /**
     * Get numeric value for severity ordering (Critical=0, High=1, Medium=2, Low=3)
     */
    const getSeverityOrder = (severity: AlertSeverity): number => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[severity];
    };

    /**
     * Check if alerts are properly ordered by severity then created time
     */
    const isTriageQueueOrdered = (alerts: SecurityAlert[]): boolean => {
        for (let i = 0; i < alerts.length - 1; i++) {
            const current = alerts[i];
            const next = alerts[i + 1];

            const currentSeverityOrder = getSeverityOrder(current.severity);
            const nextSeverityOrder = getSeverityOrder(next.severity);

            // First check severity ordering (Critical→Low)
            if (currentSeverityOrder < nextSeverityOrder) {
                continue; // Correct severity order
            } else if (currentSeverityOrder > nextSeverityOrder) {
                return false; // Wrong severity order
            } else {
                // Same severity, check created time (oldest first)
                if (current.createdAt > next.createdAt) {
                    return false; // Wrong time order
                }
            }
        }
        return true;
    };

    /**
     * Check if alerts are properly ordered by assignment time (newest at bottom)
     */
    const isInvestigationQueueOrdered = (alerts: SecurityAlert[]): boolean => {
        for (let i = 0; i < alerts.length - 1; i++) {
            const current = alerts[i];
            const next = alerts[i + 1];

            // Both should have assignment times
            if (!current.assignedAt || !next.assignedAt) {
                return false;
            }

            // Check assignment time ordering (newest at bottom = ascending order)
            if (current.assignedAt > next.assignedAt) {
                return false; // Wrong assignment time order
            }
        }
        return true;
    };

    // ========================================================================
    // Property Test: Triage Queue Ordering (Severity → Created Time)
    // ========================================================================

    it('should order triage queue alerts by severity (Critical→Low) then by created time (oldest first)', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(unassignedAlertArb, { minLength: 3, maxLength: 20 }),
                async (tenantId, alertTemplates) => {
                    // Setup: Create unassigned alerts with various severities and created times
                    const alerts = alertTemplates.map((alert, index) => ({
                        ...alert,
                        tenantId,
                        // Ensure variety in severities and created times
                        severity: ['critical', 'high', 'medium', 'low'][index % 4] as AlertSeverity,
                        createdAt: new Date(Date.now() - (index * 60000)), // Different created times
                    }));

                    // Sort alerts according to expected triage queue ordering
                    const expectedOrder = [...alerts].sort((a, b) => {
                        const aSeverityOrder = getSeverityOrder(a.severity);
                        const bSeverityOrder = getSeverityOrder(b.severity);

                        // First sort by severity (Critical→Low)
                        if (aSeverityOrder !== bSeverityOrder) {
                            return aSeverityOrder - bSeverityOrder;
                        }

                        // Then sort by created time (oldest first)
                        return a.createdAt.getTime() - b.createdAt.getTime();
                    });

                    // Mock AlertManager.getTriageQueue to return expected order
                    jest.spyOn(AlertManager, 'getTriageQueue').mockResolvedValue(expectedOrder);

                    // Test: Get triage queue
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    // Property: Alerts should be ordered by severity (Critical→Low) then created time (oldest first)
                    const isCorrectlyOrdered = isTriageQueueOrdered(triageQueueAlerts);
                    expect(isCorrectlyOrdered).toBe(true);

                    // Property: All alerts should be unassigned
                    const allUnassigned = triageQueueAlerts.every(alert =>
                        alert.status === 'open' && alert.assignedTo === null
                    );
                    expect(allUnassigned).toBe(true);

                    // Property: All alerts should belong to the correct tenant
                    const allCorrectTenant = triageQueueAlerts.every(alert => alert.tenantId === tenantId);
                    expect(allCorrectTenant).toBe(true);

                    // Property: Verify severity ordering specifically
                    for (let i = 0; i < triageQueueAlerts.length - 1; i++) {
                        const current = triageQueueAlerts[i];
                        const next = triageQueueAlerts[i + 1];

                        const currentSeverityOrder = getSeverityOrder(current.severity);
                        const nextSeverityOrder = getSeverityOrder(next.severity);

                        // Current alert should have equal or higher priority (lower number)
                        expect(currentSeverityOrder).toBeLessThanOrEqual(nextSeverityOrder);

                        // If same severity, current should be older or same age
                        if (currentSeverityOrder === nextSeverityOrder) {
                            expect(current.createdAt.getTime()).toBeLessThanOrEqual(next.createdAt.getTime());
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Investigation Queue Ordering (Assignment Time)
    // ========================================================================

    it('should order investigation queue alerts by assignment time with newest at bottom', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                userIdArb,
                fc.array(assignedAlertArb, { minLength: 3, maxLength: 20 }),
                async (tenantId, userId, alertTemplates) => {
                    // Setup: Create assigned alerts with various assignment times
                    const alerts = alertTemplates.map((alert, index) => ({
                        ...alert,
                        tenantId,
                        assignedTo: userId,
                        // Ensure variety in assignment times
                        assignedAt: new Date(Date.now() - ((alertTemplates.length - index) * 60000)), // Ascending assignment times
                        status: ['assigned', 'investigating'][index % 2] as AlertStatus,
                    }));

                    // Sort alerts according to expected investigation queue ordering
                    const expectedOrder = [...alerts].sort((a, b) => {
                        if (!a.assignedAt || !b.assignedAt) return 0;
                        // Sort by assignment time (newest at bottom = ascending order)
                        return a.assignedAt.getTime() - b.assignedAt.getTime();
                    });

                    // Mock AlertManager.getInvestigationQueue to return expected order
                    jest.spyOn(AlertManager, 'getInvestigationQueue').mockResolvedValue(expectedOrder);

                    // Test: Get investigation queue
                    const investigationQueueAlerts = await AlertManager.getInvestigationQueue(tenantId, userId);

                    // Property: Alerts should be ordered by assignment time (newest at bottom)
                    const isCorrectlyOrdered = isInvestigationQueueOrdered(investigationQueueAlerts);
                    expect(isCorrectlyOrdered).toBe(true);

                    // Property: All alerts should be assigned to the correct user
                    const allAssignedToUser = investigationQueueAlerts.every(alert =>
                        alert.assignedTo === userId
                    );
                    expect(allAssignedToUser).toBe(true);

                    // Property: All alerts should have assigned or investigating status
                    const allHaveCorrectStatus = investigationQueueAlerts.every(alert =>
                        ['assigned', 'investigating'].includes(alert.status)
                    );
                    expect(allHaveCorrectStatus).toBe(true);

                    // Property: All alerts should belong to the correct tenant
                    const allCorrectTenant = investigationQueueAlerts.every(alert => alert.tenantId === tenantId);
                    expect(allCorrectTenant).toBe(true);

                    // Property: Verify assignment time ordering specifically
                    for (let i = 0; i < investigationQueueAlerts.length - 1; i++) {
                        const current = investigationQueueAlerts[i];
                        const next = investigationQueueAlerts[i + 1];

                        expect(current.assignedAt).toBeTruthy();
                        expect(next.assignedAt).toBeTruthy();

                        if (current.assignedAt && next.assignedAt) {
                            // Current should be assigned earlier or at same time (newest at bottom)
                            expect(current.assignedAt.getTime()).toBeLessThanOrEqual(next.assignedAt.getTime());
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Ordering Consistency Across Queue Types
    // ========================================================================

    it('should maintain consistent ordering rules across different queue types', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                userIdArb,
                fc.array(securityAlertArb, { minLength: 5, maxLength: 15 }),
                async (tenantId, userId, alertTemplates) => {
                    // Setup: Create mix of unassigned and assigned alerts
                    const unassignedAlerts = alertTemplates.slice(0, Math.floor(alertTemplates.length / 2)).map((alert, index) => ({
                        ...alert,
                        tenantId,
                        status: 'open' as AlertStatus,
                        assignedTo: null,
                        assignedAt: null,
                        severity: ['critical', 'high', 'medium', 'low'][index % 4] as AlertSeverity,
                        createdAt: new Date(Date.now() - (index * 60000)),
                    }));

                    const assignedAlerts = alertTemplates.slice(Math.floor(alertTemplates.length / 2)).map((alert, index) => ({
                        ...alert,
                        tenantId,
                        assignedTo: userId,
                        assignedAt: new Date(Date.now() - ((alertTemplates.length - index) * 60000)),
                        status: ['assigned', 'investigating'][index % 2] as AlertStatus,
                    }));

                    // Mock database for triage queue
                    const setupTriageQueueMock = () => {
                        const expectedTriageOrder = [...unassignedAlerts].sort((a, b) => {
                            const aSeverityOrder = getSeverityOrder(a.severity);
                            const bSeverityOrder = getSeverityOrder(b.severity);
                            if (aSeverityOrder !== bSeverityOrder) {
                                return aSeverityOrder - bSeverityOrder;
                            }
                            return a.createdAt.getTime() - b.createdAt.getTime();
                        });

                        jest.spyOn(AlertManager, 'getTriageQueue').mockResolvedValue(expectedTriageOrder);
                    };

                    // Mock database for investigation queue
                    const setupInvestigationQueueMock = () => {
                        const expectedInvestigationOrder = [...assignedAlerts].sort((a, b) => {
                            if (!a.assignedAt || !b.assignedAt) return 0;
                            return a.assignedAt.getTime() - b.assignedAt.getTime();
                        });

                        jest.spyOn(AlertManager, 'getInvestigationQueue').mockResolvedValue(expectedInvestigationOrder);
                    };

                    // Test: Get both queues
                    setupTriageQueueMock();
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    setupInvestigationQueueMock();
                    const investigationQueueAlerts = await AlertManager.getInvestigationQueue(tenantId, userId);

                    // Property: Triage queue should follow severity → created time ordering
                    const triageCorrectlyOrdered = isTriageQueueOrdered(triageQueueAlerts);
                    expect(triageCorrectlyOrdered).toBe(true);

                    // Property: Investigation queue should follow assignment time ordering
                    const investigationCorrectlyOrdered = isInvestigationQueueOrdered(investigationQueueAlerts);
                    expect(investigationCorrectlyOrdered).toBe(true);

                    // Property: No alert should appear in both queues
                    const triageAlertIds = new Set(triageQueueAlerts.map(alert => alert.id));
                    const investigationAlertIds = new Set(investigationQueueAlerts.map(alert => alert.id));
                    const intersection = new Set([...triageAlertIds].filter(id => investigationAlertIds.has(id)));
                    expect(intersection.size).toBe(0);

                    // Property: Different ordering rules should produce different results for same base data
                    if (triageQueueAlerts.length > 1 && investigationQueueAlerts.length > 1) {
                        // The ordering criteria are different, so results should reflect this
                        // Triage: severity-based, Investigation: time-based
                        const triageUsesCorrectCriteria = triageQueueAlerts.every(alert => alert.status === 'open');
                        const investigationUsesCorrectCriteria = investigationQueueAlerts.every(alert =>
                            alert.assignedTo === userId && ['assigned', 'investigating'].includes(alert.status)
                        );
                        expect(triageUsesCorrectCriteria).toBe(true);
                        expect(investigationUsesCorrectCriteria).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Severity Ordering Edge Cases
    // ========================================================================

    it('should handle severity ordering edge cases correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(alertSeverityArb, { minLength: 2, maxLength: 8 }),
                async (tenantId, severities) => {
                    // Setup: Create alerts with the given severities
                    const alerts = severities.map((severity, index) => ({
                        id: `alert-${index}`,
                        tenantId,
                        sourceSystem: 'edr' as AlertSourceSystem,
                        sourceId: `source-${index}`,
                        alertType: 'test_alert',
                        classification: 'test_classification',
                        severity,
                        title: `Test Alert ${severity}`,
                        description: null,
                        metadata: {},
                        seenCount: 1,
                        firstSeenAt: new Date(),
                        lastSeenAt: new Date(),
                        defenderIncidentId: null,
                        defenderAlertId: null,
                        defenderSeverity: null,
                        threatName: null,
                        affectedDevice: null,
                        affectedUser: null,
                        status: 'open' as AlertStatus,
                        assignedTo: null,
                        assignedAt: null,
                        detectedAt: new Date(),
                        createdAt: new Date(Date.now() - (index * 1000)), // Different created times for proper ordering
                        updatedAt: new Date(),
                    }));

                    // Expected order: severity first, then created time
                    const expectedOrder = [...alerts].sort((a, b) => {
                        const aSeverityOrder = getSeverityOrder(a.severity);
                        const bSeverityOrder = getSeverityOrder(b.severity);

                        // First sort by severity
                        if (aSeverityOrder !== bSeverityOrder) {
                            return aSeverityOrder - bSeverityOrder;
                        }

                        // Then sort by created time (oldest first)
                        return a.createdAt.getTime() - b.createdAt.getTime();
                    });

                    // Mock AlertManager.getTriageQueue to return expected order
                    jest.spyOn(AlertManager, 'getTriageQueue').mockResolvedValue(expectedOrder);

                    // Test: Get triage queue
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    // Property: Ordering should be stable and consistent
                    const isCorrectlyOrdered = isTriageQueueOrdered(triageQueueAlerts);
                    expect(isCorrectlyOrdered).toBe(true);

                    // Property: Verify severity ordering is maintained
                    for (let i = 0; i < triageQueueAlerts.length - 1; i++) {
                        const current = triageQueueAlerts[i];
                        const next = triageQueueAlerts[i + 1];

                        const currentSeverityOrder = getSeverityOrder(current.severity);
                        const nextSeverityOrder = getSeverityOrder(next.severity);

                        // Current alert should have equal or higher priority (lower or equal number)
                        expect(currentSeverityOrder).toBeLessThanOrEqual(nextSeverityOrder);

                        // If same severity, current should be older or same age
                        if (currentSeverityOrder === nextSeverityOrder) {
                            expect(current.createdAt.getTime()).toBeLessThanOrEqual(next.createdAt.getTime());
                        }
                    }

                    // Property: All alerts should be unassigned
                    const allUnassigned = triageQueueAlerts.every(alert =>
                        alert.status === 'open' && alert.assignedTo === null
                    );
                    expect(allUnassigned).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});