import React from 'react';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
    variant?: 'default' | 'compact';
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
    title = 'Error',
    message,
    onRetry,
    retryLabel = 'Try Again',
    className,
    variant = 'default'
}) => {
    if (variant === 'compact') {
        return (
            <div className={cn(
                'flex items-center justify-between p-3 bg-error-900/20 border border-error-600 rounded-lg',
                className
            )}>
                <div className="flex items-center space-x-2">
                    <div className="text-error-400 text-sm">⚠️</div>
                    <span className="text-error-300 text-sm">{message}</span>
                </div>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="text-error-400 hover:text-error-300 text-sm font-medium transition-colors"
                    >
                        {retryLabel}
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
            {onRetry && (
                <button
                    onClick={onRetry}
                    className={cn(
                        'px-4 py-2 bg-error-600 hover:bg-error-700 text-white text-sm font-medium rounded-lg',
                        'transition-colors focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 focus:ring-offset-neutral-900'
                    )}
                >
                    {retryLabel}
                </button>
            )}
        </div>
    );
};