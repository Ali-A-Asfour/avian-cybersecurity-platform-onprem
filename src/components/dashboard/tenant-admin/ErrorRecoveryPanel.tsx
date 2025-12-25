import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DashboardError, ErrorRecoveryActionFactory, UserFriendlyErrorMessages } from '@/lib/errorHandling';

interface ErrorRecoveryPanelProps {
    errors: Record<string, DashboardError | null>;
    onRetryComponent: (component: string) => Promise<void>;
    onRefreshAll: () => Promise<void>;
    className?: string;
}

interface RecoveryState {
    retrying: Record<string, boolean>;
    lastRetryTime: Record<string, Date>;
    retryCount: Record<string, number>;
}

/**
 * Error Recovery Panel Component
 * 
 * Provides comprehensive error recovery interface with:
 * - Individual component retry actions
 * - Bulk recovery operations
 * - User-friendly error explanations
 * - Recovery progress tracking
 */
export const ErrorRecoveryPanel: React.FC<ErrorRecoveryPanelProps> = ({
    errors,
    onRetryComponent,
    onRefreshAll,
    className
}) => {
    const [recoveryState, setRecoveryState] = useState<RecoveryState>({
        retrying: {},
        lastRetryTime: {},
        retryCount: {},
    });

    // Get list of failed components
    const failedComponents = Object.entries(errors)
        .filter(([_, error]) => error !== null)
        .map(([component, error]) => ({ component, error: error! }));

    // Handle individual component retry
    const handleRetryComponent = useCallback(async (component: string) => {
        if (recoveryState.retrying[component]) return;

        setRecoveryState(prev => ({
            ...prev,
            retrying: { ...prev.retrying, [component]: true },
            lastRetryTime: { ...prev.lastRetryTime, [component]: new Date() },
            retryCount: { ...prev.retryCount, [component]: (prev.retryCount[component] || 0) + 1 },
        }));

        try {
            await onRetryComponent(component);
        } catch (error) {
            console.error(`Failed to retry component ${component}:`, error);
        } finally {
            setRecoveryState(prev => ({
                ...prev,
                retrying: { ...prev.retrying, [component]: false },
            }));
        }
    }, [recoveryState.retrying, onRetryComponent]);

    // Handle refresh all
    const handleRefreshAll = useCallback(async () => {
        const allComponents = failedComponents.map(({ component }) => component);

        setRecoveryState(prev => {
            const newRetrying = { ...prev.retrying };
            const newLastRetryTime = { ...prev.lastRetryTime };
            const newRetryCount = { ...prev.retryCount };

            allComponents.forEach(component => {
                newRetrying[component] = true;
                newLastRetryTime[component] = new Date();
                newRetryCount[component] = (prev.retryCount[component] || 0) + 1;
            });

            return {
                retrying: newRetrying,
                lastRetryTime: newLastRetryTime,
                retryCount: newRetryCount,
            };
        });

        try {
            await onRefreshAll();
        } catch (error) {
            console.error('Failed to refresh all components:', error);
        } finally {
            setRecoveryState(prev => {
                const newRetrying = { ...prev.retrying };
                allComponents.forEach(component => {
                    newRetrying[component] = false;
                });
                return { ...prev, retrying: newRetrying };
            });
        }
    }, [failedComponents, onRefreshAll]);

    // Get error category for styling
    const getErrorCategory = (error: DashboardError): 'network' | 'server' | 'auth' | 'other' => {
        switch (error.code) {
            case 'NETWORK_ERROR':
            case 'TIMEOUT_ERROR':
                return 'network';
            case 'SERVER_ERROR':
            case 'RATE_LIMIT_ERROR':
                return 'server';
            case 'AUTHENTICATION_ERROR':
            case 'AUTHORIZATION_ERROR':
                return 'auth';
            default:
                return 'other';
        }
    };

    // Get category styling
    const getCategoryStyles = (category: string) => {
        switch (category) {
            case 'network':
                return {
                    bg: 'bg-blue-900/20',
                    border: 'border-blue-600/50',
                    text: 'text-blue-300',
                    icon: '🌐',
                };
            case 'server':
                return {
                    bg: 'bg-red-900/20',
                    border: 'border-red-600/50',
                    text: 'text-red-300',
                    icon: '🔧',
                };
            case 'auth':
                return {
                    bg: 'bg-yellow-900/20',
                    border: 'border-yellow-600/50',
                    text: 'text-yellow-300',
                    icon: '🔐',
                };
            default:
                return {
                    bg: 'bg-gray-900/20',
                    border: 'border-gray-600/50',
                    text: 'text-gray-300',
                    icon: '⚠️',
                };
        }
    };

    if (failedComponents.length === 0) return null;

    // Group errors by category
    const errorsByCategory = failedComponents.reduce((acc, { component, error }) => {
        const category = getErrorCategory(error);
        if (!acc[category]) acc[category] = [];
        acc[category].push({ component, error });
        return acc;
    }, {} as Record<string, Array<{ component: string; error: DashboardError }>>);

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-neutral-100">
                        Error Recovery
                    </h3>
                    <p className="text-sm text-neutral-400">
                        {failedComponents.length} component{failedComponents.length !== 1 ? 's' : ''} need attention
                    </p>
                </div>

                {/* Bulk Actions */}
                <div className="flex space-x-2">
                    <button
                        onClick={handleRefreshAll}
                        disabled={Object.values(recoveryState.retrying).some(Boolean)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                    >
                        {Object.values(recoveryState.retrying).some(Boolean) ? 'Retrying...' : 'Retry All'}
                    </button>
                </div>
            </div>

            {/* Error Categories */}
            {Object.entries(errorsByCategory).map(([category, categoryErrors]) => {
                const styles = getCategoryStyles(category);

                return (
                    <div
                        key={category}
                        className={cn(
                            'rounded-lg border p-4',
                            styles.bg,
                            styles.border
                        )}
                    >
                        {/* Category Header */}
                        <div className="flex items-center space-x-2 mb-3">
                            <span className="text-lg">{styles.icon}</span>
                            <h4 className={cn('font-medium capitalize', styles.text)}>
                                {category} Issues ({categoryErrors.length})
                            </h4>
                        </div>

                        {/* Error List */}
                        <div className="space-y-3">
                            {categoryErrors.map(({ component, error }) => {
                                const friendlyMessage = UserFriendlyErrorMessages.getMessage(error.code);
                                const isRetrying = recoveryState.retrying[component];
                                const retryCount = recoveryState.retryCount[component] || 0;
                                const lastRetryTime = recoveryState.lastRetryTime[component];

                                return (
                                    <div
                                        key={component}
                                        className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                {/* Component Name */}
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <h5 className="font-medium text-neutral-100 capitalize">
                                                        {component.replace(/([A-Z])/g, ' $1').trim()}
                                                    </h5>
                                                    {retryCount > 0 && (
                                                        <span className="text-xs text-neutral-500">
                                                            (Attempt {retryCount})
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Error Message */}
                                                <p className="text-sm text-neutral-400 mb-1">
                                                    {friendlyMessage.description}
                                                </p>

                                                {/* Suggestion */}
                                                <p className="text-xs text-neutral-500">
                                                    {friendlyMessage.suggestion}
                                                </p>

                                                {/* Last Retry Time */}
                                                {lastRetryTime && (
                                                    <p className="text-xs text-neutral-600 mt-1">
                                                        Last attempt: {lastRetryTime.toLocaleTimeString()}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Retry Button */}
                                            <button
                                                onClick={() => handleRetryComponent(component)}
                                                disabled={isRetrying || !error.retryable}
                                                className={cn(
                                                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                                                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-800',
                                                    error.retryable
                                                        ? 'bg-neutral-600 hover:bg-neutral-700 text-white focus:ring-neutral-500 disabled:opacity-50'
                                                        : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                                                )}
                                                title={error.retryable ? 'Retry this component' : 'This error is not retryable'}
                                            >
                                                {isRetrying ? (
                                                    <span className="flex items-center space-x-1">
                                                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                                        <span>Retrying</span>
                                                    </span>
                                                ) : error.retryable ? (
                                                    'Retry'
                                                ) : (
                                                    'Not Retryable'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Category-specific Actions */}
                        {category === 'auth' && (
                            <div className="mt-3 pt-3 border-t border-neutral-700">
                                <button
                                    onClick={() => window.location.href = '/login'}
                                    className="text-sm text-yellow-400 hover:text-yellow-300 font-medium transition-colors"
                                >
                                    → Go to Login Page
                                </button>
                            </div>
                        )}

                        {category === 'network' && (
                            <div className="mt-3 pt-3 border-t border-neutral-700">
                                <p className="text-xs text-blue-400">
                                    💡 Check your internet connection and try again
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Recovery Tips */}
            <div className="bg-neutral-800/30 border border-neutral-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-neutral-300 mb-2">Recovery Tips</h4>
                <ul className="text-xs text-neutral-400 space-y-1">
                    <li>• Network issues usually resolve automatically</li>
                    <li>• Server errors may require waiting a few minutes</li>
                    <li>• Authentication errors require logging in again</li>
                    <li>• Contact support if problems persist after multiple retries</li>
                </ul>
            </div>
        </div>
    );
};