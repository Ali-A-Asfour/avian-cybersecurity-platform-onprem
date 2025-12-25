'use client';

import React from 'react';
import { DashboardError, ErrorContext, ErrorRecoveryActionFactory, ErrorMonitor, UserFriendlyErrorMessages } from '@/lib/errorHandling';
import { RetryableErrorMessage } from './RetryableErrorMessage';

interface EnhancedErrorBoundaryState {
    hasError: boolean;
    error: DashboardError | null;
}

interface EnhancedErrorBoundaryProps {
    children: React.ReactNode;
    componentName: string;
    fallback?: React.ReactNode;
    onRetry?: () => Promise<void>;
    onError?: (error: DashboardError) => void;
}

/**
 * Enhanced Error Boundary with Comprehensive Error Handling
 * 
 * Provides advanced error handling with:
 * - Network failure detection and recovery
 * - User-friendly error messages
 * - Multiple recovery actions
 * - Error monitoring and logging
 * - Graceful degradation support
 */
export class EnhancedErrorBoundary extends React.Component<
    EnhancedErrorBoundaryProps,
    EnhancedErrorBoundaryState
> {
    constructor(props: EnhancedErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): EnhancedErrorBoundaryState {
        // Create enhanced error with context
        const context: ErrorContext = {
            component: 'Unknown Component',
            operation: 'render',
            timestamp: new Date().toISOString(),
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
        };

        const dashboardError = new DashboardError(
            error.message,
            'COMPONENT_ERROR',
            context,
            {
                retryable: true,
                cause: error,
            }
        );

        return {
            hasError: true,
            error: dashboardError,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        const context: ErrorContext = {
            component: this.props.componentName,
            operation: 'render',
            timestamp: new Date().toISOString(),
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
        };

        const dashboardError = new DashboardError(
            error.message,
            'COMPONENT_ERROR',
            context,
            {
                retryable: true,
                cause: error,
                recoveryActions: this.createRecoveryActions(),
            }
        );

        // Log error for monitoring
        ErrorMonitor.logError(dashboardError);

        // Update state with enhanced error
        this.setState({
            hasError: true,
            error: dashboardError,
        });

        // Call error callback if provided
        if (this.props.onError) {
            this.props.onError(dashboardError);
        }

        console.error(`Enhanced Error Boundary caught error in ${this.props.componentName}:`, {
            error,
            errorInfo,
            dashboardError: dashboardError.toJSON(),
        });
    }

    private createRecoveryActions() {
        const actions = [];

        // Add retry action if available
        if (this.props.onRetry) {
            actions.push(ErrorRecoveryActionFactory.createRetryAction(this.props.onRetry));
        }

        // Add refresh action
        actions.push(ErrorRecoveryActionFactory.createRefreshAction(async () => {
            window.location.reload();
        }));

        // Add contact support action
        actions.push(ErrorRecoveryActionFactory.createContactSupportAction());

        return actions;
    }

    handleRetry = async () => {
        if (!this.state.error) return;

        try {
            // Call the provided retry function if available
            if (this.props.onRetry) {
                await this.props.onRetry();
            }

            // Reset error state on successful retry
            this.setState({ hasError: false, error: null });
        } catch (error) {
            console.error('Retry failed:', error);

            // Update error state with retry failure
            const context: ErrorContext = {
                component: this.props.componentName,
                operation: 'retry',
                timestamp: new Date().toISOString(),
                userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
                url: typeof window !== 'undefined' ? window.location.href : undefined,
            };

            const retryError = new DashboardError(
                `Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'RETRY_ERROR',
                context,
                {
                    retryable: false,
                    cause: error instanceof Error ? error : undefined,
                }
            );

            ErrorMonitor.logError(retryError);
            this.setState({ error: retryError });
        }
    };

    handleRecoveryAction = async (action: () => Promise<void> | void) => {
        try {
            await action();
        } catch (error) {
            console.error('Recovery action failed:', error);
        }
    };

    render() {
        if (this.state.hasError && this.state.error) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Get user-friendly error message
            const friendlyMessage = UserFriendlyErrorMessages.getMessage(this.state.error.code);

            // Enhanced error UI with comprehensive recovery options
            return (
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6">
                    <div className="text-center">
                        {/* Error Icon */}
                        <div className="text-red-400 text-4xl mb-4">
                            {this.state.error.code === 'NETWORK_ERROR' ? '🌐' :
                                this.state.error.code === 'TIMEOUT_ERROR' ? '⏱️' :
                                    this.state.error.code === 'SERVER_ERROR' ? '🔧' :
                                        this.state.error.code === 'AUTHENTICATION_ERROR' ? '🔐' :
                                            this.state.error.code === 'AUTHORIZATION_ERROR' ? '🚫' : '⚠️'}
                        </div>

                        {/* Error Title */}
                        <h3 className="text-red-300 font-semibold text-lg mb-2">
                            {friendlyMessage.title}
                        </h3>

                        {/* Error Description */}
                        <p className="text-red-400 text-sm mb-2">
                            {friendlyMessage.description}
                        </p>

                        {/* Component Context */}
                        <p className="text-neutral-500 text-xs mb-4">
                            Component: {this.props.componentName}
                        </p>

                        {/* Suggestion */}
                        <p className="text-neutral-400 text-sm mb-6">
                            {friendlyMessage.suggestion}
                        </p>

                        {/* Recovery Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            {/* Primary Retry Action */}
                            {this.props.onRetry && (
                                <button
                                    onClick={this.handleRetry}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                                >
                                    Try Again
                                </button>
                            )}

                            {/* Refresh Page Action */}
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-neutral-600 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                            >
                                Refresh Page
                            </button>

                            {/* Contact Support Action */}
                            <button
                                onClick={() => this.handleRecoveryAction(ErrorRecoveryActionFactory.createContactSupportAction().action)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                            >
                                Contact Support
                            </button>
                        </div>

                        {/* Technical Details (Development Only) */}
                        {process.env.NODE_ENV === 'development' && (
                            <details className="mt-6 text-left">
                                <summary className="text-neutral-400 text-xs cursor-pointer hover:text-neutral-300">
                                    Technical Details
                                </summary>
                                <pre className="mt-2 p-3 bg-neutral-900 border border-neutral-600 rounded text-xs text-neutral-300 overflow-auto">
                                    {JSON.stringify(this.state.error.toJSON(), null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}