/**
 * Test suite for badge solid background and white text enforcement
 * Requirements: 4.2, 4.3, 4.5 - Ensure solid backgrounds and white text
 */

import { validateBadgeStyling, enforceBadgeStyling } from '../badge-styling-enforcement';

describe('Badge Solid Background Enforcement', () => {
    describe('validateBadgeStyling', () => {
        it('should validate solid backgrounds with white text', () => {
            const validClasses = 'inline-flex items-center rounded-full bg-red-700 text-white px-3 py-1';
            const validation = validateBadgeStyling(validClasses);

            expect(validation.isValid).toBe(true);
            expect(validation.violations).toHaveLength(0);
        });

        it('should reject gradient effects', () => {
            const gradientClasses = 'inline-flex items-center rounded-full bg-gradient-to-r from-red-500 to-red-700 text-white px-3 py-1';
            const validation = validateBadgeStyling(gradientClasses);

            expect(validation.isValid).toBe(false);
            expect(validation.violations).toContain('Contains gradient effects (forbidden)');
        });

        it('should reject opacity effects', () => {
            const opacityClasses = 'inline-flex items-center rounded-full bg-red-700 bg-opacity-75 text-white px-3 py-1';
            const validation = validateBadgeStyling(opacityClasses);

            expect(validation.isValid).toBe(false);
            expect(validation.violations).toContain('Contains opacity effects (forbidden)');
        });

        it('should reject non-white text colors', () => {
            const darkTextClasses = 'inline-flex items-center rounded-full bg-red-700 text-black px-3 py-1';
            const validation = validateBadgeStyling(darkTextClasses);

            expect(validation.isValid).toBe(false);
            expect(validation.violations).toContain('Contains dark text colors (may not meet contrast requirements)');
        });

        it('should require solid background colors', () => {
            const noBackgroundClasses = 'inline-flex items-center rounded-full text-white px-3 py-1';
            const validation = validateBadgeStyling(noBackgroundClasses);

            expect(validation.isValid).toBe(false);
            expect(validation.violations).toContain('Missing solid background color (bg-{color}-{shade})');
        });
    });

    describe('enforceBadgeStyling', () => {
        it('should remove gradient classes and ensure white text', () => {
            const problematicClasses = 'inline-flex bg-gradient-to-r from-red-500 to-red-700 text-black opacity-75';
            const enforced = enforceBadgeStyling(problematicClasses, 'severity');

            expect(enforced).toContain('text-white');
            expect(enforced).toContain('rounded-full');
            expect(enforced).toContain('font-medium'); // severity badge weight
            expect(enforced).not.toContain('gradient');
            expect(enforced).not.toContain('opacity');
            expect(enforced).not.toContain('text-black');
        });

        it('should preserve valid solid background classes', () => {
            const validClasses = 'inline-flex bg-red-700 text-white rounded-full px-3 py-1';
            const enforced = enforceBadgeStyling(validClasses, 'status');

            expect(enforced).toContain('bg-red-700');
            expect(enforced).toContain('text-white');
            expect(enforced).toContain('rounded-full');
            expect(enforced).toContain('font-normal'); // status badge weight
        });

        it('should add required classes if missing', () => {
            const minimalClasses = 'bg-blue-600';
            const enforced = enforceBadgeStyling(minimalClasses, 'severity');

            expect(enforced).toContain('inline-flex');
            expect(enforced).toContain('items-center');
            expect(enforced).toContain('rounded-full');
            expect(enforced).toContain('text-white');
            expect(enforced).toContain('font-medium');
        });
    });

    describe('Badge Color Validation', () => {
        const solidBackgroundColors = [
            'bg-red-700', 'bg-orange-600', 'bg-yellow-700', 'bg-green-700', 'bg-blue-700',
            'bg-blue-600', 'bg-amber-700', 'bg-violet-600', 'bg-red-600', 'bg-slate-500'
        ];

        solidBackgroundColors.forEach(colorClass => {
            it(`should validate ${colorClass} with white text as compliant`, () => {
                const classes = `inline-flex items-center rounded-full ${colorClass} text-white px-3 py-1`;
                const validation = validateBadgeStyling(classes);

                expect(validation.isValid).toBe(true);
                expect(validation.violations).toHaveLength(0);
            });
        });

        const forbiddenPatterns = [
            'bg-red-100', 'bg-blue-100', 'bg-green-100', // Light backgrounds
            'text-red-800', 'text-blue-800', 'text-green-800', // Dark text
            'bg-opacity-50', 'opacity-75', // Transparency
            'bg-gradient-to-r', 'bg-gradient-to-b' // Gradients
        ];

        forbiddenPatterns.forEach(forbiddenClass => {
            it(`should reject ${forbiddenClass} as non-compliant`, () => {
                const classes = `inline-flex items-center rounded-full bg-red-700 text-white ${forbiddenClass} px-3 py-1`;
                const enforced = enforceBadgeStyling(classes, 'severity');

                expect(enforced).not.toContain(forbiddenClass);
                expect(enforced).toContain('text-white');
            });
        });
    });
});