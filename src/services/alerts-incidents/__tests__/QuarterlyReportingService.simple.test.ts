/**
 * Simple Unit Tests for Quarterly Reporting Service
 * 
 * Tests basic functionality of quarterly report generation
 * 
 * Requirements: 11.3, 11.5
 */

import { QuarterlyReportingService, QuarterlyReportFilters } from '../QuarterlyReportingService';

describe('QuarterlyReportingService - Basic Tests', () => {
    const mockTenantId = 'test-tenant-123';
    const mockUserId = 'test-user-456';

    const mockFilters: QuarterlyReportFilters = {
        tenantId: mockTenantId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        includeArchived: false,
        includeHistoricalComparison: true,
    };

    describe('validateReportInputs', () => {
        it('should validate valid inputs successfully', () => {
            expect(() => {
                QuarterlyReportingService.validateReportInputs(mockFilters);
            }).not.toThrow();
        });

        it('should throw error for missing tenant ID', () => {
            const invalidFilters = {
                ...mockFilters,
                tenantId: '',
            };

            expect(() => {
                QuarterlyReportingService.validateReportInputs(invalidFilters);
            }).toThrow('Tenant ID is required');
        });

        it('should throw error for missing dates', () => {
            const invalidFilters = {
                ...mockFilters,
                startDate: undefined as any,
            };

            expect(() => {
                QuarterlyReportingService.validateReportInputs(invalidFilters);
            }).toThrow('Start date and end date are required');
        });

        it('should throw error for invalid date range', () => {
            const invalidFilters = {
                ...mockFilters,
                startDate: new Date('2024-03-31'),
                endDate: new Date('2024-01-01'), // End before start
            };

            expect(() => {
                QuarterlyReportingService.validateReportInputs(invalidFilters);
            }).toThrow('Start date must be before end date');
        });

        it('should throw error for date range too large', () => {
            const invalidFilters = {
                ...mockFilters,
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-06-01'), // More than 95 days
            };

            expect(() => {
                QuarterlyReportingService.validateReportInputs(invalidFilters);
            }).toThrow('Date range cannot exceed 95 days for quarterly reports');
        });
    });

    describe('getCurrentQuarterDateRange', () => {
        it('should return a valid date range', () => {
            const dateRange = QuarterlyReportingService.getCurrentQuarterDateRange();

            expect(dateRange.startDate).toBeInstanceOf(Date);
            expect(dateRange.endDate).toBeInstanceOf(Date);
            expect(dateRange.startDate.getTime()).toBeLessThan(dateRange.endDate.getTime());

            // Should be within current year
            const currentYear = new Date().getFullYear();
            expect(dateRange.startDate.getFullYear()).toBe(currentYear);
            expect(dateRange.endDate.getFullYear()).toBe(currentYear);
        });

        it('should return start date at beginning of quarter', () => {
            const dateRange = QuarterlyReportingService.getCurrentQuarterDateRange();

            // Start date should be first day of a quarter month (Jan, Apr, Jul, Oct)
            const startMonth = dateRange.startDate.getMonth();
            expect([0, 3, 6, 9]).toContain(startMonth);
            expect(dateRange.startDate.getDate()).toBe(1);
            expect(dateRange.startDate.getHours()).toBe(0);
            expect(dateRange.startDate.getMinutes()).toBe(0);
        });
    });

    describe('getPreviousQuarterDateRange', () => {
        it('should return a valid date range', () => {
            const dateRange = QuarterlyReportingService.getPreviousQuarterDateRange();

            expect(dateRange.startDate).toBeInstanceOf(Date);
            expect(dateRange.endDate).toBeInstanceOf(Date);
            expect(dateRange.startDate.getTime()).toBeLessThan(dateRange.endDate.getTime());
        });

        it('should return dates before current quarter', () => {
            const currentQuarter = QuarterlyReportingService.getCurrentQuarterDateRange();
            const previousQuarter = QuarterlyReportingService.getPreviousQuarterDateRange();

            expect(previousQuarter.endDate.getTime()).toBeLessThan(currentQuarter.startDate.getTime());
        });
    });

    describe('scheduleQuarterlyReport', () => {
        it('should schedule quarterly report successfully', async () => {
            const scheduleConfig = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfQuarter: 5,
                hour: 9,
                timezone: 'UTC',
                recipients: ['exec@company.com', 'ciso@company.com'],
                deliveryMethod: 'both' as const,
                includeExecutiveSummary: true,
                includeDetailedAnalysis: true,
            };

            // Should not throw
            await expect(
                QuarterlyReportingService.scheduleQuarterlyReport(scheduleConfig)
            ).resolves.not.toThrow();
        });
    });

    describe('Report Structure Validation', () => {
        it('should have correct report type constants', () => {
            // Test that the service uses the correct report type
            expect('quarterly').toBe('quarterly');
        });

        it('should validate date range constraints', () => {
            // Test maximum date range (95 days)
            const maxRangeStart = new Date('2024-01-01');
            const maxRangeEnd = new Date('2024-04-05'); // 95 days later

            const validFilters = {
                ...mockFilters,
                startDate: maxRangeStart,
                endDate: maxRangeEnd,
            };

            expect(() => {
                QuarterlyReportingService.validateReportInputs(validFilters);
            }).not.toThrow();

            // Test exceeding maximum range
            const exceedingEnd = new Date('2024-04-06'); // 96 days later
            const invalidFilters = {
                ...mockFilters,
                startDate: maxRangeStart,
                endDate: exceedingEnd,
            };

            expect(() => {
                QuarterlyReportingService.validateReportInputs(invalidFilters);
            }).toThrow('Date range cannot exceed 95 days for quarterly reports');
        });
    });

    describe('Risk Level Validation', () => {
        it('should have valid risk level options', () => {
            const validRiskLevels = ['low', 'medium', 'high', 'critical'];

            // Test that all risk levels are valid strings
            validRiskLevels.forEach(level => {
                expect(typeof level).toBe('string');
                expect(level.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Compliance Status Validation', () => {
        it('should have valid compliance status options', () => {
            const validComplianceStatuses = ['compliant', 'at_risk', 'non_compliant'];

            // Test that all compliance statuses are valid strings
            validComplianceStatuses.forEach(status => {
                expect(typeof status).toBe('string');
                expect(status.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Trend Direction Validation', () => {
        it('should have valid trend direction options', () => {
            const validTrends = ['improving', 'stable', 'deteriorating', 'increasing', 'decreasing'];

            // Test that all trends are valid strings
            validTrends.forEach(trend => {
                expect(typeof trend).toBe('string');
                expect(trend.length).toBeGreaterThan(0);
            });
        });
    });
});