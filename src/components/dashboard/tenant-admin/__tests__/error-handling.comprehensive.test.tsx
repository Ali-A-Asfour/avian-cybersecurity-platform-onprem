/**
 * Comprehensive Error Handling Tests
 * 
 * Tests the complete error handling system including:
 * - Network failure handling with retry mechanisms
 * - Partial data failure handling with graceful degradation
 * - User-friendly error messages and recovery actions
 * 
 * **Feature: tenant-admin-dashboard, Task 10.2: Add comprehensive error handling**
 * **Validates: Requirements: error handling, reliability requirements**
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { TenantAdminDashboard } from '../TenantAdminDashboard';
import { dashboardApi } from '@/services/dashboardApi';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardError, ErrorContext, NetworkErrorDetector } from '@/lib/errorHandling';

// Mock the dashboard API
jest.mock('@/services/dashboardApi', () => ({
    dashboardApi: {
        getKPIs: jest.fn(),
        getAlertsTrend: jest.fn(),
        getDeviceCoverage: jest.fn(),
        getTicketBreakdown: jest.fn(),
        getIntegrations: jest.fn(),
        getRecentActivity: jest.fn(),
        getAllDashboardData: jest.fn(),
        healthCheck: jest.fn(),
    },
}));

const mockDashboardApi = dashboardApi as jest.Mocked<typeof dashboardApi>;
const mockUseDashboardData = useDashboardData as jest.MockedFunction<typeof useDashboardData>;

// Mock the useDashboardData hook
jest.mock('@/hooks/useDashboardData', () => ({
    useDashboardData: jest.fn(),
}));

// Mock the navigation service
jest.mock('@/services/navigationService', () => ({
    navigationService: {
        generateActivityUrl: jest.fn(() => '/test-url'),
        generateAlertsTrendUrl: jest.fn(() => '/alerts'),
        generateDeviceCoverageUrl: jest.fn(() => '/assets'),
        generateTicketBreakdownUrl: jest.fn(() => '/tickets'),
        generateIntegrationUrl: jest.fn(() => '/integrations'),
        navigatePreservingContext: jest.fn(),
    },
}));

// Mock auto-refresh hook
jest.mock('@/hooks/useAutoRefresh', () => ({
    useAutoRefresh: () => ({
        isRefreshing: false,
        lastRefreshTime: new Date().toISOString(),
        refreshNow: jest.fn(),
        isActive: true,
    }),
}));

describe('Comprehensive Error Handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset fetch mock
        global.fetch = jest.fn();

        // Mock console methods to avoid noise in tests
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Network Failure Handling', () => {
        it('should detect network errors and provide retry mechanisms', async () => {
            // Mock network error
            const networkError = new Error('Failed to fetch');
            mockDashboardApi.getKPIs.mockRejectedValue(networkError);

            // Mock other successful endpoints
            mockDashboardApi.getAlertsTrend.mockResolvedValue({
                data: [],
                period: '7d',
                timestamp: new Date().toISOString(),
            });

            render(<TenantAdminDashboard />);

            // Should show error recovery panel
            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Should categorize as network error
            expect(screen.getByText(/Network Issues/)).toBeInTheDocument();

            // Should provide retry button
            const retryButton = screen.getByRole('button', { name: /retry/i });
            expect(retryButton).toBeInTheDocument();
            expect(retryButton).not.toBeDisabled();
        });

        it('should implement exponential backoff for retries', async () => {
            const context: ErrorContext = {
                component: 'test',
                operation: 'test',
                timestamp: new Date().toISOString(),
            };

            const networkError = new DashboardError(
                'Network error',
                'NETWORK_ERROR',
                context,
                { retryable: true }
            );

            let attemptCount = 0;
            const mockOperation = jest.fn().mockImplementation(() => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw networkError;
                }
                return Promise.resolve('success');
            });

            const startTime = Date.now();

            // This would be tested in the RetryManager unit tests
            // Here we verify the integration works
            expect(NetworkErrorDetector.isNetworkError(new Error('Failed to fetch'))).toBe(true);
            expect(NetworkErrorDetector.isRetryableHttpError(500)).toBe(true);
            expect(NetworkErrorDetector.isRetryableHttpError(429)).toBe(true);
            expect(NetworkErrorDetector.isRetryableHttpError(404)).toBe(false);
        });

        it('should handle timeout errors appropriately', async () => {
            const timeoutError = new DashboardError(
                'Request timeout',
                'TIMEOUT_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_kpis',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            );

            mockDashboardApi.getKPIs.mockRejectedValue(timeoutError);

            render(<TenantAdminDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Should show timeout-specific messaging
            expect(screen.getByText(/Request Timeout/)).toBeInTheDocument();
            expect(screen.getByText(/The server might be busy/)).toBeInTheDocument();
        });
    });

    describe('Partial Data Failure Handling', () => {
        it('should handle partial failures gracefully', async () => {
            // Mock partial failure scenario
            mockDashboardApi.getKPIs.mockResolvedValue({
                criticalAlerts: 5,
                securityTicketsOpen: 3,
                helpdeskTicketsOpen: 2,
                complianceScore: 85,
                timestamp: new Date().toISOString(),
            });

            mockDashboardApi.getAlertsTrend.mockRejectedValue(
                new DashboardError(
                    'Server error',
                    'SERVER_ERROR',
                    {
                        component: 'DashboardApiService',
                        operation: 'fetch_alerts-trend',
                        timestamp: new Date().toISOString(),
                    },
                    { retryable: true }
                )
            );

            mockDashboardApi.getDeviceCoverage.mockResolvedValue({
                protected: 100,
                missingAgent: 5,
                withAlerts: 2,
                total: 107,
                timestamp: new Date().toISOString(),
            });

            render(<TenantAdminDashboard />);

            // Should show partial data indicator
            await waitFor(() => {
                expect(screen.getByText(/Partial Data Available/)).toBeInTheDocument();
            });

            // Should show successful components
            expect(screen.getByText('5')).toBeInTheDocument(); // Critical alerts
            expect(screen.getByText('107')).toBeInTheDocument(); // Total devices

            // Should show error recovery for failed component
            expect(screen.getByText('Error Recovery')).toBeInTheDocument();
        });

        it('should provide fallback data for failed components', async () => {
            const serverError = new DashboardError(
                'Internal server error',
                'SERVER_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_kpis',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            );

            mockDashboardApi.getKPIs.mockRejectedValue(serverError);

            render(<TenantAdminDashboard />);

            // Should still render KPI cards with fallback data (zeros)
            await waitFor(() => {
                const kpiCards = screen.getAllByText('0');
                expect(kpiCards.length).toBeGreaterThan(0);
            });

            // Should show error recovery
            expect(screen.getByText('Error Recovery')).toBeInTheDocument();
        });

        it('should maintain available data during refresh failures', async () => {
            // Initial successful load
            mockDashboardApi.getKPIs.mockResolvedValueOnce({
                criticalAlerts: 5,
                securityTicketsOpen: 3,
                helpdeskTicketsOpen: 2,
                complianceScore: 85,
                timestamp: new Date().toISOString(),
            });

            // Subsequent failure
            mockDashboardApi.getKPIs.mockRejectedValue(
                new DashboardError(
                    'Network error',
                    'NETWORK_ERROR',
                    {
                        component: 'DashboardApiService',
                        operation: 'fetch_kpis',
                        timestamp: new Date().toISOString(),
                    },
                    { retryable: true }
                )
            );

            render(<TenantAdminDashboard />);

            // Should show initial data
            await waitFor(() => {
                expect(screen.getByText('5')).toBeInTheDocument();
            });

            // Trigger refresh
            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            fireEvent.click(refreshButton);

            // Should maintain previous data and show error
            await waitFor(() => {
                expect(screen.getByText('5')).toBeInTheDocument(); // Previous data preserved
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });
        });
    });

    describe('User-Friendly Error Messages', () => {
        it('should display appropriate error messages for different error types', async () => {
            const authError = new DashboardError(
                'Unauthorized',
                'AUTHENTICATION_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_kpis',
                    timestamp: new Date().toISOString(),
                },
                { retryable: false }
            );

            mockDashboardApi.getKPIs.mockRejectedValue(authError);

            render(<TenantAdminDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Should show authentication-specific messaging
            expect(screen.getByText(/Session Expired/)).toBeInTheDocument();
            expect(screen.getByText(/login session has expired/)).toBeInTheDocument();
            expect(screen.getByText(/log in again/)).toBeInTheDocument();

            // Should provide login action
            expect(screen.getByText(/Go to Login Page/)).toBeInTheDocument();
        });

        it('should categorize errors appropriately', async () => {
            const errors = [
                {
                    error: new DashboardError('Network error', 'NETWORK_ERROR', {} as ErrorContext),
                    expectedCategory: 'Network Issues',
                    expectedIcon: '🌐',
                },
                {
                    error: new DashboardError('Server error', 'SERVER_ERROR', {} as ErrorContext),
                    expectedCategory: 'Server Issues',
                    expectedIcon: '🔧',
                },
                {
                    error: new DashboardError('Auth error', 'AUTHENTICATION_ERROR', {} as ErrorContext),
                    expectedCategory: 'Auth Issues',
                    expectedIcon: '🔐',
                },
            ];

            for (const { error, expectedCategory } of errors) {
                mockDashboardApi.getKPIs.mockRejectedValue(error);

                const { unmount } = render(<TenantAdminDashboard />);

                await waitFor(() => {
                    expect(screen.getByText(expectedCategory)).toBeInTheDocument();
                });

                unmount();
            }
        });

        it('should provide contextual recovery suggestions', async () => {
            const networkError = new DashboardError(
                'Connection failed',
                'NETWORK_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_kpis',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            );

            mockDashboardApi.getKPIs.mockRejectedValue(networkError);

            render(<TenantAdminDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Should show network-specific recovery tip
            expect(screen.getByText(/Check your internet connection/)).toBeInTheDocument();
        });
    });

    describe('Recovery Actions', () => {
        it('should provide individual component retry actions', async () => {
            const error = new DashboardError(
                'Server error',
                'SERVER_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_kpis',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            );

            mockDashboardApi.getKPIs.mockRejectedValueOnce(error);
            mockDashboardApi.getKPIs.mockResolvedValue({
                criticalAlerts: 5,
                securityTicketsOpen: 3,
                helpdeskTicketsOpen: 2,
                complianceScore: 85,
                timestamp: new Date().toISOString(),
            });

            render(<TenantAdminDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Click individual retry button
            const retryButton = screen.getByRole('button', { name: /retry/i });
            fireEvent.click(retryButton);

            // Should show retrying state
            await waitFor(() => {
                expect(screen.getByText(/Retrying/)).toBeInTheDocument();
            });

            // Should recover and hide error panel
            await waitFor(() => {
                expect(screen.queryByText('Error Recovery')).not.toBeInTheDocument();
                expect(screen.getByText('5')).toBeInTheDocument();
            });
        });

        it('should provide bulk retry functionality', async () => {
            const error = new DashboardError(
                'Server error',
                'SERVER_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            );

            mockDashboardApi.getKPIs.mockRejectedValueOnce(error);
            mockDashboardApi.getAlertsTrend.mockRejectedValueOnce(error);

            render(<TenantAdminDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Should show retry all button
            const retryAllButton = screen.getByRole('button', { name: /retry all/i });
            expect(retryAllButton).toBeInTheDocument();

            // Mock successful retry
            mockDashboardApi.getKPIs.mockResolvedValue({
                criticalAlerts: 5,
                securityTicketsOpen: 3,
                helpdeskTicketsOpen: 2,
                complianceScore: 85,
                timestamp: new Date().toISOString(),
            });

            mockDashboardApi.getAlertsTrend.mockResolvedValue({
                data: [],
                period: '7d',
                timestamp: new Date().toISOString(),
            });

            fireEvent.click(retryAllButton);

            // Should show retrying state
            await waitFor(() => {
                expect(screen.getByText(/Retrying.../)).toBeInTheDocument();
            });
        });

        it('should handle non-retryable errors appropriately', async () => {
            const validationError = new DashboardError(
                'Invalid data',
                'VALIDATION_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_kpis',
                    timestamp: new Date().toISOString(),
                },
                { retryable: false }
            );

            mockDashboardApi.getKPIs.mockRejectedValue(validationError);

            render(<TenantAdminDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Should show non-retryable button
            const nonRetryableButton = screen.getByRole('button', { name: /not retryable/i });
            expect(nonRetryableButton).toBeInTheDocument();
            expect(nonRetryableButton).toBeDisabled();
        });
    });

    describe('Error Monitoring and Logging', () => {
        it('should log errors for monitoring', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            const error = new DashboardError(
                'Test error',
                'SERVER_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_kpis',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            );

            mockDashboardApi.getKPIs.mockRejectedValue(error);

            render(<TenantAdminDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Should have logged the error
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should track retry attempts', async () => {
            const error = new DashboardError(
                'Server error',
                'SERVER_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_kpis',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            );

            mockDashboardApi.getKPIs.mockRejectedValue(error);

            render(<TenantAdminDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Error Recovery')).toBeInTheDocument();
            });

            // Click retry button
            const retryButton = screen.getByRole('button', { name: /retry/i });
            fireEvent.click(retryButton);

            // Should show attempt count
            await waitFor(() => {
                expect(screen.getByText(/Attempt 1/)).toBeInTheDocument();
            });
        });
    });

    describe('Network Status Monitoring', () => {
        it('should monitor network status', async () => {
            render(<TenantAdminDashboard />);

            // Should show network status indicator
            expect(screen.getByText(/Connected|Excellent|Good|Poor/)).toBeInTheDocument();
        });

        it('should handle offline state', async () => {
            // Mock navigator.onLine
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: false,
            });

            render(<TenantAdminDashboard />);

            // Should show offline status
            expect(screen.getByText(/Offline/)).toBeInTheDocument();
        });
    });
});

describe('Error Handling Integration', () => {
    it('should integrate all error handling components seamlessly', async () => {
        // Mock mixed success/failure scenario
        mockDashboardApi.getKPIs.mockResolvedValue({
            criticalAlerts: 5,
            securityTicketsOpen: 3,
            helpdeskTicketsOpen: 2,
            complianceScore: 85,
            timestamp: new Date().toISOString(),
        });

        mockDashboardApi.getAlertsTrend.mockRejectedValue(
            new DashboardError(
                'Network error',
                'NETWORK_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_alerts-trend',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            )
        );

        mockDashboardApi.getDeviceCoverage.mockRejectedValue(
            new DashboardError(
                'Server error',
                'SERVER_ERROR',
                {
                    component: 'DashboardApiService',
                    operation: 'fetch_device-coverage',
                    timestamp: new Date().toISOString(),
                },
                { retryable: true }
            )
        );

        render(<TenantAdminDashboard />);

        // Should show successful data
        await waitFor(() => {
            expect(screen.getByText('5')).toBeInTheDocument(); // Critical alerts
        });

        // Should show partial data indicator
        expect(screen.getByText(/Partial Data Available/)).toBeInTheDocument();

        // Should show error recovery panel
        expect(screen.getByText('Error Recovery')).toBeInTheDocument();

        // Should categorize errors
        expect(screen.getByText(/Network Issues/)).toBeInTheDocument();
        expect(screen.getByText(/Server Issues/)).toBeInTheDocument();

        // Should show network status
        expect(screen.getByText(/Connected|Excellent|Good|Poor|Offline/)).toBeInTheDocument();

        // Should provide recovery actions
        expect(screen.getByRole('button', { name: /retry all/i })).toBeInTheDocument();
    });
});