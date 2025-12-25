/**
 * Tests for ReportsNavigation Component
 * 
 * Tests the navigation interface for Weekly, Monthly, and Quarterly reports
 * with role-based access control functionality.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ReportsNavigation } from '../ReportsNavigation';

describe('ReportsNavigation', () => {
    it('renders all report type tabs', () => {
        render(<ReportsNavigation />);

        expect(screen.getByText('Weekly Reports')).toBeInTheDocument();
        expect(screen.getByText('Monthly Reports')).toBeInTheDocument();
        expect(screen.getByText('Quarterly Reports')).toBeInTheDocument();
    });

    it('highlights the current report type', () => {
        render(<ReportsNavigation currentReportType="monthly" />);

        const monthlyTab = screen.getByRole('tab', { name: /Switch to Monthly Reports/ });
        expect(monthlyTab).toHaveClass('border-primary-500');
        expect(monthlyTab).toHaveClass('text-primary-600');
    });

    it('calls onReportTypeChange when a tab is clicked', () => {
        const mockOnChange = jest.fn();
        render(
            <ReportsNavigation
                currentReportType="weekly"
                onReportTypeChange={mockOnChange}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: /Switch to Quarterly Reports/ }));
        expect(mockOnChange).toHaveBeenCalledWith('quarterly');
    });

    it('shows description for current report type', () => {
        render(<ReportsNavigation currentReportType="weekly" />);

        expect(screen.getByText('Security activities and alerts digest for the past week')).toBeInTheDocument();
    });

    it('updates description when report type changes', () => {
        const { rerender } = render(<ReportsNavigation currentReportType="weekly" />);

        expect(screen.getByText('Security activities and alerts digest for the past week')).toBeInTheDocument();

        rerender(<ReportsNavigation currentReportType="quarterly" />);

        expect(screen.getByText('Executive summary and business-focused security posture')).toBeInTheDocument();
    });

    it('applies custom className when provided', () => {
        const { container } = render(<ReportsNavigation className="custom-class" />);

        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('handles no current report type gracefully', () => {
        render(<ReportsNavigation />);

        // Should not show description section when no report type is selected
        expect(screen.queryByText('Security activities and alerts digest for the past week')).not.toBeInTheDocument();
    });

    it('has proper accessibility attributes', () => {
        render(<ReportsNavigation currentReportType="weekly" />);

        const nav = screen.getByRole('tablist', { name: 'Report Types' });
        expect(nav).toBeInTheDocument();

        const activeTab = screen.getByRole('tab', { name: /Switch to Weekly Reports/ });
        expect(activeTab).toHaveAttribute('aria-current', 'page');
        expect(activeTab).toHaveAttribute('aria-selected', 'true');
        expect(activeTab).toHaveAttribute('tabIndex', '0');
    });

    it('supports keyboard navigation', () => {
        const mockOnChange = jest.fn();
        render(
            <ReportsNavigation
                currentReportType="weekly"
                onReportTypeChange={mockOnChange}
            />
        );

        const monthlyTab = screen.getByRole('tab', { name: /Switch to Monthly Reports/ });

        // Test Enter key
        fireEvent.keyDown(monthlyTab, { key: 'Enter' });
        expect(mockOnChange).toHaveBeenCalledWith('monthly');

        // Test Space key
        fireEvent.keyDown(monthlyTab, { key: ' ' });
        expect(mockOnChange).toHaveBeenCalledWith('monthly');

        expect(mockOnChange).toHaveBeenCalledTimes(2);
    });
});