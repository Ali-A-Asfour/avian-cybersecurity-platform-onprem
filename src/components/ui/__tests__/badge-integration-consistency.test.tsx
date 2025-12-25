/**
 * Integration tests for consistent badge usage across the platform
 * Tests badge rendering in Security Tickets, Helpdesk Tickets, Alerts, Dashboards, and Filters
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import components that should use the new badge system
import { SeverityBadge } from '../SeverityBadge';
import { StatusBadge } from '../StatusBadge';

// Mock data for testing
const mockSecurityTicket = {
    id: 'SEC-001',
    title: 'Security Breach Detected',
    severity: 'critical' as const,
    status: 'investigating' as const,
};

const mockHelpdeskTicket = {
    id: 'HELP-001',
    title: 'Password Reset Request',
    priority: 'high' as const,
    status: 'in_progress' as const,
};

const mockAlert = {
    id: 'ALERT-001',
    title: 'Malware Detection',
    severity: 'high' as const,
    status: 'new' as const,
};

describe('Badge Integration Consistency Tests', () => {
    describe('Security Tickets Badge Usage', () => {
        test('renders severity badges with correct styling', () => {
            render(
                <div data-testid="security-ticket">
                    <SeverityBadge severity={mockSecurityTicket.severity} size="sm" />
                    <StatusBadge status={mockSecurityTicket.status} size="sm" />
                </div>
            );

            const container = screen.getByTestId('security-ticket');
            const badges = container.querySelectorAll('span');

            expect(badges).toHaveLength(2);

            // Verify severity badge has higher visual weight
            const severityBadge = badges[0];
            expect(severityBadge).toHaveClass('font-semibold');
            expect(severityBadge).toHaveClass('bg-red-700');
            expect(severityBadge).toHaveClass('text-white');
            expect(severityBadge).toHaveClass('rounded-full');

            // Verify status badge has lower visual weight
            const statusBadge = badges[1];
            expect(statusBadge).toHaveClass('font-normal');
            expect(statusBadge).toHaveClass('text-white');
            expect(statusBadge).toHaveClass('rounded-full');
        });

        test('uses standard severity colors for security tickets', () => {
            const severities: Array<'critical' | 'high' | 'medium' | 'low' | 'info'> =
                ['critical', 'high', 'medium', 'low', 'info'];

            severities.forEach(severity => {
                const { container } = render(
                    <SeverityBadge severity={severity} size="sm" />
                );

                const badge = container.querySelector('span');
                expect(badge).toBeTruthy();
                expect(badge).toHaveClass('text-white');
                expect(badge).toHaveClass('rounded-full');

                // Verify no brown/earth-tone colors
                expect(badge?.className).not.toMatch(/brown|tan|beige|amber-800|yellow-800/);
            });
        });
    });

    describe('Helpdesk Tickets Badge Usage', () => {
        test('renders priority badges using severity badge component', () => {
            render(
                <div data-testid="helpdesk-ticket">
                    <SeverityBadge severity={mockHelpdeskTicket.priority} size="sm" />
                    <StatusBadge status={mockHelpdeskTicket.status} size="sm" />
                </div>
            );

            const container = screen.getByTestId('helpdesk-ticket');
            const badges = container.querySelectorAll('span');

            expect(badges).toHaveLength(2);

            // Priority should use SeverityBadge for visual consistency
            const priorityBadge = badges[0];
            expect(priorityBadge).toHaveClass('font-semibold');
            expect(priorityBadge).toHaveClass('text-white');
            expect(priorityBadge).toHaveClass('rounded-full');
        });

        test('maintains consistent styling across ticket views', () => {
            const statuses: Array<'new' | 'open' | 'in_progress' | 'resolved' | 'closed'> =
                ['new', 'open', 'in_progress', 'resolved', 'closed'];

            statuses.forEach(status => {
                const { container } = render(
                    <StatusBadge status={status} size="sm" />
                );

                const badge = container.querySelector('span');
                expect(badge).toBeTruthy();
                expect(badge).toHaveClass('text-white');
                expect(badge).toHaveClass('rounded-full');
                expect(badge).toHaveClass('font-normal'); // Lower visual weight than severity
            });
        });
    });

    describe('Alerts and Dashboards Badge Usage', () => {
        test('renders alert severity badges consistently', () => {
            render(
                <div data-testid="alert-dashboard">
                    <SeverityBadge severity={mockAlert.severity} size="sm" />
                    <StatusBadge status={mockAlert.status} size="sm" />
                </div>
            );

            const container = screen.getByTestId('alert-dashboard');
            const badges = container.querySelectorAll('span');

            expect(badges).toHaveLength(2);

            // Alert severity should use same styling as security tickets
            const severityBadge = badges[0];
            expect(severityBadge).toHaveClass('font-semibold');
            expect(severityBadge).toHaveClass('bg-orange-700'); // High severity uses orange-700
            expect(severityBadge).toHaveClass('text-white');
        });

        test('updates dashboard legend components consistently', () => {
            const legendItems = [
                { severity: 'critical' as const, count: 5 },
                { severity: 'high' as const, count: 12 },
                { severity: 'medium' as const, count: 8 },
                { severity: 'low' as const, count: 3 },
            ];

            render(
                <div data-testid="dashboard-legend">
                    {legendItems.map((item, index) => (
                        <div key={index} className="legend-item">
                            <SeverityBadge severity={item.severity} size="sm" />
                            <span>{item.count}</span>
                        </div>
                    ))}
                </div>
            );

            const container = screen.getByTestId('dashboard-legend');
            const badges = container.querySelectorAll('span[class*="bg-"]');

            expect(badges).toHaveLength(4);

            // All legend badges should have consistent styling
            badges.forEach(badge => {
                expect(badge).toHaveClass('text-white');
                expect(badge).toHaveClass('rounded-full');
                expect(badge).toHaveClass('font-semibold');
            });
        });
    });

    describe('Filters and Dropdowns Badge Usage', () => {
        test('renders filter option badges consistently', () => {
            const filterOptions = [
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
            ];

            render(
                <div data-testid="filter-options">
                    {filterOptions.map((option, index) => (
                        <div key={index} className="filter-option">
                            <SeverityBadge
                                severity={option.value as 'critical' | 'high' | 'medium'}
                                size="sm"
                            />
                            <span>{option.label}</span>
                        </div>
                    ))}
                </div>
            );

            const container = screen.getByTestId('filter-options');
            const badges = container.querySelectorAll('span[class*="bg-"]');

            expect(badges).toHaveLength(3);

            // Filter badges should match main badge styling
            badges.forEach(badge => {
                expect(badge).toHaveClass('text-white');
                expect(badge).toHaveClass('rounded-full');
                expect(badge).toHaveClass('font-semibold');
            });
        });

        test('ensures consistent badge styling in form elements', () => {
            const statusOptions: Array<'new' | 'investigating' | 'resolved'> =
                ['new', 'investigating', 'resolved'];

            render(
                <div data-testid="form-elements">
                    {statusOptions.map((status, index) => (
                        <label key={index} className="form-option">
                            <input type="checkbox" />
                            <StatusBadge status={status} size="sm" />
                        </label>
                    ))}
                </div>
            );

            const container = screen.getByTestId('form-elements');
            const badges = container.querySelectorAll('span[class*="bg-"]');

            expect(badges).toHaveLength(3);

            // Form element badges should have consistent styling
            badges.forEach(badge => {
                expect(badge).toHaveClass('text-white');
                expect(badge).toHaveClass('rounded-full');
                expect(badge).toHaveClass('font-normal'); // Status badges have lower weight
            });
        });
    });

    describe('Cross-Platform Consistency', () => {
        test('maintains visual hierarchy across all areas', () => {
            render(
                <div data-testid="cross-platform">
                    <div className="security-section">
                        <SeverityBadge severity="critical" size="md" />
                        <StatusBadge status="investigating" size="md" />
                    </div>
                    <div className="helpdesk-section">
                        <SeverityBadge severity="high" size="md" />
                        <StatusBadge status="in_progress" size="md" />
                    </div>
                    <div className="alert-section">
                        <SeverityBadge severity="medium" size="md" />
                        <StatusBadge status="new" size="md" />
                    </div>
                </div>
            );

            const container = screen.getByTestId('cross-platform');
            const severityBadges = container.querySelectorAll('.security-section span:first-child, .helpdesk-section span:first-child, .alert-section span:first-child');
            const statusBadges = container.querySelectorAll('.security-section span:last-child, .helpdesk-section span:last-child, .alert-section span:last-child');

            // All severity badges should have higher visual weight
            severityBadges.forEach(badge => {
                expect(badge).toHaveClass('font-semibold');
            });

            // All status badges should have lower visual weight
            statusBadges.forEach(badge => {
                expect(badge).toHaveClass('font-normal');
            });
        });

        test('eliminates brown/earth-tone colors across all badge types', () => {
            const allSeverities: Array<'critical' | 'high' | 'medium' | 'low' | 'info'> =
                ['critical', 'high', 'medium', 'low', 'info'];
            const allStatuses: Array<'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled'> =
                ['new', 'open', 'investigating', 'in_progress', 'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'];

            // Test all severity badges
            allSeverities.forEach(severity => {
                const { container } = render(<SeverityBadge severity={severity} size="sm" />);
                const badge = container.querySelector('span');

                // Verify no brown/earth-tone colors
                expect(badge?.className).not.toMatch(/brown|tan|beige|amber-800|yellow-800|orange-800/);
                expect(badge?.className).not.toMatch(/bg-yellow-100|bg-amber-100/);
            });

            // Test all status badges
            allStatuses.forEach(status => {
                const { container } = render(<StatusBadge status={status} size="sm" />);
                const badge = container.querySelector('span');

                // Verify no brown/earth-tone colors
                expect(badge?.className).not.toMatch(/brown|tan|beige|amber-800|yellow-800/);
            });
        });

        test('ensures solid backgrounds and white text across all contexts', () => {
            render(
                <div data-testid="styling-consistency">
                    <SeverityBadge severity="critical" size="sm" />
                    <SeverityBadge severity="high" size="md" />
                    <SeverityBadge severity="medium" size="lg" />
                    <StatusBadge status="new" size="sm" />
                    <StatusBadge status="investigating" size="md" />
                    <StatusBadge status="resolved" size="lg" />
                </div>
            );

            const container = screen.getByTestId('styling-consistency');
            const allBadges = container.querySelectorAll('span');

            allBadges.forEach(badge => {
                // Verify solid backgrounds (no gradients or opacity)
                expect(badge).toHaveClass('text-white');
                expect(badge).toHaveClass('rounded-full');

                // Verify no gradient or opacity classes
                expect(badge.className).not.toMatch(/gradient|opacity|bg-opacity|from-|to-/);

                // Verify solid background colors
                expect(badge.className).toMatch(/bg-(red|orange|yellow|green|blue|violet|slate|amber)-(500|600|700)/);
            });
        });
    });
});