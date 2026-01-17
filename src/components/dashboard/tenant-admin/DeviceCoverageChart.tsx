import React, { memo, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

interface DeviceCoverageChartProps {
    data: {
        protected: number;
        missingAgent: number;
        withAlerts: number;
        total: number;
    };
    onSegmentClick: (segment: 'protected' | 'missing-agent' | 'with-alerts') => void;
    loading?: boolean;
}

const DeviceCoverageChartComponent: React.FC<DeviceCoverageChartProps> = ({
    data,
    onSegmentClick,
    loading = false
}) => {
    if (loading) {
        return (
            <div
                className="flex flex-col bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
                style={{ minHeight: '320px' }}
                role="status"
                aria-label="Loading device coverage data"
            >
                <div className="animate-pulse">
                    <div className="h-4 bg-neutral-700 rounded w-1/2 mb-4"></div>
                    <div className="h-60 bg-neutral-700 rounded"></div>
                </div>
                <span className="sr-only">Loading device coverage data...</span>
            </div>
        );
    }

    // Memoize chart data to prevent unnecessary recalculations
    const chartData = useMemo(() => [
        {
            name: 'Protected',
            value: data.protected,
            percentage: Math.round((data.protected / data.total) * 100),
            segment: 'protected' as const
        },
        {
            name: 'Missing Agent',
            value: data.missingAgent,
            percentage: Math.round((data.missingAgent / data.total) * 100),
            segment: 'missing-agent' as const
        },
        {
            name: 'With Alerts',
            value: data.withAlerts,
            percentage: Math.round((data.withAlerts / data.total) * 100),
            segment: 'with-alerts' as const
        }
    ], [data.protected, data.missingAgent, data.withAlerts, data.total]);

    // Memoize colors to prevent object recreation
    const COLORS = useMemo(() => ({
        'Protected': '#029904',
        'Missing Agent': '#F0D002',
        'With Alerts': '#E00008'
    }), []);

    const CustomLabel = ({ cx, cy }: any) => {
        return (
            <text
                x={cx}
                y={cy + 4}
                fill="#FFFFFF"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={16}
                fontWeight={600}
            >
                <tspan x={cx} dy="-0.5em">{data.total}</tspan>
                <tspan x={cx} dy="1.2em" fontSize={12} fontWeight={400} fill="#D1D5DB">Total Devices</tspan>
            </text>
        );
    };

    const CustomLegend = (props: any) => {
        const { payload } = props;
        return (
            <div className="flex flex-col space-y-2" style={{ paddingTop: '12px' }}>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                            <div
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-neutral-300 text-sm">{entry.value}</span>
                        </div>
                        <span className="text-neutral-400 text-sm">
                            {chartData.find(d => d.name === entry.value)?.percentage}%
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    // Calculate optimal radius to prevent cutoff
    const containerHeight = 280;
    const maxRadius = Math.floor(containerHeight * 0.4);
    const outerRadius = Math.min(84, maxRadius);
    const innerRadius = 44;

    return (
        <div
            className="flex flex-col bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
            style={{ minHeight: '320px' }}
            role="img"
            aria-label={`Device coverage chart: ${data.protected} protected devices (${Math.round((data.protected / data.total) * 100)}%), ${data.missingAgent} missing agent (${Math.round((data.missingAgent / data.total) * 100)}%), ${data.withAlerts} with alerts (${Math.round((data.withAlerts / data.total) * 100)}%). Total: ${data.total} devices.`}
        >
            <h3 className="text-white text-base sm:text-lg font-semibold mb-4">Device Coverage</h3>
            <div
                style={{ height: '260px' }}
                tabIndex={0}
                role="button"
                aria-label="Interactive device coverage chart - press Enter to navigate to device details"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        // Navigate to the largest segment by default
                        const largestSegment = chartData.reduce((prev, current) =>
                            prev.value > current.value ? prev : current
                        );
                        onSegmentClick(largestSegment.segment);
                    }
                }}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 40, right: 20, bottom: 30, left: 20 }}>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={<CustomLabel />}
                            outerRadius={outerRadius}
                            innerRadius={innerRadius}
                            fill="#8884d8"
                            dataKey="value"
                            onClick={(data) => onSegmentClick(data.segment)}
                            className="cursor-pointer focus:outline-none"
                            animationDuration={400}
                            animationEasing="ease-out"
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[entry.name as keyof typeof COLORS]}
                                    stroke="#0f172a"
                                    strokeWidth={2}
                                    className="hover:opacity-80 transition-opacity focus:opacity-80"
                                />
                            ))}
                        </Pie>
                        <Legend content={<CustomLegend />} wrapperStyle={{ paddingTop: 12 }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {/* Screen reader accessible data summary */}
            <div className="sr-only">
                Device coverage breakdown:
                {chartData.map((item, index) => (
                    <span key={item.name}>
                        {item.name}: {item.value} devices ({item.percentage}%)
                        {index < chartData.length - 1 ? ', ' : ''}
                    </span>
                ))}
            </div>
        </div>
    );
};

// Memoize the component to prevent unnecessary re-renders
export const DeviceCoverageChart = memo(DeviceCoverageChartComponent, (prevProps, nextProps) => {
    // Compare data object properties
    const prevData = prevProps.data;
    const nextData = nextProps.data;

    return (
        prevData.protected === nextData.protected &&
        prevData.missingAgent === nextData.missingAgent &&
        prevData.withAlerts === nextData.withAlerts &&
        prevData.total === nextData.total &&
        prevProps.loading === nextProps.loading &&
        prevProps.onSegmentClick === nextProps.onSegmentClick
    );
});