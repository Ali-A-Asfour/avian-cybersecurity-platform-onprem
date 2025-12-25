import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface KPICardProps {
    title: string;
    value: number | string;
    subtitle: string;
    trend?: 'up' | 'down' | 'stable';
    trendValue?: number;
    onClick: () => void;
    loading?: boolean;
    error?: string;
}

const KPICardComponent: React.FC<KPICardProps> = ({
    title,
    value,
    subtitle,
    trend,
    trendValue,
    onClick,
    loading = false,
    error
}) => {
    // Generate accessible description for screen readers
    const getTrendDescription = () => {
        if (!trend || trendValue === undefined) return '';
        const direction = trend === 'up' ? 'increased' : trend === 'down' ? 'decreased' : 'remained stable';
        return `, trend has ${direction} by ${trendValue} percent`;
    };

    const ariaLabel = `${title}: ${value} ${subtitle}${getTrendDescription()}. Click to view details.`;

    if (loading) {
        return (
            <div
                className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6 animate-pulse"
                role="status"
                aria-label={`Loading ${title} data`}
            >
                <div className="h-4 bg-neutral-700 rounded w-3/4 mb-4"></div>
                <div className="h-6 sm:h-8 bg-neutral-700 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-neutral-700 rounded w-2/3"></div>
                <span className="sr-only">Loading {title} data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="bg-neutral-800 border border-error-600 rounded-lg p-4 sm:p-6"
                role="alert"
                aria-label={`Error loading ${title}: ${error}`}
            >
                <div className="text-error-400 text-sm font-medium">{title}</div>
                <div className="text-error-300 text-xs mt-2">{error}</div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6 cursor-pointer transition-all duration-200",
                "hover:border-primary-500 hover:shadow-lg hover:shadow-primary-500/20",
                "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900",
                // Enhanced responsive design
                "min-h-[120px] sm:min-h-[140px]", // Consistent height across breakpoints
                "active:scale-95 active:transition-transform" // Touch feedback
            )}
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <div className="text-neutral-300 text-sm font-medium mb-2" id={`${title.replace(/\s+/g, '-').toLowerCase()}-title`}>
                {title}
            </div>
            <div
                className="text-white text-xl sm:text-2xl font-bold mb-1"
                aria-describedby={`${title.replace(/\s+/g, '-').toLowerCase()}-title`}
            >
                {value}
            </div>
            <div className="flex items-center justify-between">
                <div className="text-neutral-400 text-xs">{subtitle}</div>
                {trend && trendValue !== undefined && (
                    <div
                        className={cn(
                            "text-xs font-medium flex items-center gap-1",
                            trend === 'up' && "text-error-400",
                            trend === 'down' && "text-success-400",
                            trend === 'stable' && "text-neutral-400"
                        )}
                        aria-label={`Trend: ${trend === 'up' ? 'increasing' : trend === 'down' ? 'decreasing' : 'stable'} at ${trendValue} percent`}
                    >
                        <span aria-hidden="true">
                            {trend === 'up' && '↗'}
                            {trend === 'down' && '↘'}
                            {trend === 'stable' && '→'}
                        </span>
                        <span>{trendValue}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Memoize the component to prevent unnecessary re-renders
export const KPICard = memo(KPICardComponent, (prevProps, nextProps) => {
    return (
        prevProps.title === nextProps.title &&
        prevProps.value === nextProps.value &&
        prevProps.subtitle === nextProps.subtitle &&
        prevProps.trend === nextProps.trend &&
        prevProps.trendValue === nextProps.trendValue &&
        prevProps.loading === nextProps.loading &&
        prevProps.error === nextProps.error &&
        prevProps.onClick === nextProps.onClick
    );
});