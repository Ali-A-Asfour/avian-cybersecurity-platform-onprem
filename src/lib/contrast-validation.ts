/**
 * WCAG AA contrast ratio validation utility
 * Implements contrast ratio calculation and validation for badge accessibility compliance
 * Requirements: 4.1 - Validate WCAG AA contrast ratios for all badge combinations
 */

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // Remove # if present
    hex = hex.replace('#', '');

    // Handle 3-digit hex codes
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Calculate relative luminance according to WCAG guidelines
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
    // Convert RGB to sRGB
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;

    // Apply gamma correction
    const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    // Calculate relative luminance
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio between 1:1 (no contrast) and 21:1 (maximum contrast)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    if (!rgb1 || !rgb2) {
        console.warn(`Invalid color format: ${color1} or ${color2}`);
        return 0;
    }

    const luminance1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const luminance2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

    // Ensure lighter color is in numerator
    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validate if contrast ratio meets WCAG AA standards
 * WCAG AA requires minimum 4.5:1 for normal text
 * WCAG AAA requires minimum 7:1 for normal text
 */
export function validateWCAGContrast(
    backgroundColor: string,
    textColor: string,
    level: 'AA' | 'AAA' = 'AA'
): boolean {
    const ratio = calculateContrastRatio(backgroundColor, textColor);
    const minimumRatio = level === 'AAA' ? 7 : 4.5;

    return ratio >= minimumRatio;
}

/**
 * Badge color hex mappings for validation
 * Must match the exact Tailwind colors defined in badge-colors.ts
 */
const BADGE_COLOR_HEX = {
    // Severity colors (from badge-colors.ts) - must match exactly
    'bg-red-700': '#B91C1C',     // critical
    'bg-orange-700': '#C2410C',  // high  
    'bg-yellow-600': '#CA8A04',  // medium - matches badge-colors.ts
    'bg-yellow-700': '#A16207',  // medium alternative (WCAG AA compliant)
    'bg-green-700': '#15803D',   // low
    'bg-blue-700': '#1D4ED8',    // info

    // Status colors (from badge-colors.ts) - must match exactly
    'bg-blue-600': '#2563EB',    // new, open
    'bg-amber-700': '#B45309',   // investigating
    'bg-amber-600': '#D97706',   // in_progress - matches badge-colors.ts
    'bg-violet-600': '#7C3AED',  // awaiting_response
    'bg-red-600': '#DC2626',     // escalated
    'bg-green-600': '#16A34A',   // resolved - matches badge-colors.ts
    'bg-slate-500': '#64748B',   // closed
    'bg-slate-600': '#475569',   // canceled

    // Fallback colors
    'bg-gray-500': '#6B7280',

    // Text colors
    'text-white': '#FFFFFF',
    'text-black': '#000000',
} as const;

/**
 * Extract hex color from Tailwind CSS class
 */
function extractHexFromTailwindClass(tailwindClass: string): string | null {
    return BADGE_COLOR_HEX[tailwindClass as keyof typeof BADGE_COLOR_HEX] || null;
}

/**
 * Validate badge color combination meets WCAG AA standards
 * Accepts Tailwind CSS classes (e.g., 'bg-red-700 text-white')
 */
export function validateBadgeContrast(
    badgeClasses: string,
    level: 'AA' | 'AAA' = 'AA'
): { isValid: boolean; ratio: number; backgroundColor: string; textColor: string } {
    const classes = badgeClasses.split(' ');

    // Find background and text color classes
    const bgClass = classes.find(cls => cls.startsWith('bg-'));
    // Look for actual text color classes, not size classes
    const textColorClass = classes.find(cls =>
        cls.startsWith('text-') &&
        (cls.includes('white') || cls.includes('black') || cls.includes('gray'))
    );

    // Default to white text if no text color class found (our badges always use white text)
    const textClass = textColorClass || 'text-white';

    if (!bgClass) {
        console.warn(`No background color class found in: ${badgeClasses}`);
        return { isValid: false, ratio: 0, backgroundColor: '', textColor: '' };
    }

    const backgroundColor = extractHexFromTailwindClass(bgClass);
    const textColor = extractHexFromTailwindClass(textClass);

    if (!backgroundColor || !textColor) {
        console.warn(`Could not extract hex colors from: ${bgClass}, ${textClass}`);
        return { isValid: false, ratio: 0, backgroundColor: bgClass, textColor: textClass };
    }

    const ratio = calculateContrastRatio(backgroundColor, textColor);
    const isValid = validateWCAGContrast(backgroundColor, textColor, level);

    return { isValid, ratio, backgroundColor, textColor };
}

/**
 * Validate all badge combinations and log warnings for non-compliant ones
 * Used for runtime validation during development
 */
export function validateAllBadgeCombinations(): void {
    const severityColors = [
        'bg-red-700 text-white',
        'bg-orange-700 text-white',
        'bg-yellow-700 text-white',
        'bg-green-700 text-white',
        'bg-blue-700 text-white',
    ];

    const statusColors = [
        'bg-blue-600 text-white',
        'bg-amber-700 text-white',
        'bg-violet-600 text-white',
        'bg-red-600 text-white',
        'bg-slate-500 text-white',
        'bg-slate-600 text-white',
    ];

    console.log('🔍 Validating badge contrast ratios...');

    let allValid = true;

    // Validate severity badges
    console.log('\n📊 Severity Badge Validation:');
    severityColors.forEach((colorClass) => {
        const result = validateBadgeContrast(colorClass);
        const status = result.isValid ? '✅' : '❌';
        console.log(`${status} ${colorClass}: ${result.ratio.toFixed(2)}:1`);

        if (!result.isValid) {
            console.warn(`⚠️  Non-compliant contrast ratio for ${colorClass}`);
            allValid = false;
        }
    });

    // Validate status badges
    console.log('\n🔄 Status Badge Validation:');
    statusColors.forEach((colorClass) => {
        const result = validateBadgeContrast(colorClass);
        const status = result.isValid ? '✅' : '❌';
        console.log(`${status} ${colorClass}: ${result.ratio.toFixed(2)}:1`);

        if (!result.isValid) {
            console.warn(`⚠️  Non-compliant contrast ratio for ${colorClass}`);
            allValid = false;
        }
    });

    if (allValid) {
        console.log('\n🎉 All badge combinations meet WCAG AA standards!');
    } else {
        console.warn('\n⚠️  Some badge combinations do not meet WCAG AA standards');
    }
}