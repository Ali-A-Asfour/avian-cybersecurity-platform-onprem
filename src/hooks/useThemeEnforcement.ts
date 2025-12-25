'use client';

import { useEffect } from 'react';
import { initializeDarkMode } from '@/lib/theme-enforcement';

/**
 * React hook for theme enforcement that only supports dark mode
 * 
 * This hook:
 * - Overrides system preference detection
 * - Removes theme state management (no state needed for single theme)
 * - Enforces dark mode on component mount
 * 
 * Requirements: 3.1, 3.3
 */
export const useThemeEnforcement = () => {
    const theme = 'dark' as const; // Always dark, no state needed

    // Initialize dark mode enforcement on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            initializeDarkMode();
        }
    }, []);

    // No theme toggle functionality - dark mode only
    return { theme };
};

/**
 * Type definition for the theme enforcement hook return value
 */
export type ThemeEnforcementResult = {
    theme: 'dark';
};