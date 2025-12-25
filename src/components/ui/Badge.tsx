'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { enforceBadgeStyling } from '@/lib/badge-styling-enforcement';

// Badge variant styles
const BADGE_VARIANTS = {
    default: 'bg-gray-700 text-white',
    secondary: 'bg-gray-500 text-white',
    success: 'bg-green-700 text-white',
    warning: 'bg-yellow-700 text-white',
    danger: 'bg-red-700 text-white',
    outline: 'border border-gray-300 bg-transparent text-gray-700 dark:border-gray-600 dark:text-gray-300',
} as const;

// Badge color styles (for backward compatibility)
const BADGE_COLORS = {
    gray: 'bg-gray-700 text-white',
    blue: 'bg-blue-700 text-white',
    green: 'bg-green-700 text-white',
    yellow: 'bg-yellow-700 text-white',
    red: 'bg-red-700 text-white',
    purple: 'bg-purple-700 text-white',
    orange: 'bg-orange-700 text-white',
} as const;

// Badge sizes
const BADGE_SIZES = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
} as const;

export type BadgeVariant = keyof typeof BADGE_VARIANTS;
export type BadgeColor = keyof typeof BADGE_COLORS;
export type BadgeSize = keyof typeof BADGE_SIZES;

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    color?: BadgeColor;
    size?: BadgeSize;
    className?: string;
}

/**
 * Base Badge component for general-purpose labeling
 * Supports both variant and color props for flexibility
 * Uses consistent styling with SeverityBadge and StatusBadge
 */
export function Badge({
    children,
    variant = 'default',
    color,
    size = 'md',
    className
}: BadgeProps) {
    // Color prop takes precedence over variant for backward compatibility
    const colorClass = color ? BADGE_COLORS[color] : BADGE_VARIANTS[variant];
    const sizeClass = BADGE_SIZES[size];

    // Base classes for all badges
    const baseClasses = 'inline-flex items-center font-normal rounded-full';
    const combinedClasses = cn(baseClasses, colorClass, sizeClass, className);

    // Enforce styling requirements for consistency
    const enforcedClasses = enforceBadgeStyling(combinedClasses, 'general');

    return (
        <span className={enforcedClasses}>
            {children}
        </span>
    );
}