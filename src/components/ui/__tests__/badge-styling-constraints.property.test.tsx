/**
 * Property-based tests for consistent badge styling constraints
 * **Feature: badge-system-standardization, Property 7: Consistent styling constraints**
 * **Validates: Requirements 8.4, 8.5**
 */

import { render } from '@testing-library/react';
import fc from 'fast-check';
import { SeverityBadge } from '../SeverityBadge';
import { StatusBadge } from '../StatusBadge';

// Property-based test configuration
const PBT_CONFIG = { numRuns: 100 };

describe('Badge Styling Constraints Property Tests', () => {
    test('**Feature: badge-system-standardization, Property 7: Consistent styling constraints**', () => {
        fc.assert(fc.property(
            fc.constantFrom('critical', 'high', 'medium', 'low', 'info'),
            fc.constantFrom('new', 'open', 'investigating', 'in_progress', 'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'),
            fc.constantFrom('sm', 'md', 'lg'),
            (severity, status, size) => {
                // Test SeverityBadge styling constraints
                const { container: severityContainer } = render(
                    <SeverityBadge severity={severity as any} size={size as any} />
                );

                // Test StatusBadge styling constraints
                const { container: statusContainer } = render(
                    <StatusBadge status={status as any} size={size as any} />
                );

                const severityBadge = severityContainer.querySelector('span');
                const statusBadge = statusContainer.querySelector('span');

                expect(severityBadge).toBeTruthy();
                expect(statusBadge).toBeTruthy();

                const severityClasses = severityBadge!.className;
                const statusClasses = statusBadge!.className;

                // Requirement 8.4: Use solid backgrounds with no gradients or opacity effects
                // Both badges should have solid background colors (bg-* classes)
                expect(severityClasses).toMatch(/bg-\w+-\d+/); // Matches bg-red-700, bg-blue-600, etc.
                expect(statusClasses).toMatch(/bg-\w+-\d+/);

                // Should not contain gradient or opacity classes
                expect(severityClasses).not.toContain('bg-gradient');
                expect(severityClasses).not.toContain('opacity-');
                expect(statusClasses).not.toContain('bg-gradient');
                expect(statusClasses).not.toContain('opacity-');

                // Requirement 8.5: Use rounded-full styling for consistent pill-shaped appearance
                expect(severityClasses).toContain('rounded-full');
                expect(statusClasses).toContain('rounded-full');

                // Should not use other border radius classes
                expect(severityClasses).not.toContain('rounded-md');
                expect(severityClasses).not.toContain('rounded-lg');
                expect(severityClasses).not.toContain('rounded-xl');
                expect(statusClasses).not.toContain('rounded-md');
                expect(statusClasses).not.toContain('rounded-lg');
                expect(statusClasses).not.toContain('rounded-xl');

                // Both badges should have white text for consistency
                expect(severityClasses).toContain('text-white');
                expect(statusClasses).toContain('text-white');

                // Both badges should use inline-flex for consistent layout
                expect(severityClasses).toContain('inline-flex');
                expect(statusClasses).toContain('inline-flex');

                // Both badges should center their content
                expect(severityClasses).toContain('items-center');
                expect(statusClasses).toContain('items-center');
            }
        ), PBT_CONFIG);
    });

    test('severity badges maintain consistent solid styling across all variants', () => {
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

                // Must have solid background color
                expect(classes).toMatch(/bg-\w+-\d+/);

                // Must not have transparency or gradient effects
                expect(classes).not.toContain('bg-opacity');
                expect(classes).not.toContain('bg-gradient');
                expect(classes).not.toContain('opacity-');

                // Must use rounded-full styling
                expect(classes).toContain('rounded-full');

                // Must have white text
                expect(classes).toContain('text-white');

                // Must use consistent layout classes
                expect(classes).toContain('inline-flex');
                expect(classes).toContain('items-center');
                expect(classes).toContain('font-semibold');
            }
        ), PBT_CONFIG);
    });

    test('status badges maintain consistent solid styling across all variants', () => {
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

                // Must have solid background color
                expect(classes).toMatch(/bg-\w+-\d+/);

                // Must not have transparency or gradient effects
                expect(classes).not.toContain('bg-opacity');
                expect(classes).not.toContain('bg-gradient');
                expect(classes).not.toContain('opacity-');

                // Must use rounded-full styling
                expect(classes).toContain('rounded-full');

                // Must have white text
                expect(classes).toContain('text-white');

                // Must use consistent layout classes
                expect(classes).toContain('inline-flex');
                expect(classes).toContain('items-center');
                expect(classes).toContain('font-normal');
            }
        ), PBT_CONFIG);
    });

    test('invalid badge types render consistent fallback styling', () => {
        fc.assert(fc.property(
            fc.constantFrom('invalid', 'unknown', 'bad-value', 'test', '123'),
            fc.constantFrom('invalid', 'unknown', 'bad-value', 'test', '456'),
            (invalidSeverity, invalidStatus) => {
                // Test invalid severity
                const { container: severityContainer } = render(
                    <SeverityBadge severity={invalidSeverity as any} />
                );

                // Test invalid status
                const { container: statusContainer } = render(
                    <StatusBadge status={invalidStatus as any} />
                );

                const severityFallback = severityContainer.querySelector('span');
                const statusFallback = statusContainer.querySelector('span');

                expect(severityFallback).toBeTruthy();
                expect(statusFallback).toBeTruthy();

                const severityClasses = severityFallback!.className;
                const statusClasses = statusFallback!.className;

                // Fallback badges should maintain consistent styling
                expect(severityClasses).toContain('bg-gray-500');
                expect(severityClasses).toContain('text-white');
                expect(severityClasses).toContain('rounded-full');
                expect(severityClasses).toContain('inline-flex');
                expect(severityClasses).toContain('items-center');

                expect(statusClasses).toContain('bg-gray-500');
                expect(statusClasses).toContain('text-white');
                expect(statusClasses).toContain('rounded-full');
                expect(statusClasses).toContain('inline-flex');
                expect(statusClasses).toContain('items-center');

                // Fallback badges should display "UNKNOWN"
                expect(severityFallback!.textContent).toBe('UNKNOWN');
                expect(statusFallback!.textContent).toBe('UNKNOWN');
            }
        ), PBT_CONFIG);
    });
});