'use client';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface ConnectionStatusIndicatorProps {
    /**
     * Additional CSS classes
     */
    className?: string;

    /**
     * Whether to show the indicator when online
     * @default false
     */
    showWhenOnline?: boolean;
}

/**
 * Connection status indicator component
 * 
 * Displays a banner when the user is offline
 * Optionally shows status when online
 */
export function ConnectionStatusIndicator({
    className = '',
    showWhenOnline = false,
}: ConnectionStatusIndicatorProps) {
    const { isOnline, isInitialized } = useNetworkStatus();

    // Don't show anything until initialized
    if (!isInitialized) {
        return null;
    }

    // Don't show when online unless explicitly requested
    if (isOnline && !showWhenOnline) {
        return null;
    }

    return (
        <div
            className={`
        fixed top-0 left-0 right-0 z-50
        ${isOnline ? 'bg-green-500' : 'bg-red-500'}
        text-white px-4 py-2 text-center text-sm font-medium
        shadow-lg
        ${className}
      `}
            role="alert"
            aria-live="polite"
        >
            {isOnline ? 'Connected' : 'No internet connection'}
        </div>
    );
}
