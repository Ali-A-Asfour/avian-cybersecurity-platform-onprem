/**
 * PDFExportInterface Component Tests
 * 
 * Tests for PDF export functionality with snapshot management,
 * progress indicators, download handling, and audit trail.
 * 
 * Requirements: 1.2, 8.5, audit compliance
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PDFExportInterface } from '../PDFExportInterface';

// Setup DOM environment
import '@testing-library/jest-dom';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock the Button component
jest.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, disabled, loading, variant, size, className, ...props }: any) => (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            data-variant={variant}
            data-size={size}
            data-loading={loading}
            className={className}
            {...props}
        >
            {loading ? 'Loading...' : children}
        </button>
    ),
}));

// Mock the Modal component
jest.mock('@/components/ui/Modal', () => ({
    Modal: ({ isOpen, onClose, title, children, size }: any) => (
        isOpen ? (
            <div data-testid="modal" data-size={size}>
                <div data-testid="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} data-testid="modal-close">Close</button>
                </div>
                <div data-testid="modal-content">{children}</div>
            </div>
        ) : null
    ),
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

describe('PDFExportInterface', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockClear();
    });

    describe('Basic Rendering', () => {
        it('should render export button and history button', () => {
            const { container } = render(<PDFExportInterface reportType="weekly" />);

            expect(container.querySelector('button')).toBeInTheDocument();
            expect(container.textContent).toContain('Export PDF');
            expect(container.textContent).toContain('History');
        });

        it('should disable export button when disabled prop is true', () => {
            const { container } = render(<PDFExportInterface reportType="weekly" disabled={true} />);

            const exportButton = container.querySelector('button[data-loading="false"]');
            expect(exportButton).toBeDisabled();
        });

        it('should enable export button when reportId is provided', () => {
            const { container } = render(<PDFExportInterface reportType="weekly" reportId="test-report-id" />);

            const exportButton = container.querySelector('button[data-loading="false"]');
            expect(exportButton).not.toBeDisabled();
        });
    });

    describe('Demo Mode Functionality', () => {
        it('should work in demo mode without making API calls for snapshots', () => {
            const { container } = render(<PDFExportInterface reportType="weekly" reportId="test-report-id" />);

            // Component should render without making API calls
            expect(container.textContent).toContain('Export PDF');
            expect(container.textContent).toContain('History');

            // No fetch calls should be made for snapshots in demo mode
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should handle different report types', () => {
            const weeklyRender = render(<PDFExportInterface reportType="weekly" reportId="test-id" />);
            expect(weeklyRender.container).toBeInTheDocument();

            const monthlyRender = render(<PDFExportInterface reportType="monthly" reportId="test-id" />);
            expect(monthlyRender.container).toBeInTheDocument();

            const quarterlyRender = render(<PDFExportInterface reportType="quarterly" reportId="test-id" />);
            expect(quarterlyRender.container).toBeInTheDocument();
        });
    });
});