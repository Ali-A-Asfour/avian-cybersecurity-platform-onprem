/**
 * Unit Tests for Weekly Reporting Service
 * 
 * Tests the weekly report generation functionality including:
 * - Data aggregation and metrics calculation
 * - Tenant isolation
 * - Date range filtering
 * - Report scheduling and delivery mechanisms
 * 
 * Requirements: 11.1
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WeeklyReportingService, WeeklyReportFilters, ReportScheduleConfig } from '../WeeklyReportingService';
import { db } from '../../../lib/database';
import { logger } from '../../../lib/logger';

// Mock dependencies
jest.mock('../../../lib/database');
jest.mock('../../../lib/logger');

const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('WeeklyReportingService', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-456';
    const mockStartDate = new Date('2024-01-01T00:00:00.000Z');
    const mockEndDate = new Date('2024-01-07T23:59:59.999Z');

    const mockFilters: WeeklyReportFilters = {
        tenantId: mockTenantId,
        startDate: mockStartDate,
        endDate: mockEndDate,
        includeResolved: true,
        includeDismissed: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('generateWeeklyReport', () => {
        it('should generate a complete weekly report with all metrics', async () => {
            // Mock database responses
            const mockDbSelect = jest.fn().mockReturnThis();
            const mockDbFrom = jest.fn().mockReturnThis();
            const mockDbWhere = jest.fn().mockReturnThis();
            const mockDbGroupBy = jest.fn().mockReturnThis();
            const mockDbOrderBy = jest.fn().mockReturnThis();
            const mockDbLimit = jest.fn().mockReturnThis();

            // Mock the database query results
            mockDbSelect
                .mockResolvedValueOnce([{ count: 150 }]) // alertsDigested
                .mockResolvedValueOnce([{ count: 25 }]) // alertsEscalated
                .mockResolvedValueOnce([ // incidentsBySeverity
                    { severity: 'critical', count: 5 },
                    { severity: 'high', count: 10 },
                    { severity: 'medium', count: 8 },
                    { severity: 'low', count: 2 }
                ])
                .mockResolvedValueOnce([ // outcomes
                    { status: 'resolved', count: 15 },
                    { status: 'dismissed', count: 5 },
                    { status: 'in_progress', count: 3 },
                    { status: 'open', count: 2 }
                ])
                .mockResolvedValueOnce([ // alertsByStatus
                    { status: 'closed_benign', count: 80 },
                    { status: 'closed_false_positive', count: 20 },
                    { status: 'escalated', count: 25 },
                    { status: 'investigating', count: 15 },
                    { status: 'assigned', count: 10 }
                ])
                .mockResolvedValueOnce([ // alertsBySeverity
                    { severity: 'critical', count: 20 },
                    { severity: 'high', count: 45 },
                    { severity: 'medium', count: 60 },
                    { severity: 'low', count: 25 }
                ])
                .mockResolvedValueOnce([{ avgResolutionTime: 240 }]) // averageResolutionTime
                .mockResolvedValueOnce([ // dailyAlertCounts
                    { date: '2024-01-01', count: 20 },
                    { date: '2024-01-02', count: 25 },
                    { date: '2024-01-03', count: 18 },
                    { date: '2024-01-04', count: 22 },
                    { date: '2024-01-05', count: 30 },
                    { date: '2024-01-06', count: 15 },
                    { date: '2024-01-07', count: 20 }
                ])
                .mockResolvedValueOnce([ // topAlertClassifications
                    { classification: 'malware', count: 45 },
                    { classification: 'phishing', count: 30 },
                    { classification: 'network_anomaly', count: 25 },
                    { classification: 'suspicious_activity', count: 20 },
                    { classification: 'intrusion_attempt', count: 15 }
                ]);

            (mockDb as any).select = mockDbSelect;
            (mockDb as any).from = mockDbFrom;
            (mockDb as any).where = mockDbWhere;
            (mockDb as any).groupBy = mockDbGroupBy;
            (mockDb as any).orderBy = mockDbOrderBy;
            (mockDb as any).limit = mockDbLimit;

            const report = await WeeklyReportingService.generateWeeklyReport(mockFilters, mockUserId);

            expect(report).toBeDefined();
            expect(report.id).toMatch(/^weekly-alerts-incidents-/);
            expect(report.tenantId).toBe(mockTenantId);
            expect(report.reportType).toBe('weekly');
            expect(report.generatedBy).toBe(mockUserId);
            expect(report.dateRange.startDate).toEqual(mockStartDate);
            expect(report.dateRange.endDate).toEqual(mockEndDate);

            // Verify core metrics
            expect(report.alertsDigested).toBe(150);
            expect(report.alertsEscalated).toBe(25);
            expect(report.escalationRate).toBe(16.67); // 25/150 * 100, rounded to 2 decimals

            // Verify incidents by severity
            expect(report.incidentsBySeverity).toEqual({
                critical: 5,
                high: 10,
                medium: 8,
                low: 2
            });

            // Verify outcomes
            expect(report.outcomes).toEqual({
                resolved: 15,
                dismissed: 5,
                in_progress: 3,
                open: 2
            });

            // Verify additional metrics
            expect(report.averageResolutionTime).toBe(240);
            expect(report.dailyAlertCounts).toHaveLength(7);
            expect(report.topAlertClassifications).toHaveLength(5);

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Weekly report generated successfully',
                expect.objectContaining({
                    reportId: report.id,
                    tenantId: mockTenantId,
                    alertsDigested: 150,
                    alertsEscalated: 25,
                    escalationRate: 16.67
                })
            );
        });

        it('should handle zero escalation rate when no alerts digested', async () => {
            // Mock database responses with zero alerts
            const mockDbSelect = jest.fn()
                .mockResolvedValueOnce([{ count: 0 }]) // alertsDigested
                .mockResolvedValueOnce([{ count: 0 }]) // alertsEscalated
                .mockResolvedValueOnce([]) // incidentsBySeverity
                .mockResolvedValueOnce([]) // outcomes
                .mockResolvedValueOnce([]) // alertsByStatus
                .mockResolvedValueOnce([]) // alertsBySeverity
                .mockResolvedValueOnce([{ avgResolutionTime: null }]) // averageResolutionTime
                .mockResolvedValueOnce([]) // dailyAlertCounts
                .mockResolvedValueOnce([]); // topAlertClassifications

            (mockDb as any).select = mockDbSelect;
            (mockDb as any).from = jest.fn().mockReturnThis();
            (mockDb as any).where = jest.fn().mockReturnThis();
            (mockDb as any).groupBy = jest.fn().mockReturnThis();
            (mockDb as any).orderBy = jest.fn().mockReturnThis();
            (mockDb as any).limit = jest.fn().mockReturnThis();

            const report = await WeeklyReportingService.generateWeeklyReport(mockFilters, mockUserId);

            expect(report.alertsDigested).toBe(0);
            expect(report.alertsEscalated).toBe(0);
            expect(report.escalationRate).toBe(0);
            expect(report.averageResolutionTime).toBe(0);
        });

        it('should handle database connection errors', async () => {
            // Mock database module to return null
            jest.doMock('../../../lib/database', () => ({
                db: null
            }));

            await expect(
                WeeklyReportingService.generateWeeklyReport(mockFilters, mockUserId)
            ).rejects.toThrow('Database connection not available');

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to generate weekly report',
                expect.any(Error),
                expect.objectContaining({
                    tenantId: mockTenantId,
                    startDate: mockStartDate,
                    endDate: mockEndDate
                })
            );
        });

        it('should handle database query errors', async () => {
            const mockError = new Error('Database query failed');
            const mockDbSelect = jest.fn().mockRejectedValue(mockError);

            (mockDb as any).select = mockDbSelect;
            (mockDb as any).from = jest.fn().mockReturnThis();
            (mockDb as any).where = jest.fn().mockReturnThis();

            await expect(
                WeeklyReportingService.generateWeeklyReport(mockFilters, mockUserId)
            ).rejects.toThrow('Database query failed');

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to generate weekly report',
                mockError,
                expect.objectContaining({
                    tenantId: mockTenantId
                })
            );
        });
    });

    describe('scheduleWeeklyReport', () => {
        it('should schedule weekly report successfully', async () => {
            const config: ReportScheduleConfig = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfWeek: 1, // Monday
                hour: 9,
                timezone: 'UTC',
                recipients: ['admin@example.com', 'manager@example.com'],
                deliveryMethod: 'email',
            };

            await expect(
                WeeklyReportingService.scheduleWeeklyReport(config)
            ).resolves.not.toThrow();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Scheduling weekly report',
                expect.objectContaining({
                    tenantId: mockTenantId,
                    dayOfWeek: 1,
                    hour: 9,
                    timezone: 'UTC',
                    recipients: 2
                })
            );

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Weekly report scheduled successfully',
                expect.objectContaining({
                    tenantId: mockTenantId,
                    enabled: true
                })
            );
        });
    });

    describe('deliverWeeklyReport', () => {
        const mockReport = {
            id: 'weekly-test-123',
            tenantId: mockTenantId,
            reportType: 'weekly' as const,
            dateRange: { startDate: mockStartDate, endDate: mockEndDate },
            generatedAt: new Date(),
            generatedBy: mockUserId,
            alertsDigested: 100,
            alertsEscalated: 20,
            incidentsBySeverity: { critical: 2, high: 5, medium: 8, low: 5 },
            outcomes: { resolved: 15, dismissed: 3, in_progress: 2, open: 0 },
            alertsByStatus: { open: 10, assigned: 15, investigating: 20, escalated: 20, closed_benign: 25, closed_false_positive: 10 },
            alertsBySeverity: { critical: 10, high: 25, medium: 40, low: 25 },
            escalationRate: 20,
            averageResolutionTime: 180,
            dailyAlertCounts: [],
            topAlertClassifications: [],
        };

        it('should deliver report via email', async () => {
            const config: ReportScheduleConfig = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfWeek: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: ['admin@example.com'],
                deliveryMethod: 'email',
            };

            await expect(
                WeeklyReportingService.deliverWeeklyReport(mockReport, config)
            ).resolves.not.toThrow();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Weekly report delivered successfully',
                expect.objectContaining({
                    reportId: mockReport.id,
                    tenantId: mockTenantId,
                    deliveryMethod: 'email'
                })
            );
        });

        it('should deliver report via dashboard', async () => {
            const config: ReportScheduleConfig = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfWeek: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: [],
                deliveryMethod: 'dashboard',
            };

            await expect(
                WeeklyReportingService.deliverWeeklyReport(mockReport, config)
            ).resolves.not.toThrow();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Weekly report delivered successfully',
                expect.objectContaining({
                    reportId: mockReport.id,
                    tenantId: mockTenantId,
                    deliveryMethod: 'dashboard'
                })
            );
        });

        it('should deliver report via both methods', async () => {
            const config: ReportScheduleConfig = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfWeek: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: ['admin@example.com'],
                deliveryMethod: 'both',
            };

            await expect(
                WeeklyReportingService.deliverWeeklyReport(mockReport, config)
            ).resolves.not.toThrow();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Weekly report delivered successfully',
                expect.objectContaining({
                    reportId: mockReport.id,
                    tenantId: mockTenantId,
                    deliveryMethod: 'both'
                })
            );
        });

        it('should handle unsupported delivery method', async () => {
            const config: ReportScheduleConfig = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfWeek: 1,
                hour: 9,
                timezone: 'UTC',
                recipients: [],
                deliveryMethod: 'sms' as any, // Invalid delivery method
            };

            await expect(
                WeeklyReportingService.deliverWeeklyReport(mockReport, config)
            ).rejects.toThrow('Unsupported delivery method: sms');

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to deliver weekly report',
                expect.any(Error),
                expect.objectContaining({
                    reportId: mockReport.id,
                    tenantId: mockTenantId
                })
            );
        });
    });

    describe('utility methods', () => {
        describe('getCurrentWeekDateRange', () => {
            it('should return current week date range starting from Monday', () => {
                // Mock current date to a known Wednesday
                const mockDate = new Date('2024-01-03T15:30:00.000Z'); // Wednesday
                jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

                const dateRange = WeeklyReportingService.getCurrentWeekDateRange();

                // Should start from Monday (2024-01-01)
                expect(dateRange.startDate.getDay()).toBe(1); // Monday
                expect(dateRange.startDate.getHours()).toBe(0);
                expect(dateRange.startDate.getMinutes()).toBe(0);

                // Should end on Sunday (2024-01-07)
                expect(dateRange.endDate.getDay()).toBe(0); // Sunday
                expect(dateRange.endDate.getHours()).toBe(23);
                expect(dateRange.endDate.getMinutes()).toBe(59);

                jest.restoreAllMocks();
            });
        });

        describe('getPreviousWeekDateRange', () => {
            it('should return previous week date range', () => {
                // Mock current date to a known Wednesday
                const mockDate = new Date('2024-01-10T15:30:00.000Z'); // Wednesday of second week
                jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

                const dateRange = WeeklyReportingService.getPreviousWeekDateRange();

                // Should be 7 days before current week
                expect(dateRange.startDate.getDay()).toBe(1); // Monday
                expect(dateRange.endDate.getDay()).toBe(0); // Sunday

                jest.restoreAllMocks();
            });
        });

        describe('validateReportInputs', () => {
            it('should validate valid inputs successfully', () => {
                expect(() => {
                    WeeklyReportingService.validateReportInputs(mockFilters);
                }).not.toThrow();
            });

            it('should throw error for missing tenant ID', () => {
                const invalidFilters = { ...mockFilters, tenantId: '' };

                expect(() => {
                    WeeklyReportingService.validateReportInputs(invalidFilters);
                }).toThrow('Tenant ID is required');
            });

            it('should throw error for missing dates', () => {
                const invalidFilters = { ...mockFilters, startDate: null as any };

                expect(() => {
                    WeeklyReportingService.validateReportInputs(invalidFilters);
                }).toThrow('Start date and end date are required');
            });

            it('should throw error for invalid date range', () => {
                const invalidFilters = {
                    ...mockFilters,
                    startDate: mockEndDate,
                    endDate: mockStartDate
                };

                expect(() => {
                    WeeklyReportingService.validateReportInputs(invalidFilters);
                }).toThrow('Start date must be before end date');
            });

            it('should throw error for date range exceeding 7 days', () => {
                const invalidFilters = {
                    ...mockFilters,
                    endDate: new Date(mockStartDate.getTime() + 8 * 24 * 60 * 60 * 1000) // 8 days later
                };

                expect(() => {
                    WeeklyReportingService.validateReportInputs(invalidFilters);
                }).toThrow('Date range cannot exceed 7 days for weekly reports');
            });
        });
    });
});