import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KPICard } from '../KPICard';

describe('KPICard Component', () => {
    const mockOnClick = jest.fn();

    beforeEach(() => {
        mockOnClick.mockClear();
    });

    it('should render with title, value, and subtitle', () => {
        render(
            <KPICard
                title="Critical Alerts"
                value={42}
                subtitle="Last 24 hours"
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('Last 24 hours')).toBeInTheDocument();
    });

    it('should display loading skeleton when loading is true', () => {
        render(
            <KPICard
                title="Critical Alerts"
                value={42}
                subtitle="Last 24 hours"
                onClick={mockOnClick}
                loading={true}
            />
        );

        // Check for loading skeleton elements
        const skeletonElements = document.querySelectorAll('.animate-pulse .bg-neutral-700');
        expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('should display error state when error is provided', () => {
        const errorMessage = 'Failed to load data';
        render(
            <KPICard
                title="Critical Alerts"
                value={42}
                subtitle="Last 24 hours"
                onClick={mockOnClick}
                error={errorMessage}
            />
        );

        expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        render(
            <KPICard
                title="Critical Alerts"
                value={42}
                subtitle="Last 24 hours"
                onClick={mockOnClick}
            />
        );

        const card = screen.getByRole('button');
        fireEvent.click(card);

        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Enter key is pressed', () => {
        render(
            <KPICard
                title="Critical Alerts"
                value={42}
                subtitle="Last 24 hours"
                onClick={mockOnClick}
            />
        );

        const card = screen.getByRole('button');
        fireEvent.keyDown(card, { key: 'Enter' });

        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Space key is pressed', () => {
        render(
            <KPICard
                title="Critical Alerts"
                value={42}
                subtitle="Last 24 hours"
                onClick={mockOnClick}
            />
        );

        const card = screen.getByRole('button');
        fireEvent.keyDown(card, { key: ' ' });

        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should display trend indicator when trend and trendValue are provided', () => {
        render(
            <KPICard
                title="Critical Alerts"
                value={42}
                subtitle="Last 24 hours"
                onClick={mockOnClick}
                trend="up"
                trendValue={15}
            />
        );

        // Check for trend elements separately since they're in different text nodes
        expect(screen.getByText(/↗/)).toBeInTheDocument();
        expect(screen.getByText(/15/)).toBeInTheDocument();
        expect(screen.getByText(/%/)).toBeInTheDocument();
    });

    it('should have proper hover and focus styles', () => {
        render(
            <KPICard
                title="Critical Alerts"
                value={42}
                subtitle="Last 24 hours"
                onClick={mockOnClick}
            />
        );

        const card = screen.getByRole('button');
        expect(card).toHaveClass('cursor-pointer');
        expect(card).toHaveClass('transition-all');
        expect(card).toHaveClass('hover:border-primary-500');
        expect(card).toHaveClass('focus:ring-2');
    });
});