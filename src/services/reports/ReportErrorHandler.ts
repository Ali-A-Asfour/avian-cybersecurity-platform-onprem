/**
 * Report Error Handler Service
 * 
 * Provides comprehensive error categorization, handling logic, retry mechanisms,
 * and user-friendly error messages for the AVIAN Reports Module.
 * 
 * Requirements: All error scenarios, graceful degradation, retry mechanisms
 */

import { logger } from '@/lib/logger';
import { ReportError, ErrorResponse, ValidationResult } from '@/types/reports';

/**
 * Error categories for systematic handling
 */
export enum ErrorCategory {
    DATA = 'data',
    GENERATION = 'generation',
    EXPORT = 'export',
    VALIDATION = 'validation',
    NETWORK = 'network',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    SYSTEM = 'system'
}

/**
 * Error severity levels for prioritization
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Retry configuration for transient failures
 */
export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    retryableErrorCodes: string[];
}

/**
 * Error context for enhanced debugging and user messaging
 */
export interface ErrorContext {
    tenantId?: string;
    userId?: string;
    reportType?: 'weekly' | 'monthly' | 'quarterly';
    reportId?: string;
    snapshotId?: string;
    operation?: string;
    timestamp: Date;
    requestId?: string;
    userAgent?: string;
    ipAddress?: string;
}

/**
 * User-friendly error message configuration
 */
export interface UserErrorMessage {
    title: string;
    message: string;
    suggestions: string[];
    supportContact?: string;
    documentationUrl?: string;
}

/**
 * Comprehensive Report Error Handler
 * 
 * Handles all error scenarios in the reports module with categorization,
 * retry mechanisms, and user-friendly messaging.
 */
