/**
 * Badge styling enforcement utility
 * Ensures solid backgrounds, white text, and removes any gradient/opacity effects
 * Requirements: 4.2, 4.3, 4.5 - Enforce solid backgrounds and white text
 */

/**
 * Validate that badge classes meet styling requirements
 * - Must have solid background (bg-* class)
 * - Must have white text (text-white)
 * - Must not have gradients, opacity, or transparency effects
 * - Must use rounded-full styling
 */
export function validateBadgeStyling(className: string): {
    isValid: boolean;
    violations: string[];
    recommendations: string[];
} {
    const classes = className.split(' ').filter(cls => cls.trim());
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check for solid background color
    const hasSolidBackground = classes.some(cls => /^bg-\w+-\d+$/.test(cls));
    if (!hasSolidBackground) {
        violations.push('Missing solid background color (bg-{color}-{shade})');
        recommendations.push('Add a solid background color like bg-red-700, bg-blue-600, etc.');
    }

    // Check for white text
    const hasWhiteText = classes.includes('text-white');
    if (!hasWhiteText) {
        violations.push('Missing white text color');
        recommendations.push('Add text-white class for maximum contrast');
    }

    // Check for forbidden gradient effects
    const hasGradient = classes.some(cls => cls.includes('gradient'));
    if (hasGradient) {
        violations.push('Contains gradient effects (forbidden)');
        recommendations.push('Remove gradient classes and use solid backgrounds only');
    }

    // Check for forbidden opacity effects
    const hasOpacity = classes.some(cls => cls.includes('opacity') || cls.includes('bg-opacity'));
    if (hasOpacity) {
        violations.push('Contains opacity effects (forbidden)');
        recommendations.push('Remove opacity classes and use solid backgrounds only');
    }

    // Check for rounded-full styling
    const hasRoundedFull = classes.includes('rounded-full');
    if (!hasRoundedFull) {
        violations.push('Missing rounded-full styling');
        recommendations.push('Add rounded-full class for consistent pill-shaped appearance');
    }

    // Check for forbidden dark text colors
    const hasDarkText = classes.some(cls =>
        cls.includes('text-black') ||
        cls.includes('text-gray') ||
        cls.includes('text-slate') ||
        cls.includes('text-neutral')
    );
    if (hasDarkText) {
        violations.push('Contains dark text colors (may not meet contrast requirements)');
        recommendations.push('Use text-white for maximum contrast on colored backgrounds');
    }

    return {
        isValid: violations.length === 0,
        violations,
        recommendations
    };
}

/**
 * Enforce badge styling requirements by cleaning and correcting class names
 * Removes forbidden classes and ensures required classes are present
 */
export function enforceBadgeStyling(
    className: string,
    badgeType: 'severity' | 'status' = 'status'
): string {
    const classes = className.split(' ').filter(cls => cls.trim());
    const cleanedClasses: string[] = [];

    // Remove forbidden classes
    const forbiddenPatterns = [
        /gradient/,
        /opacity/,
        /bg-opacity/,
        /text-opacity/,
        /text-black/,
        /text-gray/,
        /text-slate/,
        /text-neutral/,
        /bg-\w+-100$/, // Light background colors (bg-red-100, bg-blue-100, etc.)
        /text-\w+-800$/, // Dark text colors (text-red-800, text-blue-800, etc.)
        /text-\w+-900$/, // Very dark text colors
        /bg-\w+-50$/, // Very light background colors
        /bg-\w+-200$/, // Light background colors
        /bg-\w+-300$/, // Light background colors
        /bg-\w+-400$/ // Medium-light background colors
    ];

    classes.forEach(cls => {
        const isForbidden = forbiddenPatterns.some(pattern => pattern.test(cls));
        if (!isForbidden) {
            cleanedClasses.push(cls);
        }
    });

    // Ensure required classes are present
    const requiredClasses = [
        'inline-flex',
        'items-center',
        'rounded-full',
        'text-white'
    ];

    requiredClasses.forEach(requiredClass => {
        if (!cleanedClasses.includes(requiredClass)) {
            cleanedClasses.push(requiredClass);
        }
    });

    // Add appropriate font weight based on badge type
    const fontWeightClass = badgeType === 'severity' ? 'font-medium' : 'font-normal';
    if (!cleanedClasses.some(cls => cls.startsWith('font-'))) {
        cleanedClasses.push(fontWeightClass);
    }

    return cleanedClasses.join(' ');
}

