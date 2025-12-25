import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface NetworkStatusIndicatorProps {
    className?: string;
}

/**
 * Network Status Indicator Component
 * 
 * Displays connection status and provides retry mechanisms
 * for network failures. Shows online/offline status with
 * appropriate visual indicators.
 */
export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
    className
}) => {
    const [isOnline, setIsOnline] = useState(true);
    const [lastOfflineTime, setLastOfflineTime] = useState<Date | null>(null);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setLastOfflineTime(null);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setLastOfflineTime(new Date());
        };

        // Set initial state
        setIsOnline(navigator.onLine);

        // Add event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) {
        return (
            <div className={cn('flex items-center space-x-2 text-sm', className)}>
                <div className="w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></div>
                <span className="text-neutral-400">Connected</span>
            </div>
        );
    }

    return (
        <div className={cn('flex items-center space-x-2 text-sm', className)}>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true"></div>
            <span className="text-red-400">
                Offline
                {lastOfflineTime && (
                    <span className="text-neutral-500 ml-1">
                        since {lastOfflineTime.toLocaleTimeString()}
                    </span>
                )}
            </span>
        </div>
    );
};