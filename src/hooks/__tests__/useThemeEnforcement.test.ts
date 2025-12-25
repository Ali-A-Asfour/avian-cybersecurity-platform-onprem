/**
 * Tests for useThemeEnforcement hook
 */

import { renderHook } from '@testing-library/react';
import { useThemeEnforcement } from '../useThemeEnforcement';

// Mock the theme enforcement utilities
jest.mock('@/lib/theme-enforcement', () => ({
    initializeDarkMode: jest.fn(),
}));

describe('useThemeEnforcement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should always return dark theme', () => {
        const { result } = renderHook(() => useThemeEnforcement());

        expect(result.current.theme).toBe('dark');
    });

    it('should call initializeDarkMode on mount in browser environment', () => {
        const { initializeDarkMode } = require('@/lib/theme-enforcement');

        renderHook(() => useThemeEnforcement());

        expect(initializeDarkMode).toHaveBeenCalledTimes(1);
    });

    it('should not have any theme toggle functionality', () => {
        const { result } = renderHook(() => useThemeEnforcement());

        // Should only return theme, no toggle functions
        expect(Object.keys(result.current)).toEqual(['theme']);
        expect(typeof result.current.theme).toBe('string');
        expect(result.current.theme).toBe('dark');
    });
});