/**
 * Validate badge readability in tables and dense lists
 * Ensures badges maintain readability without hover states
 */
export function validateBadgeReadability(
    badgeElement: HTMLElement | null,
    context: 'table' | 'list' | 'card' | 'general' = 'general'
): {
    isReadable: boolean;
    issues: string[];
    suggestions: string[];
} {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!badgeElement) {
        issues.push('Badge element not found');
        return { isReadable: false, issues, suggestions };
    }

    const computedStyle = window.getComputedStyle(badgeElement);

    // Check minimum size requirements for readability
    const minHeight = context === 'table' ? 20 : 24; // Smaller in tables
    const actualHeight = badgeElement.offsetHeight;

    if (actualHeight < minHeight) {
        issues.push(`Badge height (${actualHeight}px) below minimum for ${context} context`);
        suggestions.push(`Increase padding or font size for better readability in ${context}`);
    }

    // Check font size
    const fontSize = parseInt(computedStyle.fontSize);
    const minFontSize = context === 'table' ? 11 : 12;

    if (fontSize < minFontSize) {
        issues.push(`Font size (${fontSize}px) too small for ${context} context`);
        suggestions.push(`Use minimum ${minFontSize}px font size for ${context} readability`);
    }

    // Check for sufficient padding
    const paddingLeft = parseInt(computedStyle.paddingLeft);
    const paddingRight = parseInt(computedStyle.paddingRight);
    const minPadding = context === 'table' ? 6 : 8;

    if (paddingLeft < minPadding || paddingRight < minPadding) {
        issues.push('Insufficient horizontal padding for readability');
        suggestions.push(`Use minimum ${minPadding}px horizontal padding`);
    }

    // Verify solid background (no transparency)
    const backgroundColor = computedStyle.backgroundColor;
    if (backgroundColor.includes('rgba') && backgroundColor.includes('0)')) {
        issues.push('Transparent background detected');
        suggestions.push('Use solid background colors only');
    }

    return {
        isReadable: issues.length === 0,
        issues,
        suggestions
    };
}

/**
 * Validate badge readability specifically in table and list contexts
 * Ensures badges maintain visibility and contrast in dense layouts
 */
export function validateBadgeInContext(
    badgeElement: HTMLElement,
    parentContext: 'table' | 'list' | 'card' | 'general' = 'general'
): {
    isReadable: boolean;
    issues: string[];
    fixes: string[];
} {
    const issues: string[] = [];
    const fixes: string[] = [];
    const computedStyle = window.getComputedStyle(badgeElement);

    // Check for solid background (no transparency)
    const backgroundColor = computedStyle.backgroundColor;
    if (backgroundColor === 'transparent' || backgroundColor.includes('rgba(0, 0, 0, 0)')) {
        issues.push('Badge has transparent background');
        fixes.push('Apply solid background color (bg-{color}-600 or bg-{color}-700)');
    }

    // Check for white text
    const color = computedStyle.color;
    const isWhiteText = color === 'rgb(255, 255, 255)' || color === 'white' || color === '#ffffff';
    if (!isWhiteText) {
        issues.push(`Badge text color is not white: ${color}`);
        fixes.push('Apply text-white class for maximum contrast');
    }

    // Check minimum size for readability in context
    const minHeight = parentContext === 'table' ? 18 : 20;
    const actualHeight = badgeElement.offsetHeight;
    if (actualHeight < minHeight) {
        issues.push(`Badge height (${actualHeight}px) too small for ${parentContext}`);
        fixes.push(`Increase padding to achieve minimum ${minHeight}px height`);
    }

    // Check for sufficient padding
    const paddingX = parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight);
    const minPaddingX = parentContext === 'table' ? 12 : 16; // px-1.5 vs px-2
    if (paddingX < minPaddingX) {
        issues.push(`Insufficient horizontal padding: ${paddingX}px`);
        fixes.push(`Use minimum ${minPaddingX}px total horizontal padding`);
    }

    // Check for rounded corners
    const borderRadius = computedStyle.borderRadius;
    if (!borderRadius || borderRadius === '0px') {
        issues.push('Badge missing rounded corners');
        fixes.push('Apply rounded-full class for pill-shaped appearance');
    }

    // Check for any gradient or opacity effects
    const backgroundImage = computedStyle.backgroundImage;
    if (backgroundImage && backgroundImage !== 'none') {
        issues.push('Badge has background gradient or image');
        fixes.push('Remove gradient classes and use solid background only');
    }

    const opacity = computedStyle.opacity;
    if (parseFloat(opacity) < 1) {
        issues.push(`Badge has reduced opacity: ${opacity}`);
        fixes.push('Remove opacity classes and use full opacity (1.0)');
    }

    return {
        isReadable: issues.length === 0,
        issues,
        fixes
    };
}

