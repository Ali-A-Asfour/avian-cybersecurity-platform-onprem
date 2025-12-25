import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { IntegrationHealthPanel } from '../IntegrationHealthPanel';

/**
 * **Feature: tenant-admin-dashboard, Property 6: Integration Status Visual Mapping**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

describe('IntegrationHealthPanel Property Tests', () => {
    beforeEach(() => {
        cleanup();
    });

    // Simple date generator that avoids invalid dates
    const dateGenerator = fc.integer({ min: 0, max: Date.now() }).map(timestamp => new Date(timestamp).toISOString());

    it('Property 6: Integration Status Visual Mapping - should handle all valid status values', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('healthy', 'warning', 'error'),
                fc.constantFrom('microsoft', 'sonicwall', 'edr-antivirus', 'avian-agents'),
                dateGenerator,
                (status, serviceName, lastSync) => {
                    cleanup(); // Clean up before each property test run

                    const integration = { serviceName, status, lastSync };
                    const mockOnClick = jest.fn();

                    render(
                        <IntegrationHealthPanel
                            integrations={[integration]}
                            onIntegrationClick={mockOnClick}
                        />
                    );

                    const serviceButton = screen.getByRole('button');

                    // Verify status color mapping
                    const statusIndicator = serviceButton.querySelector('.w-3.h-3.rounded-full');
                    expect(statusIndicator).toBeInTheDocument();

                    const expectedColorClass = getExpectedStatusColor(status);
                    expect(statusIndicator).toHaveClass(expectedColorClass);

                    // Verify status text mapping
                    const expectedStatusText = getExpectedStatusText(status);
                    expect(serviceButton).toHaveTextContent(expectedStatusText);

                    // Verify service name mapping
                    const expectedDisplayName = getExpectedDisplayName(serviceName);
                    expect(serviceButton).toHaveTextContent(expectedDisplayName);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 6: Integration Status Visual Mapping - status color consistency for healthy status', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('microsoft', 'sonicwall', 'edr-antivirus', 'avian-agents'),
                dateGenerator,
                (serviceName, lastSync) => {
                    cleanup();

                    const integration = { serviceName, status: 'healthy' as const, lastSync };
                    const mockOnClick = jest.fn();

                    render(
                        <IntegrationHealthPanel
                            integrations={[integration]}
                            onIntegrationClick={mockOnClick}
                        />
                    );

                    const serviceButton = screen.getByRole('button');
                    const statusIndicator = serviceButton.querySelector('.w-3.h-3.rounded-full');

                    expect(statusIndicator).toHaveClass('bg-success-500');
                    expect(serviceButton).toHaveTextContent('Healthy');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 6: Integration Status Visual Mapping - status color consistency for warning status', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('microsoft', 'sonicwall', 'edr-antivirus', 'avian-agents'),
                dateGenerator,
                (serviceName, lastSync) => {
                    cleanup();

                    const integration = { serviceName, status: 'warning' as const, lastSync };
                    const mockOnClick = jest.fn();

                    render(
                        <IntegrationHealthPanel
                            integrations={[integration]}
                            onIntegrationClick={mockOnClick}
                        />
                    );

                    const serviceButton = screen.getByRole('button');
                    const statusIndicator = serviceButton.querySelector('.w-3.h-3.rounded-full');

                    expect(statusIndicator).toHaveClass('bg-warning-500');
                    expect(serviceButton).toHaveTextContent('Warning');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 6: Integration Status Visual Mapping - status color consistency for error status', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('microsoft', 'sonicwall', 'edr-antivirus', 'avian-agents'),
                dateGenerator,
                (serviceName, lastSync) => {
                    cleanup();

                    const integration = { serviceName, status: 'error' as const, lastSync };
                    const mockOnClick = jest.fn();

                    render(
                        <IntegrationHealthPanel
                            integrations={[integration]}
                            onIntegrationClick={mockOnClick}
                        />
                    );

                    const serviceButton = screen.getByRole('button');
                    const statusIndicator = serviceButton.querySelector('.w-3.h-3.rounded-full');

                    expect(statusIndicator).toHaveClass('bg-error-500');
                    expect(serviceButton).toHaveTextContent('Error');
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Helper functions to match the component's internal logic
function getExpectedStatusColor(status: string): string {
    switch (status) {
        case 'healthy':
            return 'bg-success-500';
        case 'warning':
            return 'bg-warning-500';
        case 'error':
            return 'bg-error-500';
        default:
            return 'bg-neutral-500';
    }
}

function getExpectedStatusText(status: string): string {
    switch (status) {
        case 'healthy':
            return 'Healthy';
        case 'warning':
            return 'Warning';
        case 'error':
            return 'Error';
        default:
            return 'Unknown';
    }
}

function getExpectedDisplayName(serviceName: string): string {
    switch (serviceName) {
        case 'microsoft':
            return 'Microsoft';
        case 'sonicwall':
            return 'SonicWall';
        case 'edr-antivirus':
            return 'EDR/Antivirus';
        case 'avian-agents':
            return 'AVIAN Agents';
        default:
            return serviceName;
    }
}