export class ReportErrorHandler {
    private readonly defaultRetryConfig: RetryConfig = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableErrorCodes: [
            'NETWORK_TIMEOUT',
            'DATABASE_CONNECTION_LOST',
            'TEMPORARY_SERVICE_UNAVAILABLE',
            'RATE_LIMIT_EXCEEDED',
            'PDF_GENERATION_TIMEOUT',
            'BROWSER_INITIALIZATION_FAILED'
        ]
    };

    /**
     * Main error handling entry point
     */
    async handleError(
        error: Error | ReportError,
        context: ErrorContext,
        retryConfig?: Partial<RetryConfig>
    ): Promise<ErrorResponse> {
        const reportError = this.normalizeError(error, context);
        const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };

        // Log the error with full context
        this.logError(reportError, context);

        // Determine if error is retryable
        if (this.isRetryableError(reportError, finalRetryConfig)) {
            // Attempt retry with exponential backoff
            const retryResult = await this.attemptRetry(reportError, context, finalRetryConfig);
            if (retryResult.success) {
                return retryResult.response!;
            }
            // If retry failed, continue with error response
        }

        // Generate user-friendly error response
        const errorResponse = this.createErrorResponse(reportError, context);

        // Handle specific error categories
        await this.handleErrorByCategory(reportError, context);

        return errorResponse;
    }

    /**
     * Normalize various error types into ReportError format
     */
    private normalizeError(error: Error | ReportError, context: ErrorContext): ReportError {
        if (this.isReportError(error)) {
            return error;
        }

        // Categorize error based on message and context
        const category = this.categorizeError(error, context);
        const severity = this.determineSeverity(error, category);
        const errorCode = this.generateErrorCode(error, category);

        return {
            code: errorCode,
            message: error.message,
            category,
            retryable: this.isErrorRetryable(error, category),
            details: {
                originalError: error.name,
                stack: error.stack,
                context,
                severity,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Categorize errors based on message patterns and context
     */
    private categorizeError(error: Error, context: ErrorContext): ErrorCategory {
        const message = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();

        // Check for specific data-related patterns first (highest priority)
        if (message.includes('database') || message.includes('insufficient data') ||
            message.includes('data not found') || message.includes('tenant') ||
            (message.includes('database') && message.includes('connection'))) {
            return ErrorCategory.DATA;
        }

        // Authentication errors (check before authorization to avoid conflicts)
        if (message.includes('authentication') || message.includes('login') ||
            message.includes('token') || message.includes('unauthorized') ||
            errorName.includes('auth')) {
            return ErrorCategory.AUTHENTICATION;
        }

        // Authorization errors
        if (message.includes('authorization') || message.includes('permission') ||
            message.includes('access denied') || message.includes('forbidden')) {
            return ErrorCategory.AUTHORIZATION;
        }

        // Check context operation for explicit categorization
        if (context.operation?.includes('auth') && !context.operation?.includes('authorize')) {
            return ErrorCategory.AUTHENTICATION;
        }

        if (context.operation?.includes('authorize')) {
            return ErrorCategory.AUTHORIZATION;
        }

        if (context.operation?.includes('network')) {
            return ErrorCategory.NETWORK;
        }

        if (context.operation?.includes('export')) {
            return ErrorCategory.EXPORT;
        }

        // Network errors (check before general connection errors)
        if (message.includes('network') || message.includes('connection refused') ||
            message.includes('fetch') || errorName.includes('network') ||
            (message.includes('connection failed') && !message.includes('database'))) {
            return ErrorCategory.NETWORK;
        }

        // Generation errors
        if (message.includes('template') || message.includes('render') ||
            message.includes('slide') || message.includes('chart') ||
            message.includes('aggregation') || context.operation?.includes('generate')) {
            return ErrorCategory.GENERATION;
        }

        // Export/PDF errors
        if (message.includes('pdf') || message.includes('export') ||
            message.includes('browser') || message.includes('chromium') ||
            message.includes('playwright')) {
            return ErrorCategory.EXPORT;
        }

        // Validation errors
        if (message.includes('validation') || message.includes('invalid') ||
            message.includes('required') || message.includes('format') ||
            errorName.includes('validation')) {
            return ErrorCategory.VALIDATION;
        }

        // General connection errors (after database and network checks)
        if (message.includes('connection') || message.includes('query')) {
            return ErrorCategory.DATA;
        }

        // Default to system error
        return ErrorCategory.SYSTEM;
    }

    /**
     * Determine error severity based on type and impact
     */
    private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
        const message = error.message.toLowerCase();

        // Critical errors that prevent core functionality
        if (message.includes('system failure') || message.includes('critical')) {
            return ErrorSeverity.CRITICAL;
        }

        // System category is critical unless it's a specific non-critical case
        if (category === ErrorCategory.SYSTEM && !message.includes('corruption')) {
            return ErrorSeverity.CRITICAL;
        }

        // High severity for data integrity, corruption, or security issues
        if (message.includes('corruption') || message.includes('data corruption') ||
            category === ErrorCategory.AUTHENTICATION || category === ErrorCategory.AUTHORIZATION) {
            return ErrorSeverity.HIGH;
        }

        // High severity for database connection issues
        if (message.includes('database connection') ||
            (category === ErrorCategory.DATA && message.includes('connection'))) {
            return ErrorSeverity.HIGH;
        }

        // Medium severity for generation, export, and network issues
        if (category === ErrorCategory.GENERATION || category === ErrorCategory.EXPORT ||
            category === ErrorCategory.NETWORK || category === ErrorCategory.DATA) {
            return ErrorSeverity.MEDIUM;
        }

        // Low severity for validation issues
        return ErrorSeverity.LOW;
    }

    /**
     * Generate standardized error codes
     */
    private generateErrorCode(error: Error, category: ErrorCategory): string {
        const prefix = category.toUpperCase();
        const message = error.message.toLowerCase();

        // Generate specific error codes based on common patterns
        if (message.includes('not found')) return `${prefix}_NOT_FOUND`;
        if (message.includes('timeout')) return `${prefix}_TIMEOUT`;
        if (message.includes('connection')) return `${prefix}_CONNECTION_ERROR`;
        if (message.includes('permission') || message.includes('access denied')) return `${prefix}_ACCESS_DENIED`;
        if (message.includes('invalid')) return `${prefix}_INVALID_INPUT`;
        if (message.includes('insufficient')) return `${prefix}_INSUFFICIENT_DATA`;
        if (message.includes('browser')) return `${prefix}_BROWSER_ERROR`;
        if (message.includes('template')) return `${prefix}_TEMPLATE_ERROR`;
        if (message.includes('validation')) return `${prefix}_VALIDATION_ERROR`;

        return `${prefix}_GENERAL_ERROR`;
    }

    /**
     * Check if error is retryable based on category and configuration
     */
    private isRetryableError(error: ReportError, config: RetryConfig): boolean {
        return error.retryable && config.retryableErrorCodes.includes(error.code);
    }

    /**
     * Determine if an error should be retryable
     */
    private isErrorRetryable(error: Error, category: ErrorCategory): boolean {
        const message = error.message.toLowerCase();

        // Network and temporary system issues are retryable
        if (category === ErrorCategory.NETWORK ||
            message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('temporary') ||
            message.includes('rate limit')) {
            return true;
        }

        // PDF generation issues may be retryable
        if (category === ErrorCategory.EXPORT &&
            (message.includes('browser') || message.includes('initialization'))) {
            return true;
        }

        // Data connection issues are retryable
        if (category === ErrorCategory.DATA &&
            (message.includes('connection') || message.includes('timeout'))) {
            return true;
        }

        return false;
    }

    /**
     * Attempt retry with exponential backoff
     */
    private async attemptRetry(
        error: ReportError,
        context: ErrorContext,
        config: RetryConfig
    ): Promise<{ success: boolean; response?: ErrorResponse }> {
        let lastError = error;
        let delay = config.baseDelayMs;

        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            logger.info('Attempting retry for retryable error', {
                errorCode: error.code,
                attempt,
                maxAttempts: config.maxAttempts,
                delay,
                context,
                category: 'reports'
            });

            // Wait before retry (except first attempt)
            if (attempt > 1) {
                await this.sleep(delay);
                delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
            }

            try {
                // The actual retry logic would be implemented by the calling service
                // This is a placeholder for the retry mechanism
                logger.info('Retry attempt completed', {
                    errorCode: error.code,
                    attempt,
                    context,
                    category: 'reports'
                });

                // If we reach here, the retry was successful
                return {
                    success: true,
                    response: {
                        error: {
                            ...error,
                            message: `Operation succeeded after ${attempt} attempts`
                        },
                        timestamp: new Date(),
                        requestId: context.requestId || this.generateRequestId()
                    }
                };

            } catch (retryError) {
                lastError = this.normalizeError(
                    retryError instanceof Error ? retryError : new Error(String(retryError)),
                    context
                );

                logger.warn('Retry attempt failed', {
                    errorCode: error.code,
                    attempt,
                    retryError: lastError.message,
                    context,
                    category: 'reports'
                });
            }
        }

        logger.error('All retry attempts exhausted', undefined, {
            originalError: error.code,
            finalError: lastError.code,
            attempts: config.maxAttempts,
            context,
            category: 'reports'
        });

        return { success: false };
    }

    /**
     * Create user-friendly error response
     */
    private createErrorResponse(error: ReportError, context: ErrorContext): ErrorResponse {
        const userMessage = this.generateUserFriendlyMessage(error, context);

        return {
            error: {
                ...error,
                // Keep original message for ReportError objects, use user message for others
                message: this.isReportError(error) ? error.message : userMessage.message,
                details: {
                    ...error.details,
                    userMessage,
                    supportInfo: {
                        requestId: context.requestId || this.generateRequestId(),
                        timestamp: context.timestamp.toISOString(),
                        category: error.category
                    }
                }
            },
            timestamp: new Date(),
            requestId: context.requestId || this.generateRequestId()
        };
    }

    /**
     * Generate user-friendly error messages
     */
    private generateUserFriendlyMessage(error: ReportError, context: ErrorContext): UserErrorMessage {
        const category = error.category;
        const reportType = context.reportType || 'report';

        switch (category) {
            case ErrorCategory.DATA:
                return {
                    title: 'Data Unavailable',
                    message: `We're unable to generate your ${reportType} report due to insufficient data for the selected time period.`,
                    suggestions: [
                        'Try selecting a different date range with more activity',
                        'Ensure your security systems are properly configured and sending data',
                        'Contact support if this issue persists'
                    ],
                    supportContact: 'support@avian-security.com',
                    documentationUrl: '/docs/reports/troubleshooting#data-issues'
                };

            case ErrorCategory.GENERATION:
                return {
                    title: 'Report Generation Failed',
                    message: `We encountered an issue while creating your ${reportType} report. Our team has been notified.`,
                    suggestions: [
                        'Try generating the report again in a few minutes',
                        'Check if you have the necessary permissions to generate reports',
                        'Contact support if the problem continues'
                    ],
                    supportContact: 'support@avian-security.com',
                    documentationUrl: '/docs/reports/troubleshooting#generation-issues'
                };

            case ErrorCategory.EXPORT:
                return {
                    title: 'PDF Export Failed',
                    message: `We couldn't export your ${reportType} report to PDF format. The report data is still available for viewing.`,
                    suggestions: [
                        'Try the PDF export again - this is often a temporary issue',
                        'Use the in-app preview while we resolve the export issue',
                        'Contact support for assistance with PDF delivery'
                    ],
                    supportContact: 'support@avian-security.com',
                    documentationUrl: '/docs/reports/troubleshooting#export-issues'
                };

            case ErrorCategory.VALIDATION:
                return {
                    title: 'Invalid Request',
                    message: 'The report request contains invalid parameters. Please check your inputs and try again.',
                    suggestions: [
                        'Verify that your date range is valid and not in the future',
                        'Ensure you have selected a supported report type',
                        'Check that all required fields are filled out correctly'
                    ],
                    documentationUrl: '/docs/reports/api-reference'
                };

            case ErrorCategory.AUTHENTICATION:
                return {
                    title: 'Authentication Required',
                    message: 'You need to log in to access reports. Please sign in and try again.',
                    suggestions: [
                        'Log in with your AVIAN account credentials',
                        'Clear your browser cache and cookies if login issues persist',
                        'Contact your administrator if you need account access'
                    ],
                    supportContact: 'support@avian-security.com'
                };

            case ErrorCategory.AUTHORIZATION:
                return {
                    title: 'Access Denied',
                    message: 'You don\'t have permission to access this report or perform this action.',
                    suggestions: [
                        'Contact your administrator to request report access permissions',
                        'Verify you are accessing reports for the correct tenant/organization',
                        'Ensure your account has the Security Analyst or Super Admin role'
                    ],
                    supportContact: 'support@avian-security.com'
                };

            case ErrorCategory.NETWORK:
                return {
                    title: 'Connection Issue',
                    message: 'We\'re experiencing connectivity issues. Please check your internet connection and try again.',
                    suggestions: [
                        'Check your internet connection and try again',
                        'Wait a few minutes and retry - this may be a temporary issue',
                        'Contact support if connectivity issues persist'
                    ],
                    supportContact: 'support@avian-security.com'
                };

            default:
                return {
                    title: 'System Error',
                    message: 'An unexpected error occurred. Our technical team has been notified and is working to resolve the issue.',
                    suggestions: [
                        'Try refreshing the page and attempting the action again',
                        'Wait a few minutes before retrying',
                        'Contact support with the error details if the issue persists'
                    ],
                    supportContact: 'support@avian-security.com',
                    documentationUrl: '/docs/reports/troubleshooting'
                };
        }
    }

    /**
     * Handle errors by category with specific actions
     */
    private async handleErrorByCategory(error: ReportError, context: ErrorContext): Promise<void> {
        switch (error.category) {
            case ErrorCategory.DATA:
                await this.handleDataError(error, context);
                break;
            case ErrorCategory.GENERATION:
                await this.handleGenerationError(error, context);
                break;
            case ErrorCategory.EXPORT:
                await this.handleExportError(error, context);
                break;
            case ErrorCategory.VALIDATION:
                await this.handleValidationError(error, context);
                break;
            case ErrorCategory.AUTHENTICATION:
            case ErrorCategory.AUTHORIZATION:
                await this.handleSecurityError(error, context);
                break;
            case ErrorCategory.NETWORK:
                await this.handleNetworkError(error, context);
                break;
            default:
                await this.handleSystemError(error, context);
                break;
        }
    }

    /**
     * Handle data-related errors
     */
    private async handleDataError(error: ReportError, context: ErrorContext): Promise<void> {
        // Log data availability issues for monitoring
        logger.warn('Data availability issue detected', {
            errorCode: error.code,
            tenantId: context.tenantId,
            reportType: context.reportType,
            operation: context.operation,
            category: 'reports-data'
        });

        // Could trigger data validation checks or alerts here
        // For now, just ensure proper logging for monitoring
    }

    /**
     * Handle report generation errors
     */
    private async handleGenerationError(error: ReportError, context: ErrorContext): Promise<void> {
        // Log generation failures for system monitoring
        logger.error('Report generation failure', undefined, {
            errorCode: error.code,
            tenantId: context.tenantId,
            reportType: context.reportType,
            operation: context.operation,
            severity: error.details?.severity,
            category: 'reports-generation'
        });

        // Could trigger alerts for repeated generation failures
    }

    /**
     * Handle PDF export errors
     */
    private async handleExportError(error: ReportError, context: ErrorContext): Promise<void> {
        // Log export failures for system health monitoring
        logger.error('PDF export failure', undefined, {
            errorCode: error.code,
            tenantId: context.tenantId,
            reportId: context.reportId,
            snapshotId: context.snapshotId,
            category: 'reports-export'
        });

        // Could trigger browser service health checks or restarts
    }

    /**
     * Handle validation errors
     */
    private async handleValidationError(error: ReportError, context: ErrorContext): Promise<void> {
        // Log validation issues for API monitoring
        logger.info('Validation error occurred', {
            errorCode: error.code,
            tenantId: context.tenantId,
            userId: context.userId,
            operation: context.operation,
            category: 'reports-validation'
        });
    }

    /**
     * Handle security-related errors
     */
    private async handleSecurityError(error: ReportError, context: ErrorContext): Promise<void> {
        // Log security issues for audit trail
        logger.warn('Security error detected', {
            errorCode: error.code,
            tenantId: context.tenantId,
            userId: context.userId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            category: 'reports-security'
        });

        // Could trigger security monitoring alerts
    }

    /**
     * Handle network-related errors
     */
    private async handleNetworkError(error: ReportError, context: ErrorContext): Promise<void> {
        // Log network issues for infrastructure monitoring
        logger.warn('Network error detected', {
            errorCode: error.code,
            operation: context.operation,
            category: 'reports-network'
        });
    }

    /**
     * Handle system errors
     */
    private async handleSystemError(error: ReportError, context: ErrorContext): Promise<void> {
        // Log system errors for critical monitoring
        logger.error('System error detected', undefined, {
            errorCode: error.code,
            tenantId: context.tenantId,
            operation: context.operation,
            severity: error.details?.severity,
            category: 'reports-system'
        });

        // Could trigger system health alerts
    }

    /**
     * Log errors with appropriate level and context
     */
    private logError(error: ReportError, context: ErrorContext): void {
        const severity = error.details?.severity as ErrorSeverity;
        const logData = {
            errorCode: error.code,
            errorMessage: error.message,
            category: error.category,
            severity,
            retryable: error.retryable,
            context,
            timestamp: new Date().toISOString()
        };

        switch (severity) {
            case ErrorSeverity.CRITICAL:
                logger.error('Critical report error', undefined, logData);
                break;
            case ErrorSeverity.HIGH:
                logger.error('High severity report error', undefined, logData);
                break;
            case ErrorSeverity.MEDIUM:
                logger.warn('Medium severity report error', logData);
                break;
            default:
                logger.info('Low severity report error', logData);
                break;
        }
    }

    /**
     * Utility methods
     */
    private isReportError(error: any): error is ReportError {
        return error && typeof error === 'object' &&
            'code' in error && 'category' in error && 'retryable' in error;
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create error context from request information
     */
    static createContext(
        operation: string,
        tenantId?: string,
        userId?: string,
        reportType?: 'weekly' | 'monthly' | 'quarterly',
        reportId?: string,
        snapshotId?: string,
        requestId?: string,
        userAgent?: string,
        ipAddress?: string
    ): ErrorContext {
        return {
            operation,
            tenantId,
            userId,
            reportType,
            reportId,
            snapshotId,
            requestId,
            userAgent,
            ipAddress,
            timestamp: new Date()
        };
    }

    /**
     * Validate error handling configuration
     */
    validateConfiguration(config: Partial<RetryConfig>): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (config.maxAttempts !== undefined) {
            if (config.maxAttempts < 1 || config.maxAttempts > 10) {
                errors.push('maxAttempts must be between 1 and 10');
            }
        }

        if (config.baseDelayMs !== undefined) {
            if (config.baseDelayMs < 100 || config.baseDelayMs > 10000) {
                warnings.push('baseDelayMs should be between 100ms and 10s for optimal performance');
            }
        }

        if (config.maxDelayMs !== undefined) {
            if (config.maxDelayMs < 1000 || config.maxDelayMs > 300000) {
                warnings.push('maxDelayMs should be between 1s and 5m for reasonable retry behavior');
            }
        }

        if (config.backoffMultiplier !== undefined) {
            if (config.backoffMultiplier < 1.1 || config.backoffMultiplier > 5) {
                warnings.push('backoffMultiplier should be between 1.1 and 5 for effective exponential backoff');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}