import React from 'react';
import { render, screen } from '@testing-library/react';
import { WorkflowGuidance } from '../WorkflowGuidance';
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

describe('WorkflowGuidance', () => {
    it('renders workflow guidance for assigned alert', () => {
        const alert = createMockAlert('assigned');

        render(<WorkflowGuidance alert={alert} />);

        expect(screen.getByText('Simplified Alert Workflow')).toBeInTheDocument();
        expect(screen.getByText('1. Assigned')).toBeInTheDocument();
        expect(screen.getByText('2. Create Security Ticket')).toBeInTheDocument();
        expect(screen.getByText('← Click "Investigate"')).toBeInTheDocument();
    });

    it('shows correct status message for assigned alert', () => {
        const alert = createMockAlert('assigned');

        render(<WorkflowGuidance alert={alert} />);

        expect(screen.getByText(/Click "Investigate" to create a security ticket and move to Security Incidents tab/)).toBeInTheDocument();
    });

    it('shows correct status message for investigating alert', () => {
        const alert = createMockAlert('investigating');

        render(<WorkflowGuidance alert={alert} />);

        expect(screen.getByText(/Security ticket created - check Security Incidents tab for investigation and resolution/)).toBeInTheDocument();
    });

    it('shows simplified workflow notice for assigned alerts', () => {
        const alert = createMockAlert('assigned');

        render(<WorkflowGuidance alert={alert} />);

        expect(screen.getByText(/Click "Investigate" to automatically create a security ticket and move this alert to the Security Incidents tab/)).toBeInTheDocument();
    });

    it('shows security ticket created notice for investigating alerts', () => {
        const alert = createMockAlert('investigating');

        render(<WorkflowGuidance alert={alert} />);

        expect(screen.getByText(/This alert has been moved to the Security Incidents tab. All investigation, resolution, and escalation actions are now available there/)).toBeInTheDocument();
    });

    it('shows correct workflow step indicators for different alert statuses', () => {
        // Test assigned status - should show step 2 as current
        const assignedAlert = createMockAlert('assigned');
        const { rerender } = render(<WorkflowGuidance alert={assignedAlert} />);

        expect(screen.getByText('← Click "Investigate"')).toBeInTheDocument();

        // Test investigating status - should show completed
        const investigatingAlert = createMockAlert('investigating');
        rerender(<WorkflowGuidance alert={investigatingAlert} />);

        expect(screen.queryByText('← Click "Investigate"')).not.toBeInTheDocument();

        // Test escalated status
        const escalatedAlert = createMockAlert('escalated');
        rerender(<WorkflowGuidance alert={escalatedAlert} />);

        expect(screen.getByText(/Security ticket created - check Security Incidents tab for investigation and resolution/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const alert = createMockAlert('assigned');

        const { container } = render(<WorkflowGuidance alert={alert} className="custom-class" />);

        const workflowContainer = container.firstChild as HTMLElement;
        expect(workflowContainer).toHaveClass('custom-class');
    });
});