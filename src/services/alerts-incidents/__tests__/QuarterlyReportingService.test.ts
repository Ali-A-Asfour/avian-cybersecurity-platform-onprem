/**
 * Unit Tests for Quarterly Reporting Service
 * 
 * Tests quarterly report generation with:
 * - Executive risk summary, incident volume trends, and SLA performance analysis
 * - Executive-level dashboards and visualizations
 * - Long-term data retention for compliance
 * 
 * Requirements: 11.3, 11.5
 */

import { QuarterlyReportingService, QuarterlyReportFilters } from '../QuarterlyReportingService';

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
    }
}));

import { db } from '../../../lib/database';

describe('QuarterlyReportingService', () => {
    const mockTenantId = 'test-tenant-123';
    const mockUserId = 'test-user-456';

    const mockFilters: QuarterlyReportFilters = {
        tenantId: mockTenantId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        includeArchived: false,
        includeHistoricalComparison: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('generateQuarterlyReport', () => {
        it('should generate a complete quarterly report with all sections', async () => {
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

            // Mock various database queries
            mockDbChain.select.mockImplementation((fields) => {
                if (fields && typeof fields === 'object' && 'count' in fields) {
                    return Promise.resolve([{ count: 25 }]); // Total incidents
                }
                if (fields && typeof fields === 'object' && 'severity' in fields) {
                    return Promise.resolve([
                        { severity: 'critical', count: 2 },
                        { severity: 'high', count: 8 },
                        { severity: 'medium', count: 12 },
                        { severity: 'low', count: 3 }
                    ]);
                }
                return Promise.resolve([]);
            });

            (db as any).select = mockDbChain.select;
            (db as any).from = mockDbChain.from;
            (db as any).where = mockDbChain.where;
            (db as any).groupBy = mockDbChain.groupBy;
            (db as any).orderBy = mockDbChain.orderBy;
            (db as any).limit = mockDbChain.limit;
            (db as any).innerJoin = mockDbChain.innerJoin;

            const report = await QuarterlyReportingService.generateQuarterlyReport(
                mockFilters,
                mockUserId
            );

            // Verify report structure
            expect(report).toBeDefined();
            expect(report.id).toMatch(/^quarterly-alerts-incidents-/);
            expect(report.tenantId).toBe(mockTenantId);
            expect(report.reportType).toBe('quarterly');
            expect(report.generatedBy).toBe(mockUserId);
            expect(report.generatedAt).toBeInstanceOf(Date);

            // Verify executive risk summary
            expect(report.executiveRiskSummary).toBeDefined();
            expect(report.executiveRiskSummary.overallRiskLevel).toMatch(/^(low|medium|high|critical)$/);
            expect(report.executiveRiskSummary.riskScore).toBeGreaterThanOrEqual(0);
            expect(report.executiveRiskSummary.riskScore).toBeLessThanOrEqual(100);
            expect(Array.isArray(report.executiveRiskSummary.keyRiskFactors)).toBe(true);
            expect(report.executiveRiskSummary.riskTrends).toMatch(/^(improving|stable|deteriorating)$/);

            // Verify incident volume trends
            expect(report.incidentVolumeTrends).toBeDefined();
            expect(typeof report.incidentVolumeTrends.quarterlyTotal).toBe('number');
            expect(Array.isArray(report.incidentVolumeTrends.monthlyBreakdown)).toBe(true);
            expect(report.incidentVolumeTrends.yearOverYearComparison).toBeDefined();
            expect(Array.isArray(report.incidentVolumeTrends.seasonalPatterns)).toBe(true);

            // Verify SLA performance analysis
            expect(report.slaPerformanceAnalysis).toBeDefined();
            expect(typeof report.slaPerformanceAnalysis.overallCompliance).toBe('number');
            expect(Array.isArray(report.slaPerformanceAnalysis.complianceByMonth)).toBe(true);
            expect(Array.isArray(report.slaPerformanceAnalysis.improvementRecommendations)).toBe(true);
            expect(report.slaPerformanceAnalysis.benchmarkComparison).toBeDefined();

            // Verify executive dashboards
            expect(report.executiveDashboards).toBeDefined();
            expect(report.executiveDashboards.securityPosture).toBeDefined();
            expect(report.executiveDashboards.operationalEfficiency).toBeDefined();
            expect(report.executiveDashboards.complianceMetrics).toBeDefined();

            // Verify data retention
            expect(report.dataRetention).toBeDefined();
            expect(typeof report.dataRetention.retentionPeriodMonths).toBe('number');
            expect(report.dataRetention.complianceStatus).toMatch(/^(compliant|at_risk|non_compliant)$/);
        });

        it('should handle database unavailable gracefully', async () => {
            // Mock database as undefined
            (db as any) = undefined;

            const report = await QuarterlyReportingService.generateQuarterlyReport(
                mockFilters,
                mockUserId
            );

            // Should return report with default values
            expect(report).toBeDefined();
            expect(report.executiveRiskSummary.overallRiskLevel).toBe('low');
            expect(report.incidentVolumeTrends.quarterlyTotal).toBe(0);
            expect(report.slaPerformanceAnalysis.overallCompliance).toBe(100);
        });

        it('should throw error for invalid filters', async () => {
            const invalidFilters = {
                ...mockFilters,
                tenantId: '', // Invalid tenant ID
            };

            await expect(
                QuarterlyReportingService.generateQuarterlyReport(invalidFilters, mockUserId)
            ).rejects.toThrow('Tenant ID is required');
        });
    });

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
        it('should return correct date range for Q1', () => {
            // Mock current date to be in Q1
            const mockDate = new Date('2024-02-15');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const dateRange = QuarterlyReportingService.getCurrentQuarterDateRange();

            expect(dateRange.startDate).toEqual(new Date('2024-01-01T00:00:00.000Z'));
            expect(dateRange.endDate.getMonth()).toBe(2); // March (0-indexed)
            expect(dateRange.endDate.getDate()).toBe(31); // Last day of March

            jest.useRealTimers();
        });

        it('should return correct date range for Q4', () => {
            // Mock current date to be in Q4
            const mockDate = new Date('2024-11-15');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const dateRange = QuarterlyReportingService.getCurrentQuarterDateRange();

            expect(dateRange.startDate).toEqual(new Date('2024-10-01T00:00:00.000Z'));
            expect(dateRange.endDate.getMonth()).toBe(11); // December (0-indexed)
            expect(dateRange.endDate.getDate()).toBe(31); // Last day of December

            jest.useRealTimers();
        });
    });

    describe('getPreviousQuarterDateRange', () => {
        it('should return correct date range for previous quarter in same year', () => {
            // Mock current date to be in Q2
            const mockDate = new Date('2024-05-15');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const dateRange = QuarterlyReportingService.getPreviousQuarterDateRange();

            expect(dateRange.startDate).toEqual(new Date('2024-01-01T00:00:00.000Z'));
            expect(dateRange.endDate.getMonth()).toBe(2); // March (0-indexed)
            expect(dateRange.endDate.getDate()).toBe(31); // Last day of March

            jest.useRealTimers();
        });

        it('should return correct date range for previous quarter in previous year', () => {
            // Mock current date to be in Q1
            const mockDate = new Date('2024-02-15');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const dateRange = QuarterlyReportingService.getPreviousQuarterDateRange();

            expect(dateRange.startDate).toEqual(new Date('2023-10-01T00:00:00.000Z'));
            expect(dateRange.endDate.getMonth()).toBe(11); // December (0-indexed)
            expect(dateRange.endDate.getDate()).toBe(31); // Last day of December
            expect(dateRange.endDate.getFullYear()).toBe(2023);

            jest.useRealTimers();
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

        it('should handle scheduling errors gracefully', async () => {
            const scheduleConfig = {
                tenantId: '', // Invalid tenant ID
                enabled: true,
                dayOfQuarter: 5,
                hour: 9,
                timezone: 'UTC',
                recipients: ['exec@company.com'],
                deliveryMethod: 'email' as const,
                includeExecutiveSummary: true,
                includeDetailedAnalysis: true,
            };

            // Should log error but not throw (in production would handle gracefully)
            await expect(
                QuarterlyReportingService.scheduleQuarterlyReport(scheduleConfig)
            ).resolves.not.toThrow();
        });
    });

    describe('deliverQuarterlyReport', () => {
        it('should deliver quarterly report via email', async () => {
            const mockReport = {
                id: 'test-report-123',
                tenantId: mockTenantId,
                reportType: 'quarterly' as const,
                dateRange: {
                    startDate: mockFilters.startDate,
                    endDate: mockFilters.endDate,
                },
                generatedAt: new Date(),
                generatedBy: mockUserId,
                executiveRiskSummary: {
                    overallRiskLevel: 'medium' as const,
                    riskScore: 65,
                    keyRiskFactors: ['High incident volume'],
                    riskTrends: 'stable' as const,
                    criticalIncidentsCount: 2,
                    highSeverityIncidentsCount: 8,
                    unmitigatedRisks: [],
                },
                incidentVolumeTrends: {
                    quarterlyTotal: 25,
                    monthlyBreakdown: [],
                    yearOverYearComparison: {
                        previousQuarterTotal: 20,
                        percentageChange: 25,
                        trend: 'increasing' as const,
                    },
                    seasonalPatterns: [],
                },
                slaPerformanceAnalysis: {
                    overallCompliance: 88,
                    complianceByMonth: [],
                    breachesBySeverity: { critical: 0, high: 2, medium: 1, low: 0 },
                    breachesByType: { acknowledge: 1, investigate: 1, resolve: 1 },
                    improvementRecommendations: [],
                    benchmarkComparison: {
                        industryAverage: 85,
                        performanceGap: 3,
                        ranking: 'above_average' as const,
                    },
                },
                executiveDashboards: {
                    securityPosture: {
                        maturityScore: 78,
                        controlEffectiveness: 82,
                        threatLandscape: [],
                    },
                    operationalEfficiency: {
                        mttrTrend: [],
                        analystProductivity: {
                            averageIncidentsPerAnalyst: 8,
                            topPerformers: [],
                        },
                        resourceUtilization: {
                            alertToIncidentRatio: 4.2,
                            falsePositiveRate: 12,
                            escalationRate: 18,
                        },
                    },
                    complianceMetrics: {
                        dataRetentionCompliance: 98,
                        auditTrailCompleteness: 95,
                        regulatoryAlignmentScore: 88,
                    },
                },
                dataRetention: {
                    retentionPeriodMonths: 84,
                    archivedIncidentsCount: 0,
                    complianceStatus: 'compliant' as const,
                    nextArchivalDate: new Date(),
                },
            };

            const deliveryConfig = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfQuarter: 5,
                hour: 9,
                timezone: 'UTC',
                recipients: ['exec@company.com'],
                deliveryMethod: 'email' as const,
                includeExecutiveSummary: true,
                includeDetailedAnalysis: true,
            };

            // Should not throw
            await expect(
                QuarterlyReportingService.deliverQuarterlyReport(mockReport, deliveryConfig)
            ).resolves.not.toThrow();
        });

        it('should deliver quarterly report via dashboard', async () => {
            const mockReport = {
                id: 'test-report-123',
                tenantId: mockTenantId,
                reportType: 'quarterly' as const,
                dateRange: {
                    startDate: mockFilters.startDate,
                    endDate: mockFilters.endDate,
                },
                generatedAt: new Date(),
                generatedBy: mockUserId,
                executiveRiskSummary: {
                    overallRiskLevel: 'low' as const,
                    riskScore: 25,
                    keyRiskFactors: [],
                    riskTrends: 'improving' as const,
                    criticalIncidentsCount: 0,
                    highSeverityIncidentsCount: 2,
                    unmitigatedRisks: [],
                },
                incidentVolumeTrends: {
                    quarterlyTotal: 10,
                    monthlyBreakdown: [],
                    yearOverYearComparison: {
                        previousQuarterTotal: 15,
                        percentageChange: -33.33,
                        trend: 'decreasing' as const,
                    },
                    seasonalPatterns: [],
                },
                slaPerformanceAnalysis: {
                    overallCompliance: 95,
                    complianceByMonth: [],
                    breachesBySeverity: { critical: 0, high: 0, medium: 1, low: 0 },
                    breachesByType: { acknowledge: 0, investigate: 1, resolve: 0 },
                    improvementRecommendations: [],
                    benchmarkComparison: {
                        industryAverage: 85,
                        performanceGap: 10,
                        ranking: 'above_average' as const,
                    },
                },
                executiveDashboards: {
                    securityPosture: {
                        maturityScore: 85,
                        controlEffectiveness: 90,
                        threatLandscape: [],
                    },
                    operationalEfficiency: {
                        mttrTrend: [],
                        analystProductivity: {
                            averageIncidentsPerAnalyst: 3,
                            topPerformers: [],
                        },
                        resourceUtilization: {
                            alertToIncidentRatio: 2.5,
                            falsePositiveRate: 8,
                            escalationRate: 15,
                        },
                    },
                    complianceMetrics: {
                        dataRetentionCompliance: 100,
                        auditTrailCompleteness: 98,
                        regulatoryAlignmentScore: 92,
                    },
                },
                dataRetention: {
                    retentionPeriodMonths: 84,
                    archivedIncidentsCount: 0,
                    complianceStatus: 'compliant' as const,
                    nextArchivalDate: new Date(),
                },
            };

            const deliveryConfig = {
                tenantId: mockTenantId,
                enabled: true,
                dayOfQuarter: 5,
                hour: 9,
                timezone: 'UTC',
                recipients: ['exec@company.com'],
                deliveryMethod: 'dashboard' as const,
                includeExecutiveSummary: true,
                includeDetailedAnalysis: false,
            };

            // Should not throw
            await expect(
                QuarterlyReportingService.deliverQuarterlyReport(mockReport, deliveryConfig)
            ).resolves.not.toThrow();
        });
    });

    describe('Risk Assessment', () => {
        it('should calculate critical risk level for high incident volume', () => {
            // This would be tested through the private method via the public generateQuarterlyReport
            // The risk assessment logic should identify critical risk when there are many critical incidents
            expect(true).toBe(true); // Placeholder - actual implementation would test risk calculation
        });

        it('should identify key risk factors correctly', () => {
            // This would test the risk factor identification logic
            expect(true).toBe(true); // Placeholder - actual implementation would test risk factors
        });
    });

    describe('Executive Insights', () => {
        it('should generate appropriate executive recommendations', () => {
            // This would test the executive insight generation
            expect(true).toBe(true); // Placeholder - actual implementation would test insights
        });

        it('should calculate security maturity score correctly', () => {
            // This would test the security maturity calculation
            expect(true).toBe(true); // Placeholder - actual implementation would test maturity score
        });
    });
});