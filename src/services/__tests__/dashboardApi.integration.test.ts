/**
 * Tests for Dashboard API Service
 * 
 * Requirements: API endpoints, error handling
 */

import { dashboardApi, DashboardApiError, DashboardDataTransformer } from '../dashboardApi';
import { KPIResponse, AlertsTrendResponse } from '@/types/dashboard';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Dashboard API Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockClear();
    });

    it('should have all required methods', () => {
        expect(dashboardApi).toBeDefined();
        expect(dashboardApi.getKPIs).toBeDefined();
        expect(dashboardApi.getAlertsTrend).toBeDefined();
        expect(dashboardApi.getDeviceCoverage).toBeDefined();
        expect(dashboardApi.getTicketBreakdown).toBeDefined();
        expect(dashboardApi.getIntegrations).toBeDefined();
        expect(dashboardApi.getRecentActivity).toBeDefined();
        expect(dashboardApi.getAllDashboardData).toBeDefined();
        expect(dashboardApi.healthCheck).toBeDefined();
    });

    it('should successfully fetch KPI data', async () => {
        const mockResponse: KPIResponse = {
            criticalAlerts: 7,
            securityTicketsOpen: 12,
            helpdeskTicketsOpen: 23,
            complianceScore: 94,
            timestamp: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockResponse,
        });

        const result = await dashboardApi.getKPIs();

        expect(mockFetch).toHaveBeenCalledWith('/api/dashboard/kpis', {
            headers: { 'Content-Type': 'application/json' },
            signal: expect.any(Object),
        });
        expect(result).toEqual(mockResponse);
    });

    it('should successfully fetch alerts trend data', async () => {
        const mockResponse: AlertsTrendResponse = {
            data: [
                { date: '2024-01-01', alertCount: 5 },
                { date: '2024-01-02', alertCount: 8 },
            ],
            period: '7 days',
            timestamp: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockResponse,
        });

        const result = await dashboardApi.getAlertsTrend();

        expect(mockFetch).toHaveBeenCalledWith('/api/dashboard/alerts-trend?days=7', {
            headers: { 'Content-Type': 'application/json' },
            signal: expect.any(Object),
        });
        expect(result).toEqual(mockResponse);
    });

    it('should handle API errors correctly', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
        });

        await expect(dashboardApi.getKPIs()).rejects.toThrow(DashboardApiError);
    });

    it('should validate parameter bounds', async () => {
        await expect(dashboardApi.getAlertsTrend(0)).rejects.toThrow(DashboardApiError);
        await expect(dashboardApi.getAlertsTrend(31)).rejects.toThrow(DashboardApiError);
        await expect(dashboardApi.getRecentActivity(0)).rejects.toThrow(DashboardApiError);
        await expect(dashboardApi.getRecentActivity(51)).rejects.toThrow(DashboardApiError);
    });

    it('should transform data correctly', () => {
        const response: KPIResponse = {
            criticalAlerts: 7,
            securityTicketsOpen: 12,
            helpdeskTicketsOpen: 23,
            complianceScore: 94,
            timestamp: '2024-01-01T00:00:00.000Z',
        };

        const transformed = DashboardDataTransformer.transformKPIData(response);

        expect(transformed).toEqual({
            criticalAlerts: 7,
            securityTicketsOpen: 12,
            helpdeskTicketsOpen: 23,
            complianceScore: 94,
        });
    });

    it('should handle retry logic for 5xx errors', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        });

        await expect(dashboardApi.getKPIs()).rejects.toThrow(DashboardApiError);

        // Should retry 3 times for 5xx errors
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle network errors with retries', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(dashboardApi.getKPIs()).rejects.toThrow(DashboardApiError);

        // Should retry network errors
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });
});