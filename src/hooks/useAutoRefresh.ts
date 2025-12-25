import { useEffect, useRef, useCallback, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

interface UseAutoRefreshOptions {
    /**
     * Callback function to execute on each refresh
     */
    onRefresh: () => void | Promise<void>;

    /**
     * Refresh interval in milliseconds when tab is active
     * @default 60000 (60 seconds)
     */
    interval?: number;

    /**
     * Refresh interval in milliseconds when tab is inactive
     * @default 300000 (5 minutes)
     */
    inactiveInterval?: number;

    /**
     * Whether auto-refresh is enabled
     * @default true
     */
    enabled?: boolean;

    /**
     * Whether to pause refresh when network is offline
     * @default true
     */
    pauseWhenOffline?: boolean;

    /**
     * Whether to pause refresh when modals are open
     * @default true
     */
    pauseWhenModalOpen?: boolean;
}

/**
 * Custom hook for auto-refreshing data at a specified interval
 * 
 * Features:
 * - Configurable refresh interval (default: 60 seconds active, 5 minutes inactive)
 * - Automatic cleanup on component unmount
 * - Network connectivity detection (pauses when offline)
 * - Tab visibility detection (reduced frequency when inactive)
 * - Modal detection (pauses when modals are open)
 * - Can be enabled/disabled dynamically
 * - Maintains filter state across refreshes
 * 
 * @example
 * ```tsx
 * const { isRefreshing, lastRefreshTime, forceRefresh, pause, resume } = useAutoRefresh({
 *   onRefresh: fetchData,
 *   interval: 60000,
 *   enabled: true,
 * });
 * ```
 */
export function useAutoRefresh({
    onRefresh,
    interval = 60000,
    inactiveInterval = 300000,
    enabled = true,
    pauseWhenOffline = true,
    pauseWhenModalOpen = true,
}: UseAutoRefreshOptions) {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const { isOnline } = useNetworkStatus();

    // Track refresh state
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

    // Track tab visibility
    const [isTabActive, setIsTabActive] = useState(() => {
        // Only access document in browser environment
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            return !document.hidden;
        }
        return true; // Default to active during SSR
    });

    // Track modal state
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Track manual pause state
    const [isManuallyPaused, setIsManuallyPaused] = useState(false);

    // Stable reference to onRefresh callback
    const onRefreshRef = useRef(onRefresh);
    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    // Track tab visibility changes
    useEffect(() => {
        // Only set up visibility tracking in browser environment
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        const handleVisibilityChange = () => {
            setIsTabActive(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Detect modal state by checking for modal elements in DOM
    useEffect(() => {
        const checkModalState = () => {
            // Only check for modals in browser environment
            if (typeof window === 'undefined' || typeof document === 'undefined') {
                setIsModalOpen(false);
                return;
            }

            // Check for common modal indicators
            const hasModal = !!(
                document.querySelector('[role="dialog"]') ||
                document.querySelector('.modal') ||
                document.querySelector('[data-modal]') ||
                document.querySelector('.overlay') ||
                document.body.classList.contains('modal-open')
            );
            setIsModalOpen(hasModal);
        };

        // Initial check
        checkModalState();

        // Set up mutation observer to watch for modal changes (browser only)
        let observer: MutationObserver | null = null;
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            observer = new MutationObserver(checkModalState);
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'role', 'data-modal']
            });
        }

        return () => {
            if (observer) {
                observer.disconnect();
            }
        };
    }, []);

    // Execute refresh
    const executeRefresh = useCallback(async () => {
        if (isRefreshing) {
            return; // Prevent concurrent refreshes
        }

        try {
            setIsRefreshing(true);
            await onRefreshRef.current();
            setLastRefreshTime(new Date());
        } catch (error) {
            console.error('Auto-refresh error:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing]);

    // Force refresh (can be called manually)
    const forceRefresh = useCallback(() => {
        executeRefresh();
    }, [executeRefresh]);

    // Manual pause/resume controls
    const pause = useCallback(() => {
        setIsManuallyPaused(true);
    }, []);

    const resume = useCallback(() => {
        setIsManuallyPaused(false);
    }, []);

    // Determine if refresh should be paused
    const shouldPause = !enabled ||
        isManuallyPaused ||
        (pauseWhenOffline && !isOnline) ||
        (pauseWhenModalOpen && isModalOpen);

    // Determine current interval based on tab activity
    const currentInterval = isTabActive ? interval : inactiveInterval;

    // Set up auto-refresh interval
    useEffect(() => {
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Don't set up interval if paused
        if (shouldPause) {
            return;
        }

        // Set up new interval
        intervalRef.current = setInterval(() => {
            executeRefresh();
        }, currentInterval);

        // Cleanup on unmount or when dependencies change
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [shouldPause, currentInterval, executeRefresh]);

    // Manual refresh button functionality
    const refreshNow = useCallback(async () => {
        await executeRefresh();
        // Reset the auto-refresh timer after manual refresh
        if (!shouldPause && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                executeRefresh();
            }, currentInterval);
        }
    }, [executeRefresh, shouldPause, currentInterval]);

    return {
        /**
         * Whether a refresh is currently in progress
         */
        isRefreshing,

        /**
         * Timestamp of the last successful refresh
         */
        lastRefreshTime,

        /**
         * Manually trigger a refresh (alias for forceRefresh)
         */
        forceRefresh,

        /**
         * Manually trigger a refresh and reset the auto-refresh timer
         */
        refreshNow,

        /**
         * Manually pause auto-refresh
         */
        pause,

        /**
         * Resume auto-refresh after manual pause
         */
        resume,

        /**
         * Whether auto-refresh is currently active
         */
        isActive: !shouldPause,

        /**
         * Whether the browser tab is currently active
         */
        isTabActive,

        /**
         * Whether a modal is currently open
         */
        isModalOpen,

        /**
         * Whether auto-refresh is manually paused
         */
        isManuallyPaused,

        /**
         * Current refresh interval being used
         */
        currentInterval,
    };
}
