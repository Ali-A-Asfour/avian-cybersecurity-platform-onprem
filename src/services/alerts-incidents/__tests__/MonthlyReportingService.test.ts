/**
 * Unit Tests for Monthly Reporting Service
 * 
 * Tests the monthly reporting functionality including:
 * - Incident trends calculation
 * - MTTR calculation
 * - SLA compliance metrics
 * - Performance indicators
 * - Historical data preservation
 * 
 * Requirements: 11.2, 11.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MonthlyReportingService, MonthlyReportFilters } from '../MonthlyReportingService';
import { db } from '../../../lib/database';
import { securityAlerts, securityIncidents, incidentAlertLinks } from '../../../../database/schemas/alerts-incidents';
import { eq, and, gte, lte, sql, count, desc } from 'drizzle-orm';
import { vi } from 'zod/v4/locales';
import { vi } from 'zod/v4/locales';
import { vi } from 'zod/v4/locales';

// Mock the database
jest.mock('../../../lib/database', () => ({
    db: {
        select: jest.fn(),
        from: jest.fn(),
        where: jest.fn(),
        groupBy: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        innerJoin: jest.fn(),
    }
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

describe('MonthlyReportingService', () => {
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

    describe('generateMonthlyReport', () => {
        it('should generate a complete monthly report with all required metrics', async () => {
            // Mock database responses
            const mockDbChain = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
            };

            (db as any).select.mockReturnValue(mockDbChain);
            (db as any).from.mockReturnValue(mockDbChain);

            // Mock different query results
            mockDbChain.where.mockImplementation((condition) => {
                // Return different results based on the query
                if (condition.toString().includes('count()')) {
                    return Promise.resolve([{ count: 25 }]);
                }
                return mockDbChain;
            });

            mockDbChain.groupBy.mockImplementation(() => {
                return Promise.resolve([
                    { status: 'resolved', count: 15 },
                    { status: 'dismissed', count: 5 },
                    { status: 'open', count: 3 },
                    { status: 'in_progress', count: 2 },
                ]);
            });

            // Mock MTTR calculation
            jest.spyOn(MonthlyReportingService as any, 'getMTTR').mockResolvedValue(240); // 4 hours

            // Mock other private methods
            jest.spyOn(MonthlyReportingService as any, 'getIncidentTrends').mockResolvedValue({
                totalIncidents: 25,
                incidentsByStatus: { resolved: 15, dismissed: 5, open: 3, in_progress: 2 },
                incidentsBySeverity: { critical: 5, high: 8, medium: 10, low: 2 },
                weeklyBreakdown: [
                    { weekStartDate: '2024-01-01', incidentCount: 6, resolvedCount: 4, escalatedCount: 6 },
                    { weekStartDate: '2024-01-08', incidentCount: 7, resolvedCount: 5, escalatedCount: 7 },
                    { weekStartDate: '2024-01-15', incidentCount: 6, resolvedCount: 3, escalatedCount: 6 },
                    { weekStartDate: '2024-01-22', incidentCount: 6, resolvedCount: 3, escalatedCount: 6 },
                ]
            });

            jest.spyOn(MonthlyReportingService as any, 'getSLACompliance').mockResolvedValue({
                overallComplianceRate: 85.5,
                breachesBySeverity: { critical: 1, high: 2, medium: 1, low: 0 },
                breachesByType: { acknowledge: 2, investigate: 1, resolve: 1 },
                complianceByWeek: [
                    { weekStartDate: '2024-01-01', complianceRate: 90, totalIncidents: 6, breaches: 1 },
                    { weekStartDate: '2024-01-08', complianceRate: 85, totalIncidents: 7, breaches: 1 },
                    { weekStartDate: '2024-01-15', complianceRate: 80, totalIncidents: 6, breaches: 1 },
                    { weekStartDate: '2024-01-22', complianceRate: 85, totalIncidents: 6, breaches: 1 },
                ]
            });

            jest.spyOn(MonthlyReportingService as any, 'getPerformanceIndicators').mockResolvedValue({
                alertToIncidentRatio: 4.2,
                averageIncidentSeverity: 2.8,
                resolutionEfficiency: 75.0,
                analystWorkload: [
                    { analystId: 'analyst-1', incidentsHandled: 12, averageResolutionTime: 220, slaComplianceRate: 90 },
                    { analystId: 'analyst-2', incidentsHandled: 8, averageResolutionTime: 280, slaComplianceRate: 80 },
                    { analystId: 'analyst-3', incidentsHandled: 5, averageResolutionTime: 200, slaComplianceRate: 95 },
                ]
            });

            jest.spyOn(MonthlyReportingService as any, 'getHistoricalComparison').mockResolvedValue({
                previousMonthMttr: 300,
                mttrTrend: 'improving',
                previousMonthIncidents: 30,
                incidentVolumeTrend: 'decreasing',
                previousMonthSlaCompliance: 80,
                slaComplianceTrend: 'improving',
            });

            jest.spyOn(MonthlyReportingService as any, 'getTopIncidentClassifications').mockResolvedValue([
                { classification: 'malware-detection', count: 8, averageResolutionTime: 180 },
                { classification: 'network-intrusion', count: 6, averageResolutionTime: 320 },
                { classification: 'data-exfiltration', count: 4, averageResolutionTime: 450 },
            ]);

            jest.spyOn(MonthlyReportingService as any, 'generateCriticalInsights').mockResolvedValue([
                'Mean Time To Resolution (4 hours) demonstrates efficient incident response capabilities.',
                'SLA compliance rate (85.5%) is within acceptable range but has room for improvement.',
                'Low alert-to-incident ratio (4.2:1) indicates effective alert filtering and high-quality security signals.'
            ]);

            const report = await MonthlyReportingService.generateMonthlyReport(mockFilters, mockUserId);

            expect(report).toBeDefined();
            expect(report.id).toMatch(/^monthly-alerts-incidents-/);
            expect(report.tenantId).toBe(mockTenantId);
            expect(report.reportType).toBe('monthly');
            expect(report.generatedBy).toBe(mockUserId);
            expect(report.dateRange.startDate).toEqual(mockFilters.startDate);
            expect(report.dateRange.endDate).toEqual(mockFilters.endDate);

            // Verify incident trends
            expect(report.incidentTrends.totalIncidents).toBe(25);
            expect(report.incidentTrends.incidentsByStatus.resolved).toBe(15);
            expect(report.incidentTrends.weeklyBreakdown).toHaveLength(4);

            // Verify MTTR
            expect(report.mttr).toBe(240);

            // Verify SLA compliance
            expect(report.slaCompliance.overallComplianceRate).toBe(85.5);
            expect(report.slaCompliance.breachesByType.acknowledge).toBe(2);

            // Verify performance indicators
            expect(report.performanceIndicators.alertToIncidentRatio).toBe(4.2);
            expect(report.performanceIndicators.analystWorkload).toHaveLength(3);

            // Verify historical comparison
            expect(report.historicalComparison.mttrTrend).toBe('improving');
            expect(report.historicalComparison.incidentVolumeTrend).toBe('decreasing');

            // Verify top classifications
            expect(report.topIncidentClassifications).toHaveLength(3);
            expect(report.topIncidentClassifications[0].classification).toBe('malware-detection');

            // Verify critical insights
            expect(report.criticalInsights).toHaveLength(3);
            expect(report.criticalInsights[0]).toContain('Mean Time To Resolution');
        });

        it('should handle database connection errors gracefully', async () => {
            (db as any) = null;

            await expect(
                MonthlyReportingService.generateMonthlyReport(mockFilters, mockUserId)
            ).rejects.toThrow('Database connection not available');
        });

        it('should handle empty data sets correctly', async () => {
            const mockDbChain = {
                select: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
            };

            (db as any).select.mockReturnValue(mockDbChain);
            mockDbChain.where.mockResolvedValue([]);
            mockDbChain.groupBy.mockResolvedValue([]);

            // Mock all private methods to return empty/zero values
            jest.spyOn(MonthlyReportingService as any, 'getIncidentTrends').mockResolvedValue({
                totalIncidents: 0,
                incidentsByStatus: { resolved: 0, dismissed: 0, open: 0, in_progress: 0 },
                incidentsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                weeklyBreakdown: []
            });

            jest.spyOn(MonthlyReportingService as any, 'getMTTR').mockResolvedValue(0);
            jest.spyOn(MonthlyReportingService as any, 'getSLACompliance').mockResolvedValue({
                overallComplianceRate: 100,
                breachesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                breachesByType: { acknowledge: 0, investigate: 0, resolve: 0 },
                complianceByWeek: []
            });

            jest.spyOn(MonthlyReportingService as any, 'getPerformanceIndicators').mockResolvedValue({
                alertToIncidentRatio: 0,
                averageIncidentSeverity: 0,
                resolutionEfficiency: 0,
                analystWorkload: []
            });

            jest.spyOn(MonthlyReportingService as any, 'getHistoricalComparison').mockResolvedValue({
                previousMonthMttr: 0,
                mttrTrend: 'stable',
                previousMonthIncidents: 0,
                incidentVolumeTrend: 'stable',
                previousMonthSlaCompliance: 100,
                slaComplianceTrend: 'stable',
            });

            jest.spyOn(MonthlyReportingService as any, 'getTopIncidentClassifications').mockResolvedValue([]);
            jest.spyOn(MonthlyReportingService as any, 'generateCriticalInsights').mockResolvedValue([
                'No security incidents were created this month, indicating strong preventive security measures.'
            ]);

            const report = await MonthlyReportingService.generateMonthlyReport(mockFilters, mockUserId);

            expect(report.incidentTrends.totalIncidents).toBe(0);
            expect(report.mttr).toBe(0);
            expect(report.slaCompliance.overallComplianceRate).toBe(100);
            expect(report.performanceIndicators.alertToIncidentRatio).toBe(0);
            expect(report.topIncidentClassifications).toHaveLength(0);
            expect(report.criticalInsights[0]).toContain('No security incidents');
        });
    });

    describe('validateReportInputs', () => {
        it('should validate required fields', () => {
            expect(() => {
                MonthlyReportingService.validateReportInputs({
                    tenantId: '',
                    startDate: mockFilters.startDate,
                    endDate: mockFilters.endDate,
                });
            }).toThrow('Tenant ID is required');

            expect(() => {
                MonthlyReportingService.validateReportInputs({
                    tenantId: mockTenantId,
                    startDate: null as any,
                    endDate: mockFilters.endDate,
                });
            }).toThrow('Start date and end date are required');

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

    describe('getCurrentMonthDateRange', () => {
        it('should return correct date range for current month', () => {
            const mockDate = new Date('2024-06-15T10:30:00.000Z');
            vi.setSystemTime(mockDate);

            const range = MonthlyReportingService.getCurrentMonthDateRange();

            expect(range.startDate).toEqual(new Date('2024-06-01T00:00:00.000Z'));
            expect(range.endDate).toEqual(new Date('2024-06-30T23:59:59.999Z'));
        });
    });

    describe('getPreviousMonthDateRange', () => {
        it('should return correct date range for previous month', () => {
            const mockDate = new Date('2024-06-15T10:30:00.000Z');
            vi.setSystemTime(mockDate);

            const range = MonthlyReportingService.getPreviousMonthDateRange();

            expect(range.startDate).toEqual(new Date('2024-05-01T00:00:00.000Z'));
            expect(range.endDate).toEqual(new Date('2024-05-31T23:59:59.999Z'));
        });

        it('should handle year boundary correctly', () => {
            const mockDate = new Date('2024-01-15T10:30:00.000Z');
            vi.setSystemTime(mockDate);

            const range = MonthlyReportingService.getPreviousMonthDateRange();

            expect(range.startDate).toEqual(new Date('2023-12-01T00:00:00.000Z'));
            expect(range.endDate).toEqual(new Date('2023-12-31T23:59:59.999Z'));
        });
    });

    describe('scheduleMonthlyReport', () => {
        it('should log scheduling configuration', async () => {
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
    });

    describe('deliverMonthlyReport', () => {
        it('should handle email delivery method', async () => {
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

        it('should handle dashboard delivery method', async () => {
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

        it('should handle unsupported delivery method', async () => {
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
});