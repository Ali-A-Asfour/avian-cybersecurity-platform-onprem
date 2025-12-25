/**
 * Test suite for badge readability in tables and dense lists
 * Requirements: 4.2, 4.3, 4.5 - Verify readability in tables and dense lists
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SeverityBadge } from '../SeverityBadge';
import { StatusBadge } from '../StatusBadge';

describe('Badge Readability in Different Contexts', () => {
    describe('SeverityBadge in table context', () => {
        it('should render with solid background and white text in table', () => {
            render(
                <table>
                    <tbody>
                        <tr>
                            <td>
                                <SeverityBadge severity="critical" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            );

            const badge = screen.getByText('CRITICAL');
            expect(badge).toBeInTheDocument();
            expect(badge.className).toContain('bg-red-700');
            expect(badge.className).toContain('text-white');
            expect(badge.className).toContain('rounded-full');
            expect(badge.className).not.toContain('gradient');
            expect(badge.className).not.toContain('bg-opacity');
        });

        it('should render all severity levels with solid backgrounds in table', () => {
            const severityLevels: Array<'critical' | 'high' | 'medium' | 'low' | 'info'> =
                ['critical', 'high', 'medium', 'low', 'info'];

            render(
                <table>
                    <tbody>
                        {severityLevels.map(severity => (
                            <tr key={severity}>
                                <td>
                                    <SeverityBadge severity={severity} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );

            severityLevels.forEach(severity => {
                const expectedText = severity.toUpperCase();
                const badge = screen.getByText(expectedText);

                expect(badge).toBeInTheDocument();
                expect(badge.className).toContain('text-white');
                expect(badge.className).toContain('rounded-full');
                expect(badge.className).toMatch(/bg-\w+-\d+/); // Solid background pattern
                expect(badge.className).not.toContain('gradient');
                expect(badge.className).not.toContain('bg-opacity');
            });
        });
    });

    describe('StatusBadge in list context', () => {
        it('should render with solid background and white text in list', () => {
            render(
                <ul>
                    <li>
                        <StatusBadge status="new" />
                    </li>
                </ul>
            );

            const badge = screen.getByText('New');
            expect(badge).toBeInTheDocument();
            expect(badge.className).toContain('bg-blue-600');
            expect(badge.className).toContain('text-white');
            expect(badge.className).toContain('rounded-full');
            expect(badge.className).not.toContain('gradient');
            expect(badge.className).not.toContain('bg-opacity');
        });

        it('should render all status types with solid backgrounds in list', () => {
            const statusTypes: Array<'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled'> =
                ['new', 'open', 'investigating', 'in_progress', 'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'];

            render(
                <ul>
                    {statusTypes.map(status => (
                        <li key={status}>
                            <StatusBadge status={status} />
                        </li>
                    ))}
                </ul>
            );

            const expectedLabels = {
                new: 'New',
                open: 'Open',
                investigating: 'Investigating',
                in_progress: 'In Progress',
                awaiting_response: 'Awaiting Response',
                escalated: 'Escalated',
                resolved: 'Resolved',
                closed: 'Closed',
                canceled: 'Canceled'
            };

            statusTypes.forEach(status => {
                const expectedText = expectedLabels[status];
                const badge = screen.getByText(expectedText);

                expect(badge).toBeInTheDocument();
                expect(badge.className).toContain('text-white');
                expect(badge.className).toContain('rounded-full');
                expect(badge.className).toMatch(/bg-\w+-\d+/); // Solid background pattern
                expect(badge.className).not.toContain('gradient');
                expect(badge.className).not.toContain('bg-opacity');
            });
        });
    });

    describe('Badge readability in dense layouts', () => {
        it('should maintain readability when multiple badges are in close proximity', () => {
            render(
                <div className="space-y-1">
                    <div className="flex space-x-2">
                        <SeverityBadge severity="critical" size="sm" />
                        <StatusBadge status="new" size="sm" />
                    </div>
                    <div className="flex space-x-2">
                        <SeverityBadge severity="high" size="sm" />
                        <StatusBadge status="investigating" size="sm" />
                    </div>
                    <div className="flex space-x-2">
                        <SeverityBadge severity="medium" size="sm" />
                        <StatusBadge status="resolved" size="sm" />
                    </div>
                </div>
            );

            // Verify all badges are rendered with proper styling
            const criticalBadge = screen.getByText('CRITICAL');
            const newBadge = screen.getByText('New');
            const highBadge = screen.getByText('HIGH');
            const investigatingBadge = screen.getByText('Investigating');
            const mediumBadge = screen.getByText('MEDIUM');
            const resolvedBadge = screen.getByText('Resolved');

            [criticalBadge, newBadge, highBadge, investigatingBadge, mediumBadge, resolvedBadge].forEach(badge => {
                expect(badge).toBeInTheDocument();
                expect(badge.className).toContain('text-white');
                expect(badge.className).toContain('rounded-full');
                expect(badge.className).toMatch(/bg-\w+-\d+/);
                expect(badge.className).not.toContain('gradient');
                expect(badge.className).not.toContain('bg-opacity');
            });
        });

        it('should maintain visual hierarchy between severity and status badges', () => {
            render(
                <div className="flex items-center space-x-2">
                    <SeverityBadge severity="critical" />
                    <StatusBadge status="new" />
                </div>
            );

            const severityBadge = screen.getByText('CRITICAL');
            const statusBadge = screen.getByText('New');

            // Severity badge should have higher visual weight (font-semibold vs font-normal)
            expect(severityBadge.className).toContain('font-semibold');
            expect(statusBadge.className).toContain('font-normal');

            // Both should have solid backgrounds and white text
            expect(severityBadge.className).toContain('bg-red-700');
            expect(severityBadge.className).toContain('text-white');
            expect(statusBadge.className).toContain('bg-blue-600');
            expect(statusBadge.className).toContain('text-white');
        });
    });

    describe('Badge fallback rendering', () => {
        it('should render fallback badge with solid background and white text', () => {
            // Test invalid severity
            render(<SeverityBadge severity={'invalid' as any} />);

            const fallbackBadge = screen.getByText('UNKNOWN');
            expect(fallbackBadge).toBeInTheDocument();
            expect(fallbackBadge.className).toContain('bg-gray-500');
            expect(fallbackBadge.className).toContain('text-white');
            expect(fallbackBadge.className).toContain('rounded-full');
        });
    });
});