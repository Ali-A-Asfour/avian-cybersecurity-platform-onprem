import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
    it('renders with valid status', () => {
        render(<StatusBadge status="new" />);
        expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('applies correct CSS classes for status colors', () => {
        render(<StatusBadge status="open" />);
        const badge = screen.getByText('Open');
        expect(badge).toHaveClass('bg-blue-600', 'text-white', 'rounded-full');
    });

    it('applies correct size classes', () => {
        render(<StatusBadge status="resolved" size="lg" />);
        const badge = screen.getByText('Resolved');
        expect(badge).toHaveClass('px-3', 'py-1.5', 'text-sm', 'font-normal');
    });

    it('renders fallback for invalid status', () => {
        // @ts-expect-error Testing invalid status
        render(<StatusBadge status="invalid" />);
        expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        render(<StatusBadge status="escalated" className="custom-class" />);
        const badge = screen.getByText('Escalated');
        expect(badge).toHaveClass('custom-class');
    });

    it('uses font-normal for lower visual weight', () => {
        render(<StatusBadge status="investigating" />);
        const badge = screen.getByText('Investigating');
        expect(badge).toHaveClass('font-normal');
    });
});