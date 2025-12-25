import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertEscalationModal } from '../AlertEscalationModal';
import { SecurityAlert } from '@/types/alerts-incidents';

// Mock alert data
const createMockAlert = (status: SecurityAlert['status']): SecurityAlert => ({
    id: 'alert-1',
    tenantId: 'tenant-1',
    sourceSystem: 'edr',
    sourceId: 'edr-alert-123',
    alertType: 'malware_detection',
    classification: 'malware',
    severity: 'high',
    title: 'Test Security Alert',
    description: 'Test alert description',
    metadata: {},
    seenCount: 1,
    firstSeenAt: new Date('2025-01-01T10:00:00Z'),
    lastSeenAt: new Date('2025-01-01T10:00:00Z'),
    defenderIncidentId: null,
    defenderAlertId: null,
    defenderSeverity: null,
    threatName: null,
    affectedDevice: null,
    affectedUser: null,
    status,
    assignedTo: status !== 'open' ? 'user-1' : null,
    assignedAt: status !== 'open' ? new Date('2025-01-01T10:00:00Z') : null,
    detectedAt: new Date('2025-01-01T10:00:00Z'),
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
});

// Mock window.alert
const mockAlert = jest.fn();
Object.defineProperty(window, 'alert', {
    writable: true,
    value: mockAlert,
});

describe('Workflow Enforcement Integration', () => {
    const mockOnClose = jest.fn();
    const mockOnEscalate = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('AlertEscalationModal Workflow Enforcement', () => {
        it('prevents escalation for assigned alerts', async () => {
            const assignedAlert = createMockAlert('assigned');

            render(
                <AlertEscalationModal
                    alert={assignedAlert}
                    isOpen={true}
                    onClose={mockOnClose}
                    onEscalate={mockOnEscalate}
                />
            );

            // Should show escalation not available warning
            expect(screen.getByText('Escalation Not Available')).toBeInTheDocument();
            expect(screen.getByText(/Investigation must be started before this alert can be escalated/)).toBeInTheDocument();

            // Should show workflow progress
            expect(screen.getByText('Workflow Status')).toBeInTheDocument();
            expect(screen.getByText(/Current status:/)).toBeInTheDocument();
            expect(screen.getAllByText(/Assigned/)).toHaveLength(3); // Multiple instances of "Assigned"

            // Escalation button should be disabled
            const escalateButton = screen.getByRole('button', { name: /Investigation Required/ });
            expect(escalateButton).toBeDisabled();

            // Try to click disabled button - should not trigger anything
            fireEvent.click(escalateButton);

            // onEscalate should not be called since button is disabled
            expect(mockOnEscalate).not.toHaveBeenCalled();

            // No alert should be shown since the button is disabled and prevents the action
            expect(mockAlert).not.toHaveBeenCalled();
        });

        it('allows escalation for investigating alerts', async () => {
            const investigatingAlert = createMockAlert('investigating');
            mockOnEscalate.mockResolvedValue(undefined);

            render(
                <AlertEscalationModal
                    alert={investigatingAlert}
                    isOpen={true}
                    onClose={mockOnClose}
                    onEscalate={mockOnEscalate}
                />
            );

            // Should NOT show escalation not available warning
            expect(screen.queryByText('Escalation Not Available')).not.toBeInTheDocument();

            // Should show escalation info instead
            expect(screen.getByText('Escalating to Security Incident')).toBeInTheDocument();

            // Should show workflow progress with investigating status
            expect(screen.getByText(/Current status:/)).toBeInTheDocument();
            expect(screen.getByText(/Investigating/)).toBeInTheDocument();

            // Escalation button should be enabled
            const escalateButton = screen.getByRole('button', { name: /Escalate to Incident/ });
            expect(escalateButton).not.toBeDisabled();

            // Submit form - should work
            fireEvent.click(escalateButton);

            await waitFor(() => {
                expect(mockOnEscalate).toHaveBeenCalledWith({
                    alertId: 'alert-1',
                    tenantId: 'tenant-1',
                    incidentTitle: expect.any(String),
                    incidentDescription: expect.any(String),
                });
            });

            // Should not show alert message
            expect(mockAlert).not.toHaveBeenCalled();
        });

        it('shows correct workflow progress indicators', () => {
            const assignedAlert = createMockAlert('assigned');

            render(
                <AlertEscalationModal
                    alert={assignedAlert}
                    isOpen={true}
                    onClose={mockOnClose}
                    onEscalate={mockOnEscalate}
                />
            );

            // Check workflow progress indicators
            const workflowSection = screen.getByText('Workflow Status').closest('div');
            expect(workflowSection).toBeInTheDocument();

            // Should show assigned step as completed (green)
            // Should show investigate step as not completed (gray)
            // Should show escalate step as not completed (gray)
            expect(screen.getAllByText('Assigned')).toHaveLength(2); // One in workflow, one in status
            expect(screen.getByText('Investigate')).toBeInTheDocument();
            expect(screen.getByText('Escalate')).toBeInTheDocument();
        });

        it('prevents escalation for already escalated alerts', () => {
            const escalatedAlert = createMockAlert('escalated');

            render(
                <AlertEscalationModal
                    alert={escalatedAlert}
                    isOpen={true}
                    onClose={mockOnClose}
                    onEscalate={mockOnEscalate}
                />
            );

            // Should show escalation not available warning
            expect(screen.getByText('Escalation Not Available')).toBeInTheDocument();
            expect(screen.getByText(/This alert has already been escalated to a security incident/)).toBeInTheDocument();

            // Escalation button should be disabled
            const escalateButton = screen.getByRole('button', { name: /Investigation Required/ });
            expect(escalateButton).toBeDisabled();
        });

        it('prevents escalation for resolved alerts', () => {
            const resolvedAlert = createMockAlert('closed_benign');

            render(
                <AlertEscalationModal
                    alert={resolvedAlert}
                    isOpen={true}
                    onClose={mockOnClose}
                    onEscalate={mockOnEscalate}
                />
            );

            // Should show escalation not available warning
            expect(screen.getByText('Escalation Not Available')).toBeInTheDocument();
            expect(screen.getByText(/This alert has already been resolved and cannot be escalated/)).toBeInTheDocument();

            // Escalation button should be disabled
            const escalateButton = screen.getByRole('button', { name: /Investigation Required/ });
            expect(escalateButton).toBeDisabled();
        });
    });
});