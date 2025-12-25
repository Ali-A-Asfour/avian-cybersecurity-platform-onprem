/**
 * Unit Tests for Weekly Reports API Endpoint
 * 
 * Tests the REST API for weekly report generation including:
 * - Authentication and authorization
 * - Input validation
 * - Report generation and delivery
 * - Error handling
 * 
 * Requirements: 11.1
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { WeeklyReportingService } from '@/services/alerts-incidents/WeeklyReportingService';

// Mock dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/services/alerts-incidents/WeeklyReportingService');
jest.mock('@/lib/logger');

const mockAuthMiddleware = jest.mocked(authMiddleware);
const mockTenantMiddleware = jest.mocked(tenantMiddleware);
const mockWeeklyReportingService = jest.mocked(WeeklyReportingService);

describe('/api/alerts-incidents/reports/weekly', () => {
    const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
    };

    const mockTenant = {
        id: 'tenant-456',
        name: 'Test Tenant',
    };

    const mockReport = {
        id: 'weekly-test-123',
        tenantId: 'tenant-456',
        reportType: 'weekly' as const,
        dateRange: {
            startDate: new Date('2024-01-01T00:00:00.000Z'),
            endDate: new Date('2024-01-07T23:59:59.999Z'),
        },
        generatedAt: new Date(),
        generatedBy: 'user-123',
        alertsDigested: 150,
        alertsEscalated: 25,
        incidentsBySeverity: { critical: 5, high: 10, medium: 8, low: 2 },
        outcomes: { resolved: 15, dismissed: 5, in_progress: 3, open: 2 },
        alertsByStatus: { open: 10, assigned: 15, investigating: 20, escalated: 25, closed_benign: 80, closed_false_positive: 20 },
        alertsBySeverity: { critical: 20, high: 45, medium: 60, low: 25 },
        escalationRate: 16.67,
        averageResolutionTime: 240,
        dailyAlertCounts: [
            { date: '2024-01-01', count: 20 },
            { date: '2024-01-02', count: 25 },
        ],
        topAlertClassifications: [
            { classification: 'malware', count: 45 },
            { classification: 'phishing', count: 30 },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock successful authentication
        (mockAuthMiddleware as jest.MockedFunction<any>).mockResolvedValue({
            success: true,
            user: mockUser,
        });

        // Mock successful tenant validation
        (mockTenantMiddleware as jest.MockedFunction<any>).mockResolvedValue({
            success: true,
            user: mockUser,
            tenant: mockTenant,
        });

        // Mock WeeklyReportingService methods
        mockWeeklyReportingService.generateWeeklyReport = jest.fn().mockResolvedValue(mockReport);
        mockWeeklyReportingService.validateReportInputs = jest.fn().mockImplementation(() => { });
        mockWeeklyReportingService.deliverWeeklyReport = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('GET /api/alerts-incidents/reports/weekly', () => {
        it('should generate weekly report with valid parameters', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-07T23:59:59.999Z';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockReport);

            expect(mockWeeklyReportingService.validateReportInputs).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                startDate: new Date('2024-01-01T00:00:00.000Z'),
                endDate: new Date('2024-01-07T23:59:59.999Z'),
                includeResolved: true,
                includeDismissed: true,
            });

            expect(mockWeeklyReportingService.generateWeeklyReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-456',
                    startDate: new Date('2024-01-01T00:00:00.000Z'),
                    endDate: new Date('2024-01-07T23:59:59.999Z'),
                }),
                'user-123'
            );
        });

        it('should handle optional parameters correctly', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07&includeResolved=false&includeDismissed=false';
            const request = new NextRequest(url);

            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(mockWeeklyReportingService.generateWeeklyReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    includeResolved: false,
                    includeDismissed: false,
                }),
                'user-123'
            );
        });

        it('should return 401 for unauthenticated requests', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Authentication failed',
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data).toEqual({ error: 'Unauthorized' });
        });

        it('should return 400 for missing required parameters', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('startDate and endDate parameters are required');
        });

        it('should return 400 for invalid date format', async () => {
            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=invalid-date&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toContain('Invalid date format');
        });

        it('should return 400 for validation errors', async () => {
            mockWeeklyReportingService.validateReportInputs.mockImplementation(() => {
                throw new Error('Date range cannot exceed 7 days');
            });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-15';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('Date range cannot exceed 7 days');
        });

        it('should return 503 for database connection errors', async () => {
            mockWeeklyReportingService.generateWeeklyReport.mockRejectedValue(
                new Error('Database connection not available')
            );

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.error).toBe('Service Unavailable');
            expect(data.message).toBe('Database service is temporarily unavailable');
        });

        it('should return 403 for tenant access errors', async () => {
            mockWeeklyReportingService.generateWeeklyReport.mockRejectedValue(
                new Error('Tenant ID unauthorized')
            );

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Forbidden');
            expect(data.message).toBe('Access denied for this tenant');
        });

        it('should return 500 for unexpected errors', async () => {
            mockWeeklyReportingService.generateWeeklyReport.mockRejectedValue(
                new Error('Unexpected error')
            );

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Internal Server Error');
            expect(data.message).toBe('An unexpected error occurred while generating the report');
        });
    });

    describe('POST /api/alerts-incidents/reports/weekly', () => {
        const validRequestBody = {
            dateRange: {
                startDate: '2024-01-01T00:00:00.000Z',
                endDate: '2024-01-07T23:59:59.999Z',
            },
            options: {
                includeResolved: true,
                includeDismissed: false,
            },
            delivery: {
                method: 'email',
                recipients: ['admin@example.com'],
            },
        };

        it('should generate and deliver weekly report with valid request', async () => {
            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: JSON.stringify(validRequestBody),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.deliveryStatus).toBe('success');
            expect(data.id).toBe(mockReport.id);

            expect(mockWeeklyReportingService.generateWeeklyReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-456',
                    startDate: new Date('2024-01-01T00:00:00.000Z'),
                    endDate: new Date('2024-01-07T23:59:59.999Z'),
                    includeResolved: true,
                    includeDismissed: false,
                }),
                'user-123'
            );

            expect(mockWeeklyReportingService.deliverWeeklyReport).toHaveBeenCalledWith(
                mockReport,
                expect.objectContaining({
                    tenantId: 'tenant-456',
                    recipients: ['admin@example.com'],
                    deliveryMethod: 'email',
                })
            );
        });

        it('should generate report without delivery when not specified', async () => {
            const requestBodyWithoutDelivery = {
                dateRange: {
                    startDate: '2024-01-01T00:00:00.000Z',
                    endDate: '2024-01-07T23:59:59.999Z',
                },
            };

            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: JSON.stringify(requestBodyWithoutDelivery),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.deliveryStatus).toBe('not_requested');
            expect(mockWeeklyReportingService.deliverWeeklyReport).not.toHaveBeenCalled();
        });

        it('should handle delivery failures gracefully', async () => {
            mockWeeklyReportingService.deliverWeeklyReport.mockRejectedValue(
                new Error('Email service unavailable')
            );

            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: JSON.stringify(validRequestBody),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.deliveryStatus).toBe('failed');
            expect(data.deliveryError).toBe('Email service unavailable');
            expect(data.id).toBe(mockReport.id);
        });

        it('should return 401 for unauthenticated requests', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Authentication failed',
            });

            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: JSON.stringify(validRequestBody),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data).toEqual({ error: 'Unauthorized' });
        });

        it('should return 400 for invalid JSON', async () => {
            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: 'invalid json',
                headers: { 'Content-Type': 'application/json' },
            });

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

            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: JSON.stringify(invalidRequestBody),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('dateRange with startDate and endDate is required');
        });

        it('should return 400 for invalid date format in dateRange', async () => {
            const invalidRequestBody = {
                dateRange: {
                    startDate: 'invalid-date',
                    endDate: '2024-01-07T23:59:59.999Z',
                },
            };

            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: JSON.stringify(invalidRequestBody),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('Invalid date format in dateRange');
        });

        it('should return 400 for validation errors', async () => {
            mockWeeklyReportingService.validateReportInputs.mockImplementation(() => {
                throw new Error('Start date must be before end date');
            });

            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: JSON.stringify(validRequestBody),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('Start date must be before end date');
        });

        it('should handle default options correctly', async () => {
            const requestBodyWithoutOptions = {
                dateRange: {
                    startDate: '2024-01-01T00:00:00.000Z',
                    endDate: '2024-01-07T23:59:59.999Z',
                },
            };

            const request = new NextRequest('http://localhost:3000/api/alerts-incidents/reports/weekly', {
                method: 'POST',
                body: JSON.stringify(requestBodyWithoutOptions),
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(mockWeeklyReportingService.generateWeeklyReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    includeResolved: true,
                    includeDismissed: true,
                }),
                'user-123'
            );
        });
    });
});