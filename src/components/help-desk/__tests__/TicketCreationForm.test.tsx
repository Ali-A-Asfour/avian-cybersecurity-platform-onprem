/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketCreationForm } from '../TicketCreationForm';

// Mock the ValidationMessage component
jest.mock('../ValidationMessage', () => ({
    ValidationMessage: ({ message }: { message?: string }) =>
        message ? <div data-testid="validation-error">{message}</div> : null
}));

describe('TicketCreationForm', () => {
    const mockOnSubmit = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the form with all required fields', () => {
        render(
            <TicketCreationForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        // Check for main form elements
        expect(screen.getByText('Get Help from IT Support')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g., Can\'t print to the office printer')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Describe what you were trying to do/)).toBeInTheDocument();

        // Check for impact level options
        expect(screen.getByText('I can\'t work at all')).toBeInTheDocument();
        expect(screen.getByText('This is slowing me down')).toBeInTheDocument();
        expect(screen.getByText('It\'s a minor issue')).toBeInTheDocument();

        // Check for contact method options
        expect(screen.getByText('Email updates')).toBeInTheDocument();
        expect(screen.getByText('Phone call')).toBeInTheDocument();

        // Check for submit button
        expect(screen.getByText('Submit Request')).toBeInTheDocument();
    });

    it('shows phone number field when phone contact is selected', async () => {
        const user = userEvent.setup();

        render(
            <TicketCreationForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        // Initially phone number field should not be visible
        expect(screen.queryByPlaceholderText('Your phone number')).not.toBeInTheDocument();

        // Click on phone contact option
        await user.click(screen.getByText('Phone call'));

        // Now phone number field should be visible
        expect(screen.getByPlaceholderText('Your phone number')).toBeInTheDocument();
    });

    it('validates required fields on submit', async () => {
        const user = userEvent.setup();

        render(
            <TicketCreationForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        // Try to submit without filling required fields
        await user.click(screen.getByText('Submit Request'));

        // Should show validation errors
        await waitFor(() => {
            expect(screen.getByText('Please provide a short title for your request')).toBeInTheDocument();
            expect(screen.getByText('Please describe what help you need')).toBeInTheDocument();
        });

        // Should not call onSubmit
        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates phone number when phone contact is selected', async () => {
        const user = userEvent.setup();

        render(
            <TicketCreationForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        // Fill required fields
        await user.type(screen.getByPlaceholderText('e.g., Can\'t print to the office printer'), 'Test title');
        await user.type(screen.getByPlaceholderText(/Describe what you were trying to do/), 'Test description');

        // Select phone contact
        await user.click(screen.getByText('Phone call'));

        // Try to submit without phone number
        await user.click(screen.getByText('Submit Request'));

        // Should show phone number validation error
        await waitFor(() => {
            expect(screen.getByText('Phone number is required when you select phone contact')).toBeInTheDocument();
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('submits form with valid data', async () => {
        const user = userEvent.setup();

        render(
            <TicketCreationForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        // Fill required fields
        await user.type(screen.getByPlaceholderText('e.g., Can\'t print to the office printer'), 'Test title');
        await user.type(screen.getByPlaceholderText(/Describe what you were trying to do/), 'Test description');

        // Select impact level (medium is default, but let's click critical)
        await user.click(screen.getByText('I can\'t work at all'));

        // Add device ID
        await user.type(screen.getByPlaceholderText('e.g., PC-RECEP-01, LAPTOP-JOHN-02'), 'PC-TEST-01');

        // Submit form
        await user.click(screen.getByText('Submit Request'));

        // Should call onSubmit with correct data
        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith({
                title: 'Test title',
                description: 'Test description',
                impactLevel: 'critical',
                deviceId: 'PC-TEST-01',
                contactMethod: 'email',
                phoneNumber: '',
                attachments: [],
            });
        });
    });

    it('calls onCancel when cancel button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <TicketCreationForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        await user.click(screen.getByText('Cancel'));

        expect(mockOnCancel).toHaveBeenCalled();
    });

    it('shows loading state when loading prop is true', () => {
        render(
            <TicketCreationForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
                loading={true}
            />
        );

        // Submit button should show loading text
        expect(screen.getByText('Submitting...')).toBeInTheDocument();

        // Form fields should be disabled
        expect(screen.getByPlaceholderText('e.g., Can\'t print to the office printer')).toBeDisabled();
    });

    it('validates device ID format', async () => {
        const user = userEvent.setup();

        render(
            <TicketCreationForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        // Fill required fields
        await user.type(screen.getByPlaceholderText('e.g., Can\'t print to the office printer'), 'Test title');
        await user.type(screen.getByPlaceholderText(/Describe what you were trying to do/), 'Test description');

        // Enter invalid device ID
        await user.type(screen.getByPlaceholderText('e.g., PC-RECEP-01, LAPTOP-JOHN-02'), 'invalid device id!');

        // Submit form
        await user.click(screen.getByText('Submit Request'));

        // Should show device ID validation error
        await waitFor(() => {
            expect(screen.getByText('Device ID can only contain letters, numbers, hyphens, and underscores')).toBeInTheDocument();
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });
});