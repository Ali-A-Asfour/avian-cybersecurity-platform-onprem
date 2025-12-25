/**
 * Unit Tests for Error Handling Components
 * 
 * Tests individual error handling components:
 * - EnhancedErrorBoundary
 * - ErrorRecoveryPanel
 * - NetworkStatusMonitor
 * 
 * **Feature: tenant-admin-dashboard, Task 10.2: Add comprehensive error handling**
 * **Validates: Requirements: error handling, reliability requirements**
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { EnhancedErrorBoundary } from '../EnhancedErrorBoundary';
import { ErrorRecoveryPanel } from '../ErrorRecoveryPanel';
import { NetworkStatusMonitor } from '../NetworkStatusMonitor';
import { DashboardError, ErrorContext, NetworkErrorDetector } from '@/lib/errorHandling';

// Mock the utils
jest.mock('@/lib/utils', () => ({
    cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
};

describe('EnhancedErrorBoundary', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should catch and display errors with recovery actions', () => {
        const onRetry = jest.fn();

        render(
            <EnhancedErrorBoundary componentName="Test Component" onRetry={onRetry}>
                <ThrowError shouldThrow={true} />
            </EnhancedErrorBoundary>
        );

        // Should show error UI
        expect(screen.getByText(/Test Component Error/)).toBeInTheDocument();
        expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();

        // Should show retry button
        const retryButton = screen.getByRole('button', { name: /try again/i });
        expect(retryButton).toBeInTheDocument();

        // Should show other recovery actions
        expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /contact support/i })).toBeInTheDocument();
    });

    it('should call retry function when retry button is clicked', async () => {
        const onRetry = jest.fn().mockResolvedValue(undefined);

        render(
            <EnhancedErrorBoundary componentName="Test Component" onRetry={onRetry}>
                <ThrowError shouldThrow={true} />
            </EnhancedErrorBoundary>
        );

        const retryButton = screen.getByRole('button', { name: /try again/i });
        fireEvent.click(retryButton);

        await waitFor(() => {
            expect(onRetry).toHaveBeenCalled();
        });
    });

    it('should render children when there is no error', () => {
        render(
            <EnhancedErrorBoundary componentName="Test Component">
                <ThrowError shouldThrow={false} />
            </EnhancedErrorBoundary>
        );

        expect(screen.getByText('No error')).toBeInTheDocument();
        expect(screen.queryByText(/Error/)).not.toBeInTheDocument();
    });

    it('should show technical details in development mode', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        render(
            <EnhancedErrorBoundary componentName="Test Component">
                <ThrowError shouldThrow={true} />
            </EnhancedErrorBoundary>
        );

        expect(screen.getByText('Technical Details')).toBeInTheDocument();

        process.env.NODE_ENV = originalEnv;
    });
});

describe('ErrorRecoveryPanel', () => {
    const mockErrors = {
        kpis: new DashboardError(
            'Network error',
            'NETWORK_ERROR',
            {
                component: 'DashboardApiService',
                operation: 'fetch_kpis',
                timestamp: new Date().toISOString(),
            },
            { retryable: true }
        ),
        alertsTrend: new DashboardError(
            'Server error',
            'SERVER_ERROR',
            {
                component: 'DashboardApiService',
                operation: 'fetch_alerts-trend',
                timestamp: new Date().toISOString(),
            },
            { retryable: true }
        ),
        deviceCoverage: null,
        ticketBreakdown: null,
        integrations: null,
        recentActivity: null,
    };

    it('should display error categories and recovery actions', () => {
        const onRetryComponent = jest.fn();
        const onRefreshAll = jest.fn();

        render(
            <ErrorRecoveryPanel
                errors={mockErrors}
                onRetryComponent={onRetryComponent}
                onRefreshAll={onRefreshAll}
            />
        );

        // Should show error recovery header
        expect(screen.getByText('Error Recovery')).toBeInTheDocument();
        expect(screen.getByText(/2 components need attention/)).toBeInTheDocument();

        // Should show error categories
        expect(screen.getByText(/network Issues/)).toBeInTheDocument();
        expect(screen.getByText(/server Issues/)).toBeInTheDocument();

        // Should show retry all button
        expect(screen.getByRole('button', { name: /retry all/i })).toBeInTheDocument();
    });

    it('should call retry functions when buttons are clicked', async () => {
        const onRetryComponent = jest.fn().mockResolvedValue(undefined);
        const onRefreshAll = jest.fn().mockResolvedValue(undefined);

        render(
            <ErrorRecoveryPanel
                errors={mockErrors}
                onRetryComponent={onRetryComponent}
                onRefreshAll={onRefreshAll}
            />
        );

        // Click retry all
        const retryAllButton = screen.getByRole('button', { name: /retry all/i });
        fireEvent.click(retryAllButton);

        await waitFor(() => {
            expect(onRefreshAll).toHaveBeenCalled();
        });

        // Click individual retry
        const retryButtons = screen.getAllByRole('button', { name: /retry/i });
        const individualRetryButton = retryButtons.find(button =>
            button.textContent === 'Retry' && button !== retryAllButton
        );

        if (individualRetryButton) {
            fireEvent.click(individualRetryButton);
            await waitFor(() => {
                expect(onRetryComponent).toHaveBeenCalled();
            });
        }
    });

    it('should not render when there are no errors', () => {
        const noErrors = {
            kpis: null,
            alertsTrend: null,
            deviceCoverage: null,
            ticketBreakdown: null,
            integrations: null,
            recentActivity: null,
        };

        const { container } = render(
            <ErrorRecoveryPanel
                errors={noErrors}
                onRetryComponent={jest.fn()}
                onRefreshAll={jest.fn()}
            />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should show user-friendly error messages', () => {
        render(
            <ErrorRecoveryPanel
                errors={mockErrors}
                onRetryComponent={jest.fn()}
                onRefreshAll={jest.fn()}
            />
        );

        // Should show friendly descriptions
        expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument();
        expect(screen.getByText(/The server encountered an unexpected error/)).toBeInTheDocument();
    });

    it('should categorize errors correctly', () => {
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

        const errorsWithAuth = {
            ...mockErrors,
            kpis: authError,
        };

        render(
            <ErrorRecoveryPanel
                errors={errorsWithAuth}
                onRetryComponent={jest.fn()}
                onRefreshAll={jest.fn()}
            />
        );

        // Should show auth category
        expect(screen.getByText(/auth Issues/)).toBeInTheDocument();
        expect(screen.getByText(/Go to Login Page/)).toBeInTheDocument();
    });

    it('should handle non-retryable errors', () => {
        const nonRetryableError = new DashboardError(
            'Validation error',
            'VALIDATION_ERROR',
            {
                component: 'DashboardApiService',
                operation: 'fetch_kpis',
                timestamp: new Date().toISOString(),
            },
            { retryable: false }
        );

        const errorsWithNonRetryable = {
            kpis: nonRetryableError,
            alertsTrend: null,
            deviceCoverage: null,
            ticketBreakdown: null,
            integrations: null,
            recentActivity: null,
        };

        render(
            <ErrorRecoveryPanel
                errors={errorsWithNonRetryable}
                onRetryComponent={jest.fn()}
                onRefreshAll={jest.fn()}
            />
        );

        // Should show non-retryable button
        expect(screen.getByRole('button', { name: /not retryable/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /not retryable/i })).toBeDisabled();
    });
});

describe('NetworkStatusMonitor', () => {
    beforeEach(() => {
        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: true,
        });

        // Mock fetch for connection testing
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
        } as Response);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should display online status when connected', () => {
        render(<NetworkStatusMonitor />);

        expect(screen.getByText(/Connected|Excellent|Good|Poor/)).toBeInTheDocument();
    });

    it('should display offline status when disconnected', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        render(<NetworkStatusMonitor />);

        expect(screen.getByText(/Offline/)).toBeInTheDocument();
    });

    it('should provide manual connection test button', () => {
        render(<NetworkStatusMonitor />);

        const testButton = screen.getByRole('button', { name: /test connection quality/i });
        expect(testButton).toBeInTheDocument();
    });

    it('should call onNetworkChange callback when network status changes', () => {
        const onNetworkChange = jest.fn();

        render(<NetworkStatusMonitor onNetworkChange={onNetworkChange} />);

        // Simulate going offline
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        // Trigger offline event
        fireEvent(window, new Event('offline'));

        expect(onNetworkChange).toHaveBeenCalledWith(false);
    });

    it('should test connection quality when button is clicked', async () => {
        const onConnectionTest = jest.fn();

        render(<NetworkStatusMonitor onConnectionTest={onConnectionTest} />);

        const testButton = screen.getByRole('button', { name: /test connection quality/i });
        fireEvent.click(testButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/health', expect.any(Object));
        });
    });

    it('should handle connection test failures gracefully', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        const onConnectionTest = jest.fn();

        render(<NetworkStatusMonitor onConnectionTest={onConnectionTest} />);

        const testButton = screen.getByRole('button', { name: /test connection quality/i });
        fireEvent.click(testButton);

        await waitFor(() => {
            expect(onConnectionTest).toHaveBeenCalledWith(false, undefined);
        });
    });
});

describe('Error Handling Utilities Integration', () => {
    it('should detect network errors correctly', () => {
        const networkError = new Error('Failed to fetch');
        expect(NetworkErrorDetector.isNetworkError(networkError)).toBe(true);

        const timeoutError = new Error('The operation was aborted');
        timeoutError.name = 'AbortError';
        expect(NetworkErrorDetector.isNetworkError(timeoutError)).toBe(true);

        const regularError = new Error('Something else');
        expect(NetworkErrorDetector.isNetworkError(regularError)).toBe(false);
    });

    it('should identify retryable HTTP errors', () => {
        expect(NetworkErrorDetector.isRetryableHttpError(500)).toBe(true);
        expect(NetworkErrorDetector.isRetryableHttpError(502)).toBe(true);
        expect(NetworkErrorDetector.isRetryableHttpError(429)).toBe(true);
        expect(NetworkErrorDetector.isRetryableHttpError(404)).toBe(false);
        expect(NetworkErrorDetector.isRetryableHttpError(400)).toBe(false);
    });

    it('should generate appropriate error codes', () => {
        const response500 = { status: 500 } as Response;
        expect(NetworkErrorDetector.getErrorCode(null, response500)).toBe('SERVER_ERROR');

        const response401 = { status: 401 } as Response;
        expect(NetworkErrorDetector.getErrorCode(null, response401)).toBe('AUTHENTICATION_ERROR');

        const response403 = { status: 403 } as Response;
        expect(NetworkErrorDetector.getErrorCode(null, response403)).toBe('AUTHORIZATION_ERROR');

        const response429 = { status: 429 } as Response;
        expect(NetworkErrorDetector.getErrorCode(null, response429)).toBe('RATE_LIMIT_ERROR');

        const networkError = new Error('Failed to fetch');
        expect(NetworkErrorDetector.getErrorCode(networkError)).toBe('NETWORK_ERROR');
    });
});