/**
 * Reports Navigation Component
 * 
 * Provides navigation interface for Weekly, Monthly, and Quarterly reports.
 * Includes role-based access control (Super Admin, Security Analyst only).
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ReportsNavigationProps {
    currentReportType?: 'weekly' | 'monthly' | 'quarterly';
    onReportTypeChange?: (reportType: 'weekly' | 'monthly' | 'quarterly') => void;
    className?: string;
}

const reportTypes = [
    {
        id: 'weekly' as const,
        name: 'Weekly Reports',
        description: 'Executive security summary and risk assessment for the week',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        )
    },
    {
        id: 'monthly' as const,
        name: 'Monthly Reports',
        description: 'Strategic security insights and performance trends for the month',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        )
    },
    {
        id: 'quarterly' as const,
        name: 'Quarterly Reports',
        description: 'Board-ready security performance and business value delivered',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        )
    }
];

export function ReportsNavigation({
    currentReportType,
    onReportTypeChange,
    className
}: ReportsNavigationProps) {
    const handleKeyDown = (event: React.KeyboardEvent, reportType: 'weekly' | 'monthly' | 'quarterly') => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onReportTypeChange?.(reportType);
        }
    };

    return (
        <div className={cn("reports-navigation", className)}>
            {/* Navigation Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav
                    className="-mb-px flex flex-col sm:flex-row sm:space-x-8 space-y-2 sm:space-y-0"
                    aria-label="Report Types"
                    role="tablist"
                >
                    {reportTypes.map((reportType) => {
                        const isActive = currentReportType === reportType.id;

                        return (
                            <button
                                key={reportType.id}
                                onClick={() => onReportTypeChange?.(reportType.id)}
                                onKeyDown={(e) => handleKeyDown(e, reportType.id)}
                                className={cn(
                                    'group inline-flex items-center py-4 px-3 sm:px-1 border-b-2 font-medium text-sm transition-colors duration-200 rounded-t-lg sm:rounded-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                                    isActive
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800'
                                )}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={`Switch to ${reportType.name}`}
                                aria-selected={isActive}
                                role="tab"
                                tabIndex={isActive ? 0 : -1}
                            >
                                <span className={cn(
                                    'mr-2 transition-colors duration-200 flex-shrink-0',
                                    isActive
                                        ? 'text-primary-500 dark:text-primary-400'
                                        : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
                                )}>
                                    {reportType.icon}
                                </span>
                                <span className="truncate">{reportType.name}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Description for current report type */}
            {currentReportType && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start space-y-2 sm:space-y-0 sm:space-x-3">
                        <div className="flex-shrink-0 text-primary-500 dark:text-primary-400 self-start">
                            {reportTypes.find(rt => rt.id === currentReportType)?.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                {reportTypes.find(rt => rt.id === currentReportType)?.name}
                            </h3>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 break-words">
                                {reportTypes.find(rt => rt.id === currentReportType)?.description}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}