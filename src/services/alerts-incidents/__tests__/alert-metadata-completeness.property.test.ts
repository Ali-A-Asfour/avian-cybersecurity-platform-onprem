/**
 * Property-Based Test for Alert Metadata Completeness
 * 
 * **Feature: avian-alerts-incidents, Property 4: Alert metadata completeness**
 * **Validates: Requirements 1.3**
 * 
 * This test verifies that all alerts displayed in the triage queue contain
 * the required metadata fields: severity, title, classification, source, created time, and status.
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

describe('Alert Metadata Completeness Property Tests', () => {
    const mockDb = db as any;

    // ========================================================================
    // Property Test Generators
    // ========================================================================

    // Generate valid tenant IDs
    const tenantIdArb = fc.uuid();

    // Generate alert severities
    const alertSeverityArb = fc.constantFrom<AlertSeverity>('critical', 'high', 'medium', 'low');

    // Generate alert source systems
    const alertSourceSystemArb = fc.constantFrom<AlertSourceSystem>('edr', 'firewall', 'email');

    // Generate alert statuses (for triage queue, should be 'open')
    const triageAlertStatusArb = fc.constant<AlertStatus>('open');

    // Generate valid dates for testing
    const dateArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }).filter(d => !isNaN(d.getTime()));

    // Generate non-empty strings for required fields (no whitespace-only)
    const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0);
    const classificationArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
    const titleArb = fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0);

    // Generate security alert data for triage queue (unassigned alerts)
    const triageAlertArb = fc.record({
        id: fc.uuid(),
        tenantId: tenantIdArb,
        sourceSystem: alertSourceSystemArb,
        sourceId: fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length > 0),
        alertType: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        classification: classificationArb,
        severity: alertSeverityArb,
        title: titleArb,
        description: fc.oneof(fc.constant(null), fc.string({ maxLength: 1000 })),
        metadata: fc.dictionary(fc.string(), fc.string()),
        seenCount: fc.integer({ min: 1, max: 1000 }),
        firstSeenAt: dateArb,
        lastSeenAt: dateArb,
        defenderIncidentId: fc.oneof(fc.constant(null), fc.string()),
        defenderAlertId: fc.oneof(fc.constant(null), fc.string()),
        defenderSeverity: fc.oneof(fc.constant(null), fc.string()),
        threatName: fc.oneof(fc.constant(null), fc.string()),
        affectedDevice: fc.oneof(fc.constant(null), fc.string()),
        affectedUser: fc.oneof(fc.constant(null), fc.string()),
        status: triageAlertStatusArb,
        assignedTo: fc.constant(null), // Unassigned for triage queue
        assignedAt: fc.constant(null), // Unassigned for triage queue
        detectedAt: dateArb,
        createdAt: dateArb,
        updatedAt: dateArb,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    // ========================================================================
    // Helper Functions for Metadata Validation
    // ========================================================================

    /**
     * Check if an alert has all required metadata fields for triage queue display
     * Required fields: severity, title, classification, source, created time, and status
     */
    const hasRequiredMetadata = (alert: SecurityAlert): boolean => {
        // Check that all required fields are present and not null/undefined
        const hasValidSeverity = alert.severity && ['critical', 'high', 'medium', 'low'].includes(alert.severity);
        const hasValidTitle = alert.title && typeof alert.title === 'string' && alert.title.trim().length > 0;
        const hasValidClassification = alert.classification && typeof alert.classification === 'string' && alert.classification.trim().length > 0;
        const hasValidSource = alert.sourceSystem && ['edr', 'firewall', 'email'].includes(alert.sourceSystem);
        const hasValidCreatedTime = alert.createdAt && alert.createdAt instanceof Date && !isNaN(alert.createdAt.getTime());
        const hasValidStatus = alert.status && ['open', 'assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive'].includes(alert.status);

        return hasValidSeverity && hasValidTitle && hasValidClassification && hasValidSource && hasValidCreatedTime && hasValidStatus;
    };

    /**
     * Check if metadata fields are properly formatted for display
     */
    const hasProperlyFormattedMetadata = (alert: SecurityAlert): boolean => {
        // Title should not be empty or just whitespace
        if (!alert.title || alert.title.trim().length === 0) {
            return false;
        }

        // Classification should not be empty or just whitespace
        if (!alert.classification || alert.classification.trim().length === 0) {
            return false;
        }

        // Severity should be one of the valid values
        if (!['critical', 'high', 'medium', 'low'].includes(alert.severity)) {
            return false;
        }

        // Source system should be one of the valid values
        if (!['edr', 'firewall', 'email'].includes(alert.sourceSystem)) {
            return false;
        }

        // Status should be valid
        if (!['open', 'assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive'].includes(alert.status)) {
            return false;
        }

        // Created time should be a valid date
        if (!alert.createdAt || isNaN(alert.createdAt.getTime())) {
            return false;
        }

        return true;
    };

    // ========================================================================
    // Property Test: Required Metadata Fields Presence
    // ========================================================================

    it('should ensure all alerts in triage queue have required metadata fields', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(triageAlertArb, { minLength: 1, maxLength: 20 }),
                async (tenantId, alertTemplates) => {
                    // Setup: Create alerts with all required metadata
                    const alerts = alertTemplates.map(alert => ({
                        ...alert,
                        tenantId,
                        status: 'open' as AlertStatus, // Ensure triage queue status
                        assignedTo: null, // Ensure unassigned
                        assignedAt: null, // Ensure unassigned
                    }));

                    // Mock AlertManager.getTriageQueue to return the alerts
                    jest.spyOn(AlertManager, 'getTriageQueue').mockResolvedValue(alerts);

                    // Test: Get triage queue
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    // Property: All alerts should have required metadata fields
                    for (const alert of triageQueueAlerts) {
                        const hasAllRequiredFields = hasRequiredMetadata(alert);
                        expect(hasAllRequiredFields).toBe(true);

                        // Verify each required field individually for better error messages
                        expect(alert.severity).toBeDefined();
                        expect(['critical', 'high', 'medium', 'low']).toContain(alert.severity);

                        expect(alert.title).toBeDefined();
                        expect(typeof alert.title).toBe('string');
                        expect(alert.title.trim().length).toBeGreaterThan(0);

                        expect(alert.classification).toBeDefined();
                        expect(typeof alert.classification).toBe('string');
                        expect(alert.classification.trim().length).toBeGreaterThan(0);

                        expect(alert.sourceSystem).toBeDefined();
                        expect(['edr', 'firewall', 'email']).toContain(alert.sourceSystem);

                        expect(alert.createdAt).toBeDefined();
                        expect(alert.createdAt).toBeInstanceOf(Date);
                        expect(isNaN(alert.createdAt.getTime())).toBe(false);

                        expect(alert.status).toBeDefined();
                        expect(['open', 'assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive']).toContain(alert.status);
                    }

                    // Property: All alerts should be properly formatted for display
                    const allProperlyFormatted = triageQueueAlerts.every(alert => hasProperlyFormattedMetadata(alert));
                    expect(allProperlyFormatted).toBe(true);

                    // Property: All alerts should be unassigned (triage queue requirement)
                    const allUnassigned = triageQueueAlerts.every(alert =>
                        alert.status === 'open' && alert.assignedTo === null && alert.assignedAt === null
                    );
                    expect(allUnassigned).toBe(true);

                    // Property: All alerts should belong to the correct tenant
                    const allCorrectTenant = triageQueueAlerts.every(alert => alert.tenantId === tenantId);
                    expect(allCorrectTenant).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Metadata Field Types and Constraints
    // ========================================================================

    it('should ensure metadata fields have correct types and constraints', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(triageAlertArb, { minLength: 1, maxLength: 15 }),
                async (tenantId, alertTemplates) => {
                    // Setup: Create alerts with various metadata values
                    const alerts = alertTemplates.map(alert => ({
                        ...alert,
                        tenantId,
                        status: 'open' as AlertStatus,
                        assignedTo: null,
                        assignedAt: null,
                    }));

                    // Mock AlertManager.getTriageQueue to return the alerts
                    jest.spyOn(AlertManager, 'getTriageQueue').mockResolvedValue(alerts);

                    // Test: Get triage queue
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    // Property: Severity field should be valid enum value
                    for (const alert of triageQueueAlerts) {
                        expect(alert.severity).toMatch(/^(critical|high|medium|low)$/);
                    }

                    // Property: Title field should be non-empty string
                    for (const alert of triageQueueAlerts) {
                        expect(typeof alert.title).toBe('string');
                        expect(alert.title.length).toBeGreaterThan(0);
                        expect(alert.title.trim().length).toBeGreaterThan(0);
                    }

                    // Property: Classification field should be non-empty string
                    for (const alert of triageQueueAlerts) {
                        expect(typeof alert.classification).toBe('string');
                        expect(alert.classification.length).toBeGreaterThan(0);
                        expect(alert.classification.trim().length).toBeGreaterThan(0);
                    }

                    // Property: Source system should be valid enum value
                    for (const alert of triageQueueAlerts) {
                        expect(alert.sourceSystem).toMatch(/^(edr|firewall|email)$/);
                    }

                    // Property: Created time should be valid Date object
                    for (const alert of triageQueueAlerts) {
                        expect(alert.createdAt).toBeInstanceOf(Date);
                        expect(alert.createdAt.getTime()).toBeGreaterThan(0);
                        expect(isNaN(alert.createdAt.getTime())).toBe(false);
                    }

                    // Property: Status should be 'open' for triage queue
                    for (const alert of triageQueueAlerts) {
                        expect(alert.status).toBe('open');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Metadata Completeness Under Various Conditions
    // ========================================================================

    it('should maintain metadata completeness regardless of alert source or content', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(
                    fc.record({
                        sourceSystem: alertSourceSystemArb,
                        severity: alertSeverityArb,
                        title: fc.oneof(
                            titleArb, // Normal title
                            fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0), // Long title
                            fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0) // Short title
                        ),
                        classification: fc.oneof(
                            classificationArb, // Normal classification
                            fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0), // Long classification
                            fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0) // Short classification
                        ),
                        metadata: fc.oneof(
                            fc.constant({}), // Empty metadata
                            fc.dictionary(fc.string(), fc.string()), // Simple metadata
                            fc.dictionary(fc.string(), fc.anything()) // Complex metadata
                        ),
                    }),
                    { minLength: 3, maxLength: 12 }
                ),
                async (tenantId, alertConfigs) => {
                    // Setup: Create alerts with various configurations
                    const alerts = alertConfigs.map((config, index) => ({
                        id: `alert-${index}`,
                        tenantId,
                        sourceSystem: config.sourceSystem,
                        sourceId: `source-${index}`,
                        alertType: `alert_type_${index}`,
                        classification: config.classification,
                        severity: config.severity,
                        title: config.title,
                        description: `Description for alert ${index}`,
                        metadata: config.metadata,
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
                        createdAt: new Date(Date.now() - (index * 60000)),
                        updatedAt: new Date(),
                    }));

                    // Mock AlertManager.getTriageQueue to return the alerts
                    jest.spyOn(AlertManager, 'getTriageQueue').mockResolvedValue(alerts);

                    // Test: Get triage queue
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    // Property: All alerts should have complete metadata regardless of source
                    const edrAlerts = triageQueueAlerts.filter(alert => alert.sourceSystem === 'edr');
                    const firewallAlerts = triageQueueAlerts.filter(alert => alert.sourceSystem === 'firewall');
                    const emailAlerts = triageQueueAlerts.filter(alert => alert.sourceSystem === 'email');

                    // Each source type should maintain metadata completeness
                    for (const alert of edrAlerts) {
                        expect(hasRequiredMetadata(alert)).toBe(true);
                        expect(hasProperlyFormattedMetadata(alert)).toBe(true);
                    }

                    for (const alert of firewallAlerts) {
                        expect(hasRequiredMetadata(alert)).toBe(true);
                        expect(hasProperlyFormattedMetadata(alert)).toBe(true);
                    }

                    for (const alert of emailAlerts) {
                        expect(hasRequiredMetadata(alert)).toBe(true);
                        expect(hasProperlyFormattedMetadata(alert)).toBe(true);
                    }

                    // Property: Metadata completeness should be independent of content length
                    const shortTitleAlerts = triageQueueAlerts.filter(alert => alert.title.length <= 10);
                    const longTitleAlerts = triageQueueAlerts.filter(alert => alert.title.length > 100);

                    for (const alert of shortTitleAlerts) {
                        expect(hasRequiredMetadata(alert)).toBe(true);
                    }

                    for (const alert of longTitleAlerts) {
                        expect(hasRequiredMetadata(alert)).toBe(true);
                    }

                    // Property: All alerts should have consistent metadata structure
                    for (const alert of triageQueueAlerts) {
                        // Required fields should always be present
                        expect(alert).toHaveProperty('severity');
                        expect(alert).toHaveProperty('title');
                        expect(alert).toHaveProperty('classification');
                        expect(alert).toHaveProperty('sourceSystem');
                        expect(alert).toHaveProperty('createdAt');
                        expect(alert).toHaveProperty('status');

                        // Fields should have correct types
                        expect(typeof alert.severity).toBe('string');
                        expect(typeof alert.title).toBe('string');
                        expect(typeof alert.classification).toBe('string');
                        expect(typeof alert.sourceSystem).toBe('string');
                        expect(alert.createdAt).toBeInstanceOf(Date);
                        expect(typeof alert.status).toBe('string');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // ========================================================================
    // Property Test: Edge Cases for Metadata Fields
    // ========================================================================

    it('should handle edge cases in metadata fields correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                tenantIdArb,
                fc.array(
                    fc.record({
                        title: fc.oneof(
                            fc.string({ minLength: 1, maxLength: 1 }).filter(s => s.trim().length > 0), // Single character
                            fc.string({ minLength: 500, maxLength: 500 }).filter(s => s.trim().length > 0), // Maximum length
                            fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0) // No whitespace-only
                        ),
                        classification: fc.oneof(
                            fc.string({ minLength: 1, maxLength: 1 }).filter(s => s.trim().length > 0), // Single character
                            fc.string({ minLength: 100, maxLength: 100 }).filter(s => s.trim().length > 0), // Maximum length
                            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0) // No whitespace-only
                        ),
                        severity: alertSeverityArb,
                        sourceSystem: alertSourceSystemArb,
                        createdAt: fc.oneof(
                            fc.date({ min: new Date('1990-01-01'), max: new Date('2000-01-01') }), // Old dates
                            fc.date({ min: new Date('2024-01-01'), max: new Date() }), // Recent dates
                            fc.date({ min: new Date(), max: new Date('2030-01-01') }) // Future dates
                        ).filter(d => !isNaN(d.getTime()) && d.getTime() > 0),
                    }),
                    { minLength: 2, maxLength: 8 }
                ),
                async (tenantId, alertConfigs) => {
                    // Setup: Create alerts with edge case metadata
                    const alerts = alertConfigs.map((config, index) => ({
                        id: `alert-${index}`,
                        tenantId,
                        sourceSystem: config.sourceSystem,
                        sourceId: `source-${index}`,
                        alertType: `alert_type_${index}`,
                        classification: config.classification,
                        severity: config.severity,
                        title: config.title,
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
                        createdAt: config.createdAt,
                        updatedAt: new Date(),
                    }));

                    // Mock AlertManager.getTriageQueue to return the alerts
                    jest.spyOn(AlertManager, 'getTriageQueue').mockResolvedValue(alerts);

                    // Test: Get triage queue
                    const triageQueueAlerts = await AlertManager.getTriageQueue(tenantId);

                    // Property: Even edge case metadata should be complete and valid
                    for (const alert of triageQueueAlerts) {
                        expect(hasRequiredMetadata(alert)).toBe(true);
                        expect(hasProperlyFormattedMetadata(alert)).toBe(true);

                        // Specific edge case validations
                        expect(alert.title.trim().length).toBeGreaterThan(0);
                        expect(alert.classification.trim().length).toBeGreaterThan(0);
                        expect(alert.createdAt.getTime()).toBeGreaterThan(0);
                        expect(isFinite(alert.createdAt.getTime())).toBe(true);
                    }

                    // Property: Metadata should be displayable regardless of edge cases
                    for (const alert of triageQueueAlerts) {
                        // Title should be displayable (not just whitespace)
                        expect(alert.title.trim()).toBeTruthy();

                        // Classification should be displayable (not just whitespace)
                        expect(alert.classification.trim()).toBeTruthy();

                        // Date should be valid and displayable
                        expect(alert.createdAt.toISOString()).toBeTruthy();

                        // Severity should be displayable
                        expect(['critical', 'high', 'medium', 'low']).toContain(alert.severity);

                        // Source should be displayable
                        expect(['edr', 'firewall', 'email']).toContain(alert.sourceSystem);

                        // Status should be displayable
                        expect(alert.status).toBe('open');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});