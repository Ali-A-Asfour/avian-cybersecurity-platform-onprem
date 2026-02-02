/**
 * Help Desk Error Boundary Component
 * 
 * React error boundary specifically designed for help desk components
 * with graceful error handling and recovery options.
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { HelpDeskErrorBoundary } from '@/lib/help-desk/error-handling';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    retryCount: number;
}

/**
 * Error boundary for help desk components
 */
export class HelpDeskErrorBoundaryComponent extends Component<Props, State> {
    private maxRetries = 3;

    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            errorInfo,
        });

        // Log error using help desk error handling
        HelpDeskErrorBoundary.handleComponentError(error, errorInfo);

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleRetry = () => {
        if (this.state.retryCount < this.maxRetries) {
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
                retryCount: this.state.retryCount + 1,
            });
        }
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-[400px] flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-200">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="flex-shrink-0">
                                    <svg
                                        className="h-8 w-8 text-red-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                        />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-lg font-medium text-gray-900">
                                        Something went wrong
                                    </h3>
                                </div>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm text-gray-600">
                                    {HelpDeskErrorBoundary.getUserFriendlyMessage(this.state.error)}
                                </p>
                            </div>

                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <div className="mb-4 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 overflow-auto max-h-32">
                                    <div className="font-bold mb-1">Error Details:</div>
                                    <div>{this.state.error.message}</div>
                                    {this.state.error.stack && (
                                        <div className="mt-2 text-xs">
                                            <div className="font-bold">Stack Trace:</div>
                                            <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex space-x-3">
                                {this.state.retryCount < this.maxRetries && (
                                    <button
                                        onClick={this.handleRetry}
                                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                    >
                                        Try Again ({this.maxRetries - this.state.retryCount} left)
                                    </button>
                                )}

                                <button
                                    onClick={this.handleReload}
                                    className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                >
                                    Reload Page
                                </button>
                            </div>

                            <div className="mt-4 text-center">
                                <a
                                    href="mailto:support@avian.com?subject=Help Desk Error"
                                    className="text-sm text-blue-600 hover:text-blue-500"
                                >
                                    Contact Support
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-based error boundary wrapper
 */
export function withHelpDeskErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WrappedComponent(props: P) {
        return (
            <HelpDeskErrorBoundaryComponent fallback={fallback}>
                <Component {...props} />
            </HelpDeskErrorBoundaryComponent>
        );
    };
}

/**
 * Simple error display component for non-boundary errors
 */
export function HelpDeskErrorDisplay({
    error,
    onRetry,
    onDismiss,
}: {
    error: string | Error;
    onRetry?: () => void;
    onDismiss?: () => void;
}) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const userFriendlyMessage = typeof error === 'string'
        ? error
        : HelpDeskErrorBoundary.getUserFriendlyMessage(error);

    return (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg
                        className="h-5 w-5 text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                        />
                    </svg>
                </div>
                <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800">
                        Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                        <p>{userFriendlyMessage}</p>
                    </div>
                    {(onRetry || onDismiss) && (
                        <div className="mt-4">
                            <div className="flex space-x-2">
                                {onRetry && (
                                    <button
                                        type="button"
                                        onClick={onRetry}
                                        className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-50"
                                    >
                                        Try Again
                                    </button>
                                )}
                                {onDismiss && (
                                    <button
                                        type="button"
                                        onClick={onDismiss}
                                        className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-50"
                                    >
                                        Dismiss
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Loading state with error fallback
 */
export function HelpDeskLoadingWithError({
    loading,
    error,
    onRetry,
    children,
}: {
    loading: boolean;
    error?: string | Error | null;
    onRetry?: () => void;
    children: ReactNode;
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <HelpDeskErrorDisplay
                error={error}
                onRetry={onRetry}
            />
        );
    }

    return <>{children}</>;
}