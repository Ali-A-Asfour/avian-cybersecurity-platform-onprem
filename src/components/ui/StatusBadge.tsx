'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
    STATUS_COLORS,
    STATUS_SIZES,
    STATUS_LABELS,
    validateStatusType,
    type StatusType
} from '@/lib/badge-colors';
import { enforceBadgeStyling } from '@/lib/badge-styling-enforcement';

interface StatusBadgeProps {
    status: StatusType;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * StatusBadge component for displaying workflow states
 * Uses lower visual weight than SeverityBadge to maintain hierarchy
 * Implements solid backgrounds with white text and rounded-full styling
 */
export function StatusBadge({
    status,
    size = 'md',
    className
}: StatusBadgeProps) {
    // Validate status type and provide fallback
    if (!validateStatusType(status)) {
        console.warn(`Invalid status value: ${status}`);
        return (
            <span className={cn(
                'inline-flex items-center font-normal rounded-full',
                'bg-gray-500 text-white px-2 py-1 text-xs',
                className
            )}>
                UNKNOWN
            </span>
        );
    }

    const colorClass = STATUS_COLORS[status];
    const sizeClass = STATUS_SIZES[size];
    const label = STATUS_LABELS[status];

    // Enforce styling requirements: solid backgrounds, white text, no gradients/opacity
    const baseClasses = 'inline-flex items-center font-normal rounded-full';
    const combinedClasses = cn(baseClasses, colorClass, sizeClass, className);
    const enforcedClasses = enforceBadgeStyling(combinedClasses, 'status');

    // Additional enforcement: ensure white text and solid background
    const finalClasses = cn(enforcedClasses, 'text-white');

    return (
        <span className={finalClasses}>
            {label}
        </span>
    );
}