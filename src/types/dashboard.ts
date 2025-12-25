// Core dashboard data types
export interface ActivityItem {
    id: string;
    timestamp: string;
    description: string;
    type: 'alert' | 'compliance' | 'device' | 'ticket' | 'integration';
    icon: string;
}

export interface KPIData {
    criticalAlerts: number;
    securityTicketsOpen: number;
    helpdeskTicketsOpen: number;
    complianceScore: number;
}

export interface AlertsTrendData {
    date: string;
    alertCount: number;
}

export interface DeviceCoverageData {
    protected: number;
    missingAgent: number;
    withAlerts: number;
    total: number;
}

export interface TicketBreakdownData {
    securityTickets: { created: number; resolved: number };
    helpdeskTickets: { created: number; resolved: number };
}

export interface IntegrationHealthData {
    serviceName: string;
    status: 'healthy' | 'warning' | 'error';
    lastSync: string;
}

// Main dashboard data model
export interface DashboardData {
    kpis: KPIData;
    alertsTrend: Array<AlertsTrendData>;
    deviceCoverage: DeviceCoverageData;
    ticketBreakdown: TicketBreakdownData;
    integrations: Array<IntegrationHealthData>;
    recentActivity: Array<ActivityItem>;
    lastUpdated: string;
}

// API Response Models
export interface KPIResponse {
    criticalAlerts: number;
    securityTicketsOpen: number;
    helpdeskTicketsOpen: number;
    complianceScore: number;
    timestamp: string;
}

export interface AlertsTrendResponse {
    data: Array<AlertsTrendData>;
    period: string;
    timestamp: string;
}

export interface DeviceCoverageResponse {
    protected: number;
    missingAgent: number;
    withAlerts: number;
    total: number;
    timestamp: string;
}

export interface TicketBreakdownResponse {
    securityTickets: { created: number; resolved: number };
    helpdeskTickets: { created: number; resolved: number };
    timestamp: string;
}

export interface IntegrationsResponse {
    integrations: Array<IntegrationHealthData>;
    timestamp: string;
}

export interface RecentActivityResponse {
    activities: Array<ActivityItem>;
    timestamp: string;
}

// Component prop types
export interface KPICardProps {
    title: string;
    value: number | string;
    subtitle: string;
    trend?: 'up' | 'down' | 'stable';
    trendValue?: number;
    onClick: () => void;
    loading?: boolean;
    error?: string;
}

export interface AlertsTrendGraphProps {
    data: Array<AlertsTrendData>;
    onPointClick: (date: string) => void;
    loading?: boolean;
    error?: string;
}

export interface DeviceCoverageChartProps {
    data: DeviceCoverageData;
    onSegmentClick: (segment: 'protected' | 'missing-agent' | 'with-alerts') => void;
    loading?: boolean;
}

export interface TicketBreakdownChartProps {
    data: TicketBreakdownData;
    chartType: 'donut' | 'bar';
    onSegmentClick: (type: 'security' | 'helpdesk') => void;
    loading?: boolean;
}

export interface IntegrationHealthPanelProps {
    integrations: Array<IntegrationHealthData>;
    onIntegrationClick: (serviceName: string) => void;
}

export interface RecentActivityFeedProps {
    activities: Array<ActivityItem>;
    onActivityClick: (activity: ActivityItem) => void;
    loading?: boolean;
}

// Navigation and routing types
export type NavigationTarget =
    | { type: 'alerts'; filters?: { severity?: string; timeRange?: string; date?: string; startDate?: string; endDate?: string } }
    | { type: 'tickets'; filters?: { type?: 'security' | 'helpdesk'; status?: string; id?: string } }
    | { type: 'compliance'; filters?: { view?: string; event?: string } }
    | { type: 'assets'; filters?: { filter?: string; deviceId?: string } }
    | { type: 'integrations'; filters?: { service?: string; event?: string } };

// Error handling types
export interface DashboardError {
    component: string;
    message: string;
    timestamp: string;
    retryable: boolean;
}

// Loading state types
export interface LoadingState {
    kpis: boolean;
    alertsTrend: boolean;
    deviceCoverage: boolean;
    ticketBreakdown: boolean;
    integrations: boolean;
    recentActivity: boolean;
}

// Auto-refresh configuration
export interface AutoRefreshConfig {
    enabled: boolean;
    interval: number; // in milliseconds
    pauseOnModal: boolean;
    reducedFrequencyOnInactive: boolean;
    inactiveInterval: number; // in milliseconds
}

// Dashboard state management
export interface DashboardState {
    data: DashboardData | null;
    loading: LoadingState;
    errors: Record<string, DashboardError | null>;
    lastRefresh: string | null;
    autoRefresh: AutoRefreshConfig;
}