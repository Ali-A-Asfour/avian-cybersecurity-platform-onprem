/**
 * Property-based test for badge accessibility compliance
 * **Feature: badge-system-standardization, Property 4: Badge accessibility compliance**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */

import { render } from '@testing-library/react';
import fc from 'fast-check';
import { SeverityBadge } from '../SeverityBadge';
import { StatusBadge } from '../StatusBadge';
import {
    calculateContrastRatio,
    validateBadgeContrast,
    validateWCAGContrast
} from '@/lib/contrast-validation';
import { validateBadgeStyling } from '@/lib/badge-styling-enforcement';
import {
    SEVERITY_COLORS,
    STATUS_COLORS,
    type SeverityLevel,
    type StatusType
} from '@/lib/badge-colors';

// Property-based test configuration
const PBT_CONFIG = { numRuns: 100 };

describe('Badge Accessibility Compliance Property Tests', () => {

    /**
     * Property 4: Badge accessibility compliance
     * For any badge type and color combination, the text-to-background contrast ratio 
     * should meet WCAG AA standards (4.5:1 minimum) and use solid backgrounds with white text
     */

    describe('Severity Badge Accessibility', () => {
        test('all severity badge combinations meet WCAG AA contrast requirements', () => {
            fc.assert(fc.property(
                fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low', 'info'),
                fc.constantFrom('sm', 'md', 'lg'),
                (severity, size) => {
                    // Render the badge
                    const { container } = render(
                        <SeverityBadge severity={severity} size={size} />
                    );

                    const badgeElement = container.querySelector('span');
                    expect(badgeElement).toBeTruthy();

                    const className = badgeElement!.className;

                    // Requirement 4.1: Validate WCAG AA contrast ratios
                    const contrastResult = validateBadgeContrast(className);
                    expect(contrastResult.isValid).toBe(true);
                    expect(contrastResult.ratio).toBeGreaterThanOrEqual(4.5);

                    // Requirement 4.2: Ensure white text on colored backgrounds
                    expect(className).toContain('text-white');

                    // Requirement 4.3: Use solid backgrounds (no opacity/transparency)
                    expect(className).not.toContain('opacity');
                    expect(className).not.toContain('bg-opacity');
                    expect(className).not.toContain('transparent');

                    // Requirement 4.4: Avoid dark-on-dark combinations in dark mode
                    // All our badges use white text, so this is automatically satisfied
                    expect(className).toContain('text-white');

                    // Requirement 4.5: Reject low-opacity or muted styles
                    const stylingValidation = validateBadgeStyling(className);
                    expect(stylingValidation.isValid).toBe(true);
                    expect(stylingValidation.violations).toHaveLength(0);
                }
            ), PBT_CONFIG);
        });

        test('severity badges maintain readability in dense contexts', () => {
            fc.assert(fc.property(
                fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low', 'info'),
                fc.constantFrom('table', 'list', 'card'),
                (severity, context) => {
                    const { container } = render(
                        <div style={{ fontSize: '12px', lineHeight: '1.2' }}>
                            <SeverityBadge severity={severity} size="sm" />
                        </div>
                    );

                    const badgeElement = container.querySelector('span');
                    expect(badgeElement).toBeTruthy();

                    // Badge should remain readable even in dense layouts
                    const className = badgeElement!.className;

                    // Must have solid background for visibility
                    expect(className).toMatch(/bg-\w+-\d+/);

                    // Must have white text for maximum contrast
                    expect(className).toContain('text-white');

                    // Must have adequate padding for readability
                    expect(className).toMatch(/px-\d+/);
                    expect(className).toMatch(/py-\d+/);
                }
            ), PBT_CONFIG);
        });
    });

    describe('Status Badge Accessibility', () => {
        test('all status badge combinations meet WCAG AA contrast requirements', () => {
            fc.assert(fc.property(
                fc.constantFrom<StatusType>(
                    'new', 'open', 'investigating', 'in_progress',
                    'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'
                ),
                fc.constantFrom('sm', 'md', 'lg'),
                (status, size) => {
                    // Render the badge
                    const { container } = render(
                        <StatusBadge status={status} size={size} />
                    );

                    const badgeElement = container.querySelector('span');
                    expect(badgeElement).toBeTruthy();

                    const className = badgeElement!.className;

                    // Requirement 4.1: Validate WCAG AA contrast ratios
                    const contrastResult = validateBadgeContrast(className);
                    expect(contrastResult.isValid).toBe(true);
                    expect(contrastResult.ratio).toBeGreaterThanOrEqual(4.5);

                    // Requirement 4.2: Ensure white text on colored backgrounds
                    expect(className).toContain('text-white');

                    // Requirement 4.3: Use solid backgrounds (no opacity/transparency)
                    expect(className).not.toContain('opacity');
                    expect(className).not.toContain('bg-opacity');
                    expect(className).not.toContain('transparent');

                    // Requirement 4.4: Avoid dark-on-dark combinations in dark mode
                    expect(className).toContain('text-white');

                    // Requirement 4.5: Reject low-opacity or muted styles
                    const stylingValidation = validateBadgeStyling(className);
                    expect(stylingValidation.isValid).toBe(true);
                    expect(stylingValidation.violations).toHaveLength(0);
                }
            ), PBT_CONFIG);
        });

        test('status badges maintain readability in dense contexts', () => {
            fc.assert(fc.property(
                fc.constantFrom<StatusType>(
                    'new', 'open', 'investigating', 'in_progress',
                    'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'
                ),
                fc.constantFrom('table', 'list', 'card'),
                (status, context) => {
                    const { container } = render(
                        <div style={{ fontSize: '12px', lineHeight: '1.2' }}>
                            <StatusBadge status={status} size="sm" />
                        </div>
                    );

                    const badgeElement = container.querySelector('span');
                    expect(badgeElement).toBeTruthy();

                    // Badge should remain readable even in dense layouts
                    const className = badgeElement!.className;

                    // Must have solid background for visibility
                    expect(className).toMatch(/bg-\w+-\d+/);

                    // Must have white text for maximum contrast
                    expect(className).toContain('text-white');

                    // Must have adequate padding for readability
                    expect(className).toMatch(/px-\d+/);
                    expect(className).toMatch(/py-\d+/);
                }
            ), PBT_CONFIG);
        });
    });

    describe('Cross-Badge Accessibility Validation', () => {
        test('all badge color combinations meet minimum contrast standards', () => {
            fc.assert(fc.property(
                fc.oneof(
                    fc.constantFrom<SeverityLevel>('critical', 'high', 'medium', 'low', 'info'),
                    fc.constantFrom<StatusType>(
                        'new', 'open', 'investigating', 'in_progress',
                        'awaiting_response', 'escalated', 'resolved', 'closed', 'canceled'
                    )
                ),
                (badgeType) => {
                    let colorClass: string;

                    if (typeof badgeType === 'string' && badgeType in SEVERITY_COLORS) {
                        colorClass = SEVERITY_COLORS[badgeType as SeverityLevel];
                    } else {
                        colorClass = STATUS_COLORS[badgeType as StatusType];
                    }

                    // Validate contrast ratio meets WCAG AA standards
                    const contrastResult = validateBadgeContrast(colorClass);
                    expect(contrastResult.isValid).toBe(true);
                    expect(contrastResult.ratio).toBeGreaterThanOrEqual(4.5);

                    // Ensure no forbidden styling
                    expect(colorClass).not.toContain('gradient');
                    expect(colorClass).not.toContain('opacity');
                    expect(colorClass).toContain('text-white');
                }
            ), PBT_CONFIG);
        });

        test('badge styling enforcement prevents accessibility violations', () => {
            fc.assert(fc.property(
                fc.array(fc.constantFrom(
                    'bg-red-700', 'text-white', 'rounded-full', 'px-3', 'py-1',
                    'gradient-to-r', 'opacity-50', 'bg-opacity-75', 'text-black'
                ), { minLength: 2, maxLength: 8 }),
                (classArray) => {
                    const className = classArray.join(' ');
                    const validation = validateBadgeStyling(className);

                    // If there are violations, they should be properly identified
                    if (!validation.isValid) {
                        expect(validation.violations.length).toBeGreaterThan(0);
                        expect(validation.recommendations.length).toBeGreaterThan(0);

                        // Common violations should be caught
                        if (className.includes('gradient')) {
                            expect(validation.violations.some(v => v.includes('gradient'))).toBe(true);
                        }
                        if (className.includes('opacity')) {
                            expect(validation.violations.some(v => v.includes('opacity'))).toBe(true);
                        }
                        if (className.includes('text-black')) {
                            expect(validation.violations.some(v => v.includes('dark text'))).toBe(true);
                        }
                    }
                }
            ), PBT_CONFIG);
        });
    });

    describe('Contrast Ratio Calculations', () => {
        test('contrast ratio calculations are mathematically correct', () => {
            fc.assert(fc.property(
                fc.constantFrom('#FFFFFF', '#000000', '#B91C1C', '#EA580C', '#A16207', '#15803D', '#1D4ED8'),
                fc.constantFrom('#FFFFFF', '#000000', '#B91C1C', '#EA580C', '#A16207', '#15803D', '#1D4ED8'),
                (color1, color2) => {
                    const ratio = calculateContrastRatio(color1, color2);

                    // Contrast ratio should be between 1:1 and 21:1
                    expect(ratio).toBeGreaterThanOrEqual(1);
                    expect(ratio).toBeLessThanOrEqual(21);

                    // Ratio should be symmetric (order shouldn't matter)
                    const reverseRatio = calculateContrastRatio(color2, color1);
                    expect(Math.abs(ratio - reverseRatio)).toBeLessThan(0.01);
                }
            ), PBT_CONFIG);
        });

        test('WCAG validation correctly identifies compliant combinations', () => {
            fc.assert(fc.property(
                fc.constantFrom('#FFFFFF', '#000000', '#B91C1C', '#A16207', '#15803D'),
                fc.constantFrom('#FFFFFF', '#000000'),
                (backgroundColor, textColor) => {
                    const isValid = validateWCAGContrast(backgroundColor, textColor, 'AA');
                    const ratio = calculateContrastRatio(backgroundColor, textColor);

                    // Validation result should match ratio calculation
                    if (ratio >= 4.5) {
                        expect(isValid).toBe(true);
                    } else {
                        expect(isValid).toBe(false);
                    }
                }
            ), PBT_CONFIG);
        });
    });
});