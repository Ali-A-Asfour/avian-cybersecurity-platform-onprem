'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LabelProps {
    children: React.ReactNode;
    variant?: 'default' | 'secondary' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * Simple Label component for generic text labels and tags
 * This replaces the old Badge component for non-severity/status use cases
 * For severity indicators, use SeverityBadge
 * For status indicators, use StatusBadge
 */
export function Label({
    children,
    variant = 'default',
    size = 'md',
    className
}: LabelProps) {
    const baseClasses = 'inline-flex items-center font-medium rounded-full';

    const variantClasses = {
        default: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
        secondary: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
        outline: 'border border-slate-300 text-slate-700 bg-transparent dark:border-slate-600 dark:text-slate-300'
    };

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-sm',
        lg: 'px-3 py-1 text-base'
    };

    const classes = cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
    );

    return (
        <span className={classes}>
            {children}
        </span>
    );
}