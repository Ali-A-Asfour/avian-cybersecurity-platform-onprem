import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AllSecurityIncidentsTab } from '../AllSecurityIncidentsTab';

// Mock the child components
jest.mock('../IncidentQueue', () => ({
    IncidentQueue: ({ readOnly }: { readOnly: boolean }) => (
        <div data-testid="incident-queue" data-readonly={readOnly}>
            Incident Queue Component
        </div>
    ),
}));

jest.mock('../IncidentFiltersPanel', () => ({
    IncidentFiltersPanel: () => <div data-testid="incident-filters">Filters Panel</div>,
}));

jest.mock('@/components/common/LoadingSpinner', () => ({
    LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

jest.mock('@/components/common/ErrorMessage', () => ({
    ErrorMessage: ({ message }: { message: string }) => (
        <div data-testid="error-message">{message}</div>
    ),
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
    },
}));

// Mock fetch
global.fetch = jest.fn();

describe('AllSecurityIncidentsTab', () => {
    const mockTenantId = 'test-tenant-123';

    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            json: () => Promise.resolve({
                success: true,
                data: {
                    incidents: [],
                    pagination: { page: 1, limit: 50, total: 0 },
                    metadata: {
                        total: 0,
                        openCount: 0,
                        inProgressCount: 0,
                        resolvedCount: 0,
                        dismissedCount: 0,
                        queue: 'all',
                        readOnly: true,
                    },
                },
            }),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders the component with correct title and read-only indicator', async () => {
        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        await waitFor(() => {
            expect(screen.getByText('All Security Incidents')).toBeInTheDocument();
            expect(screen.getByText('Read Only')).toBeInTheDocument();
        });
    });

    it('displays read-only information banner', async () => {
        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        await waitFor(() => {
            expect(screen.getByText('Read-Only View')).toBeInTheDocument();
            expect(screen.getByText(/This view provides visibility into all security incidents/)).toBeInTheDocument();
        });
    });

    it('fetches incidents with correct API parameters', async () => {
        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/alerts-incidents/incidents?queue=all&page=1&limit=50'),
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );
        });
    });

    it('passes readOnly=true to IncidentQueue component', async () => {
        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        await waitFor(() => {
            const incidentQueue = screen.getByTestId('incident-queue');
            expect(incidentQueue).toHaveAttribute('data-readonly', 'true');
        });
    });

    it('displays incident counts in header', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: () => Promise.resolve({
                success: true,
                data: {
                    incidents: [],
                    pagination: { page: 1, limit: 50, total: 5 },
                    metadata: {
                        total: 5,
                        openCount: 2,
                        inProgressCount: 1,
                        resolvedCount: 1,
                        dismissedCount: 1,
                        queue: 'all',
                        readOnly: true,
                    },
                },
            }),
        });

        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        await waitFor(() => {
            expect(screen.getByText(/5 total incidents • 2 open • 1 in progress • 1 resolved • 1 dismissed/)).toBeInTheDocument();
        });
    });

    it('renders filters panel', async () => {
        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        await waitFor(() => {
            expect(screen.getByTestId('incident-filters')).toBeInTheDocument();
        });
    });

    it('shows loading spinner initially', () => {
        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('handles API errors gracefully', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: () => Promise.resolve({
                success: false,
                error: {
                    code: 'FETCH_ERROR',
                    message: 'Failed to fetch incidents',
                },
            }),
        });

        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        await waitFor(() => {
            expect(screen.getByTestId('error-message')).toBeInTheDocument();
            expect(screen.getByText('Failed to fetch incidents')).toBeInTheDocument();
        });
    });

    it('includes refresh button', async () => {
        render(<AllSecurityIncidentsTab tenantId={mockTenantId} />);

        await waitFor(() => {
            expect(screen.getByText('Refresh')).toBeInTheDocument();
        });
    });
});