/**
 * Comprehensive badge validation for all contexts
 * Validates styling, readability, and accessibility compliance
 */
export function validateBadgeCompliance(badgeElement: HTMLElement): {
    isCompliant: boolean;
    stylingIssues: string[];
    readabilityIssues: string[];
    recommendations: string[];
} {
    const className = badgeElement.className;
    const stylingValidation = validateBadgeStyling(className);

    // Determine context from parent elements
    const parentTable = badgeElement.closest('table');
    const parentList = badgeElement.closest('ul, ol');
    const context = parentTable ? 'table' : parentList ? 'list' : 'general';

    const readabilityValidation = validateBadgeInContext(badgeElement, context);

    return {
        isCompliant: stylingValidation.isValid && readabilityValidation.isReadable,
        stylingIssues: stylingValidation.violations,
        readabilityIssues: readabilityValidation.issues,
        recommendations: [
            ...stylingValidation.recommendations,
            ...readabilityValidation.fixes
        ]
    };
}

/**
 * Runtime validation for development - logs warnings for non-compliant badges
 */
export function validateAllBadgeElements(): void {
    if (typeof window === 'undefined') return; // Skip on server-side

    const badgeElements = document.querySelectorAll('[class*="bg-"][class*="text-white"]');

    console.log(`🔍 Validating ${badgeElements.length} badge elements...`);

    let compliantCount = 0;
    let tableContextCount = 0;
    let listContextCount = 0;

    badgeElements.forEach((element, index) => {
        const badgeElement = element as HTMLElement;
        const validation = validateBadgeCompliance(badgeElement);

        // Track context distribution
        if (badgeElement.closest('table')) tableContextCount++;
        if (badgeElement.closest('ul, ol')) listContextCount++;

        if (validation.isCompliant) {
            compliantCount++;
        } else {
            console.warn(`❌ Badge ${index + 1} violations:`);
            if (validation.stylingIssues.length > 0) {
                console.warn('  Styling issues:', validation.stylingIssues);
            }
            if (validation.readabilityIssues.length > 0) {
                console.warn('  Readability issues:', validation.readabilityIssues);
            }
            console.info('  💡 Recommendations:', validation.recommendations);
        }
    });

    const complianceRate = (compliantCount / badgeElements.length) * 100;
    console.log(`📊 Badge compliance: ${compliantCount}/${badgeElements.length} (${complianceRate.toFixed(1)}%)`);
    console.log(`📍 Context distribution: ${tableContextCount} in tables, ${listContextCount} in lists`);

    if (complianceRate === 100) {
        console.log('🎉 All badges meet styling and readability requirements!');
    } else {
        console.log('⚠️  Some badges need attention for solid backgrounds and white text compliance');
    }
}