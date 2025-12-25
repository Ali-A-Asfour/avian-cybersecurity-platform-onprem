import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { useAutoRefresh } from '../useAutoRefresh';

// Mock the network status hook to avoid network-related test issues
jest.mock('../useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOnline: true })
}));

/**
 * **Feature: tenant-admin-dashboard, Property 9: Auto-refresh Timing Consistency**
 * **Validates: Requirements 8.1, 8.6**
 */
describe('useAutoRefresh Property Tests', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // Mock document.hidden to simulate active tab
        Object.defineProperty(document, 'hidden', {
            writable: true,
            value: false,
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    // Generator for valid auto-refresh configurations
    const autoRefreshConfigGenerator = fc.record({
        interval: fc.integer({ min: 1000, max: 300000 }), // 1 second to 5 minutes
        enabled: fc.boolean(),
        pauseOnModal: fc.boolean()
    });

    it('Property 9: Auto-refresh Timing Consistency - should refresh at specified intervals when active', () => {
        fc.assert(
            fc.property(
                autoRefreshConfigGenerator,
                (config) => {
                    const mockOnRefresh = jest.fn(() => Promise.resolve());

                    const { result } = renderHook(() =>
                        useAutoRefresh({
                            onRefresh: mockOnRefresh,
                            interval: config.interval,
                            enabled: config.enabled,
                        })
                    );

                    // Initially should not have called refresh
                    expect(mockOnRefresh).not.toHaveBeenCalled();

                    if (config.enabled) {
                        // Fast-forward time by the interval
                        act(() => {
                            jest.advanceTimersByTime(config.interval);
                        });

                        // Should have called refresh once (allow some timing flexibility)
                        expect(mockOnRefresh).toHaveBeenCalledTimes(1);

                        // Fast-forward by another interval
                        act(() => {
                            jest.advanceTimersByTime(config.interval);
                        });

                        // Should have called refresh twice (allow some timing flexibility)
                        expect(mockOnRefresh).toHaveBeenCalledTimes(2);
                    } else {
                        // If disabled, should not refresh even after time passes
                        act(() => {
                            jest.advanceTimersByTime(config.interval * 3);
                        });

                        expect(mockOnRefresh).not.toHaveBeenCalled();
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 9: Auto-refresh Timing Consistency - should pause during modal interactions', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 5000, max: 60000 }), // 5 seconds to 1 minute intervals
                (interval) => {
                    const mockOnRefresh = jest.fn(() => Promise.resolve());

                    const { result } = renderHook(() =>
                        useAutoRefresh({
                            onRefresh: mockOnRefresh,
                            interval: interval,
                            enabled: true,
                        })
                    );

                    // Simulate modal opening (pause refresh)
                    act(() => {
                        result.current.pause();
                    });

                    // Fast-forward time - should not refresh while paused
                    act(() => {
                        jest.advanceTimersByTime(interval * 2);
                    });

                    expect(mockOnRefresh).not.toHaveBeenCalled();
                    expect(result.current.isActive).toBe(false);

                    // Resume refresh
                    act(() => {
                        result.current.resume();
                    });

                    expect(result.current.isActive).toBe(true);

                    // Now should refresh after interval
                    act(() => {
                        jest.advanceTimersByTime(interval);
                    });

                    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 9: Auto-refresh Timing Consistency - should handle manual refresh correctly', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 10000, max: 120000 }), // 10 seconds to 2 minutes
                (interval) => {
                    const mockOnRefresh = jest.fn(() => Promise.resolve());

                    const { result } = renderHook(() =>
                        useAutoRefresh({
                            onRefresh: mockOnRefresh,
                            interval: interval,
                            enabled: true,
                        })
                    );

                    // Manual refresh should work immediately
                    act(() => {
                        result.current.refreshNow();
                    });

                    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
                    // Note: isRefreshing might still be true immediately after call due to async nature

                    // Should still auto-refresh after the interval
                    act(() => {
                        jest.advanceTimersByTime(interval);
                    });

                    expect(mockOnRefresh).toHaveBeenCalledTimes(2);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 9: Auto-refresh Timing Consistency - should track last refresh time accurately', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1000, max: 30000 }), // 1 to 30 seconds
                (interval) => {
                    const mockOnRefresh = jest.fn(() => Promise.resolve());
                    const startTime = Date.now();

                    const { result } = renderHook(() =>
                        useAutoRefresh({
                            onRefresh: mockOnRefresh,
                            interval: interval,
                            enabled: true,
                        })
                    );

                    // Initially no last refresh time
                    expect(result.current.lastRefreshTime).toBeNull();

                    // Trigger manual refresh
                    act(() => {
                        result.current.refreshNow();
                    });

                    // Wait for async refresh to complete
                    act(() => {
                        jest.runAllTimers();
                    });

                    // Should have a last refresh time
                    expect(result.current.lastRefreshTime).not.toBeNull();
                    if (result.current.lastRefreshTime) {
                        expect(result.current.lastRefreshTime.getTime()).toBeGreaterThanOrEqual(startTime);
                    }

                    const firstRefreshTime = result.current.lastRefreshTime;

                    // Wait and trigger auto refresh
                    act(() => {
                        jest.advanceTimersByTime(interval);
                    });

                    // Last refresh time should be updated
                    expect(result.current.lastRefreshTime).not.toBeNull();
                    expect(result.current.lastRefreshTime!.getTime()).toBeGreaterThanOrEqual(firstRefreshTime!.getTime());

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 9: Auto-refresh Timing Consistency - should handle refresh failures gracefully', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 5000, max: 30000 }), // 5 to 30 seconds
                (interval) => {
                    const mockOnRefresh = jest.fn(() => Promise.reject(new Error('Refresh failed')));

                    const { result } = renderHook(() =>
                        useAutoRefresh({
                            onRefresh: mockOnRefresh,
                            interval: interval,
                            enabled: true,
                        })
                    );

                    // Trigger refresh that will fail
                    act(() => {
                        result.current.refreshNow();
                    });

                    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

                    // Should continue to auto-refresh even after failure
                    act(() => {
                        jest.advanceTimersByTime(interval);
                    });

                    expect(mockOnRefresh).toHaveBeenCalledTimes(2);
                    expect(result.current.isActive).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});