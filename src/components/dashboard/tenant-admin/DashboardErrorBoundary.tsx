'use client';

import React from 'react';
import { RetryableErrorMessage } from './RetryableErrorMessage';

interface DashboardErrorBoundaryState {
    hasError: boolean;
    errorComponent?: string;
    errorMessage?: string;
}

interface DashboardErrorBoundaryProps {
    children: React.ReactNode;
    componentName?: string;
    fallback?: React.ReactNode;
    onRetry?: () => Promise<void>;
}

/**
 * Dashboard Error Boundary Component
 * 
 * Provides component-level error isolation for dashboard sections
 * to prevent cascade failures. When an error occurs in one component,
 * other dashboard sections continue to function normally.
 */
export class DashboardErrorBoundary extends React.Component<
    DashboardErrorBoundaryProps,
    DashboardErrorBoundaryState
> {
    constructor(props: DashboardErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
        return {
            hasError: true,
            errorMessage: error.message
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        const componentName = this.props.componentName || 'Dashboard Component';

        console.error(`DashboardErrorBoundary caught an error in ${componentName}:`, error, errorInfo);

        this.setState({
            errorComponent: componentName,
            errorMessage: error.message
        });

        // Log to monitoring system in production
        if (process.env.NODE_ENV === 'production') {
            // TODO: Integrate with monitoring service
            console.error('Dashboard component error:', {
                component: componentName,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }
    }

    handleRetry = async () => {
        // Call the provided retry function if available
        if (this.props.onRetry) {
            try {
                await this.props.onRetry();
            } catch (error) {
                console.error('Retry failed:', error);
                return; // Don't reset state if retry fails
            }
        }

        // Reset error state on successful retry
        this.setState({ hasError: false, errorComponent: undefined, errorMessage: undefined });
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI optimized for dashboard context with retry mechanism
            return (
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
                    <RetryableErrorMessage
                        title={`${this.state.errorComponent || 'Component'} Error`}
                        message={this.state.errorMessage || 'An unexpected error occurred'}
                        onRetry={this.props.onRetry ? this.handleRetry : undefined}
                        retryLabel="Reload Component"
                        variant="compact"
                        className="bg-error-900/10 border-error-600/30"
                        maxRetries={3}
                        retryDelay={1000}
                    />
                </div>
            );
        }

        return this.props.children;
    }
}