import React, { useState, useCallback, memo, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AlertsTrendGraphProps {
    data: Array<{ date: string; alertCount: number }>;
    onPointClick: (date: string) => void;
    loading?: boolean;
    error?: string;
}

const AlertsTrendGraphComponent: React.FC<AlertsTrendGraphProps> = ({
    data,
    onPointClick,
    loading = false,
    error
}) => {
    const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    if (loading) {
        return (
            <div
                className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6 h-48 sm:h-64"
                role="status"
                aria-label="Loading security alerts trend data"
            >
                <div className="animate-pulse">
                    <div className="h-4 bg-neutral-700 rounded w-1/4 mb-4"></div>
                    <div className="h-32 sm:h-48 bg-neutral-700 rounded"></div>
                </div>
                <span className="sr-only">Loading security alerts trend data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="bg-neutral-800 border border-error-600 rounded-lg p-4 sm:p-6 h-48 sm:h-64 flex items-center justify-center"
                role="alert"
                aria-label={`Error loading alerts trend: ${error}`}
            >
                <div className="text-error-300 text-center">
                    <div className="text-error-400 font-medium mb-2">Failed to load alerts trend</div>
                    <div className="text-sm">{error}</div>
                </div>
            </div>
        );
    }

    // Memoize date formatting function to prevent recreation on every render
    const formatDate = useCallback((dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }, []);

    // Handle mouse events for hover state management
    const handleMouseEnter = useCallback((data: any) => {
        if (data && data.activeLabel) {
            setHoveredPoint(data.activeLabel);
            setIsInteracting(true);
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHoveredPoint(null);
        setIsInteracting(false);
    }, []);

    // Handle click events for navigation
    const handleChartClick = useCallback((data: any) => {
        if (data && data.activeLabel) {
            try {
                onPointClick(data.activeLabel);
            } catch (err) {
                console.error('Error handling chart click:', err);
            }
        }
    }, [onPointClick]);

    // Memoize tooltip component to prevent unnecessary re-renders
    const CustomTooltip = useMemo(() => ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-neutral-900 border border-neutral-600 rounded-lg p-3 shadow-lg">
                    <p className="text-neutral-300 text-sm">{formatDate(label)}</p>
                    <p className="text-green-400 font-medium">
                        {payload[0].value} alerts
                    </p>
                    <p className="text-neutral-400 text-xs mt-1">Click to view details</p>
                </div>
            );
        }
        return null;
    }, [formatDate]);

    return (
        <div
            className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
            role="img"
            aria-label={`Security alerts trend chart showing ${data.length} days of data. ${data.reduce((sum, item) => sum + item.alertCount, 0)} total alerts in the period.`}
        >
            <h3 className="text-white text-base sm:text-lg font-semibold mb-4">
                Security Alerts Trend (7 Days)
            </h3>
            <div
                className={`h-40 sm:h-48 transition-opacity duration-200 ${isInteracting ? 'cursor-pointer' : ''}`}
                tabIndex={0}
                role="button"
                aria-label="Interactive chart - use arrow keys to navigate data points, press Enter to view details"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && hoveredPoint) {
                        onPointClick(hoveredPoint);
                    }
                }}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                        onClick={handleChartClick}
                        onMouseMove={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDate}
                            stroke="#9CA3AF"
                            fontSize={10}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            stroke="#9CA3AF"
                            fontSize={10}
                            width={30}
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ stroke: '#029904', strokeWidth: 1, strokeDasharray: '3 3' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="alertCount"
                            stroke="#029904"
                            strokeWidth={2}
                            dot={{
                                fill: '#029904',
                                strokeWidth: 2,
                                r: 3,
                                cursor: 'pointer'
                            }}
                            activeDot={{
                                r: 6,
                                stroke: '#029904',
                                strokeWidth: 3,
                                fill: '#1F2937',
                                cursor: 'pointer'
                            }}
                            animationDuration={300}
                            animationEasing="ease-in-out"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            {hoveredPoint && (
                <div className="mt-2 text-sm text-neutral-400" aria-live="polite">
                    Hover over {formatDate(hoveredPoint)} - Click to view detailed alerts
                </div>
            )}
            {/* Screen reader accessible data summary */}
            <div className="sr-only">
                Chart data summary:
                {data.map((item, index) => (
                    <span key={item.date}>
                        {formatDate(item.date)}: {item.alertCount} alerts
                        {index < data.length - 1 ? ', ' : ''}
                    </span>
                ))}
            </div>
        </div>
    );
};

// Memoize the component to prevent unnecessary re-renders
// Only re-render when props actually change
export const AlertsTrendGraph = memo(AlertsTrendGraphComponent, (prevProps, nextProps) => {
    // Custom comparison for data array
    if (prevProps.data.length !== nextProps.data.length) return false;

    // Deep comparison for data array items
    for (let i = 0; i < prevProps.data.length; i++) {
        if (prevProps.data[i].date !== nextProps.data[i].date ||
            prevProps.data[i].alertCount !== nextProps.data[i].alertCount) {
            return false;
        }
    }

    // Compare other props
    return (
        prevProps.loading === nextProps.loading &&
        prevProps.error === nextProps.error &&
        prevProps.onPointClick === nextProps.onPointClick
    );
});