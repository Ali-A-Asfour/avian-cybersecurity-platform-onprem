import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface RetryableErrorMessageProps {
    title?: string;
    message: string;
    onRetry?: () => Promise<void>;
    retryLabel?: string;
    className?: string;
    variant?: 'default' | 'compact' | 'inline';
    maxRetries?: number;
    retryDelay?: number;
}

/**
 * Retryable Error Message Component
 * 
 * Enhanced error message with exponential backoff retry mechanism
 * and user-friendly error recovery actions.
 */
export const RetryableErrorMessage: React.FC<RetryableErrorMessageProps> = ({
    title = 'Error',
    message,
    onRetry,
    retryLabel = 'Try Again',
    className,
    variant = 'default',
    maxRetries = 3,
    retryDelay = 1000
}) => {
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [lastRetryTime, setLastRetryTime] = useState<Date | null>(null);

    const handleRetry = useCallback(async () => {
        if (!onRetry || isRetrying || retryCount >= maxRetries) return;

        setIsRetrying(true);
        setLastRetryTime(new Date());

        try {
            // Exponential backoff: 1s, 2s, 4s, 8s
            const delay = retryDelay * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));

            await onRetry();

            // Reset retry count on success
            setRetryCount(0);
        } catch (error) {
            console.error('Retry failed:', error);
            setRetryCount(prev => prev + 1);
        } finally {
            setIsRetrying(false);
        }
    }, [onRetry, isRetrying, retryCount, maxRetries, retryDelay]);

    const canRetry = onRetry && retryCount < maxRetries;
    const retriesRemaining = maxRetries - retryCount;

    if (variant === 'inline') {
        return (
            <div className={cn(
                'flex items-center justify-between p-2 bg-error-900/10 border border-error-600/30 rounded text-sm',
                className
            )}>
                <span className="text-error-300">{message}</span>
                {canRetry && (
                    <button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="text-error-400 hover:text-error-300 font-medium transition-colors disabled:opacity-50"
                    >
                        {isRetrying ? 'Retrying...' : retryLabel}
                    </button>
                )}
            </div>
        );
    }

    if (variant === 'compact') {
        return (
            <div className={cn(
                'flex items-center justify-between p-3 bg-error-900/20 border border-error-600 rounded-lg',
                className
            )}>
                <div className="flex items-center space-x-2">
                    <div className="text-error-400 text-sm">⚠️</div>
                    <div>
                        <span className="text-error-300 text-sm">{message}</span>
                        {retryCount > 0 && (
                            <div className="text-error-500 text-xs mt-1">
                                {retriesRemaining} retries remaining
                            </div>
                        )}
                    </div>
                </div>
                {canRetry && (
                    <button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="text-error-400 hover:text-error-300 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isRetrying ? 'Retrying...' : retryLabel}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={cn(
            'bg-error-900/20 border border-error-600 rounded-lg p-6 text-center',
            className
        )}>
            <div className="text-error-400 text-4xl mb-3">⚠️</div>
            <h3 className="text-error-300 font-semibold mb-2">{title}</h3>
            <p className="text-error-400 text-sm mb-4">{message}</p>

            {retryCount > 0 && (
                <p className="text-error-500 text-xs mb-4">
                    Retry attempt {retryCount} of {maxRetries}
                    {lastRetryTime && (
                        <span className="block mt-1">
                            Last attempt: {lastRetryTime.toLocaleTimeString()}
                        </span>
                    )}
                </p>
            )}

            <div className="flex justify-center space-x-3">
                {canRetry && (
                    <button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className={cn(
                            'px-4 py-2 bg-error-600 hover:bg-error-700 text-white text-sm font-medium rounded-lg',
                            'transition-colors focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 focus:ring-offset-neutral-900',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                    >
                        {isRetrying ? (
                            <span className="flex items-center space-x-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Retrying...</span>
                            </span>
                        ) : (
                            retryLabel
                        )}
                    </button>
                )}

                {retryCount >= maxRetries && (
                    <div className="text-error-500 text-sm">
                        Maximum retries exceeded. Please refresh the page or contact support.
                    </div>
                )}
            </div>
        </div>
    );
};