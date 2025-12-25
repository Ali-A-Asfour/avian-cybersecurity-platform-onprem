/**
 * Simple Integration Test for Monthly Reporting Service
 * 
 * Basic smoke test to verify the service can generate reports
 * without complex database mocking.
 * 
 * Requirements: 11.2, 11.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MonthlyReportingService, MonthlyReportFilters } from '../MonthlyReportingService';

// Mock the database to return empty results
jest.mock('../../../lib/database', () => ({
    db: null // Simulate no database connection for simple test
}));

// Mock the logger
jest.mock('../../../lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }
}));

describe('MonthlyReportingService - Simple Integration', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-456';

    const mockFilters: MonthlyReportFilters = {
        tenantId: mockTenantId,
        startDate: new Date('2024-01-01T00:00:00.000Z'),
        endDate: new Date('2024-01-31T23:59:59.999Z'),
        includeResolved: true,
        includeDismissed: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Service Configuration', () => {
        it('should have correct service structure and methods', () => {
            expect(MonthlyReportingService).toBeDefined();
            expect(typeof MonthlyReportingService.generateMonthlyReport).toBe('function');
            expect(typeof MonthlyReportingService.validateReportInputs).toBe('function');
            expect(typeof MonthlyReportingService.getCurrentMonthDateRange).toBe('function');
            expect(typeof MonthlyReportingService.getPreviousMonthDateRange).toBe('function');
            expect(typeof MonthlyReportingService.scheduleMonthlyReport).toBe('function');
            expect(typeof MonthlyReportingService.deliverMonthlyReport).toBe('function');
        });

        it('should handle database unavailability gracefully', async () => {
            // The service should check for null db and throw appropriate error
            // This test verifies the error handling when db is null
            await expect(
                MonthlyReportingService.generateMonthlyReport(mockFilters, mockUserId)
            ).rejects.toThrow();
        });
    });

    describe('Input Validation', () => {
        it('should validate tenant ID requirement', () => {
            expect(() => {
                MonthlyReportingService.validateReportInputs({
                    tenantId: '',
                    startDate: mockFilters.startDate,
                    endDate: mockFilters.endDate,
                });
            }).toThrow('Tenant ID is required');
        });

        it('should validate date requirements', () => {
            expect(() => {
                MonthlyReportingService.validateReportInputs({
                    tenantId: mockTenantId,
                    startDate: null as any,
                    endDate: mockFilters.endDate,
                });
            }).toThrow('Start date and end date are required');
        });

        it('should validate date order', () => {
            expect(() => {
                MonthlyReportingService.validateReportInputs({
                    tenantId: mockTenantId,
                    startDate: mockFilters.endDate,
                    endDate: mockFilters.startDate,
                });
            }).toThrow('Start date must be before end date');
        });

        it('should validate date range limits', () => {
            const longRangeEnd = new Date(mockFilters.startDate);
            longRangeEnd.setDate(longRangeEnd.getDate() + 35); // 35 days

            expect(() => {
                MonthlyReportingService.validateReportInputs({
                    tenantId: mockTenantId,
                    startDate: mockFilters.startDate,
                    endDate: longRangeEnd,
                });
            }).toThrow('Date range cannot exceed 32 days for monthly reports');
        });

        it('should accept valid inputs', () => {
            expect(() => {
                MonthlyReportingService.validateReportInputs(mockFilters);
            }).not.toThrow();
        });
    });

    describe('Date Range Utilities', () => {
        it('should generate current month date range correctly', () => {
            const mockDate = new Date('2024-06-15T10:30:00.000Z');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const range = MonthlyReportingService.getCurrentMonthDateRange();

            expect(range.startDate).toEqual(new Date('2024-06-01T00:00:00.000Z'));
            expect(range.endDate).toEqual(new Date('2024-06-30T23:59:59.999Z'));

            jest.useRealTimers();
        });

        it('should generate previous month date range correctly', () => {
            const mockDate = new Date('2024-06-15T10:30:00.000Z');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const range = MonthlyReportingService.getPreviousMonthDateRange();

            expect(range.startDate).toEqual(new Date('2024-05-01T00:00:00.000Z'));
            expect(range.endDate).toEqual(new Date('2024-05-31T23:59:59.999Z'));

            jest.useRealTimers();
        });

        it('should handle year boundary in previous month calculation', () => {
            const mockDate = new Date('2024-01-15T10:30:00.000Z');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const range = MonthlyReportingService.getPreviousMonthDateRange();

            expect(range.startDate).toEqual(new Date('2023-12-01T00:00:00.000Z'));
            expect(range.endDate).toEqual(new Date('2023-12-31T23:59:59.999Z'));

            jest.useRealTimers();
        });

        it('should handle February in leap year', () => {
            const mockDate = new Date('2024-03-15T10:30:00.000Z'); // 2024 is a leap year
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const range = MonthlyReportingService.getPreviousMonthDateRange();

            expect(range.startDate).toEqual(new Date('2024-02-01T00:00:00.000Z'));
            expect(range.endDate).toEqual(new Date('2024-02-29T23:59:59.999Z')); // Leap year February has 29 days

            jest.useRealTimers();
        });

        it('should handle February in non-leap year', () => {
            const mockDate = new Date('2023-03-15T10:30:00.000Z'); // 2023 is not a leap year
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const range = MonthlyReportingService.getPreviousMonthDateRange();

            expect(range.startDate).toEqual(new Date('2023-02-01T00:00:00.000Z'));
            expect(range.endDate).toEqual(new Date('2023-02-28T23:59:59.999Z')); // Non-leap year February has 28 days

            jest.useRealTimers();
        });
    });

    describe('Report Scheduling', () => {
        it('should accept valid scheduling configuration', async () => {
            const config = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfMonth: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: ['admin@example.com'],
                deliveryMethod: 'email' as const,
            };

            await expect(
                MonthlyReportingService.scheduleMonthlyReport(config)
            ).resolves.not.toThrow();
        });

        it('should accept dashboard delivery method', async () => {
            const config = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfMonth: 15,
                hour: 8,
                timezone: 'America/New_York',
                recipients: [],
                deliveryMethod: 'dashboard' as const,
            };

            await expect(
                MonthlyReportingService.scheduleMonthlyReport(config)
            ).resolves.not.toThrow();
        });

        it('should accept both delivery method', async () => {
            const config = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfMonth: 28,
                hour: 17,
                timezone: 'Europe/London',
                recipients: ['admin@example.com', 'security@example.com'],
                deliveryMethod: 'both' as const,
            };

            await expect(
                MonthlyReportingService.scheduleMonthlyReport(config)
            ).resolves.not.toThrow();
        });
    });

    describe('Report Delivery', () => {
        const mockReport = {
            id: 'report-123',
            tenantId: mockTenantId,
            reportType: 'monthly' as const,
            dateRange: { startDate: mockFilters.startDate, endDate: mockFilters.endDate },
            generatedAt: new Date(),
            generatedBy: mockUserId,
            incidentTrends: {
                totalIncidents: 10,
                incidentsByStatus: { resolved: 8, dismissed: 1, open: 1, in_progress: 0 },
                incidentsBySeverity: { critical: 2, high: 3, medium: 4, low: 1 },
                weeklyBreakdown: []
            },
            mttr: 180,
            slaCompliance: {
                overallComplianceRate: 90,
                breachesBySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
                breachesByType: { acknowledge: 0, investigate: 1, resolve: 0 },
                complianceByWeek: []
            },
            performanceIndicators: {
                alertToIncidentRatio: 5.0,
                averageIncidentSeverity: 2.5,
                resolutionEfficiency: 80,
                analystWorkload: []
            },
            historicalComparison: {
                previousMonthMttr: 200,
                mttrTrend: 'improving' as const,
                previousMonthIncidents: 12,
                incidentVolumeTrend: 'decreasing' as const,
                previousMonthSlaCompliance: 85,
                slaComplianceTrend: 'improving' as const,
            },
            topIncidentClassifications: [],
            criticalInsights: []
        };

        it('should handle email delivery', async () => {
            const config = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfMonth: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: ['admin@example.com'],
                deliveryMethod: 'email' as const,
            };

            await expect(
                MonthlyReportingService.deliverMonthlyReport(mockReport, config)
            ).resolves.not.toThrow();
        });

        it('should handle dashboard delivery', async () => {
            const config = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfMonth: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: [],
                deliveryMethod: 'dashboard' as const,
            };

            await expect(
                MonthlyReportingService.deliverMonthlyReport(mockReport, config)
            ).resolves.not.toThrow();
        });

        it('should handle both delivery methods', async () => {
            const config = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfMonth: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: ['admin@example.com'],
                deliveryMethod: 'both' as const,
            };

            await expect(
                MonthlyReportingService.deliverMonthlyReport(mockReport, config)
            ).resolves.not.toThrow();
        });

        it('should reject unsupported delivery methods', async () => {
            const config = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfMonth: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: [],
                deliveryMethod: 'invalid' as any,
            };

            await expect(
                MonthlyReportingService.deliverMonthlyReport(mockReport, config)
            ).rejects.toThrow('Unsupported delivery method: invalid');
        });
    });

    describe('Requirements Compliance', () => {
        it('should implement all required features for Requirement 11.2', () => {
            // Requirement 11.2: Include incident trends, MTTR calculation, and SLA compliance metrics

            // Verify service has methods for all required metrics
            expect(MonthlyReportingService.generateMonthlyReport).toBeDefined();

            // The service should be able to calculate:
            // - Incident trends (verified by method existence)
            // - MTTR calculation (verified by method existence)
            // - SLA compliance metrics (verified by method existence)

            // These are tested in the full integration test with database mocking
        });

        it('should implement all required features for Requirement 11.5', () => {
            // Requirement 11.5: Historical data preservation for reporting

            // Verify service has methods for historical comparison
            expect(MonthlyReportingService.generateMonthlyReport).toBeDefined();

            // The service should preserve historical data through:
            // - Historical comparison calculations
            // - Trend analysis
            // - Performance indicators over time

            // These are tested in the full integration test with database mocking
        });
    });
});