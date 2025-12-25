import {
    KPIResponse,
    AlertsTrendResponse,
    DeviceCoverageResponse,
    TicketBreakdownResponse,
    IntegrationsResponse,
    RecentActivityResponse,
    KPIData,
    AlertsTrendData,
    DeviceCoverageData,
    TicketBreakdownData,
    IntegrationHealthData,
    ActivityItem,
} from '@/types/dashboard';
import {
    DashboardError,
    ErrorContext,
    RetryManager,
    NetworkErrorDetector,
    ErrorMonitor,
    GracefulDegradationManager,
} from '@/lib/errorHandling';

/**
 * Custom error class for dashboard API errors
 * @deprecated Use DashboardError from @/lib/errorHandling instead
 */
export class DashboardApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public endpoint?: string,
        public retryable: boolean = true
    ) {
        super(message);
        this.name = 'DashboardApiError';
    }
}

/**
 * Response validation schemas
 */
const validateKPIResponse = (data: any): data is KPIResponse => {
    return (
        typeof data === 'object' &&
        typeof data.criticalAlerts === 'number' &&
        typeof data.securityTicketsOpen === 'number' &&
        typeof data.helpdeskTicketsOpen === 'number' &&
        typeof data.complianceScore === 'number' &&
        typeof data.timestamp === 'string'
    );
};

const validateAlertsTrendResponse = (data: any): data is AlertsTrendResponse => {
    return (
        typeof data === 'object' &&
        Array.isArray(data.data) &&
        data.data.every((item: any) =>
            typeof item.date === 'string' &&
            typeof item.alertCount === 'number'
        ) &&
        typeof data.period === 'string' &&
        typeof data.timestamp === 'string'
    );
};

const validateDeviceCoverageResponse = (data: any): data is DeviceCoverageResponse => {
    return (
        typeof data === 'object' &&
        typeof data.protected === 'number' &&
        typeof data.missingAgent === 'number' &&
        typeof data.withAlerts === 'number' &&
        typeof data.total === 'number' &&
        typeof data.timestamp === 'string'
    );
};

const validateTicketBreakdownResponse = (data: any): data is TicketBreakdownResponse => {
    return (
        typeof data === 'object' &&
        typeof data.securityTickets === 'object' &&
        typeof data.securityTickets.created === 'number' &&
        typeof data.securityTickets.resolved === 'number' &&
        typeof data.helpdeskTickets === 'object' &&
        typeof data.helpdeskTickets.created === 'number' &&
        typeof data.helpdeskTickets.resolved === 'number' &&
        typeof data.timestamp === 'string'
    );
};

const validateIntegrationsResponse = (data: any): data is IntegrationsResponse => {
    return (
        typeof data === 'object' &&
        Array.isArray(data.integrations) &&
        data.integrations.every((item: any) =>
            typeof item.serviceName === 'string' &&
            ['healthy', 'warning', 'error'].includes(item.status) &&
            typeof item.lastSync === 'string'
        ) &&
        typeof data.timestamp === 'string'
    );
};

const validateRecentActivityResponse = (data: any): data is RecentActivityResponse => {
    return (
        typeof data === 'object' &&
        Array.isArray(data.activities) &&
        data.activities.every((item: any) =>
            typeof item.id === 'string' &&
            typeof item.timestamp === 'string' &&
            typeof item.description === 'string' &&
            ['alert', 'compliance', 'device', 'ticket', 'integration'].includes(item.type) &&
            typeof item.icon === 'string'
        ) &&
        typeof data.timestamp === 'string'
    );
};

/**
 * Data transformation utilities
 */
export class DashboardDataTransformer {
    static transformKPIData(response: KPIResponse): KPIData {
        return {
            criticalAlerts: response.criticalAlerts,
            securityTicketsOpen: response.securityTicketsOpen,
            helpdeskTicketsOpen: response.helpdeskTicketsOpen,
            complianceScore: response.complianceScore,
        };
    }

    static transformAlertsTrendData(response: AlertsTrendResponse): AlertsTrendData[] {
        return response.data.map(item => ({
            date: item.date,
            alertCount: item.alertCount,
        }));
    }

    static transformDeviceCoverageData(response: DeviceCoverageResponse): DeviceCoverageData {
        return {
            protected: response.protected,
            missingAgent: response.missingAgent,
            withAlerts: response.withAlerts,
            total: response.total,
        };
    }

