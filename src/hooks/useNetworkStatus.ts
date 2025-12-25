import { useState, useEffect } from 'react';

interface NetworkStatus {
    /**
     * Whether the browser is currently online
     */
    isOnline: boolean;

    /**
     * Timestamp of the last status change
     */
    lastStatusChange: Date | null;

    /**
     * Whether the network status has been checked at least once
     */
    isInitialized: boolean;
}

/**
 * Custom hook for detecting network connectivity status
 * 
 * Features:
 * - Real-time online/offline detection
 * - Tracks last status change timestamp
 * - Works with browser's online/offline events
 * - Provides initialization state
 * 
 * @example
 * ```tsx
 * const { isOnline, lastStatusChange } = useNetworkStatus();
 * 
 * if (!isOnline) {
 *   return <div>You are offline. Please check your connection.</div>;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [lastStatusChange, setLastStatusChange] = useState<Date | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // Mark as initialized after first render
        setIsInitialized(true);

        // Handler for online event
        const handleOnline = () => {
            setIsOnline(true);
            setLastStatusChange(new Date());
        };

        // Handler for offline event
        const handleOffline = () => {
            setIsOnline(false);
            setLastStatusChange(new Date());
        };

        // Add event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cleanup event listeners on unmount
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return {
        isOnline,
        lastStatusChange,
        isInitialized,
    };
}
