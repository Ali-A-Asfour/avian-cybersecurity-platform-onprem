/**
 * Property-based tests for badge visual hierarchy enforcement
 * **Feature: badge-system-standardization, Property 5: Visual hierarchy enforcement**
 * **Validates: Requirements 7.1, 7.3, 7.5, 8.2**
 */

import { render } from '@testing-library/react';
import fc from 'fast-check';
import { SeverityBadge } from '../SeverityBadge';
import { StatusBadge } from '../StatusBadge';
import { SEVERITY_COLORS, STATUS_COLORS, SEVERITY_SIZES, STATUS_SIZES } from '@/lib/badge-colors';

// Property-based test configuration
const PBT_CONFIG = { numRuns: 100 };

describe('Badge Visual Hierarchy Property Tests', () => {
    test('**Feature: badge-system-standardization, Property 5: Visual hierarchy enforcement**', () => {
        fc.assert(fc.property(
            fc.constantFrom('critical', 'high', 'medium', 'low', 'info'),
            fc.constantFrom('new', 'open', 'investigating', 'in_progress', 'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'),
            fc.constantFrom('sm', 'md', 'lg'),
            (severity, status, size) => {
                // Render both badge types with the same size
                const { container: severityContainer } = render(
                    <SeverityBadge severity={severity as any} size={size as any} />
                );
                const { container: statusContainer } = render(
                    <StatusBadge status={status as any} size={size as any} />
                );

                const severityBadge = severityContainer.querySelector('span');
                const statusBadge = statusContainer.querySelector('span');

                expect(severityBadge).toBeTruthy();
                expect(statusBadge).toBeTruthy();

                // Extract computed styles to compare visual weight
                const severityClasses = severityBadge!.className;
                const statusClasses = statusBadge!.className;

                // Severity badges should have font-semibold or font-medium (higher weight)
                const severityHasFontWeight = severityClasses.includes('font-semibold') || severityClasses.includes('font-medium');

                // Status badges should have font-normal (lower weight)
                const statusHasFontWeight = statusClasses.includes('font-normal');

                // Visual hierarchy: severity badges should have higher font weight than status badges
                expect(severityHasFontWeight).toBe(true);
                expect(statusHasFontWeight).toBe(true);

                // Check that severity badges use larger padding/sizing for the same size category
                const severitySizeClass = SEVERITY_SIZES[size as keyof typeof SEVERITY_SIZES];
                const statusSizeClass = STATUS_SIZES[size as keyof typeof STATUS_SIZES];

                expect(severityClasses).toContain(severitySizeClass.split(' ')[0]); // px-3 vs px-2.5
                expect(statusClasses).toContain(statusSizeClass.split(' ')[0]);

                // For medium size, severity should have larger padding than status
                if (size === 'md') {
                    expect(severitySizeClass).toContain('px-3'); // Severity: px-3
                    expect(statusSizeClass).toContain('px-2.5'); // Status: px-2.5
                }
            }
        ), PBT_CONFIG);
    });

    test('severity badges maintain visual priority across all sizes', () => {
        fc.assert(fc.property(
            fc.constantFrom('critical', 'high', 'medium', 'low', 'info'),
            fc.constantFrom('sm', 'md', 'lg'),
            (severity, size) => {
                const { container } = render(
                    <SeverityBadge severity={severity as any} size={size as any} />
                );

                const badge = container.querySelector('span');
                expect(badge).toBeTruthy();

                const classes = badge!.className;

                // All severity badges should have font-semibold for visual priority
                expect(classes).toContain('font-semibold');

                // All severity badges should use rounded-full styling
                expect(classes).toContain('rounded-full');

                // All severity badges should have white text
                expect(classes).toContain('text-white');
            }
        ), PBT_CONFIG);
    });

    test('status badges maintain lower visual weight across all sizes', () => {
        fc.assert(fc.property(
            fc.constantFrom('new', 'open', 'investigating', 'in_progress', 'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'),
            fc.constantFrom('sm', 'md', 'lg'),
            (status, size) => {
                const { container } = render(
                    <StatusBadge status={status as any} size={size as any} />
                );

                const badge = container.querySelector('span');
                expect(badge).toBeTruthy();

                const classes = badge!.className;

                // All status badges should have font-normal for lower visual weight
                expect(classes).toContain('font-normal');

                // All status badges should use rounded-full styling
                expect(classes).toContain('rounded-full');

                // All status badges should have white text
                expect(classes).toContain('text-white');
            }
        ), PBT_CONFIG);
    });
});