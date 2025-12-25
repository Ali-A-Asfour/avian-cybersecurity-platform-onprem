/**
 * Enhanced Error Handling Utilities for Dashboard
 * 
 * Provides comprehensive error handling with network failure detection,
 * retry mechanisms, and graceful degradation strategies.
 */

export interface ErrorContext {
    component: string;
    operation: string;
    timestamp: string;
    userAgent?: string;
    url?: string;
    userId?: string;
    tenantId?: string;
}

export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitterMax: number;
}

export interface ErrorRecoveryAction {
    label: string;
    action: () => Promise<void> | void;
    primary?: boolean;
}

export class DashboardError extends Error {
    public readonly code: string;
    public readonly retryable: boolean;
    public readonly context: ErrorContext;
    public readonly recoveryActions: ErrorRecoveryAction[];
    public readonly userMessage: string;

    constructor(
        message: string,
        code: string,
        context: ErrorContext,
        options: {
            retryable?: boolean;
            recoveryActions?: ErrorRecoveryAction[];
            userMessage?: string;
            cause?: Error;
        } = {}
    ) {
        super(message);
        this.name = 'DashboardError';
        this.code = code;
        this.context = context;
        this.retryable = options.retryable ?? true;
        this.recoveryActions = options.recoveryActions ?? [];
        this.userMessage = options.userMessage ?? this.getDefaultUserMessage();

        if (options.cause) {
            this.cause = options.cause;
        }
    }

    private getDefaultUserMessage(): string {
        switch (this.code) {
            case 'NETWORK_ERROR':
                return 'Unable to connect to the server. Please check your internet connection.';
            case 'TIMEOUT_ERROR':
                return 'The request took too long to complete. Please try again.';
            case 'SERVER_ERROR':
                return 'The server encountered an error. Please try again in a few moments.';
            case 'VALIDATION_ERROR':
                return 'The data received from the server is invalid. Please refresh the page.';
            case 'AUTHENTICATION_ERROR':
                return 'Your session has expired. Please log in again.';
            case 'AUTHORIZATION_ERROR':
                return 'You do not have permission to access this data.';
            case 'RATE_LIMIT_ERROR':
                return 'Too many requests. Please wait a moment before trying again.';
            default:
                return 'An unexpected error occurred. Please try again.';
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            retryable: this.retryable,
            context: this.context,
            userMessage: this.userMessage,
            stack: this.stack,
        };
    }
}

/**
 * Network Error Detection Utilities
 */
export class NetworkErrorDetector {
    static isNetworkError(error: any): boolean {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return true;
        }

        if (error.name === 'AbortError') {
            return true;
        }

        if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR') {
            return true;
        }

        // Check for common network error patterns
        const networkErrorPatterns = [
            /network/i,
            /connection/i,
            /timeout/i,
            /abort/i,
            /fetch/i,
        ];

        return networkErrorPatterns.some(pattern =>
            pattern.test(error.message || '') || pattern.test(error.name || '')
        );
    }

    static isRetryableHttpError(status: number): boolean {
        // Retry on server errors (5xx) and rate limiting (429)
        return status >= 500 || status === 429;
    }

    static getErrorCode(error: any, response?: Response): string {
        if (this.isNetworkError(error)) {
            return 'NETWORK_ERROR';
        }

        if (error.name === 'AbortError') {
            return 'TIMEOUT_ERROR';
        }

        if (response) {
            if (response.status === 401) return 'AUTHENTICATION_ERROR';
            if (response.status === 403) return 'AUTHORIZATION_ERROR';
            if (response.status === 429) return 'RATE_LIMIT_ERROR';
            if (response.status >= 400 && response.status < 500) return 'CLIENT_ERROR';
            if (response.status >= 500) return 'SERVER_ERROR';
        }

        return 'UNKNOWN_ERROR';
    }
}

/**
 * Enhanced Retry Mechanism with Exponential Backoff and Jitter
 */
export class RetryManager {
    private static defaultConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitterMax: 500,
    };

    static async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: ErrorContext,
        config: Partial<RetryConfig> = {}
    ): Promise<T> {
        const finalConfig = { ...this.defaultConfig, ...config };
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                // Don't retry on the last attempt
                if (attempt === finalConfig.maxRetries) {
                    break;
                }

                // Check if error is retryable
                if (error instanceof DashboardError && !error.retryable) {
                    throw error;
                }

                // For HTTP errors, check if status is retryable
                if (error instanceof Response && !NetworkErrorDetector.isRetryableHttpError(error.status)) {
                    throw new DashboardError(
                        `HTTP ${error.status}: ${error.statusText}`,
                        NetworkErrorDetector.getErrorCode(error, error),
                        context,
                        { retryable: false }
                    );
                }

                // Calculate delay with exponential backoff and jitter
                const exponentialDelay = Math.min(
                    finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
                    finalConfig.maxDelay
                );
                const jitter = Math.random() * finalConfig.jitterMax;
                const delay = exponentialDelay + jitter;

                console.warn(`Retry attempt ${attempt + 1}/${finalConfig.maxRetries} for ${context.operation} after ${delay}ms`, error);

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // All retries failed, throw enhanced error
        const errorCode = NetworkErrorDetector.getErrorCode(lastError);
        throw new DashboardError(
            `Operation failed after ${finalConfig.maxRetries} retries: ${lastError?.message || 'Unknown error'}`,
            errorCode,
            context,
            {
                retryable: NetworkErrorDetector.isNetworkError(lastError),
                cause: lastError || undefined,
            }
        );
    }
}

