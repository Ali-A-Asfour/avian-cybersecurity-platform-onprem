/**
 * SLA Breach Service Tests
 * 
 * Tests for comprehensive SLA breach tracking and alerting with:
 * - SLA monitoring service with breach detection
 * - Automated breach recording without workflow blocking
 * - SLA performance metrics calculation
 * - Alerts for approaching SLA deadlines
 * 
 * Requirements: 10.1, 11.4, 11.5
 */

import { SLABreachService } from '../SLABreachService';
import { db } from '../../../lib/database';
import {
    SecurityIncident,
    AlertSeverity,
    SLA_TIMERS,
} from '../../../types/alerts-incidents';

// Mock database
jest.mock('../../../lib/database', () => ({
    db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        transaction: jest.fn(),
    },
}));

// Mock logger
jest.mock('../../../lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('SLABreachService', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-456';
    const mockIncidentId = 'incident-789';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // ========================================================================
    // SLA Breach Detection Tests
    // ========================================================================

    describe('monitorSLABreaches', () => {
        it('should detect acknowledge SLA breach for open incident', async () => {
            const now = new Date('2024-01-15T10:00:00Z');
            jest.setSystemTime(now);

            const breachedIncident: SecurityIncident = {
                id: mockIncidentId,
                tenantId: mockTenantId,
                ownerId: mockUserId,
                title: 'Critical Security Incident',
                description: 'Test incident',
                severity: 'critical',
                status: 'open',
                slaAcknowledgeBy: new Date('2024-01-15T09:45:00Z'), // 15 minutes ago
                slaInvestigateBy: new Date('2024-01-15T11:00:00Z'),
                slaResolveBy: new Date('2024-01-15T14:00:00Z'),
                acknowledgedAt: null,
                investigationStartedAt: null,
                resolvedAt: null,
                resolutionSummary: null,
                dismissalJustification: null,
                createdAt: new Date('2024-01-15T09:30:00Z'),
                updatedAt: new Date('2024-01-15T09:30:00Z'),
            };

            // Mock database queries - first for active incidents, then for approaching deadlines
            (db.select as any)
                .mockReturnValueOnce({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockResolvedValue([breachedIncident]),
                    }),
                })
                .mockReturnValue({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockResolvedValue([]), // No approaching deadlines
                    }),
                });

            const result = await SLABreachService.monitorSLABreaches(mockTenantId);

            expect(result.tenantId).toBe(mockTenantId);
            expect(result.breachesDetected).toHaveLength(1);
            expect(result.breachesDetected[0].breachType).toBe('acknowledge');
            expect(result.breachesDetected[0].severity).toBe('critical');
            expect(result.breachesDetected[0].breachDurationMinutes).toBe(15);
            expect(result.alertsGenerated).toHaveLength(1);
            expect(result.alertsGenerated[0].alertType).toBe('breach_detected');
        });

        it('should calculate performance metrics for compliant incidents', async () => {
            const startDate = new Date('2024-01-01T00:00:00Z');
            const endDate = new Date('2024-01-31T23:59:59Z');

            const compliantIncidents = [
                {
                    id: 'incident-1',
                    tenantId: mockTenantId,
                    severity: 'critical',
                    status: 'resolved',
                    createdAt: new Date('2024-01-15T10:00:00Z'),
                    slaAcknowledgeBy: new Date('2024-01-15T10:15:00Z'),
                    slaInvestigateBy: new Date('2024-01-15T11:00:00Z'),
                    slaResolveBy: new Date('2024-01-15T14:00:00Z'),
                    acknowledgedAt: new Date('2024-01-15T10:10:00Z'), // 10 minutes (compliant)
                    investigationStartedAt: new Date('2024-01-15T10:45:00Z'), // 45 minutes (compliant)
                    resolvedAt: new Date('2024-01-15T13:30:00Z'), // 3.5 hours (compliant)
                },
            ];

            (db.select as any).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(compliantIncidents),
                }),
            });

            const metrics = await SLABreachService.calculateSLAPerformanceMetrics(
                mockTenantId,
                startDate,
                endDate
            );

            expect(metrics.tenantId).toBe(mockTenantId);
            expect(metrics.totalIncidents).toBe(1);
            expect(metrics.overallCompliance.complianceRate).toBe(100);
            expect(metrics.acknowledgeCompliance.complianceRate).toBe(100);
            expect(metrics.investigateCompliance.complianceRate).toBe(100);
            expect(metrics.resolveCompliance.complianceRate).toBe(100);
        });

        it('should handle empty incident list', async () => {
            const startDate = new Date('2024-01-01T00:00:00Z');
            const endDate = new Date('2024-01-31T23:59:59Z');

            (db.select as any).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([]),
                }),
            });

            const metrics = await SLABreachService.calculateSLAPerformanceMetrics(
                mockTenantId,
                startDate,
                endDate
            );

            expect(metrics.totalIncidents).toBe(0);
            expect(metrics.overallCompliance.complianceRate).toBe(100); // 100% when no incidents
            expect(metrics.acknowledgeCompliance.complianceRate).toBe(100);
            expect(metrics.investigateCompliance.complianceRate).toBe(100);
            expect(metrics.resolveCompliance.complianceRate).toBe(100);
        });
    });

    // ========================================================================
    // Error Handling Tests
    // ========================================================================

    describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            (db.select as any).mockImplementation(() => {
                throw new Error('Database connection failed');
            });

            await expect(
                SLABreachService.monitorSLABreaches(mockTenantId)
            ).rejects.toThrow('Database connection failed');
        });

        it('should record SLA breach without throwing on error', async () => {
            const breach = {
                id: 'breach-123',
                tenantId: mockTenantId,
                incidentId: mockIncidentId,
                breachType: 'acknowledge' as const,
                severity: 'critical' as AlertSeverity,
                expectedBy: new Date(),
                actualTime: null,
                breachDurationMinutes: 30,
                isResolved: false,
                createdAt: new Date(),
                resolvedAt: null,
            };

            // Should not throw even if there's an internal error
            await expect(
                SLABreachService.recordSLABreach(breach)
            ).resolves.not.toThrow();
        });
    });

    // ========================================================================
    // SLA Configuration Tests
    // ========================================================================

    describe('SLA Configuration', () => {
        it('should use correct SLA timers for each severity level', () => {
            expect(SLA_TIMERS.critical.acknowledgeMinutes).toBe(15);
            expect(SLA_TIMERS.critical.investigateMinutes).toBe(60);
            expect(SLA_TIMERS.critical.resolveMinutes).toBe(240);

            expect(SLA_TIMERS.high.acknowledgeMinutes).toBe(30);
            expect(SLA_TIMERS.high.investigateMinutes).toBe(120);
            expect(SLA_TIMERS.high.resolveMinutes).toBe(480);

            expect(SLA_TIMERS.medium.acknowledgeMinutes).toBe(60);
            expect(SLA_TIMERS.medium.investigateMinutes).toBe(240);
            expect(SLA_TIMERS.medium.resolveMinutes).toBe(1440);

            expect(SLA_TIMERS.low.acknowledgeMinutes).toBe(240);
            expect(SLA_TIMERS.low.investigateMinutes).toBe(480);
            expect(SLA_TIMERS.low.resolveMinutes).toBe(4320);
        });
    });
});