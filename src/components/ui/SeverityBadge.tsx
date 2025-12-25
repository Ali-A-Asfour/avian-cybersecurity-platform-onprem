'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
    SEVERITY_COLORS,
    SEVERITY_SIZES,
    SEVERITY_LABELS,
    validateSeverityLevel,
    type SeverityLevel
} from '@/lib/badge-colors';
import { enforceBadgeStyling } from '@/lib/badge-styling-enforcement';

interface SeverityBadgeProps {
    severity: SeverityLevel;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * SeverityBadge component for displaying security risk levels
 * Uses higher visual weight than StatusBadge for priority hierarchy
 * Implements SOC-standard colors with WCAG AA compliance
 */
export function SeverityBadge({
    severity,
    size = 'md',
    className
}: SeverityBadgeProps) {
    // Validate severity level and provide fallback
    if (!validateSeverityLevel(severity)) {
        console.warn(`Invalid severity value: ${severity}`);
        return (
            <span className={cn(
                'inline-flex items-center font-medium rounded-full',
                'bg-gray-500 text-white px-2 py-1 text-xs',
                className
            )}>
                UNKNOWN
            </span>
        );
    }

    const colorClass = SEVERITY_COLORS[severity];
    const sizeClass = SEVERITY_SIZES[size];
    const label = SEVERITY_LABELS[severity];

    // Enforce styling requirements: solid backgrounds, white text, no gradients/opacity
    const baseClasses = 'inline-flex items-center font-medium rounded-full';
    const combinedClasses = cn(baseClasses, colorClass, sizeClass, className);
    const enforcedClasses = enforceBadgeStyling(combinedClasses, 'severity');

    // Additional enforcement: ensure white text and solid background
    const finalClasses = cn(enforcedClasses, 'text-white');

    return (
        <span className={finalClasses}>
            {label}
        </span>
    );
}