    static transformTicketBreakdownData(response: TicketBreakdownResponse): TicketBreakdownData {
        return {
            securityTickets: {
                created: response.securityTickets.created,
                resolved: response.securityTickets.resolved,
            },
            helpdeskTickets: {
                created: response.helpdeskTickets.created,
                resolved: response.helpdeskTickets.resolved,
            },
        };
    }

    static transformIntegrationHealthData(response: IntegrationsResponse): IntegrationHealthData[] {
        return response.integrations.map(item => ({
            serviceName: item.serviceName,
            status: item.status,
            lastSync: item.lastSync,
        }));
    }

    static transformActivityData(response: RecentActivityResponse): ActivityItem[] {
        return response.activities.map(item => ({
            id: item.id,
            timestamp: item.timestamp,
            description: item.description,
            type: item.type,
            icon: item.icon,
        }));
    }
}

class DashboardApiService {
    private baseUrl = '/api/dashboard';
    private defaultTimeout = 10000; // 10 seconds
    private maxRetries = 3;

    /**
     * Enhanced fetch with comprehensive error handling and retry logic
     */
    private async fetchWithRetry<T>(
        url: string,
        validator: (data: any) => data is T,
        retries = this.maxRetries
    ): Promise<T> {
        const context: ErrorContext = {
            component: 'DashboardApiService',
            operation: `fetch_${url.split('/').pop() || 'unknown'}`,
            timestamp: new Date().toISOString(),
            url,
        };

        return RetryManager.executeWithRetry(
            async () => {
                // Create AbortController for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

                try {
                    const response = await fetch(url, {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errorCode = NetworkErrorDetector.getErrorCode(null, response);
                        const isRetryable = NetworkErrorDetector.isRetryableHttpError(response.status);

                        const error = new DashboardError(
                            `HTTP ${response.status}: ${response.statusText}`,
                            errorCode,
                            context,
                            { retryable: isRetryable }
                        );

                        ErrorMonitor.logError(error);
                        throw error;
                    }

                    const data = await response.json();

                    // Validate response structure
                    if (!validator(data)) {
                        const validationError = new DashboardError(
                            'Invalid response format from server',
                            'VALIDATION_ERROR',
                            context,
                            { retryable: false }
                        );

                        ErrorMonitor.logError(validationError);
                        throw validationError;
                    }

                    return data;
                } catch (error) {
                    clearTimeout(timeoutId);

                    // Handle network and timeout errors
                    if (NetworkErrorDetector.isNetworkError(error)) {
                        const networkError = new DashboardError(
                            error instanceof Error ? error.message : 'Network error occurred',
                            NetworkErrorDetector.getErrorCode(error),
                            context,
                            { retryable: true, cause: error instanceof Error ? error : undefined }
                        );

                        ErrorMonitor.logError(networkError);
                        throw networkError;
                    }

                    // Re-throw DashboardError instances
                    if (error instanceof DashboardError) {
                        throw error;
                    }

                    // Handle other errors
                    const unknownError = new DashboardError(
                        error instanceof Error ? error.message : 'Unknown error occurred',
                        'UNKNOWN_ERROR',
                        context,
                        { retryable: true, cause: error instanceof Error ? error : undefined }
                    );

                    ErrorMonitor.logError(unknownError);
                    throw unknownError;
                }
            },
            context,
            {
                maxRetries: retries,
                baseDelay: 1000,
                maxDelay: 30000,
                backoffMultiplier: 2,
                jitterMax: 500,
            }
        );
    }

    /**
     * Get KPI card data with enhanced error handling
     */
    async getKPIs(): Promise<KPIResponse> {
        try {
            return await this.fetchWithRetry<KPIResponse>(
                `${this.baseUrl}/kpis`,
                validateKPIResponse
            );
        } catch (error) {
            // Provide fallback data for graceful degradation
            if (error instanceof DashboardError && GracefulDegradationManager.shouldUseFallback(error)) {
                console.warn('Using fallback data for KPIs due to error:', error.message);
                return {
                    criticalAlerts: 0,
                    securityTicketsOpen: 0,
                    helpdeskTicketsOpen: 0,
                    complianceScore: 0,
                    timestamp: new Date().toISOString(),
                };
            }
            throw error;
        }
    }

    /**
     * Get alerts trend data with enhanced error handling
     */
    async getAlertsTrend(days: number = 7): Promise<AlertsTrendResponse> {
        if (days < 1 || days > 30) {
            const context: ErrorContext = {
                component: 'DashboardApiService',
                operation: 'getAlertsTrend',
                timestamp: new Date().toISOString(),
            };

            throw new DashboardApiError(
                'Days parameter must be between 1 and 30',
                400,
                'getAlertsTrend',
                false
            );
        }

        try {
            return await this.fetchWithRetry<AlertsTrendResponse>(
                `${this.baseUrl}/alerts-trend?days=${days}`,
                validateAlertsTrendResponse
            );
        } catch (error) {
            // Provide fallback data for graceful degradation
            if (error instanceof DashboardError && GracefulDegradationManager.shouldUseFallback(error)) {
                console.warn('Using fallback data for alerts trend due to error:', error.message);
                return {
                    data: [],
                    period: `${days}d`,
                    timestamp: new Date().toISOString(),
                };
            }
            throw error;
        }
    }

    /**
     * Get device coverage data with enhanced error handling
     */
    async getDeviceCoverage(): Promise<DeviceCoverageResponse> {
        try {
            return await this.fetchWithRetry<DeviceCoverageResponse>(
                `${this.baseUrl}/device-coverage`,
                validateDeviceCoverageResponse
            );
        } catch (error) {
            // Provide fallback data for graceful degradation
            if (error instanceof DashboardError && GracefulDegradationManager.shouldUseFallback(error)) {
                console.warn('Using fallback data for device coverage due to error:', error.message);
                return {
                    protected: 0,
                    missingAgent: 0,
                    withAlerts: 0,
                    total: 0,
                    timestamp: new Date().toISOString(),
                };
            }
            throw error;
        }
    }

    /**
     * Get ticket breakdown data with enhanced error handling
     */
    async getTicketBreakdown(): Promise<TicketBreakdownResponse> {
        try {
            return await this.fetchWithRetry<TicketBreakdownResponse>(
                `${this.baseUrl}/tickets`,
                validateTicketBreakdownResponse
            );
        } catch (error) {
            // Provide fallback data for graceful degradation
            if (error instanceof DashboardError && GracefulDegradationManager.shouldUseFallback(error)) {
                console.warn('Using fallback data for ticket breakdown due to error:', error.message);
                return {
                    securityTickets: { created: 0, resolved: 0 },
                    helpdeskTickets: { created: 0, resolved: 0 },
                    timestamp: new Date().toISOString(),
                };
            }
            throw error;
        }
    }

    /**
     * Get integration health data with enhanced error handling
     */
    async getIntegrations(): Promise<IntegrationsResponse> {
        try {
            return await this.fetchWithRetry<IntegrationsResponse>(
                `${this.baseUrl}/integrations`,
                validateIntegrationsResponse
            );
        } catch (error) {
            // Provide fallback data for graceful degradation
            if (error instanceof DashboardError && GracefulDegradationManager.shouldUseFallback(error)) {
                console.warn('Using fallback data for integrations due to error:', error.message);
                return {
                    integrations: [],
                    timestamp: new Date().toISOString(),
                };
            }
            throw error;
        }
    }

    /**
     * Get recent activity data with enhanced error handling
     */
    async getRecentActivity(limit: number = 3): Promise<RecentActivityResponse> {
        if (limit < 1 || limit > 50) {
            const context: ErrorContext = {
                component: 'DashboardApiService',
                operation: 'getRecentActivity',
                timestamp: new Date().toISOString(),
            };

            throw new DashboardApiError(
                'Limit parameter must be between 1 and 50',
                400,
                'getRecentActivity',
                false
            );
        }

        try {
            return await this.fetchWithRetry<RecentActivityResponse>(
                `${this.baseUrl}/activity-feed?limit=${limit}`,
                validateRecentActivityResponse
            );
        } catch (error) {
            // Provide fallback data for graceful degradation
            if (error instanceof DashboardError && GracefulDegradationManager.shouldUseFallback(error)) {
                console.warn('Using fallback data for recent activity due to error:', error.message);
                return {
                    activities: [],
                    timestamp: new Date().toISOString(),
                };
            }
            throw error;
        }
    }

    /**
     * Fetch all dashboard data in parallel with partial failure handling
     */
    async getAllDashboardData(): Promise<{
        kpis: KPIResponse;
        alertsTrend: AlertsTrendResponse;
        deviceCoverage: DeviceCoverageResponse;
        ticketBreakdown: TicketBreakdownResponse;
        integrations: IntegrationsResponse;
        recentActivity: RecentActivityResponse;
        partialFailures?: string[];
        warnings?: string[];
    }> {
        const context: ErrorContext = {
            component: 'DashboardApiService',
            operation: 'getAllDashboardData',
            timestamp: new Date().toISOString(),
        };

        // Use Promise.allSettled for graceful partial failure handling
        const results = await Promise.allSettled([
            this.getKPIs(),
            this.getAlertsTrend(),
            this.getDeviceCoverage(),
            this.getTicketBreakdown(),
            this.getIntegrations(),
            this.getRecentActivity(),
        ]);

        const componentNames = ['kpis', 'alertsTrend', 'deviceCoverage', 'ticketBreakdown', 'integrations', 'recentActivity'];
        const successfulData: Record<string, any> = {};
        const failedComponents: string[] = [];
        const partialFailures: string[] = [];

        // Process results and handle partial failures
        results.forEach((result, index) => {
            const componentName = componentNames[index];

            if (result.status === 'fulfilled') {
                successfulData[componentName] = result.value;
            } else {
                failedComponents.push(componentName);
                partialFailures.push(`${componentName}: ${result.reason?.message || 'Unknown error'}`);

                // Log individual component failure
                const componentError = new DashboardError(
                    `Failed to fetch ${componentName}: ${result.reason?.message || 'Unknown error'}`,
                    'PARTIAL_FAILURE',
                    { ...context, component: `DashboardApiService.${componentName}` },
                    { retryable: true, cause: result.reason }
                );

                ErrorMonitor.logError(componentError);
            }
        });

        // If all components failed, throw an error
        if (failedComponents.length === componentNames.length) {
            const totalFailureError = new DashboardError(
                'All dashboard components failed to load',
                'TOTAL_FAILURE',
                context,
                { retryable: true }
            );

            ErrorMonitor.logError(totalFailureError);
            throw totalFailureError;
        }

        // Use graceful degradation for failed components
        const { data: finalData, warnings } = GracefulDegradationManager.createPartialDataResponse(
            successfulData,
            failedComponents
        );

        // Log partial failure summary
        if (failedComponents.length > 0) {
            const partialFailureError = new DashboardError(
                `Partial dashboard failure: ${failedComponents.length}/${componentNames.length} components failed`,
                'PARTIAL_FAILURE',
                context,
                { retryable: true }
            );

            ErrorMonitor.logError(partialFailureError);
        }

        return {
            kpis: finalData.kpis,
            alertsTrend: finalData.alertsTrend,
            deviceCoverage: finalData.deviceCoverage,
            ticketBreakdown: finalData.ticketBreakdown,
            integrations: finalData.integrations,
            recentActivity: finalData.recentActivity,
            partialFailures: partialFailures.length > 0 ? partialFailures : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }

    /**
     * Health check for dashboard API
     */
    async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: Record<string, boolean> }> {
        const endpoints = [
            { name: 'kpis', fn: () => this.getKPIs() },
            { name: 'alerts-trend', fn: () => this.getAlertsTrend() },
            { name: 'device-coverage', fn: () => this.getDeviceCoverage() },
            { name: 'tickets', fn: () => this.getTicketBreakdown() },
            { name: 'integrations', fn: () => this.getIntegrations() },
            { name: 'activity-feed', fn: () => this.getRecentActivity() },
        ];

        const results: Record<string, boolean> = {};
        let healthyCount = 0;

        await Promise.allSettled(
            endpoints.map(async (endpoint) => {
                try {
                    await endpoint.fn();
                    results[endpoint.name] = true;
                    healthyCount++;
                } catch (error) {
                    results[endpoint.name] = false;
                    console.error(`Health check failed for ${endpoint.name}:`, error);
                }
            })
        );

        const totalEndpoints = endpoints.length;
        let status: 'healthy' | 'degraded' | 'unhealthy';

        if (healthyCount === totalEndpoints) {
            status = 'healthy';
        } else if (healthyCount >= totalEndpoints / 2) {
            status = 'degraded';
        } else {
            status = 'unhealthy';
        }

        return { status, details: results };
    }
}

export const dashboardApi = new DashboardApiService();