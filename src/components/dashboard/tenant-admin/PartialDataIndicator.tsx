import React from 'react';
import { cn } from '@/lib/utils';

interface PartialDataIndicatorProps {
    availableComponents: string[];
    failedComponents: string[];
    onRetryComponent?: (component: string) => void;
    className?: string;
}

/**
 * Partial Data Indicator Component
 * 
 * Shows which dashboard components have data available and which failed,
 * allowing users to retry individual components while preserving
 * available data.
 */
export const PartialDataIndicator: React.FC<PartialDataIndicatorProps> = ({
    availableComponents,
    failedComponents,
    onRetryComponent,
    className
}) => {
    if (failedComponents.length === 0) return null;

    const totalComponents = availableComponents.length + failedComponents.length;
    const successRate = Math.round((availableComponents.length / totalComponents) * 100);

    return (
        <div className={cn(
            'bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4 mb-4',
            className
        )}>
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                    <div className="text-yellow-400 text-lg">⚠️</div>
                    <div>
                        <h4 className="text-yellow-300 font-medium text-sm">
                            Partial Data Available ({successRate}% loaded)
                        </h4>
                        <p className="text-yellow-400 text-xs mt-1">
                            Some dashboard components failed to load
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-yellow-300 text-xs">
                        {availableComponents.length} of {totalComponents} loaded
                    </div>
                </div>
            </div>

            {failedComponents.length > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-600/30">
                    <div className="text-yellow-400 text-xs mb-2">Failed components:</div>
                    <div className="flex flex-wrap gap-2">
                        {failedComponents.map((component) => (
                            <div
                                key={component}
                                className="flex items-center space-x-2 bg-yellow-900/30 rounded px-2 py-1"
                            >
                                <span className="text-yellow-300 text-xs">{component}</span>
                                {onRetryComponent && (
                                    <button
                                        onClick={() => onRetryComponent(component)}
                                        className="text-yellow-400 hover:text-yellow-300 text-xs font-medium transition-colors"
                                        title={`Retry ${component}`}
                                    >
                                        ↻
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-3 pt-3 border-t border-yellow-600/30">
                <div className="text-yellow-500 text-xs">
                    Available components continue to update automatically.
                    Failed components will retry on the next refresh cycle.
                </div>
            </div>
        </div>
    );
};