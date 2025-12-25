/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketConfirmation } from '../TicketConfirmation';

describe('TicketConfirmation', () => {
    const defaultProps = {
        ticketNumber: 'TKT-12345',
        impactLevel: 'medium' as const,
        contactMethod: 'email' as const,
        userEmail: 'user@example.com',
    };

    const mockOnCreateAnother = jest.fn();
    const mockOnViewTicket = jest.fn();
    const mockOnBackToHelpDesk = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders confirmation with ticket number', () => {
        render(
            <TicketConfirmation
                {...defaultProps}
                onCreateAnother={mockOnCreateAnother}
                onViewTicket={mockOnViewTicket}
                onBackToHelpDesk={mockOnBackToHelpDesk}
            />
        );

        expect(screen.getByText('Request Submitted Successfully!')).toBeInTheDocument();
        expect(screen.getByText('TKT-12345')).toBeInTheDocument();
        expect(screen.getByText('Save this number for your records')).toBeInTheDocument();
    });

    it('shows correct response time for different impact levels', () => {
        const { rerender } = render(
            <TicketConfirmation
                {...defaultProps}
                impactLevel="critical"
            />
        );

        expect(screen.getByText('We\'ll respond within 1 hour')).toBeInTheDocument();

        rerender(
            <TicketConfirmation
                {...defaultProps}
                impactLevel="medium"
            />
        );

        expect(screen.getByText('We\'ll respond within 4 hours')).toBeInTheDocument();

        rerender(
            <TicketConfirmation
                {...defaultProps}
                impactLevel="low"
            />
        );

        expect(screen.getByText('We\'ll respond within 1 business day')).toBeInTheDocument();
    });

    it('shows email contact information', () => {
        render(
            <TicketConfirmation
                {...defaultProps}
                contactMethod="email"
                userEmail="test@example.com"
            />
        );

        expect(screen.getByText('How We\'ll Contact You')).toBeInTheDocument();
        expect(screen.getByText(/We'll send updates via email to test@example.com/)).toBeInTheDocument();
    });

    it('shows phone contact information', () => {
        render(
            <TicketConfirmation
                {...defaultProps}
                contactMethod="phone"
                phoneNumber="555-123-4567"
            />
        );

        expect(screen.getByText('How We\'ll Contact You')).toBeInTheDocument();
        expect(screen.getByText(/We'll send updates via phone to 555-123-4567/)).toBeInTheDocument();
    });

    it('shows what happens next information', () => {
        render(<TicketConfirmation {...defaultProps} />);

        expect(screen.getByText('What happens next?')).toBeInTheDocument();
        expect(screen.getByText('A help desk analyst will review your request')).toBeInTheDocument();
        expect(screen.getByText('They\'ll contact you using your preferred method')).toBeInTheDocument();
        expect(screen.getByText('We\'ll work together to resolve your issue')).toBeInTheDocument();
        expect(screen.getByText('You\'ll receive updates throughout the process')).toBeInTheDocument();
    });

    it('shows important notes', () => {
        render(<TicketConfirmation {...defaultProps} />);

        expect(screen.getByText('Important Notes:')).toBeInTheDocument();
        expect(screen.getByText(/Keep your ticket number \(TKT-12345\) for reference/)).toBeInTheDocument();
        expect(screen.getByText(/Reply to any emails from IT support/)).toBeInTheDocument();
    });

    it('calls onBackToHelpDesk when back button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <TicketConfirmation
                {...defaultProps}
                onBackToHelpDesk={mockOnBackToHelpDesk}
            />
        );

        await user.click(screen.getByText('Back to Help Desk'));

        expect(mockOnBackToHelpDesk).toHaveBeenCalled();
    });

    it('calls onViewTicket when view ticket button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <TicketConfirmation
                {...defaultProps}
                onViewTicket={mockOnViewTicket}
            />
        );

        await user.click(screen.getByText('View Ticket'));

        expect(mockOnViewTicket).toHaveBeenCalledWith('TKT-12345');
    });

    it('calls onCreateAnother when create another button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <TicketConfirmation
                {...defaultProps}
                onCreateAnother={mockOnCreateAnother}
            />
        );

        await user.click(screen.getByText('Submit Another Request'));

        expect(mockOnCreateAnother).toHaveBeenCalled();
    });

    it('shows emergency contact information', () => {
        render(<TicketConfirmation {...defaultProps} />);

        expect(screen.getByText('Need immediate help?')).toBeInTheDocument();
        expect(screen.getByText('Call the IT Help Desk at')).toBeInTheDocument();
        expect(screen.getByText('(555) 012-3456')).toBeInTheDocument();
    });

    it('renders without optional callback props', () => {
        render(<TicketConfirmation {...defaultProps} />);

        // Should still render the main content
        expect(screen.getByText('Request Submitted Successfully!')).toBeInTheDocument();
        expect(screen.getByText('TKT-12345')).toBeInTheDocument();
    });
});