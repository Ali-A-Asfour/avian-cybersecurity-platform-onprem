import React, { useState, useCallback, memo, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface TicketBreakdownChartProps {
    data: {
        securityTickets: { created: number; resolved: number };
        helpdeskTickets: { created: number; resolved: number };
    };
    chartType: 'donut' | 'bar';
    onSegmentClick: (type: 'security' | 'helpdesk') => void;
    loading?: boolean;
}

const TicketBreakdownChartComponent: React.FC<TicketBreakdownChartProps> = ({
    data,
    chartType,
    onSegmentClick,
    loading = false
}) => {
    const [focusedSegment, setFocusedSegment] = useState<'security' | 'helpdesk' | null>(null);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Navigate to the segment with more tickets by default
            const securityTotal = data.securityTickets.created + data.securityTickets.resolved;
            const helpdeskTotal = data.helpdeskTickets.created + data.helpdeskTickets.resolved;
            const defaultSegment = securityTotal >= helpdeskTotal ? 'security' : 'helpdesk';
            onSegmentClick(focusedSegment || defaultSegment);
        }
    }, [data, focusedSegment, onSegmentClick]);

    if (loading) {
        return (
            <div
                className="flex flex-col bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
                style={{ minHeight: '280px' }}
                role="status"
                aria-label="Loading ticket breakdown data"
            >
                <div className="animate-pulse">
                    <div className="h-4 bg-neutral-700 rounded w-1/2 mb-4"></div>
                    <div className="h-48 sm:h-64 bg-neutral-700 rounded"></div>
                </div>
                <span className="sr-only">Loading ticket breakdown data...</span>
            </div>
        );
    }

    // Memoize chart data to prevent unnecessary recalculations
    const donutData = useMemo(() => [
        {
            name: 'Security Tickets',
            value: data.securityTickets.created,
            resolved: data.securityTickets.resolved,
            type: 'security' as const
        },
        {
            name: 'Helpdesk Tickets',
            value: data.helpdeskTickets.created,
            resolved: data.helpdeskTickets.resolved,
            type: 'helpdesk' as const
        }
    ], [data.securityTickets.created, data.securityTickets.resolved, data.helpdeskTickets.created, data.helpdeskTickets.resolved]);

    const barData = useMemo(() => [
        {
            name: 'Security',
            created: data.securityTickets.created,
            resolved: data.securityTickets.resolved,
            type: 'security' as const
        },
        {
            name: 'Helpdesk',
            created: data.helpdeskTickets.created,
            resolved: data.helpdeskTickets.resolved,
            type: 'helpdesk' as const
        }
    ], [data.securityTickets.created, data.securityTickets.resolved, data.helpdeskTickets.created, data.helpdeskTickets.resolved]);

    // Memoize colors to prevent object recreation
    const COLORS = useMemo(() => ({
        'Security Tickets': '#E00008',
        'Helpdesk Tickets': '#029904'
    }), []);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-neutral-900 border border-neutral-600 rounded-lg p-3 shadow-lg">
                    <p className="text-neutral-300 text-sm mb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.dataKey}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const CustomLegend = (props: any) => {
        const { payload } = props;
        return (
            <div className="flex flex-col space-y-2" style={{ paddingTop: '12px' }}>
                {payload.map((entry: any, index: number) => {
                    const item = donutData.find(d => d.name === entry.value);
                    return (
                        <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div
                                    className="w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-neutral-300 text-sm">{entry.value}</span>
                            </div>
                            <span className="text-neutral-400 text-sm">
                                {item?.value} created, {item?.resolved} resolved
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Calculate optimal radius to prevent cutoff
    const containerHeight = 280;
    const maxRadius = Math.floor(containerHeight * 0.4);
    const outerRadius = Math.min(84, maxRadius);
    const innerRadius = 44;

    // Generate accessible description
    const totalSecurity = data.securityTickets.created + data.securityTickets.resolved;
    const totalHelpdesk = data.helpdeskTickets.created + data.helpdeskTickets.resolved;
    const chartDescription = `Ticket breakdown chart: ${data.securityTickets.created} security tickets created, ${data.securityTickets.resolved} resolved. ${data.helpdeskTickets.created} helpdesk tickets created, ${data.helpdeskTickets.resolved} resolved.`;

    if (chartType === 'donut') {
        return (
            <div
                className="flex flex-col bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
                style={{ minHeight: '280px', paddingTop: '10px' }}
                role="img"
                aria-label={chartDescription}
            >
                <h3 className="text-white text-base sm:text-lg font-semibold mb-4">Ticket Breakdown</h3>
                <div
                    style={{ height: '240px' }}
                    tabIndex={0}
                    role="button"
                    aria-label="Interactive ticket breakdown chart - press Enter to navigate to ticket details"
                    onKeyDown={handleKeyDown}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 20, right: 10, bottom: 20, left: 10 }}>
                            <Pie
                                data={donutData}
                                cx="50%"
                                cy="50%"
                                outerRadius={outerRadius}
                                innerRadius={innerRadius}
                                fill="#8884d8"
                                dataKey="value"
                                onClick={(data) => onSegmentClick(data.type)}
                                className="cursor-pointer focus:outline-none"
                            >
                                {donutData.map((entry, index) => (
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
                    Ticket breakdown data:
                    Security tickets: {data.securityTickets.created} created, {data.securityTickets.resolved} resolved.
                    Helpdesk tickets: {data.helpdeskTickets.created} created, {data.helpdeskTickets.resolved} resolved.
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex flex-col bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6"
            style={{ minHeight: '280px', paddingTop: '10px' }}
            role="img"
            aria-label={chartDescription}
        >
            <h3 className="text-white text-base sm:text-lg font-semibold mb-4">Ticket Breakdown</h3>
            <div
                style={{ height: '240px' }}
                tabIndex={0}
                role="button"
                aria-label="Interactive ticket breakdown bar chart - press Enter to navigate to ticket details"
                onKeyDown={handleKeyDown}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 20, right: 15, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                            dataKey="name"
                            stroke="#9CA3AF"
                            fontSize={10}
                        />
                        <YAxis
                            stroke="#9CA3AF"
                            fontSize={10}
                            width={30}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                            dataKey="created"
                            fill="#E00008"
                            name="Created"
                            onClick={(data) => onSegmentClick(data.type)}
                            className="cursor-pointer focus:outline-none"
                        />
                        <Bar
                            dataKey="resolved"
                            fill="#029904"
                            name="Resolved"
                            onClick={(data) => onSegmentClick(data.type)}
                            className="cursor-pointer focus:outline-none"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {/* Screen reader accessible data summary */}
            <div className="sr-only">
                Ticket breakdown data:
                Security tickets: {data.securityTickets.created} created, {data.securityTickets.resolved} resolved.
                Helpdesk tickets: {data.helpdeskTickets.created} created, {data.helpdeskTickets.resolved} resolved.
            </div>
        </div>
    );
};

// Memoize the component to prevent unnecessary re-renders
export const TicketBreakdownChart = memo(TicketBreakdownChartComponent, (prevProps, nextProps) => {
    // Compare data object properties
    const prevData = prevProps.data;
    const nextData = nextProps.data;

    return (
        prevData.securityTickets.created === nextData.securityTickets.created &&
        prevData.securityTickets.resolved === nextData.securityTickets.resolved &&
        prevData.helpdeskTickets.created === nextData.helpdeskTickets.created &&
        prevData.helpdeskTickets.resolved === nextData.helpdeskTickets.resolved &&
        prevProps.chartType === nextProps.chartType &&
        prevProps.loading === nextProps.loading &&
        prevProps.onSegmentClick === nextProps.onSegmentClick
    );
});