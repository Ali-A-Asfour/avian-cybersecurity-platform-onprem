/**
 * Simplified Unit Tests for Weekly Reporting Service
 * 
 * Tests the core functionality without complex database mocking
 * 
 * Requirements: 11.1
 */

import { describe, it, expect, jest } from '@jest/globals';
import { WeeklyReportingService, WeeklyReportFilters, ReportScheduleConfig } from '../WeeklyReportingService';

describe('WeeklyReportingService - Utility Methods', () => {
    const mockTenantId = 'tenant-123';
    const mockStartDate = new Date('2024-01-01T00:00:00.000Z');
    const mockEndDate = new Date('2024-01-07T23:59:59.999Z');

    const mockFilters: WeeklyReportFilters = {
        tenantId: mockTenantId,
        startDate: mockStartDate,
        endDate: mockEndDate,
        includeResolved: true,
        includeDismissed: true,
    };

    describe('getCurrentWeekDateRange', () => {
        it('should return current week date range starting from Monday', () => {
            // Mock current date to a known Wednesday
            const mockDate = new Date('2024-01-03T15:30:00.000Z'); // Wednesday
            const originalDate = global.Date;
            const mockDateConstructor = jest.fn().mockImplementation((arg?: any) => {
                if (arg === undefined) {
                    return mockDate;
                }
                return new originalDate(arg);
            });
            mockDateConstructor.now = originalDate.now;
            mockDateConstructor.UTC = originalDate.UTC;
            mockDateConstructor.parse = originalDate.parse;
            global.Date = mockDateConstructor as any;

            const dateRange = WeeklyReportingService.getCurrentWeekDateRange();

            // Should start from Monday (2024-01-01)
            expect(dateRange.startDate.getDay()).toBe(1); // Monday
            expect(dateRange.startDate.getHours()).toBe(0);
            expect(dateRange.startDate.getMinutes()).toBe(0);

            // Should end on Sunday (2024-01-07)
            expect(dateRange.endDate.getDay()).toBe(0); // Sunday
            expect(dateRange.endDate.getHours()).toBe(23);
            expect(dateRange.endDate.getMinutes()).toBe(59);

            global.Date = originalDate;
        });
    });

    describe('getPreviousWeekDateRange', () => {
        it('should return previous week date range', () => {
            // Mock current date to a known Wednesday
            const mockDate = new Date('2024-01-10T15:30:00.000Z'); // Wednesday of second week
            const originalDate = global.Date;
            const mockDateConstructor = jest.fn().mockImplementation((arg?: any) => {
                if (arg === undefined) {
                    return mockDate;
                }
                return new originalDate(arg);
            });
            mockDateConstructor.now = originalDate.now;
            mockDateConstructor.UTC = originalDate.UTC;
            mockDateConstructor.parse = originalDate.parse;
            global.Date = mockDateConstructor as any;

            const dateRange = WeeklyReportingService.getPreviousWeekDateRange();

            // Should be 7 days before current week
            expect(dateRange.startDate.getDay()).toBe(1); // Monday
            expect(dateRange.endDate.getDay()).toBe(0); // Sunday

            global.Date = originalDate;
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
                startDate: new Date('2024-01-01T00:00:00.000Z'),
                endDate: new Date('2024-01-10T00:00:00.000Z') // 9 days later
            };

            expect(() => {
                WeeklyReportingService.validateReportInputs(invalidFilters);
            }).toThrow('Date range cannot exceed 7 days for weekly reports');
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
        });
    });

    describe('deliverWeeklyReport', () => {
        const mockReport = {
            id: 'weekly-test-123',
            tenantId: mockTenantId,
            reportType: 'weekly' as const,
            dateRange: { startDate: mockStartDate, endDate: mockEndDate },
            generatedAt: new Date(),
            generatedBy: 'user-123',
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
        });
    });
});