/**
 * Unit Tests for Quarterly Reports API Route
 * 
 * Tests API endpoints for quarterly report generation with:
 * - Executive risk summary, incident volume trends, and SLA performance analysis
 * - Report scheduling and delivery mechanisms
 * - Authentication and authorization validation
 * 
 * Requirements: 11.3, 11.5
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock the QuarterlyReportingService
jest.mock('../../../../../../services/alerts-incidents/QuarterlyReportingService', () => ({
    QuarterlyReportingService: {
        generateQuarterlyReport: jest.fn(),
        scheduleQuarterlyReport: jest.fn(),
        validateReportInputs: jest.fn(),
    }
}));

// Mock the auth utils
jest.mock('../../../../../../lib/auth-utils', () => ({
    validateAuth: jest.fn(),
}));

// Mock the logger
jest.mock('../../../../../../lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    }
}));

import { QuarterlyReportingService } from '../../../../../../services/alerts-incidents/QuarterlyReportingService';
import { validateAuth } from '../../../../../../lib/auth-utils';

describe('/api/alerts-incidents/reports/quarterly', () => {
    const mockUser = {
        id: 'user-123',
        email: 'test@company.com',
        roles: ['super_admin'],
    };

    const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
    };

    const mockAuthResult = {
        success: true,
        user: mockUser,
        tenant: mockTenant,
    };

    const mockQuarterlyReport = {
        id: 'quarterly-report-123',
        tenantId: mockTenant.id,
        reportType: 'quarterly' as const,
        dateRange: {
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-03-31'),
        },
        generatedAt: new Date(),
        generatedBy: mockUser.id,
        executiveRiskSummary: {
            overallRiskLevel: 'medium' as const,
            riskScore: 65,
            keyRiskFactors: ['High incident volume in Q1'],
            riskTrends: 'stable' as const,
            criticalIncidentsCount: 2,
            highSeverityIncidentsCount: 8,
            unmitigatedRisks: [],
        },
        incidentVolumeTrends: {
            quarterlyTotal: 25,
            monthlyBreakdown: [
                { month: '2024-01', incidentCount: 10, criticalCount: 1, highCount: 3, mediumCount: 5, lowCount: 1 },
                { month: '2024-02', incidentCount: 8, criticalCount: 0, highCount: 2, mediumCount: 4, lowCount: 2 },
                { month: '2024-03', incidentCount: 7, criticalCount: 1, highCount: 3, mediumCount: 3, lowCount: 0 },
            ],
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
            improvementRecommendations: ['Improve acknowledge time for high-severity incidents'],
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
            nextArchivalDate: new Date('2024-07-01'),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (validateAuth as any).mockResolvedValue(mockAuthResult);
        (QuarterlyReportingService.generateQuarterlyReport as any).mockResolvedValue(mockQuarterlyReport);
        (QuarterlyReportingService.validateReportInputs as any).mockImplementation(() => { });
        (QuarterlyReportingService.scheduleQuarterlyReport as any).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('GET /api/alerts-incidents/reports/quarterly', () => {
        it('should generate quarterly report successfully', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockQuarterlyReport);
            expect(data.metadata).toBeDefined();
            expect(data.metadata.reportType).toBe('quarterly');
            expect(data.metadata.tenantId).toBe(mockTenant.id);

            expect(QuarterlyReportingService.generateQuarterlyReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockTenant.id,
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-03-31'),
                    includeArchived: false,
                    includeHistoricalComparison: true,
                }),
                mockUser.id
            );
        });

        it('should handle optional query parameters correctly', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31&includeArchived=true&includeHistoricalComparison=false';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(QuarterlyReportingService.generateQuarterlyReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    includeArchived: true,
                    includeHistoricalComparison: false,
                }),
                mockUser.id
            );
        });

        it('should return 401 for unauthenticated requests', async () => {
            (validateAuth as any).mockResolvedValue({ success: false });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Authentication required');
            expect(data.code).toBe('AUTH_REQUIRED');
        });

        it('should return 403 for insufficient permissions', async () => {
            const unauthorizedUser = { ...mockUser, roles: ['security_analyst'] };
            (validateAuth as any).mockResolvedValue({
                success: true,
                user: unauthorizedUser,
                tenant: mockTenant,
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Insufficient permissions for quarterly reports');
            expect(data.code).toBe('INSUFFICIENT_PERMISSIONS');
            expect(data.details.requiredRoles).toContain('super_admin');
        });

        it('should return 400 for missing required parameters', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Start date and end date are required');
            expect(data.code).toBe('MISSING_REQUIRED_PARAMS');
            expect(data.details.required).toContain('startDate');
            expect(data.details.required).toContain('endDate');
        });

        it('should return 400 for invalid date format', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=invalid-date&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid date format. Use ISO date strings (YYYY-MM-DD)');
            expect(data.code).toBe('INVALID_DATE_FORMAT');
        });

        it('should return 400 for validation errors', async () => {
            (QuarterlyReportingService.validateReportInputs as any).mockImplementation(() => {
                throw new Error('Date range cannot exceed 95 days for quarterly reports');
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-06-01';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Date range cannot exceed 95 days for quarterly reports');
            expect(data.code).toBe('VALIDATION_ERROR');
        });

        it('should return 503 for database unavailable', async () => {
            (QuarterlyReportingService.generateQuarterlyReport as any).mockRejectedValue(
                new Error('Database connection not available')
            );

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.error).toBe('Database service temporarily unavailable');
            expect(data.code).toBe('DATABASE_UNAVAILABLE');
        });

        it('should return 500 for unexpected errors', async () => {
            (QuarterlyReportingService.generateQuarterlyReport as any).mockRejectedValue(
                new Error('Unexpected error')
            );

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Internal server error during report generation');
            expect(data.code).toBe('REPORT_GENERATION_ERROR');
        });
    });

    describe('POST /api/alerts-incidents/reports/quarterly', () => {
        const validScheduleRequest = {
            enabled: true,
            dayOfQuarter: 5,
            hour: 9,
            timezone: 'UTC',
            recipients: ['exec@company.com', 'ciso@company.com'],
            deliveryMethod: 'both',
            includeExecutiveSummary: true,
            includeDetailedAnalysis: true,
        };

        it('should schedule quarterly report successfully', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(validScheduleRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Quarterly report scheduled successfully');
            expect(data.data.tenantId).toBe(mockTenant.id);
            expect(data.data.enabled).toBe(true);

            expect(QuarterlyReportingService.scheduleQuarterlyReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockTenant.id,
                    enabled: true,
                    dayOfQuarter: 5,
                    hour: 9,
                    timezone: 'UTC',
                    recipients: ['exec@company.com', 'ciso@company.com'],
                    deliveryMethod: 'both',
                })
            );
        });

        it('should handle optional parameters with defaults', async () => {
            const minimalRequest = {
                enabled: true,
                dayOfQuarter: 10,
                hour: 8,
                timezone: 'America/New_York',
                recipients: ['exec@company.com'],
                deliveryMethod: 'email',
            };

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(minimalRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(QuarterlyReportingService.scheduleQuarterlyReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    includeExecutiveSummary: true, // Default value
                    includeDetailedAnalysis: true, // Default value
                })
            );
        });

        it('should return 401 for unauthenticated requests', async () => {
            (validateAuth as any).mockResolvedValue({ success: false });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(validScheduleRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Authentication required');
            expect(data.code).toBe('AUTH_REQUIRED');
        });

        it('should return 403 for non-super-admin users', async () => {
            const managerUser = { ...mockUser, roles: ['security_manager'] };
            (validateAuth as any).mockResolvedValue({
                success: true,
                user: managerUser,
                tenant: mockTenant,
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(validScheduleRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Insufficient permissions for report scheduling');
            expect(data.code).toBe('INSUFFICIENT_PERMISSIONS');
            expect(data.details.requiredRoles).toContain('super_admin');
        });

        it('should return 400 for invalid JSON', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: 'invalid json',
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid JSON in request body');
            expect(data.code).toBe('INVALID_JSON');
        });

        it('should return 400 for missing required fields', async () => {
            const incompleteRequest = {
                enabled: true,
                // Missing other required fields
            };

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(incompleteRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Missing required fields');
            expect(data.code).toBe('MISSING_REQUIRED_FIELDS');
            expect(data.details.missing).toContain('dayOfQuarter');
            expect(data.details.missing).toContain('hour');
        });

        it('should return 400 for validation errors', async () => {
            const invalidRequest = {
                ...validScheduleRequest,
                dayOfQuarter: 100, // Invalid - must be 1-90
                hour: 25, // Invalid - must be 0-23
                recipients: [], // Invalid - must be non-empty
                deliveryMethod: 'invalid', // Invalid option
            };

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(invalidRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Validation errors in request body');
            expect(data.code).toBe('VALIDATION_ERRORS');
            expect(data.details.errors).toContain('dayOfQuarter must be a number between 1 and 90');
            expect(data.details.errors).toContain('hour must be a number between 0 and 23');
            expect(data.details.errors).toContain('recipients must be a non-empty array');
            expect(data.details.errors).toContain('deliveryMethod must be one of: email, dashboard, both');
        });

        it('should return 400 for invalid email addresses', async () => {
            const invalidEmailRequest = {
                ...validScheduleRequest,
                recipients: ['invalid-email', 'another-invalid'],
            };

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(invalidEmailRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.details.errors).toContain('all recipients must be valid email addresses');
        });

        it('should return 503 for database unavailable', async () => {
            (QuarterlyReportingService.scheduleQuarterlyReport as any).mockRejectedValue(
                new Error('Database connection not available')
            );

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(validScheduleRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.error).toBe('Database service temporarily unavailable');
            expect(data.code).toBe('DATABASE_UNAVAILABLE');
        });

        it('should return 500 for unexpected errors', async () => {
            (QuarterlyReportingService.scheduleQuarterlyReport as any).mockRejectedValue(
                new Error('Unexpected scheduling error')
            );

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(validScheduleRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Internal server error during report scheduling');
            expect(data.code).toBe('REPORT_SCHEDULING_ERROR');
        });
    });

    describe('Role-based Access Control', () => {
        it('should allow super_admin to generate reports', async () => {
            const superAdminUser = { ...mockUser, roles: ['super_admin'] };
            (validateAuth as any).mockResolvedValue({
                success: true,
                user: superAdminUser,
                tenant: mockTenant,
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            expect(response.status).toBe(200);
        });

        it('should allow security_manager to generate reports', async () => {
            const managerUser = { ...mockUser, roles: ['security_manager'] };
            (validateAuth as any).mockResolvedValue({
                success: true,
                user: managerUser,
                tenant: mockTenant,
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            expect(response.status).toBe(200);
        });

        it('should deny security_analyst access to generate reports', async () => {
            const analystUser = { ...mockUser, roles: ['security_analyst'] };
            (validateAuth as any).mockResolvedValue({
                success: true,
                user: analystUser,
                tenant: mockTenant,
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            expect(response.status).toBe(403);
        });

        it('should only allow super_admin to schedule reports', async () => {
            const managerUser = { ...mockUser, roles: ['security_manager'] };
            (validateAuth as any).mockResolvedValue({
                success: true,
                user: managerUser,
                tenant: mockTenant,
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly';
            const request = new NextRequest(url, {
                method: 'POST',
                body: JSON.stringify(validScheduleRequest),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            expect(response.status).toBe(403);
        });
    });
});