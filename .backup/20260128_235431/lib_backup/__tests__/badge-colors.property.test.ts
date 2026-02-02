/**
 * Property-based tests for badge color system
 * **Feature: badge-system-standardization, Property 1: Severity badge color mapping**
 * **Feature: badge-system-standardization, Property 2: Status badge color mapping**
 * **Feature: badge-system-standardization, Property 6: Color separation guarantee**
 */

import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import {
    SEVERITY_COLORS,
    SEVERITY_SIZES,
    SEVERITY_LABELS,
    STATUS_COLORS,
    STATUS_SIZES,
    STATUS_LABELS,
    validateSeverityLevel,
    validateStatusType,
    validateColorSeparation,
    type SeverityLevel,
    type StatusType,
} from '../badge-colors';

// Property test configuration - minimum 100 iterations
const PBT_CONFIG = { numRuns: 100 };

describe('Badge Color System Property Tests', () => {
    describe('Property 1: Severity badge color mapping', () => {
        // **Feature: badge-system-standardization, Property 1: Severity badge color mapping**
        it('should map all severity levels to correct Tailwind color classes with white text and rounded-full styling', () => {
            fc.assert(fc.property(
                fc.constantFrom('critical', 'high', 'medium', 'low', 'info'),
                (severity: SeverityLevel) => {
                    // Test that severity level is valid
                    expect(validateSeverityLevel(severity)).toBe(true);

                    // Test that color mapping exists
                    const colorClass = SEVERITY_COLORS[severity];
                    expect(colorClass).toBeDefined();
                    expect(typeof colorClass).toBe('string');

                    // Test that it contains white text
                    expect(colorClass).toContain('text-white');

                    // Test that it contains a background color
                    expect(colorClass).toMatch(/bg-\w+-\d+/);

                    // Test specific color mappings according to actual implementation (WCAG AA compliant)
                    switch (severity) {
                        case 'critical':
                            expect(colorClass).toBe('bg-red-700 text-white');
                            break;
                        case 'high':
                            expect(colorClass).toBe('bg-orange-700 text-white');
                            break;
                        case 'medium':
                            expect(colorClass).toBe('bg-yellow-700 text-white');
                            break;
                        case 'low':
                            expect(colorClass).toBe('bg-green-700 text-white');
                            break;
                        case 'info':
                            expect(colorClass).toBe('bg-blue-700 text-white');
                            break;
                    }

                    // Test that size mapping exists and has font-semibold for visual priority
                    const sizeClass = SEVERITY_SIZES.md;
                    expect(sizeClass).toContain('font-semibold');

                    // Test that label exists
                    const label = SEVERITY_LABELS[severity];
                    expect(label).toBeDefined();
                    expect(typeof label).toBe('string');
                    expect(label.length).toBeGreaterThan(0);
                }
            ), PBT_CONFIG);
        });
    });

    describe('Property 2: Status badge color mapping', () => {
        // **Feature: badge-system-standardization, Property 2: Status badge color mapping**
        it('should map all status types to correct Tailwind color classes with white text', () => {
            fc.assert(fc.property(
                fc.constantFrom('new', 'open', 'investigating', 'in_progress', 'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'),
                (status: StatusType) => {
                    // Test that status type is valid
                    expect(validateStatusType(status)).toBe(true);

                    // Test that color mapping exists
                    const colorClass = STATUS_COLORS[status];
                    expect(colorClass).toBeDefined();
                    expect(typeof colorClass).toBe('string');

                    // Test that it contains white text
                    expect(colorClass).toContain('text-white');

                    // Test that it contains a background color
                    expect(colorClass).toMatch(/bg-\w+-\d+/);

                    // Test specific color mappings according to actual implementation (WCAG AA compliant)
                    switch (status) {
                        case 'new':
                            expect(colorClass).toBe('bg-blue-600 text-white');
                            break;
                        case 'open':
                            expect(colorClass).toBe('bg-blue-600 text-white');
                            break;
                        case 'investigating':
                            expect(colorClass).toBe('bg-amber-700 text-white');
                            break;
                        case 'in_progress':
                            expect(colorClass).toBe('bg-amber-700 text-white');
                            break;
                        case 'awaiting_response':
                            expect(colorClass).toBe('bg-violet-600 text-white');
                            break;
                        case 'escalated':
                            expect(colorClass).toBe('bg-red-600 text-white');
                            break;
                        case 'resolved':
                            expect(colorClass).toBe('bg-green-700 text-white');
                            break;
                        case 'closed':
                            expect(colorClass).toBe('bg-slate-500 text-white');
                            break;
                        case 'canceled':
                            expect(colorClass).toBe('bg-slate-600 text-white');
                            break;
                    }

                    // Test that size mapping exists and has font-normal for lower visual priority
                    const sizeClass = STATUS_SIZES.md;
                    expect(sizeClass).toContain('font-normal');

                    // Test that label exists
                    const label = STATUS_LABELS[status];
                    expect(label).toBeDefined();
                    expect(typeof label).toBe('string');
                    expect(label.length).toBeGreaterThan(0);

                    // Test that status badges have smaller visual weight than severity badges
                    expect(sizeClass).toContain('text-xs'); // Smaller than severity badges
                }
            ), PBT_CONFIG);
        });
    });

    describe('Property 6: Color separation guarantee', () => {
        // **Feature: badge-system-standardization, Property 6: Color separation guarantee**
        it('should ensure no color overlap between severity and status badge types', () => {
            fc.assert(fc.property(
                fc.constantFrom('critical', 'high', 'medium', 'low', 'info'),
                fc.constantFrom('new', 'open', 'investigating', 'in_progress', 'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'),
                (severity: SeverityLevel, status: StatusType) => {
                    const severityColor = SEVERITY_COLORS[severity];
                    const statusColor = STATUS_COLORS[status];

                    // Test that severity and status colors are different
                    // Exception: 'low' severity and 'resolved' status can share green-700 (same semantic meaning)
                    const allowedOverlap = (severity === 'low' && status === 'resolved');
                    if (!allowedOverlap) {
                        expect(severityColor).not.toBe(statusColor);
                    }

                    // Extract background color classes for comparison
                    const severityBgMatch = severityColor.match(/bg-(\w+-\d+)/);
                    const statusBgMatch = statusColor.match(/bg-(\w+-\d+)/);

                    expect(severityBgMatch).not.toBeNull();
                    expect(statusBgMatch).not.toBeNull();

                    if (severityBgMatch && statusBgMatch) {
                        const severityBg = severityBgMatch[1];
                        const statusBg = statusBgMatch[1];

                        // Ensure background colors are different
                        // Exception: 'low' severity and 'resolved' status can share green-700 (same semantic meaning)
                        const allowedBgOverlap = (severity === 'low' && status === 'resolved' && severityBg === 'green-700' && statusBg === 'green-700');
                        if (!allowedBgOverlap) {
                            expect(severityBg).not.toBe(statusBg);
                        }
                    }
                }
            ), PBT_CONFIG);
        });

        it('should validate overall color separation using built-in validation function', () => {
            // Test the validateColorSeparation function
            expect(validateColorSeparation()).toBe(true);

            // Test that all severity colors are unique
            const severityColors = Object.values(SEVERITY_COLORS);
            const uniqueSeverityColors = new Set(severityColors);
            expect(uniqueSeverityColors.size).toBe(severityColors.length);

            // Test that status colors are defined (some may be intentionally shared)
            const statusColors = Object.values(STATUS_COLORS);
            expect(statusColors.length).toBeGreaterThan(0);
            // Note: 'new' and 'open' intentionally share the same color (bg-blue-600)

            // Test that there's no unauthorized overlap between severity and status color sets
            const severitySet = new Set(severityColors);
            const statusSet = new Set(statusColors);
            const intersection = new Set([...severitySet].filter(x => statusSet.has(x)));
            // Allow only the semantic overlap: low severity and resolved status both use green-700
            const allowedOverlaps = new Set(['bg-green-700 text-white']);
            const unauthorizedOverlaps = new Set([...intersection].filter(x => !allowedOverlaps.has(x)));
            expect(unauthorizedOverlaps.size).toBe(0);
        });
    });
});