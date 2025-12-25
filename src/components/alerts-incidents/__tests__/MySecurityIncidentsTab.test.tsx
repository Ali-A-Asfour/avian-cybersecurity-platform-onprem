/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MySecurityIncidentsTab } from '../MySecurityIncidentsTab';

// Mock the child components
jest.mock('../IncidentQueue', () => ({
    IncidentQueue: ({ incidents }: { incidents: any[] }) => (
        <div data-testid="incident-queue">
            {incidents.length} incidents
        </div>
    ),
}));

jest.mock('../IncidentFiltersPanel', () => ({
    IncidentFiltersPanel: () => <div data-testid="incident-filters">Filters</div>,
}));

jest.mock('../IncidentResolutionModal', () => ({
    IncidentResolutionModal: () => <div data-testid="incident-resolution-modal">Modal</div>,
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
        info: jest.fn(),
        error: jest.fn(),
    },
}));

// Mock fetch
global.fetch = jest.fn();

describe('MySecurityIncidentsTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            json: () => Promise.resolve({
                success: true,
                data: {
                    incidents: [],
                    pagination: { page: 1, limit: 50, total: 0 },
                    metadata: { total: 0, openCount: 0, inProgressCount: 0 },
                },
            }),
        });
    });

    it('renders the component with header', async () => {
        await act(async () => {
            render(<MySecurityIncidentsTab tenantId="test-tenant" />);
        });

        await screen.findByText('My Security Incidents');
        expect(screen.getByText('My Security Incidents')).toBeInTheDocument();
        expect(screen.getByText(/0 incidents owned by you/)).toBeInTheDocument();
    });

    it('shows loading spinner initially', async () => {
        await act(async () => {
            render(<MySecurityIncidentsTab tenantId="test-tenant" />);
        });

        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('renders incident queue and filters after loading', async () => {
        await act(async () => {
            render(<MySecurityIncidentsTab tenantId="test-tenant" />);
        });

        // Wait for loading to complete
        await screen.findByTestId('incident-queue');

        expect(screen.getByTestId('incident-filters')).toBeInTheDocument();
        expect(screen.getByTestId('incident-queue')).toBeInTheDocument();
    });

    it('displays refresh button', async () => {
        await act(async () => {
            render(<MySecurityIncidentsTab tenantId="test-tenant" />);
        });

        await screen.findByText('Refresh');
        expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
});