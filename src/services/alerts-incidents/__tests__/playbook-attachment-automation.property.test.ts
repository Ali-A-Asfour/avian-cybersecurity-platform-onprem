/**
 * Property-Based Test for Playbook Attachment Automation
 * 
 * **Feature: avian-alerts-incidents, Property 9: Playbook attachment automation**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * This test verifies that:
 * 1. When an alert enters My Alerts, playbooks linked to the alert classification are automatically attached (Requirement 5.1)
 * 2. The attached playbooks display all required sections: purpose, initial validation steps, source investigation steps, containment checks, and decision guidance (Requirement 5.2)
 */

import * as fc from 'fast-check';
import { PlaybookManager } from '../PlaybookManager';
import { db } from '../../../lib/database';
import { investigationPlaybooks, playbookClassificationLinks } from '../../../../database/schemas/alerts-incidents';
import { eq, and, desc } from 'drizzle-orm';
import {
    SecurityAlert,
    InvestigationPlaybook,
    AlertWithPlaybooks,
    AlertSeverity,
    AlertSourceSystem,
    AlertStatus,
    PlaybookStatus,
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

jest.mock('../../../lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

describe('Playbook Attachment Automation Property Tests', () => {
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
    const alertStatusArb = fc.constantFrom<AlertStatus>('assigned', 'investigating'); // My Alerts statuses

    // Generate playbook statuses
    const playbookStatusArb = fc.constantFrom<PlaybookStatus>('active', 'draft', 'deprecated');

    // Generate alert classifications
    const alertClassificationArb = fc.oneof(
        fc.constant('malware_detection'),
        fc.constant('suspicious_network_activity'),
        fc.constant('unauthorized_access'),
        fc.constant('data_exfiltration'),
        fc.constant('phishing_attempt'),
        fc.constant('vulnerability_exploit'),
        fc.constant('insider_threat'),
        fc.constant('ddos_attack')
    );

    // Generate security alert data for My Alerts (assigned/investigating)
    const myAlertsAlertArb = fc.record({
        id: fc.uuid(),
        tenantId: tenantIdArb,
        sourceSystem: alertSourceSystemArb,
        sourceId: fc.string({ minLength: 1, maxLength: 255 }),
        alertType: fc.string({ minLength: 1, maxLength: 100 }),
        classification: alertClassificationArb,
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
        status: alertStatusArb, // assigned or investigating (My Alerts)
        assignedTo: userIdArb, // Always assigned in My Alerts
        assignedAt: fc.date(),
        detectedAt: fc.date(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    // Generate investigation playbook data with all required sections
    const investigationPlaybookArb = fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 255 }),
        version: fc.string({ minLength: 1, maxLength: 50 }),
        status: playbookStatusArb,
        purpose: fc.string({ minLength: 10, maxLength: 1000 }), // Required section
        initialValidationSteps: fc.array(fc.string({ minLength: 5 }), { minLength: 1, maxLength: 10 }), // Required section
        sourceInvestigationSteps: fc.array(fc.string({ minLength: 5 }), { minLength: 1, maxLength: 10 }), // Required section
        containmentChecks: fc.array(fc.string({ minLength: 5 }), { minLength: 1, maxLength: 10 }), // Required section
        decisionGuidance: fc.record({ // Required section
            escalateToIncident: fc.string({ minLength: 10 }),
            resolveBenign: fc.string({ minLength: 10 }),
            resolveFalsePositive: fc.string({ minLength: 10 }),
        }),
        createdBy: userIdArb,
        createdAt: fc.date(),
        updatedAt: fc.date(),
    });

    // Generate playbook classification link data
    const playbookClassificationLinkArb = fc.record({
        playbookId: fc.uuid(),
        classification: alertClassificationArb,
        isPrimary: fc.boolean(),
        playbookStatus: fc.constant('active' as PlaybookStatus), // Only active playbooks should be attached
        createdAt: fc.date(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // Property Test: Automatic Playbook Attachment
    // ========================================================================

    it('should automatically attach playbooks linked to alert classification when alert enters My Alerts', async () => {
        await fc.assert(
            fc.asyncProperty(
                myAlertsAlertArb,
                fc.array(investigationPlaybookArb, { minLength: 1, maxLength: 5 }),
                fc.array(playbookClassificationLinkArb, { minLength: 1, maxLength: 5 }),
                async (alert, playbooks, classificationLinks) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Ensure classification links match the alert's classification
                    const matchingLinks = classificationLinks.map(link => ({
                        ...link,
                        classification: alert.classification,
                        playbookStatus: 'active' as PlaybookStatus,
                    }));

                    // Setup: Ensure playbooks have matching IDs with classification links
                    const linkedPlaybooks = playbooks.slice(0, matchingLinks.length).map((playbook, index) => ({
                        ...playbook,
                        id: matchingLinks[index].playbookId,
                        status: 'active' as PlaybookStatus,
                    }));

                    // Separate primary and secondary playbooks
                    const primaryLinks = matchingLinks.filter(link => link.isPrimary);
                    const secondaryLinks = matchingLinks.filter(link => !link.isPrimary);

                    const primaryPlaybooks = linkedPlaybooks.filter(playbook =>
                        primaryLinks.some(link => link.playbookId === playbook.id)
                    );
                    const secondaryPlaybooks = linkedPlaybooks.filter(playbook =>
                        secondaryLinks.some(link => link.playbookId === playbook.id)
                    );

                    // Mock database query for playbook classification links
                    const mockPlaybookLinks = matchingLinks.map(link => ({
                        playbook: linkedPlaybooks.find(p => p.id === link.playbookId),
                        isPrimary: link.isPrimary,
                    })).filter(item => item.playbook);

                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            innerJoin: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    orderBy: jest.fn().mockResolvedValue(mockPlaybookLinks),
                                }),
                            }),
                        }),
                    });

                    // Test: Attach playbooks to alert
                    const result: AlertWithPlaybooks = await PlaybookManager.attachPlaybooksToAlert(alert);

                    // Property 1: Alert should be preserved in the result (Requirement 5.1)
                    expect(result.alert).toEqual(alert);

                    // Property 2: Playbooks should be automatically attached based on classification (Requirement 5.1)
                    expect(result.playbooks).toBeDefined();
                    expect(Array.isArray(result.playbooks)).toBe(true);

                    // Property 3: All attached playbooks should be linked to the alert's classification
                    const allPlaybooksMatchClassification = result.playbooks.every(playbook => {
                        return matchingLinks.some(link =>
                            link.playbookId === playbook.id &&
                            link.classification === alert.classification
                        );
                    });
                    expect(allPlaybooksMatchClassification).toBe(true);

                    // Property 4: Only active playbooks should be attached (Requirement 5.1)
                    const allPlaybooksActive = result.playbooks.every(playbook => playbook.status === 'active');
                    expect(allPlaybooksActive).toBe(true);

                    // Property 5: Primary playbook should be included first if it exists
                    if (primaryPlaybooks.length > 0) {
                        const firstPlaybook = result.playbooks[0];
                        const isPrimaryFirst = primaryPlaybooks.some(p => p.id === firstPlaybook.id);
                        expect(isPrimaryFirst).toBe(true);
                    }

                    // Property 6: Database should query for classification-specific playbooks
                    expect(mockDb.select).toHaveBeenCalled();
                    const selectCall = mockDb.select();
                    expect(selectCall.from).toHaveBeenCalled();
                    expect(selectCall.from().innerJoin).toHaveBeenCalled();
                    expect(selectCall.from().innerJoin().where).toHaveBeenCalledWith(
                        and(
                            eq(playbookClassificationLinks.classification, alert.classification),
                            eq(playbookClassificationLinks.playbookStatus, 'active')
                        )
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Required Playbook Sections Display
    // ========================================================================

    it('should display all required sections in attached playbooks', async () => {
        await fc.assert(
            fc.asyncProperty(
                myAlertsAlertArb,
                fc.array(investigationPlaybookArb, { minLength: 1, maxLength: 3 }),
                async (alert, playbooks) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Filter to only active playbooks (matching real implementation behavior)
                    const activePlaybooks = playbooks.map(playbook => ({
                        ...playbook,
                        status: 'active' as PlaybookStatus, // Ensure all returned playbooks are active
                    }));

                    // Setup: Create classification links for active playbooks only
                    const classificationLinks = activePlaybooks.map((playbook, index) => ({
                        playbookId: playbook.id,
                        classification: alert.classification,
                        isPrimary: index === 0, // First playbook is primary
                        playbookStatus: 'active' as PlaybookStatus,
                        createdAt: new Date(),
                    }));

                    // Mock database query - only return active playbooks
                    const mockPlaybookLinks = activePlaybooks.map((playbook, index) => ({
                        playbook,
                        isPrimary: index === 0,
                    }));

                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            innerJoin: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    orderBy: jest.fn().mockResolvedValue(mockPlaybookLinks),
                                }),
                            }),
                        }),
                    });

                    // Test: Attach playbooks to alert
                    const result: AlertWithPlaybooks = await PlaybookManager.attachPlaybooksToAlert(alert);

                    // Property 1: All attached playbooks must have required sections (Requirement 5.2)
                    result.playbooks.forEach(playbook => {
                        // Purpose section is required
                        expect(playbook.purpose).toBeDefined();
                        expect(typeof playbook.purpose).toBe('string');
                        expect(playbook.purpose.length).toBeGreaterThan(0);

                        // Initial validation steps are required
                        expect(playbook.initialValidationSteps).toBeDefined();
                        expect(Array.isArray(playbook.initialValidationSteps)).toBe(true);

                        // Source investigation steps are required
                        expect(playbook.sourceInvestigationSteps).toBeDefined();
                        expect(Array.isArray(playbook.sourceInvestigationSteps)).toBe(true);

                        // Containment checks are required
                        expect(playbook.containmentChecks).toBeDefined();
                        expect(Array.isArray(playbook.containmentChecks)).toBe(true);

                        // Decision guidance is required
                        expect(playbook.decisionGuidance).toBeDefined();
                        expect(typeof playbook.decisionGuidance).toBe('object');
                        expect(playbook.decisionGuidance.escalateToIncident).toBeDefined();
                        expect(playbook.decisionGuidance.resolveBenign).toBeDefined();
                        expect(playbook.decisionGuidance.resolveFalsePositive).toBeDefined();
                    });

                    // Property 2: Decision guidance must include all required options (Requirement 5.2)
                    result.playbooks.forEach(playbook => {
                        const guidance = playbook.decisionGuidance;

                        // Must include escalation option
                        expect(guidance.escalateToIncident).toBeDefined();
                        expect(typeof guidance.escalateToIncident).toBe('string');
                        expect(guidance.escalateToIncident.length).toBeGreaterThan(0);

                        // Must include benign resolution option
                        expect(guidance.resolveBenign).toBeDefined();
                        expect(typeof guidance.resolveBenign).toBe('string');
                        expect(guidance.resolveBenign.length).toBeGreaterThan(0);

                        // Must include false positive resolution option
                        expect(guidance.resolveFalsePositive).toBeDefined();
                        expect(typeof guidance.resolveFalsePositive).toBe('string');
                        expect(guidance.resolveFalsePositive.length).toBeGreaterThan(0);
                    });

                    // Property 3: Playbooks should be complete and usable for investigation
                    result.playbooks.forEach(playbook => {
                        // Playbook should have identification information
                        expect(playbook.id).toBeDefined();
                        expect(playbook.name).toBeDefined();
                        expect(playbook.version).toBeDefined();

                        // Playbook should be in active status for attachment
                        expect(playbook.status).toBe('active');

                        // Playbook should have creation metadata
                        expect(playbook.createdBy).toBeDefined();
                        expect(playbook.createdAt).toBeDefined();
                        expect(playbook.updatedAt).toBeDefined();
                    });
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Primary and Secondary Playbook Ordering
    // ========================================================================

    it('should properly order primary and secondary playbooks when attached', async () => {
        await fc.assert(
            fc.asyncProperty(
                myAlertsAlertArb,
                fc.array(investigationPlaybookArb, { minLength: 2, maxLength: 5 }),
                async (alert, playbooks) => {
                    // Ensure we have at least one primary and one secondary playbook
                    if (playbooks.length < 2) return;

                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Ensure all playbooks are active (matching real implementation behavior)
                    const activePlaybooks = playbooks.map(playbook => ({
                        ...playbook,
                        status: 'active' as PlaybookStatus,
                    }));

                    // Setup: Create one primary and multiple secondary playbooks
                    const primaryPlaybook = activePlaybooks[0];
                    const secondaryPlaybooks = activePlaybooks.slice(1);

                    const classificationLinks = [
                        {
                            playbookId: primaryPlaybook.id,
                            classification: alert.classification,
                            isPrimary: true,
                            playbookStatus: 'active' as PlaybookStatus,
                        },
                        ...secondaryPlaybooks.map(playbook => ({
                            playbookId: playbook.id,
                            classification: alert.classification,
                            isPrimary: false,
                            playbookStatus: 'active' as PlaybookStatus,
                        }))
                    ];

                    // Mock database query with proper ordering (primary first)
                    const mockPlaybookLinks = [
                        { playbook: primaryPlaybook, isPrimary: true },
                        ...secondaryPlaybooks.map(playbook => ({ playbook, isPrimary: false }))
                    ];

                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            innerJoin: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    orderBy: jest.fn().mockResolvedValue(mockPlaybookLinks),
                                }),
                            }),
                        }),
                    });

                    // Test: Attach playbooks to alert
                    const result: AlertWithPlaybooks = await PlaybookManager.attachPlaybooksToAlert(alert);

                    // Property 1: Primary playbook should be first in the list (Requirement 5.1)
                    expect(result.playbooks.length).toBeGreaterThan(0);
                    expect(result.playbooks[0].id).toBe(primaryPlaybook.id);

                    // Property 2: Secondary playbooks should follow the primary playbook
                    const secondaryIds = secondaryPlaybooks.map(p => p.id);
                    const resultSecondaryIds = result.playbooks.slice(1).map(p => p.id);

                    // All secondary playbooks should be present
                    secondaryIds.forEach(id => {
                        expect(resultSecondaryIds).toContain(id);
                    });

                    // Property 3: Database query should order by isPrimary descending
                    expect(mockDb.select).toHaveBeenCalled();
                    const orderByCall = mockDb.select().from().innerJoin().where().orderBy;
                    expect(orderByCall).toHaveBeenCalledWith(desc(playbookClassificationLinks.isPrimary));
                }
            ),
            { numRuns: 50 }
        );
    });

    // ========================================================================
    // Property Test: Graceful Degradation on Errors
    // ========================================================================

    it('should gracefully degrade when playbook attachment fails', async () => {
        await fc.assert(
            fc.asyncProperty(
                myAlertsAlertArb,
                async (alert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock database error
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            innerJoin: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    orderBy: jest.fn().mockRejectedValue(new Error('Database connection failed')),
                                }),
                            }),
                        }),
                    });

                    // Test: Attach playbooks should not throw error
                    const result: AlertWithPlaybooks = await PlaybookManager.attachPlaybooksToAlert(alert);

                    // Property 1: Alert should still be returned even on playbook attachment failure
                    expect(result.alert).toEqual(alert);

                    // Property 2: Playbooks should be empty array on failure (graceful degradation)
                    expect(result.playbooks).toBeDefined();
                    expect(Array.isArray(result.playbooks)).toBe(true);
                    expect(result.playbooks.length).toBe(0);

                    // Property 3: Error should be logged but not thrown
                    // (This is implicitly tested by the function not throwing)
                }
            ),
            { numRuns: 30 }
        );
    });

    // ========================================================================
    // Property Test: No Playbooks for Unlinked Classifications
    // ========================================================================

    it('should return empty playbooks array when no playbooks are linked to alert classification', async () => {
        await fc.assert(
            fc.asyncProperty(
                myAlertsAlertArb,
                async (alert) => {
                    // Reset mocks for this iteration
                    jest.clearAllMocks();

                    // Setup: Mock empty result (no playbooks linked to this classification)
                    mockDb.select.mockReturnValue({
                        from: jest.fn().mockReturnValue({
                            innerJoin: jest.fn().mockReturnValue({
                                where: jest.fn().mockReturnValue({
                                    orderBy: jest.fn().mockResolvedValue([]), // No linked playbooks
                                }),
                            }),
                        }),
                    });

                    // Test: Attach playbooks to alert
                    const result: AlertWithPlaybooks = await PlaybookManager.attachPlaybooksToAlert(alert);

                    // Property 1: Alert should be preserved
                    expect(result.alert).toEqual(alert);

                    // Property 2: Playbooks should be empty array when none are linked
                    expect(result.playbooks).toBeDefined();
                    expect(Array.isArray(result.playbooks)).toBe(true);
                    expect(result.playbooks.length).toBe(0);

                    // Property 3: Database should still be queried for the classification
                    expect(mockDb.select).toHaveBeenCalled();
                    const whereCall = mockDb.select().from().innerJoin().where;
                    expect(whereCall).toHaveBeenCalledWith(
                        and(
                            eq(playbookClassificationLinks.classification, alert.classification),
                            eq(playbookClassificationLinks.playbookStatus, 'active')
                        )
                    );
                }
            ),
            { numRuns: 50 }
        );
    });
});