/**
 * Property-based tests for useAutoRefresh hook
 * **Feature: tenant-admin-dashboard, Property 9: Auto-refresh Timing Consistency**
 * **Validates: Requirements 8.1, 8.6**
 */

import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { useAutoRefresh } from '../useAutoRefresh';

// Mock useNetworkStatus hook
jest.mock('../useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOnline: true })
}));

describe('useAutoRefresh Property-Based Tests', () => {
    beforeEach(() => {
        jest.useFakeTimers();

        // Mock document properties
        Object.defineProperty(document, 'hidden', {
            writable: true,
            configurable: true,
            value: false
        });
        Object.defineProperty(document, 'addEventListener', {
            writable: true,
            configurable: true,
            value: jest.fn()
        });
        Object.defineProperty(document, 'removeEventListener', {
            writable: true,
            configurable: true,
            value: jest.fn()
        });
        Object.defineProperty(document, 'querySelector', {
            writable: true,
            configurable: true,
            value: jest.fn().mockReturnValue(null)
        });
        Object.defineProperty(document.body, 'classList', {
            writable: true,
            configurable: true,
            value: { contains: jest.fn().mockReturnValue(false) }
        });

        // Mock MutationObserver
        global.MutationObserver = jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            disconnect: jest.fn(),
        }));
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    /**
     * Property 9: Auto-refresh Timing Consistency
     * For any enabled auto-refresh configuration, the refresh function should be called
     * at consistent intervals when active (setInterval fires after the first interval, not immediately)
     */
    it('should maintain consistent refresh intervals when enabled', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1000, max: 3000 }),
                (testInterval) => {
                    const mockOnRefresh = jest.fn();

                    const { result } = renderHook(() =>
                        useAutoRefresh({
                            onRefresh: mockOnRefresh,
                            interval: testInterval,
                            enabled: true,
                        })
                    );

                    expect(result.current.isActive).toBe(true);

                    // setInterval doesn't fire immediately, so no calls yet
                    expect(mockOnRefresh).toHaveBeenCalledTimes(0);

                    // First interval - should trigger first call
                    act(() => {
                        jest.advanceTimersByTime(testInterval);
                    });
                    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

                    // Second interval - should trigger second call
                    act(() => {
                        jest.advanceTimersByTime(testInterval);
                    });
                    expect(mockOnRefresh).toHaveBeenCalledTimes(2);

                    // Third interval - should trigger third call (consistent timing)
                    act(() => {
                        jest.advanceTimersByTime(testInterval);
                    });
                    expect(mockOnRefresh).toHaveBeenCalledTimes(3);
                }
            ),
            { numRuns: 3 }
        );
    });

    it('should respect manual pause and resume controls', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1000, max: 3000 }),
                (testInterval) => {
                    const mockOnRefresh = jest.fn();

                    const { result } = renderHook(() =>
                        useAutoRefresh({
                            onRefresh: mockOnRefresh,
                            interval: testInterval,
                            enabled: true,
                        })
                    );

                    expect(result.current.isActive).toBe(true);

                    act(() => {
                        result.current.pause();
                    });

                    expect(result.current.isActive).toBe(false);

                    act(() => {
                        jest.advanceTimersByTime(testInterval * 2);
                    });
                    expect(mockOnRefresh).not.toHaveBeenCalled();

                    act(() => {
                        result.current.resume();
                    });

                    expect(result.current.isActive).toBe(true);

                    act(() => {
                        jest.advanceTimersByTime(testInterval);
                    });
                    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
                }
            ),
            { numRuns: 3 }
        );
    });

    it('should default to 60-second intervals', () => {
        const mockOnRefresh = jest.fn();

        const { result } = renderHook(() =>
            useAutoRefresh({
                onRefresh: mockOnRefresh,
                enabled: true,
            })
        );

        expect(result.current.isActive).toBe(true);
        expect(result.current.currentInterval).toBe(60000);
    });

    it('should provide refresh button functionality', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1000, max: 3000 }),
                (testInterval) => {
                    const mockOnRefresh = jest.fn();

                    const { result } = renderHook(() =>
                        useAutoRefresh({
                            onRefresh: mockOnRefresh,
                            interval: testInterval,
                            enabled: true,
                        })
                    );

                    expect(result.current.isActive).toBe(true);

                    // Manual refresh should work immediately
                    act(() => {
                        result.current.refreshNow();
                    });
                    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

                    // Should reset the timer - advance by less than interval
                    act(() => {
                        jest.advanceTimersByTime(testInterval / 2);
                    });
                    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

                    // Complete the interval after manual refresh
                    act(() => {
                        jest.advanceTimersByTime(testInterval / 2);
                    });
                    expect(mockOnRefresh).toHaveBeenCalledTimes(2);
                }
            ),
            { numRuns: 3 }
        );
    });
});