/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AllAlertsTab } from '../AllAlertsTab';

// Mock the fetch function
global.fetch = jest.fn();

// Mock the logger
jest.mock('@/lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
    },
}));

// Mock the child components
jest.mock('../AlertTriageQueue', () => ({
    AlertTriageQueue: ({ alerts, onAssignAlert }: any) => (
        <div data-testid="alert-triage-queue">
            <div>Alert count: {alerts.length}</div>
            {alerts.map((alert: any) => (
                <div key={alert.id} data-testid={`alert-${alert.id}`}>
                    <span>{alert.title}</span>
                    <button onClick={() => onAssignAlert(alert.id)}>Assign to Me</button>
                </div>
            ))}
        </div>
    ),
}));

jest.mock('../AlertFiltersPanel', () => ({
    AlertFiltersPanel: ({ onFiltersChange }: any) => (
        <div data-testid="alert-filters-panel">
            <button onClick={() => onFiltersChange({ severity: 'critical' })}>
                Filter Critical
            </button>
        </div>
    ),
}));

const mockAlerts = [
    {
        id: 'alert-1',
        tenantId: 'tenant-1',
        sourceSystem: 'edr',
        sourceId: 'edr-001',
        alertType: 'malware_detection',
        classification: 'malware',
        severity: 'critical',
        title: 'Critical Malware Detected',
        description: 'Malware found on endpoint',
        metadata: {},
        seenCount: 1,
        firstSeenAt: new Date('2023-01-01T10:00:00Z'),
        lastSeenAt: new Date('2023-01-01T10:00:00Z'),
        defenderIncidentId: null,
        defenderAlertId: null,
        defenderSeverity: null,
        threatName: null,
        affectedDevice: null,
        affectedUser: null,
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2023-01-01T10:00:00Z'),
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T10:00:00Z'),
    },
    {
        id: 'alert-2',
        tenantId: 'tenant-1',
        sourceSystem: 'firewall',
        sourceId: 'fw-001',
        alertType: 'intrusion_attempt',
        classification: 'intrusion_attempt',
        severity: 'high',
        title: 'Intrusion Attempt Detected',
        description: 'Suspicious network activity',
        metadata: {},
        seenCount: 1,
        firstSeenAt: new Date('2023-01-01T11:00:00Z'),
        lastSeenAt: new Date('2023-01-01T11:00:00Z'),
        defenderIncidentId: null,
        defenderAlertId: null,
        defenderSeverity: null,
        threatName: null,
        affectedDevice: null,
        affectedUser: null,
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2023-01-01T11:00:00Z'),
        createdAt: new Date('2023-01-01T11:00:00Z'),
        updatedAt: new Date('2023-01-01T11:00:00Z'),
    },
];

const mockApiResponse = {
    success: true,
    data: {
        alerts: mockAlerts,
        pagination: {
            page: 1,
            limit: 50,
            total: 2,
        },
        metadata: {
            unassignedCount: 2,
            assignedCount: 0,
            queue: 'all',
        },
    },
};

describe('AllAlertsTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockApiResponse,
        });
    });

    it('renders the All Alerts tab with correct title and description', async () => {
        await act(async () => {
            render(<AllAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByText('All Alerts (Triage Queue)')).toBeInTheDocument();
            expect(screen.getByText('2 unassigned alerts awaiting triage')).toBeInTheDocument();
        });
    });

    it('fetches alerts on mount with correct API parameters', async () => {
        await act(async () => {
            render(<AllAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/alerts-incidents/alerts?queue=all&page=1&limit=50'),
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );
        });
    });

    it('displays alerts in the triage queue', async () => {
        await act(async () => {
            render(<AllAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('alert-triage-queue')).toBeInTheDocument();
            expect(screen.getByText('Alert count: 2')).toBeInTheDocument();
            expect(screen.getByText('Critical Malware Detected')).toBeInTheDocument();
            expect(screen.getByText('Intrusion Attempt Detected')).toBeInTheDocument();
        });
    });

    it('handles alert assignment correctly', async () => {
        const assignResponse = {
            success: true,
            data: {
                message: 'Alert assigned successfully',
                alertId: 'alert-1',
                assignedTo: 'user-1',
            },
        };

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => assignResponse,
            });

        // Mock window.alert
        const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => { });

        await act(async () => {
            render(<AllAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
        });

        const assignButtons = screen.getAllByRole('button', { name: 'Assign to Me' });
        const assignButton = assignButtons[0]; // Get the first one

        await act(async () => {
            fireEvent.click(assignButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/alerts-incidents/alerts/alert-1/assign',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );
        });

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                'Alert assigned successfully! It has been moved to your My Alerts queue.'
            );
        });

        alertSpy.mockRestore();
    });

    it('handles assignment errors correctly', async () => {
        const errorResponse = {
            success: false,
            error: {
                code: 'ASSIGNMENT_FAILED',
                message: 'Alert already assigned',
            },
        };

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockApiResponse,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => errorResponse,
            });

        // Mock window.alert
        const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => { });

        await act(async () => {
            render(<AllAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
        });

        const assignButtons = screen.getAllByRole('button', { name: 'Assign to Me' });
        const assignButton = assignButtons[0]; // Get the first one

        await act(async () => {
            fireEvent.click(assignButton);
        });

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                'Failed to assign alert: Alert already assigned'
            );
        });

        alertSpy.mockRestore();
    });

    it('applies filters correctly', async () => {
        await act(async () => {
            render(<AllAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('alert-filters-panel')).toBeInTheDocument();
        });

        const filterButton = screen.getByRole('button', { name: 'Filter Critical' });

        await act(async () => {
            fireEvent.click(filterButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('severity=critical'),
                expect.any(Object)
            );
        });
    });

    it('handles refresh correctly', async () => {
        await act(async () => {
            render(<AllAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
        });

        const refreshButton = screen.getByRole('button', { name: 'Refresh' });

        await act(async () => {
            fireEvent.click(refreshButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2); // Initial load + refresh
        });
    });

    it('displays loading state correctly', async () => {
        // Mock a slow response to catch loading state
        (global.fetch as jest.Mock).mockImplementation(() =>
            new Promise(resolve =>
                setTimeout(() => resolve({
                    ok: true,
                    json: async () => mockApiResponse,
                }), 100)
            )
        );

        render(<AllAlertsTab tenantId="tenant-1" />);

        // Should show loading spinner initially
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('handles API errors correctly', async () => {
        const errorResponse = {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
            },
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => errorResponse,
        });

        await act(async () => {
            render(<AllAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByText('Internal server error')).toBeInTheDocument();
        });
    });

    it('does not fetch alerts when tenantId is not provided', async () => {
        await act(async () => {
            render(<AllAlertsTab tenantId="" />);
        });

        expect(global.fetch).not.toHaveBeenCalled();
    });
});