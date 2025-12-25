/**
 * Integration Tests for Alerts & Incidents Reporting API Endpoints
 * 
 * Tests the complete reporting API functionality including:
 * - All three report types (weekly, monthly, quarterly)
 * - Caching and performance optimization
 * - Date range filtering
 * - Error handling
 * 
 * Requirements: 11.1, 11.2, 11.3, Task 22
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock all dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/services/alerts-incidents/WeeklyReportingService');
jest.mock('@/services/alerts-incidents/MonthlyReportingService');
jest.mock('@/services/alerts-incidents/QuarterlyReportingService');
jest.mock('@/services/alerts-incidents/ReportCacheService');
jest.mock('@/lib/logger');

describe('Alerts & Incidents Reporting API Integration', () => {
    const mockUser = {
        user_id: 'user-123',
        tenant_id: 'tenant-456',
        email: 'test@example.com',
        role: 'super_admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const mockTenant = {
        id: 'tenant-456',
        name: 'Test Tenant',
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock auth middleware
        const { authMiddleware } = require('@/middleware/auth.middleware');
        authMiddleware.mockResolvedValue({
            success: true,
            user: mockUser,
        });

        // Mock tenant middleware
        const { tenantMiddleware } = require('@/middleware/tenant.middleware');
        tenantMiddleware.mockResolvedValue({
            success: true,
            user: mockUser,
            tenant: mockTenant,
        });

        // Mock cache service
        const { ReportCacheService } = require('@/services/alerts-incidents/ReportCacheService');
        ReportCacheService.getCachedReport.mockResolvedValue(null); // Cache miss
        ReportCacheService.setCachedReport.mockResolvedValue(undefined);
        ReportCacheService.shouldCacheReport.mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('API Endpoint Availability', () => {
        it('should have all required reporting endpoints available', async () => {
            // Test that all endpoint modules can be imported
            expect(() => require('../weekly/route')).not.toThrow();
            expect(() => require('../monthly/route')).not.toThrow();
            expect(() => require('../quarterly/route')).not.toThrow();
        });

        it('should export GET and POST methods for weekly reports', () => {
            const weeklyRoute = require('../weekly/route');
            expect(typeof weeklyRoute.GET).toBe('function');
            expect(typeof weeklyRoute.POST).toBe('function');
        });

        it('should export GET and POST methods for monthly reports', () => {
            const monthlyRoute = require('../monthly/route');
            expect(typeof monthlyRoute.GET).toBe('function');
            expect(typeof monthlyRoute.POST).toBe('function');
        });

        it('should export GET and POST methods for quarterly reports', () => {
            const quarterlyRoute = require('../quarterly/route');
            expect(typeof quarterlyRoute.GET).toBe('function');
            expect(typeof quarterlyRoute.POST).toBe('function');
        });
    });

    describe('Weekly Reports API', () => {
        it('should generate weekly report with caching', async () => {
            const { WeeklyReportingService } = require('@/services/alerts-incidents/WeeklyReportingService');
            const { ReportCacheService } = require('@/services/alerts-incidents/ReportCacheService');
            const { GET } = require('../weekly/route');

            const mockReport = {
                id: 'weekly-123',
                tenantId: mockTenant.id,
                reportType: 'weekly',
                alertsDigested: 100,
                alertsEscalated: 15,
            };

            WeeklyReportingService.validateReportInputs.mockImplementation(() => { });
            WeeklyReportingService.generateWeeklyReport.mockResolvedValue(mockReport);

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockReport);

            // Verify caching was attempted
            expect(ReportCacheService.getCachedReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportType: 'weekly',
                    tenantId: mockTenant.id,
                })
            );

            expect(ReportCacheService.setCachedReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportType: 'weekly',
                    tenantId: mockTenant.id,
                }),
                mockReport
            );
        });
    });

    describe('Monthly Reports API', () => {
        it('should generate monthly report with caching', async () => {
            const { MonthlyReportingService } = require('@/services/alerts-incidents/MonthlyReportingService');
            const { ReportCacheService } = require('@/services/alerts-incidents/ReportCacheService');
            const { GET } = require('../monthly/route');

            const mockReport = {
                id: 'monthly-123',
                tenantId: mockTenant.id,
                reportType: 'monthly',
                incidentTrends: { totalIncidents: 25 },
                mttr: 240,
            };

            MonthlyReportingService.validateReportInputs.mockImplementation(() => { });
            MonthlyReportingService.generateMonthlyReport.mockResolvedValue(mockReport);

            const url = 'http://localhost:3000/api/alerts-incidents/reports/monthly?startDate=2024-01-01&endDate=2024-01-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockReport);

            // Verify caching was attempted
            expect(ReportCacheService.getCachedReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportType: 'monthly',
                    tenantId: mockTenant.id,
                })
            );
        });
    });

    describe('Quarterly Reports API', () => {
        it('should generate quarterly report with caching', async () => {
            const { QuarterlyReportingService } = require('@/services/alerts-incidents/QuarterlyReportingService');
            const { ReportCacheService } = require('@/services/alerts-incidents/ReportCacheService');
            const { GET } = require('../quarterly/route');

            const mockReport = {
                id: 'quarterly-123',
                tenantId: mockTenant.id,
                reportType: 'quarterly',
                dateRange: {
                    startDate: '2024-01-01T00:00:00.000Z',
                    endDate: '2024-03-31T00:00:00.000Z',
                },
                generatedAt: '2024-01-01T00:00:00.000Z',
                generatedBy: mockUser.user_id,
                executiveRiskSummary: { overallRiskLevel: 'medium' },
                incidentVolumeTrends: { quarterlyTotal: 25 },
                slaPerformanceAnalysis: { overallCompliance: 85 },
            };

            QuarterlyReportingService.validateReportInputs.mockImplementation(() => { });
            QuarterlyReportingService.generateQuarterlyReport.mockResolvedValue(mockReport);

            const url = 'http://localhost:3000/api/alerts-incidents/reports/quarterly?startDate=2024-01-01&endDate=2024-03-31';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockReport);

            // Verify caching was attempted
            expect(ReportCacheService.getCachedReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportType: 'quarterly',
                    tenantId: mockTenant.id,
                })
            );
        });
    });

    describe('Cache Hit Scenario', () => {
        it('should serve cached report when available', async () => {
            const { WeeklyReportingService } = require('@/services/alerts-incidents/WeeklyReportingService');
            const { ReportCacheService } = require('@/services/alerts-incidents/ReportCacheService');
            const { GET } = require('../weekly/route');

            const cachedReport = {
                id: 'cached-weekly-123',
                tenantId: mockTenant.id,
                reportType: 'weekly',
                alertsDigested: 100,
                alertsEscalated: 15,
            };

            // Mock cache hit
            ReportCacheService.getCachedReport.mockResolvedValue(cachedReport);
            WeeklyReportingService.validateReportInputs.mockImplementation(() => { });

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(cachedReport);

            // Verify report generation was NOT called (cache hit)
            expect(WeeklyReportingService.generateWeeklyReport).not.toHaveBeenCalled();

            // Verify cache was checked
            expect(ReportCacheService.getCachedReport).toHaveBeenCalled();
        });
    });

    describe('Performance Optimization', () => {
        it('should only cache reports that meet performance criteria', async () => {
            const { WeeklyReportingService } = require('@/services/alerts-incidents/WeeklyReportingService');
            const { ReportCacheService } = require('@/services/alerts-incidents/ReportCacheService');
            const { GET } = require('../weekly/route');

            const mockReport = {
                id: 'small-weekly-123',
                tenantId: mockTenant.id,
                reportType: 'weekly',
                alertsDigested: 5,
            };

            WeeklyReportingService.validateReportInputs.mockImplementation(() => { });
            WeeklyReportingService.generateWeeklyReport.mockResolvedValue(mockReport);

            // Mock that this report should NOT be cached (too small/fast)
            ReportCacheService.shouldCacheReport.mockReturnValue(false);

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);

            expect(response.status).toBe(200);

            // Verify cache check was attempted
            expect(ReportCacheService.getCachedReport).toHaveBeenCalled();

            // Verify report was NOT cached due to performance criteria
            expect(ReportCacheService.setCachedReport).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling with Caching', () => {
        it('should handle cache errors gracefully and still generate reports', async () => {
            const { WeeklyReportingService } = require('@/services/alerts-incidents/WeeklyReportingService');
            const { ReportCacheService } = require('@/services/alerts-incidents/ReportCacheService');
            const { GET } = require('../weekly/route');

            const mockReport = {
                id: 'weekly-123',
                tenantId: mockTenant.id,
                reportType: 'weekly',
                alertsDigested: 100,
            };

            WeeklyReportingService.validateReportInputs.mockImplementation(() => { });
            WeeklyReportingService.generateWeeklyReport.mockResolvedValue(mockReport);

            // Mock cache error
            ReportCacheService.getCachedReport.mockRejectedValue(new Error('Cache unavailable'));

            const url = 'http://localhost:3000/api/alerts-incidents/reports/weekly?startDate=2024-01-01&endDate=2024-01-07';
            const request = new NextRequest(url);

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockReport);

            // Verify report was still generated despite cache error
            expect(WeeklyReportingService.generateWeeklyReport).toHaveBeenCalled();
        });
    });
});