/**
 * Graceful Degradation Manager
 */
export class GracefulDegradationManager {
    private static fallbackData: Record<string, any> = {
        kpis: {
            criticalAlerts: 0,
            securityTicketsOpen: 0,
            helpdeskTicketsOpen: 0,
            complianceScore: 0,
        },
        alertsTrend: [],
        deviceCoverage: {
            protected: 0,
            missingAgent: 0,
            withAlerts: 0,
            total: 0,
        },
        ticketBreakdown: {
            securityTickets: { created: 0, resolved: 0 },
            helpdeskTickets: { created: 0, resolved: 0 },
        },
        integrations: [],
        recentActivity: [],
    };

    static getFallbackData(component: string): any {
        return this.fallbackData[component] || null;
    }

    static shouldUseFallback(error: DashboardError): boolean {
        // Use fallback for network errors and server errors
        return ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVER_ERROR'].includes(error.code);
    }

    static createPartialDataResponse(
        successfulData: Record<string, any>,
        failedComponents: string[]
    ): { data: any; warnings: string[] } {
        const data = { ...successfulData };
        const warnings: string[] = [];

        // Fill in fallback data for failed components
        failedComponents.forEach(component => {
            const fallback = this.getFallbackData(component);
            if (fallback !== null) {
                data[component] = fallback;
                warnings.push(`${component} data unavailable - showing cached/default values`);
            }
        });

        return { data, warnings };
    }
}

/**
 * Error Recovery Action Factory
 */
export class ErrorRecoveryActionFactory {
    static createRefreshAction(refreshFn: () => Promise<void>): ErrorRecoveryAction {
        return {
            label: 'Refresh Data',
            action: refreshFn,
            primary: true,
        };
    }

    static createRetryAction(retryFn: () => Promise<void>): ErrorRecoveryAction {
        return {
            label: 'Try Again',
            action: retryFn,
            primary: true,
        };
    }

    static createReloadPageAction(): ErrorRecoveryAction {
        return {
            label: 'Reload Page',
            action: () => window.location.reload(),
        };
    }

    static createContactSupportAction(): ErrorRecoveryAction {
        return {
            label: 'Contact Support',
            action: () => {
                // Open support contact method (email, chat, etc.)
                window.open('mailto:support@avian.com?subject=Dashboard Error', '_blank');
            },
        };
    }

    static createLoginAction(): ErrorRecoveryAction {
        return {
            label: 'Log In Again',
            action: () => {
                // Redirect to login page
                window.location.href = '/login';
            },
            primary: true,
        };
    }
}

/**
 * Error Monitoring and Logging
 */
export class ErrorMonitor {
    private static errorQueue: DashboardError[] = [];
    private static maxQueueSize = 100;

    static logError(error: DashboardError): void {
        // Add to local queue
        this.errorQueue.push(error);
        if (this.errorQueue.length > this.maxQueueSize) {
            this.errorQueue.shift();
        }

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Dashboard Error:', error.toJSON());
        }

        // Send to monitoring service in production
        if (process.env.NODE_ENV === 'production') {
            this.sendToMonitoringService(error);
        }
    }

    private static async sendToMonitoringService(error: DashboardError): Promise<void> {
        try {
            // TODO: Integrate with actual monitoring service (Sentry, DataDog, etc.)
            await fetch('/api/monitoring/errors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(error.toJSON()),
            });
        } catch (monitoringError) {
            console.error('Failed to send error to monitoring service:', monitoringError);
        }
    }

    static getRecentErrors(): DashboardError[] {
        return [...this.errorQueue];
    }

    static clearErrors(): void {
        this.errorQueue.length = 0;
    }
}

/**
 * User-Friendly Error Message Generator
 */
export class UserFriendlyErrorMessages {
    private static messages: Record<string, { title: string; description: string; suggestion: string }> = {
        NETWORK_ERROR: {
            title: 'Connection Problem',
            description: 'Unable to connect to the server',
            suggestion: 'Check your internet connection and try again',
        },
        TIMEOUT_ERROR: {
            title: 'Request Timeout',
            description: 'The request took too long to complete',
            suggestion: 'The server might be busy. Please try again in a moment',
        },
        SERVER_ERROR: {
            title: 'Server Error',
            description: 'The server encountered an unexpected error',
            suggestion: 'This is usually temporary. Please try again in a few minutes',
        },
        AUTHENTICATION_ERROR: {
            title: 'Session Expired',
            description: 'Your login session has expired',
            suggestion: 'Please log in again to continue',
        },
        AUTHORIZATION_ERROR: {
            title: 'Access Denied',
            description: 'You do not have permission to access this data',
            suggestion: 'Contact your administrator if you believe this is an error',
        },
        RATE_LIMIT_ERROR: {
            title: 'Too Many Requests',
            description: 'You have made too many requests in a short time',
            suggestion: 'Please wait a moment before trying again',
        },
        VALIDATION_ERROR: {
            title: 'Data Error',
            description: 'The data received from the server is invalid',
            suggestion: 'Try refreshing the page or contact support if the problem persists',
        },
    };

    static getMessage(errorCode: string): { title: string; description: string; suggestion: string } {
        return this.messages[errorCode] || {
            title: 'Unexpected Error',
            description: 'An unexpected error occurred',
            suggestion: 'Please try again or contact support if the problem persists',
        };
    }
}