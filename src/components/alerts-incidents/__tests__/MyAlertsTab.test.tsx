import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MyAlertsTab } from '../MyAlertsTab';
import { SecurityAlert } from '@/types/alerts-incidents';

// Mock the child components
jest.mock('../AlertInvestigationQueue', () => ({
    AlertInvestigationQueue: ({ alerts, onInvestigateAlert }: any) => (
        <div data-testid="alert-investigation-queue">
            <div>Alert count: {alerts?.length || 0}</div>
            {(alerts || []).map((alert: SecurityAlert) => (
                <div key={alert.id} data-testid={`alert-${alert.id}`}>
                    <span>{alert.title}</span>
                    {alert.status === 'assigned' && (
                        <button onClick={() => onInvestigateAlert(alert.id)}>
                            Investigate
                        </button>
                    )}
                    {(alert.status === 'escalated' || alert.status === 'investigating') && (
                        <span>Moved to Security Tickets</span>
                    )}
                </div>
            ))}
        </div>
    ),
}));

jest.mock('../AlertFiltersPanel', () => ({
    AlertFiltersPanel: ({ filters, onFiltersChange }: any) => (
        <div data-testid="alert-filters-panel">
            <button onClick={() => onFiltersChange({ severity: 'critical' })}>
                Filter Critical
            </button>
        </div>
    ),
}));

// No modal mocks needed - simplified workflow

// Mock fetch
global.fetch = jest.fn();

const mockAlerts: SecurityAlert[] = [
    {
        id: 'alert-1',
        tenantId: 'tenant-1',
        sourceSystem: 'edr',
        sourceId: 'edr-alert-1',
        alertType: 'malware',
        classification: 'malware_detected',
        severity: 'critical',
        title: 'Critical Malware Detected',
        description: 'Malware detected on endpoint',
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
        status: 'assigned',
        assignedTo: 'user-1',
        assignedAt: new Date('2023-01-01T10:05:00Z'),
        detectedAt: new Date('2023-01-01T10:00:00Z'),
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T10:05:00Z'),
    },
    {
        id: 'alert-2',
        tenantId: 'tenant-1',
        sourceSystem: 'firewall',
        sourceId: 'fw-alert-2',
        alertType: 'intrusion',
        classification: 'intrusion_attempt',
        severity: 'high',
        title: 'Intrusion Attempt Detected',
        description: 'Suspicious network activity detected',
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
        status: 'investigating',
        assignedTo: 'user-1',
        assignedAt: new Date('2023-01-01T11:05:00Z'),
        detectedAt: new Date('2023-01-01T11:00:00Z'),
        createdAt: new Date('2023-01-01T11:00:00Z'),
        updatedAt: new Date('2023-01-01T11:05:00Z'),
    },
];

describe('MyAlertsTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    alerts: mockAlerts,
                    pagination: { page: 1, limit: 50, total: 2 },
                    metadata: { unassignedCount: 0, assignedCount: 2, queue: 'my' },
                },
            }),
        });
    });

    it('renders the My Alerts tab with correct title and description', async () => {
        await act(async () => {
            render(<MyAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByText('My Alerts (Investigation Queue)')).toBeInTheDocument();
            expect(screen.getByText('2 alerts assigned to you for investigation')).toBeInTheDocument();
        });
    });

    it('fetches alerts on mount with correct API parameters', async () => {
        await act(async () => {
            render(<MyAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/alerts-incidents/alerts?queue=my&page=1&limit=50'),
                expect.objectContaining({
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        });
    });

    it('displays alerts in the investigation queue', async () => {
        await act(async () => {
            render(<MyAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('alert-investigation-queue')).toBeInTheDocument();
            expect(screen.getByText('Alert count: 2')).toBeInTheDocument();
            expect(screen.getByText('Critical Malware Detected')).toBeInTheDocument();
            expect(screen.getByText('Intrusion Attempt Detected')).toBeInTheDocument();
        });
    });

    it('handles alert investigation correctly - creates security ticket', async () => {
        (fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    data: {
                        alerts: mockAlerts,
                        pagination: { page: 1, limit: 50, total: 2 },
                        metadata: { unassignedCount: 0, assignedCount: 2, queue: 'my' },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    data: {
                        message: 'Security ticket created successfully',
                        incidentId: 'incident-123',
                        status: 'escalated'
                    }
                }),
            });

        await act(async () => {
            render(<MyAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
        });

        const investigateButton = screen.getByRole('button', { name: 'Investigate' });

        await act(async () => {
            fireEvent.click(investigateButton);
        });

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                '/api/alerts-incidents/alerts/alert-1/investigate',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        });
    });

    it('shows status for alerts moved to security tickets', async () => {
        await act(async () => {
            render(<MyAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('alert-alert-2')).toBeInTheDocument();
        });

        // Alert with investigating status should show "Moved to Security Tickets"
        expect(screen.getByText('Moved to Security Tickets')).toBeInTheDocument();
    });

    it('applies filters correctly', async () => {
        await act(async () => {
            render(<MyAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('alert-filters-panel')).toBeInTheDocument();
        });

        const filterButton = screen.getByRole('button', { name: 'Filter Critical' });

        await act(async () => {
            fireEvent.click(filterButton);
        });

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('severity=critical'),
                expect.any(Object)
            );
        });
    });

    it('handles refresh correctly', async () => {
        await act(async () => {
            render(<MyAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
        });

        const refreshButton = screen.getByRole('button', { name: 'Refresh' });

        await act(async () => {
            fireEvent.click(refreshButton);
        });

        // Should make another API call
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });

    it('handles API errors correctly', async () => {
        (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

        await act(async () => {
            render(<MyAlertsTab tenantId="tenant-1" />);
        });

        await waitFor(() => {
            expect(screen.getByText('API Error')).toBeInTheDocument();
        });
    });

    it('does not fetch alerts when tenantId is not provided', async () => {
        await act(async () => {
            render(<MyAlertsTab tenantId="" />);
        });

        expect(fetch).not.toHaveBeenCalled();
    });
});