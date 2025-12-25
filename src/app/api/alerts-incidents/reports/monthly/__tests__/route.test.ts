/**
 * Unit Tests for Monthly Reports API Endpoint
 * 
 * Tests the REST API for monthly reporting including:
 * - GET endpoint for report generation
 * - POST endpoint with custom configuration
 * - Error handling and validation
 * - Authentication and tenant isolation
 * 
 * Requirements: 11.2, 11.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { MonthlyReportingService } from '@/services/alerts-incidents/MonthlyReportingService';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Mock dependencies
jest.mock('@/services/alerts-incidents/MonthlyReportingService');
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }
}));

describe('/api/alerts-incidents/reports/monthly', () => {
    const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'security_analyst',
    };

    const mockTenant = {
        id: 'tenant-456',
        name: 'Test Tenant',
    };

    const mockReport = {
        id: 'monthly-report-123',
        tenantId: 'tenant-456',
        reportType: 'monthly' as const,
        dateRange: {
            startDate: new Date('2024-01-01T00:00:00.000Z'),
            endDate: new Date('2024-01-31T23:59:59.999Z'),
        },
        generatedAt: new Date('2024-02-01T09:00:00.000Z'),
        generatedBy: 'user-123',
        incidentTrends: {
            totalIncidents: 25,
            incidentsByStatus: { resolved: 15, dismissed: 5, open: 3, in_progress: 2 },
            incidentsBySeverity: { critical: 5, high: 8, medium: 10, low: 2 },
            weeklyBreakdown: [
                { weekStartDate: '2024-01-01', incidentCount: 6, resolvedCount: 4, escalatedCount: 6 },
                { weekStartDate: '2024-01-08', incidentCount: 7, resolvedCount: 5, escalatedCount: 7 },
                { weekStartDate: '2024-01-15', incidentCount: 6, resolvedCount: 3, escalatedCount: 6 },
                { weekStartDate: '2024-01-22', incidentCount: 6, resolvedCount: 3, escalatedCount: 6 },
            ]
        },
        mttr: 240, // 4 hours
        slaCompliance: {
            overallComplianceRate: 85.5,
            breachesBySeverity: { critical: 1, high: 2, medium: 1, low: 0 },
            breachesByType: { acknowledge: 2, investigate: 1, resolve: 1 },
            complianceByWeek: [
                { weekStartDate: '2024-01-01', complianceRate: 90, totalIncidents: 6, breaches: 1 },
                { weekStartDate: '2024-01-08', complianceRate: 85, totalIncidents: 7, breaches: 1 },
                { weekStartDate: '2024-01-15', complianceRate: 80, totalIncidents: 6, breaches: 1 },
                { weekStartDate: '2024-01-22', complianceRate: 85, totalIncidents: 6, breaches: 1 },
            ]
        },
        performanceIndicators: {
            alertToIncidentRatio: 4.2,
            averageIncidentSeverity: 2.8,
            resolutionEfficiency: 75.0,
            analystWorkload: [
                { analystId: 'analyst-1', incidentsHandled: 12, averageResolutionTime: 220, slaComplianceRate: 90 },
                { analystId: 'analyst-2', incidentsHandled: 8, averageResolutionTime: 280, slaComplianceRate: 80 },
                { analystId: 'analyst-3', incidentsHandled: 5, averageResolutionTime: 200, slaComplianceRate: 95 },
            ]
        },
        historicalComparison: {
            previousMonthMttr: 300,
            mttrTrend: 'improving' as const,
            previousMonthIncidents: 30,
            incidentVolumeTrend: 'decreasing' as const,
            previousMonthSlaCompliance: 80,
            slaComplianceTrend: 'improving' as const,
        },
        topIncidentClassifications: [
            { classification: 'malware-detection', count: 8, averageResolutionTime: 180 },
            { classification: 'network-intrusion', count: 6, averageResolutionTime: 320 },
            { classification: 'data-exfiltration', count: 4, averageResolutionTime: 450 },
        ],
        criticalInsights: [
            'Mean Time To Resolution (4 hours) demonstrates efficient incident response capabilities.',
            'SLA compliance rate (85.5%) is within acceptable range but has room for improvement.',
            'Low alert-to-incident ratio (4.2:1) indicates effective alert filtering and high-quality security signals.'
        ]
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default successful auth and tenant middleware responses
        (authMiddleware as any).mockResolvedValue({
            success: true,
            user: mockUser,
        });

        (tenantMiddleware as any).mockResolvedValue({
            success: true,
            user: mockUser,
            tenant: mockTenant,
        });

        // Setup default successful service response
        (MonthlyReportingService.generateMonthlyReport as any).mockResolvedValue(mockReport);
        (MonthlyReportingService.validateReportInputs as any).mockImplementation(() => { });
        (MonthlyReportingService.deliverMonthlyReport as any).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('GET /api/alerts-incidents/reports/monthly', () => {
        it('should generate monthly report with valid parameters', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-31T23:59:59.999Z'
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockReport);
            expect(MonthlyReportingService.generateMonthlyReport).toHaveBeenCalledWith(
                {
                    tenantId: mockTenant.id,
                    startDate: new Date('2024-01-01T00:00:00.000Z'),
                    endDate: new Date('2024-01-31T23:59:59.999Z'),
                    includeResolved: true,
                    includeDismissed: true,
                },
                mockUser.id
            );
        });

        it('should handle optional query parameters correctly', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01&endDate=2024-01-31&includeResolved=false&includeDismissed=false'
            );

            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(MonthlyReportingService.generateMonthlyReport).toHaveBeenCalledWith(
                {
                    tenantId: mockTenant.id,
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31'),
                    includeResolved: false,
                    includeDismissed: false,
                },
                mockUser.id
            );
        });

        it('should return 400 for missing required parameters', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01'
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('startDate and endDate parameters are required');
        });

        it('should return 400 for invalid date format', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=invalid-date&endDate=2024-01-31'
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toContain('Invalid date format');
        });

        it('should return 400 for validation errors', async () => {
            (MonthlyReportingService.validateReportInputs as any).mockImplementation(() => {
                throw new Error('Date range cannot exceed 32 days for monthly reports');
            });

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01&endDate=2024-02-15'
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('Date range cannot exceed 32 days for monthly reports');
        });

        it('should return 401 for unauthenticated requests', async () => {
            (authMiddleware as any).mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01&endDate=2024-01-31'
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('should return 403 for invalid tenant access', async () => {
            (tenantMiddleware as any).mockResolvedValue({
                success: false,
                error: 'Invalid tenant',
            });

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01&endDate=2024-01-31'
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Forbidden');
            expect(data.message).toBe('Invalid tenant access');
        });

        it('should return 503 for database connection errors', async () => {
            (MonthlyReportingService.generateMonthlyReport as any).mockRejectedValue(
                new Error('Database connection not available')
            );

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01&endDate=2024-01-31'
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.error).toBe('Service Unavailable');
            expect(data.message).toBe('Database service is temporarily unavailable');
        });

        it('should return 500 for unexpected errors', async () => {
            (MonthlyReportingService.generateMonthlyReport as any).mockRejectedValue(
                new Error('Unexpected error')
            );

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01&endDate=2024-01-31'
            );

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Internal Server Error');
            expect(data.message).toBe('An unexpected error occurred while generating the report');
        });
    });

    describe('POST /api/alerts-incidents/reports/monthly', () => {
        const validRequestBody = {
            dateRange: {
                startDate: '2024-01-01T00:00:00.000Z',
                endDate: '2024-01-31T23:59:59.999Z',
            },
            options: {
                includeResolved: true,
                includeDismissed: true,
            },
        };

        it('should generate monthly report with request body', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: JSON.stringify(validRequestBody),
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual({
                ...mockReport,
                deliveryStatus: 'not_requested'
            });
            expect(MonthlyReportingService.generateMonthlyReport).toHaveBeenCalledWith(
                {
                    tenantId: mockTenant.id,
                    startDate: new Date('2024-01-01T00:00:00.000Z'),
                    endDate: new Date('2024-01-31T23:59:59.999Z'),
                    includeResolved: true,
                    includeDismissed: true,
                },
                mockUser.id
            );
        });

        it('should handle delivery configuration', async () => {
            const requestBodyWithDelivery = {
                ...validRequestBody,
                delivery: {
                    method: 'email',
                    recipients: ['admin@example.com', 'security@example.com'],
                },
            };

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: JSON.stringify(requestBodyWithDelivery),
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.deliveryStatus).toBe('success');
            expect(MonthlyReportingService.deliverMonthlyReport).toHaveBeenCalledWith(
                mockReport,
                {
                    tenantId: mockTenant.id,
                    enabled: true,
                    dayOfMonth: 1,
                    hour: 9,
                    timezone: 'UTC',
                    recipients: ['admin@example.com', 'security@example.com'],
                    deliveryMethod: 'email',
                }
            );
        });

        it('should handle delivery failures gracefully', async () => {
            (MonthlyReportingService.deliverMonthlyReport as any).mockRejectedValue(
                new Error('Email service unavailable')
            );

            const requestBodyWithDelivery = {
                ...validRequestBody,
                delivery: {
                    method: 'email',
                    recipients: ['admin@example.com'],
                },
            };

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: JSON.stringify(requestBodyWithDelivery),
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.deliveryStatus).toBe('failed');
            expect(data.deliveryError).toBe('Email service unavailable');
        });

        it('should return 400 for invalid JSON', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: 'invalid json',
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('Invalid JSON in request body');
        });

        it('should return 400 for missing dateRange', async () => {
            const invalidRequestBody = {
                options: {
                    includeResolved: true,
                },
            };

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: JSON.stringify(invalidRequestBody),
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('dateRange with startDate and endDate is required');
        });

        it('should return 400 for invalid date format in request body', async () => {
            const invalidRequestBody = {
                dateRange: {
                    startDate: 'invalid-date',
                    endDate: '2024-01-31T23:59:59.999Z',
                },
            };

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: JSON.stringify(invalidRequestBody),
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('Invalid date format in dateRange');
        });

        it('should handle default options correctly', async () => {
            const minimalRequestBody = {
                dateRange: {
                    startDate: '2024-01-01T00:00:00.000Z',
                    endDate: '2024-01-31T23:59:59.999Z',
                },
            };

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: JSON.stringify(minimalRequestBody),
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(MonthlyReportingService.generateMonthlyReport).toHaveBeenCalledWith(
                {
                    tenantId: mockTenant.id,
                    startDate: new Date('2024-01-01T00:00:00.000Z'),
                    endDate: new Date('2024-01-31T23:59:59.999Z'),
                    includeResolved: true,
                    includeDismissed: true,
                },
                mockUser.id
            );
        });

        it('should return 401 for unauthenticated requests', async () => {
            (authMiddleware as any).mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: JSON.stringify(validRequestBody),
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('should return 403 for invalid tenant access', async () => {
            (tenantMiddleware as any).mockResolvedValue({
                success: false,
                error: 'Invalid tenant',
            });

            const request = new NextRequest(
                'http://localhost:3000/api/alerts-incidents/reports/monthly',
                {
                    method: 'POST',
                    body: JSON.stringify(validRequestBody),
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Forbidden');
            expect(data.message).toBe('Invalid tenant access');
        });
    });
});