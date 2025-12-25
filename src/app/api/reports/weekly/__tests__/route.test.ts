/**
 * Tests for GET /api/reports/weekly endpoint
 * 
 * Requirements: 1.1, 1.3 - Weekly report generation with tenant isolation
 * 
 * Note: These tests run in development mode with BYPASS_AUTH=true,
 * so authentication and tenant validation are automatically successful.
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock the report generator
jest.mock('@/services/reports/ReportGenerator');

const mockCreateReportGenerator = require('@/services/reports/ReportGenerator').createReportGenerator;

describe('GET /api/reports/weekly', () => {
    const mockWeeklyReport = {
        id: 'weekly-dev-tenant-123-123456789',
        tenantId: 'dev-tenant-123',
        reportType: 'weekly',
        dateRange: {
            startDate: '2024-01-01T00:00:00.000Z',
            endDate: '2024-01-07T23:59:59.000Z',
            timezone: 'UTC',
            weekStart: 'monday'
        },
        generatedAt: '2025-12-15T20:03:39.019Z',
        generatedBy: 'dev-user-123',
        slides: [],
        templateVersion: '1.0.0',
        dataSchemaVersion: '1.0.0'
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default successful report generation
        const mockReportGenerator = {
            generateWeeklyReport: jest.fn().mockResolvedValue(mockWeeklyReport)
        };
        mockCreateReportGenerator.mockResolvedValue(mockReportGenerator);
    });

    describe('Input Validation', () => {
        it('should return 400 when startDate is missing', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?endDate=2024-01-07T23:59:59Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('startDate and endDate parameters are required');
        });

        it('should return 400 when endDate is missing', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('startDate and endDate parameters are required');
        });

        it('should return 400 when startDate format is invalid', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=invalid-date&endDate=2024-01-07T23:59:59Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid startDate format');
        });

        it('should return 400 when endDate format is invalid', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=invalid-date');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid endDate format');
        });

        it('should return 400 when startDate is after endDate', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-07T00:00:00Z&endDate=2024-01-01T23:59:59Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('startDate must be before endDate');
        });

        it('should return 400 when date range exceeds 7 days', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-10T23:59:59Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Date range for weekly reports cannot exceed 7 days');
        });

        it('should return 400 when timezone is invalid', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z&timezone=Invalid/Timezone');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid timezone');
        });
    });

    describe('Successful Report Generation', () => {
        it('should generate weekly report successfully with valid parameters', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockWeeklyReport);
            expect(data.meta.reportType).toBe('weekly');
            expect(data.meta.tenantId).toBe('dev-tenant-123'); // Development tenant ID
            expect(data.meta.generatedBy).toBe('dev-user-123'); // Development user ID
        });

        it('should use custom timezone when provided', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z&timezone=America/Toronto');
            const response = await GET(request);

            expect(response.status).toBe(200);

            // Verify the report generator was called with the correct timezone
            const mockReportGenerator = await mockCreateReportGenerator();
            expect(mockReportGenerator.generateWeeklyReport).toHaveBeenCalledWith(
                'dev-tenant-123',
                expect.objectContaining({
                    timezone: 'America/Toronto'
                }),
                'dev-user-123'
            );
        });

        it('should default to UTC timezone when not provided', async () => {
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z');
            const response = await GET(request);

            expect(response.status).toBe(200);

            // Verify the report generator was called with UTC timezone
            const mockReportGenerator = await mockCreateReportGenerator();
            expect(mockReportGenerator.generateWeeklyReport).toHaveBeenCalledWith(
                'dev-tenant-123',
                expect.objectContaining({
                    timezone: 'UTC'
                }),
                'dev-user-123'
            );
        });
    });

    describe('Error Handling', () => {
        it('should return 422 when insufficient data is available', async () => {
            const mockReportGenerator = {
                generateWeeklyReport: jest.fn().mockRejectedValue(new Error('insufficient data for the specified date range'))
            };
            mockCreateReportGenerator.mockResolvedValue(mockReportGenerator);

            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INSUFFICIENT_DATA');
        });

        it('should return 404 when tenant is not found', async () => {
            const mockReportGenerator = {
                generateWeeklyReport: jest.fn().mockRejectedValue(new Error('tenant not found'))
            };
            mockCreateReportGenerator.mockResolvedValue(mockReportGenerator);

            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_NOT_FOUND');
        });

        it('should return 500 for unexpected errors', async () => {
            const mockReportGenerator = {
                generateWeeklyReport: jest.fn().mockRejectedValue(new Error('Unexpected error'))
            };
            mockCreateReportGenerator.mockResolvedValue(mockReportGenerator);

            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('Development Mode Behavior', () => {
        it('should work with development auth bypass', async () => {
            // This test verifies that the endpoint works in development mode
            // with BYPASS_AUTH=true (which is set in jest.setup.js)
            const request = new NextRequest('http://localhost:3000/api/reports/weekly?startDate=2024-01-01T00:00:00Z&endDate=2024-01-07T23:59:59Z');
            const response = await GET(request);

            expect(response.status).toBe(200);

            // Verify development tenant and user IDs are used
            const mockReportGenerator = await mockCreateReportGenerator();
            expect(mockReportGenerator.generateWeeklyReport).toHaveBeenCalledWith(
                'dev-tenant-123', // Development tenant ID from middleware
                expect.any(Object),
                'dev-user-123' // Development user ID from middleware
            );
        });
    });
});