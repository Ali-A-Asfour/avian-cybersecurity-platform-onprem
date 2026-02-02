/**
 * Help Desk Validation Message Components
 * 
 * Reusable components for displaying validation errors and messages
 * with consistent styling and user-friendly formatting.
 */

'use client';

import React from 'react';

interface ValidationMessageProps {
    message: string;
    type?: 'error' | 'warning' | 'info' | 'success';
    className?: string;
}

/**
 * Single validation message component
 */
export function ValidationMessage({
    message,
    type = 'error',
    className = ''
}: ValidationMessageProps) {
    const baseClasses = 'text-sm flex items-center mt-1';
    const typeClasses = {
        error: 'text-red-600 dark:text-red-400',
        warning: 'text-amber-700 dark:text-amber-300',
        info: 'text-blue-600 dark:text-blue-400',
        success: 'text-emerald-700 dark:text-emerald-300',
    };

    const iconClasses = {
        error: 'text-red-500',
        warning: 'text-amber-600',
        info: 'text-blue-500',
        success: 'text-emerald-600',
    };

    const icons = {
        error: (
            <svg className="h-4 w-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        ),
        warning: (
            <svg className="h-4 w-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        ),
        info: (
            <svg className="h-4 w-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
        ),
        success: (
            <svg className="h-4 w-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
        ),
    };

    return (
        <div className={`${baseClasses} ${typeClasses[type]} ${className}`}>
            <span className={iconClasses[type]}>
                {icons[type]}
            </span>
            <span>{message}</span>
        </div>
    );
}

interface ValidationMessagesProps {
    messages: string[];
    type?: 'error' | 'warning' | 'info' | 'success';
    className?: string;
    showIcon?: boolean;
}

/**
 * Multiple validation messages component
 */
export function ValidationMessages({
    messages,
    type = 'error',
    className = '',
    showIcon = true
}: ValidationMessagesProps) {
    if (!messages || messages.length === 0) {
        return null;
    }

    const containerClasses = {
        error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
        warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
        success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    };

    const iconClasses = {
        error: 'text-red-500 dark:text-red-400',
        warning: 'text-amber-600 dark:text-amber-400',
        info: 'text-blue-500 dark:text-blue-400',
        success: 'text-emerald-600 dark:text-emerald-400',
    };

    const icons = {
        error: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
        ),
        warning: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        ),
        info: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
        ),
        success: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
        ),
    };

    return (
        <div className={`rounded-md border p-4 mt-3 ${containerClasses[type]} ${className}`}>
            <div className="flex">
                {showIcon && (
                    <div className="flex-shrink-0">
                        <span className={iconClasses[type]}>
                            {icons[type]}
                        </span>
                    </div>
                )}
                <div className={showIcon ? 'ml-3' : ''}>
                    {messages.length === 1 ? (
                        <p className="text-sm font-medium">
                            {messages[0]}
                        </p>
                    ) : (
                        <div>
                            <h3 className="text-sm font-medium mb-2">
                                {type === 'error' ? 'Please fix the following errors:' :
                                    type === 'warning' ? 'Please note the following warnings:' :
                                        type === 'info' ? 'Information:' : 'Success:'}
                            </h3>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                {messages.map((message, index) => (
                                    <li key={index}>{message}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface FieldValidationProps {
    error?: string;
    warning?: string;
    info?: string;
    success?: string;
    className?: string;
}

/**
 * Field-level validation component
 */
export function FieldValidation({
    error,
    warning,
    info,
    success,
    className = ''
}: FieldValidationProps) {
    // Show in priority order: error > warning > success > info
    if (error) {
        return <ValidationMessage message={error} type="error" className={className} />;
    }
    if (warning) {
        return <ValidationMessage message={warning} type="warning" className={className} />;
    }
    if (success) {
        return <ValidationMessage message={success} type="success" className={className} />;
    }
    if (info) {
        return <ValidationMessage message={info} type="info" className={className} />;
    }

    return null;
}

interface FormValidationSummaryProps {
    errors?: string[];
    warnings?: string[];
    className?: string;
    title?: string;
}

/**
 * Form validation summary component
 */
export function FormValidationSummary({
    errors = [],
    warnings = [],
    className = '',
    title
}: FormValidationSummaryProps) {
    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;

    if (!hasErrors && !hasWarnings) {
        return null;
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {title && (
                <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            )}

            {hasErrors && (
                <ValidationMessages
                    messages={errors}
                    type="error"
                />
            )}

            {hasWarnings && (
                <ValidationMessages
                    messages={warnings}
                    type="warning"
                />
            )}
        </div>
    );
}

interface InlineValidationProps {
    isValid?: boolean;
    validMessage?: string;
    invalidMessage?: string;
    className?: string;
}

/**
 * Inline validation indicator (checkmark/x)
 */
export function InlineValidation({
    isValid,
    validMessage = 'Valid',
    invalidMessage = 'Invalid',
    className = ''
}: InlineValidationProps) {
    if (isValid === undefined) {
        return null;
    }

    return (
        <div className={`flex items-center ${className}`}>
            {isValid ? (
                <>
                    <svg className="h-4 w-4 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">{validMessage}</span>
                </>
            ) : (
                <>
                    <svg className="h-4 w-4 text-red-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-700 dark:text-red-300">{invalidMessage}</span>
                </>
            )}
        </div>
    );
}

interface ValidationTooltipProps {
    message: string;
    type?: 'error' | 'warning' | 'info';
    children: React.ReactNode;
}

/**
 * Validation tooltip component
 */
export function ValidationTooltip({
    message,
    type = 'error',
    children
}: ValidationTooltipProps) {
    const [isVisible, setIsVisible] = React.useState(false);

    const tooltipClasses = {
        error: 'bg-red-700 text-white dark:bg-red-600',
        warning: 'bg-amber-700 text-white dark:bg-amber-600',
        info: 'bg-blue-700 text-white dark:bg-blue-600',
    };

    return (
        <div className="relative inline-block">
            <div
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
            >
                {children}
            </div>

            {isVisible && (
                <div className={`absolute z-10 px-3 py-2 text-sm rounded-md shadow-lg -top-2 left-full ml-2 ${tooltipClasses[type]}`}>
                    <div className="max-w-xs">
                        {message}
                    </div>
                    <div className={`absolute top-2 -left-1 w-2 h-2 ${tooltipClasses[type]} transform rotate-45`}></div>
                </div>
            )}
        </div>
    );
}