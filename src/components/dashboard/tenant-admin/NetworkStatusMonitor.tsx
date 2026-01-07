import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { NetworkErrorDetector, ErrorMonitor, DashboardError, ErrorContext } from '@/lib/errorHandling';
import { api } from '@/lib/api-client';

interface NetworkStatusMonitorProps {
    className?: string;
    onNetworkChange?: (isOnline: boolean) => void;
    onConnectionTest?: (success: boolean, latency?: number) => void;
}

interface ConnectionQuality {
    status: 'excellent' | 'good' | 'poor' | 'offline';
    latency: number | null;
    lastTest: Date | null;
}

/**
 * Enhanced Network Status Monitor
 * 
 * Provides comprehensive network monitoring with:
 * - Real-time online/offline detection
 * - Connection quality testing
 * - Automatic recovery mechanisms
 * - User-friendly status indicators
 */
export const NetworkStatusMonitor: React.FC<NetworkStatusMonitorProps> = ({
    className,
    onNetworkChange,
    onConnectionTest
}) => {
    const [isOnline, setIsOnline] = useState(true);
    const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
        status: 'excellent',
        latency: null,
        lastTest: null,
    });
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [lastOfflineTime, setLastOfflineTime] = useState<Date | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    // Test connection quality by pinging a lightweight endpoint
    const testConnectionQuality = useCallback(async (): Promise<{ success: boolean; latency: number | null }> => {
        try {
            const startTime = performance.now();

            // Use a lightweight endpoint for connection testing
            const response = await api.get('/api/health');

            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);

            if (response.ok) {
                return { success: true, latency };
            } else {
                return { success: false, latency: null };
            }
        } catch (error) {
            console.warn('Connection quality test failed:', error);
            return { success: false, latency: null };
        }
    }, []);

    // Update connection quality based on latency
    const updateConnectionQuality = useCallback((success: boolean, latency: number | null) => {
        let status: ConnectionQuality['status'];

        if (!success) {
            status = 'offline';
        } else if (latency === null) {
            status = 'poor';
        } else if (latency < 100) {
            status = 'excellent';
        } else if (latency < 300) {
            status = 'good';
        } else {
            status = 'poor';
        }

        setConnectionQuality({
            status,
            latency,
            lastTest: new Date(),
        });

        // Notify parent component
        if (onConnectionTest) {
            onConnectionTest(success, latency || undefined);
        }
    }, [onConnectionTest]);

    // Perform connection test
    const performConnectionTest = useCallback(async () => {
        if (isTestingConnection) return;

        setIsTestingConnection(true);
        try {
            const result = await testConnectionQuality();
            updateConnectionQuality(result.success, result.latency);
        } finally {
            setIsTestingConnection(false);
        }
    }, [isTestingConnection, testConnectionQuality, updateConnectionQuality]);

    // Handle online/offline events
    const handleOnline = useCallback(() => {
        setIsOnline(true);
        setLastOfflineTime(null);
        setReconnectAttempts(0);

        // Test connection quality when coming back online
        performConnectionTest();

        if (onNetworkChange) {
            onNetworkChange(true);
        }

        // Log recovery event
        const context: ErrorContext = {
            component: 'NetworkStatusMonitor',
            operation: 'network_recovery',
            timestamp: new Date().toISOString(),
        };

        console.log('Network connection restored', context);
    }, [onNetworkChange, performConnectionTest]);

    const handleOffline = useCallback(() => {
        setIsOnline(false);
        setLastOfflineTime(new Date());
        setConnectionQuality(prev => ({ ...prev, status: 'offline' }));

        if (onNetworkChange) {
            onNetworkChange(false);
        }

        // Log network failure
        const context: ErrorContext = {
            component: 'NetworkStatusMonitor',
            operation: 'network_failure',
            timestamp: new Date().toISOString(),
        };

        const networkError = new DashboardError(
            'Network connection lost',
            'NETWORK_ERROR',
            context,
            {
                retryable: true,
                userMessage: 'Network connection has been lost. Attempting to reconnect...',
            }
        );

        ErrorMonitor.logError(networkError);
    }, [onNetworkChange]);

    // Automatic reconnection attempts
    useEffect(() => {
        if (!isOnline && reconnectAttempts < 5) {
            const timeout = setTimeout(() => {
                setReconnectAttempts(prev => prev + 1);
                performConnectionTest();
            }, Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)); // Exponential backoff, max 30s

            return () => clearTimeout(timeout);
        }
    }, [isOnline, reconnectAttempts, performConnectionTest]);

    // Set up event listeners and periodic testing
    useEffect(() => {
        // Set initial state
        setIsOnline(navigator.onLine);

        // Add event listeners for online/offline
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Periodic connection quality testing (every 30 seconds when online)
        const qualityTestInterval = setInterval(() => {
            if (isOnline && !isTestingConnection) {
                performConnectionTest();
            }
        }, 30000);

        // Initial connection test
        if (navigator.onLine) {
            performConnectionTest();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(qualityTestInterval);
        };
    }, [handleOnline, handleOffline, isOnline, isTestingConnection, performConnectionTest]);

    // Get status display information
    const getStatusInfo = () => {
        if (!isOnline) {
            return {
                color: 'text-red-400',
                bgColor: 'bg-red-500',
                icon: '🔴',
                label: 'Offline',
                description: reconnectAttempts > 0
                    ? `Reconnecting... (attempt ${reconnectAttempts}/5)`
                    : 'No connection',
            };
        }

        switch (connectionQuality.status) {
            case 'excellent':
                return {
                    color: 'text-green-400',
                    bgColor: 'bg-green-500',
                    icon: '🟢',
                    label: 'Excellent',
                    description: connectionQuality.latency ? `${connectionQuality.latency}ms` : 'Connected',
                };
            case 'good':
                return {
                    color: 'text-yellow-400',
                    bgColor: 'bg-yellow-500',
                    icon: '🟡',
                    label: 'Good',
                    description: connectionQuality.latency ? `${connectionQuality.latency}ms` : 'Connected',
                };
            case 'poor':
                return {
                    color: 'text-orange-400',
                    bgColor: 'bg-orange-500',
                    icon: '🟠',
                    label: 'Poor',
                    description: connectionQuality.latency ? `${connectionQuality.latency}ms` : 'Slow connection',
                };
            default:
                return {
                    color: 'text-gray-400',
                    bgColor: 'bg-gray-500',
                    icon: '⚪',
                    label: 'Unknown',
                    description: 'Testing...',
                };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <div className={cn('flex items-center space-x-2 text-sm', className)}>
            {/* Status Indicator */}
            <div
                className={cn(
                    'w-2 h-2 rounded-full',
                    statusInfo.bgColor,
                    !isOnline && 'animate-pulse'
                )}
                aria-hidden="true"
            />

            {/* Status Text */}
            <div className="flex items-center space-x-1">
                <span className={statusInfo.color}>
                    {statusInfo.label}
                </span>
                {connectionQuality.latency && isOnline && (
                    <span className="text-neutral-500 text-xs">
                        ({connectionQuality.latency}ms)
                    </span>
                )}
            </div>

            {/* Manual Test Button */}
            <button
                onClick={performConnectionTest}
                disabled={isTestingConnection}
                className="text-neutral-400 hover:text-neutral-300 text-xs transition-colors disabled:opacity-50"
                title="Test connection quality"
                aria-label="Test connection quality"
            >
                {isTestingConnection ? (
                    <span className="inline-block animate-spin">⟳</span>
                ) : (
                    '🔄'
                )}
            </button>

            {/* Offline Time Display */}
            {!isOnline && lastOfflineTime && (
                <span className="text-red-500 text-xs">
                    since {lastOfflineTime.toLocaleTimeString()}
                </span>
            )}

            {/* Connection Quality Tooltip */}
            {isOnline && connectionQuality.lastTest && (
                <div className="hidden sm:block text-neutral-500 text-xs">
                    Last tested: {connectionQuality.lastTest.toLocaleTimeString()}
                </div>
            )}
        </div>
    );
};