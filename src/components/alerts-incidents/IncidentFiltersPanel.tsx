'use client';

import { useState } from 'react';
import { IncidentFilters, IncidentStatus, AlertSeverity } from '@/types/alerts-incidents';
import { Button } from '@/components/ui/Button';

interface IncidentFiltersPanelProps {
    filters: Partial<IncidentFilters>;
    onFiltersChange: (filters: Partial<IncidentFilters>) => void;
    className?: string;
}

/**
 * Incident Filters Panel Component
 * 
 * Provides filtering options for incident queues:
 * - Status filtering (open, in_progress, resolved, dismissed)
 * - Severity filtering (critical, high, medium, low)
 * - Date range filtering
 * 
 * Requirements: 7.1, 8.1
 */
export function IncidentFiltersPanel({
    filters,
    onFiltersChange,
    className,
}: IncidentFiltersPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [localFilters, setLocalFilters] = useState<Partial<IncidentFilters>>(filters);

    /**
     * Handle filter value changes
     */
    const handleFilterChange = (key: keyof IncidentFilters, value: any) => {
        const newFilters = { ...localFilters, [key]: value };
        setLocalFilters(newFilters);
    };

    /**
     * Apply filters
     */
    const applyFilters = () => {
        onFiltersChange(localFilters);
    };

    /**
     * Clear all filters
     */
    const clearFilters = () => {
        const clearedFilters = {};
        setLocalFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    /**
     * Check if any filters are active
     */
    const hasActiveFilters = () => {
        return Object.keys(filters).some(key => {
            const value = filters[key as keyof IncidentFilters];
            return value !== undefined && value !== null &&
                (Array.isArray(value) ? value.length > 0 : true);
        });
    };

    /**
     * Format date for input
     */
    const formatDateForInput = (date: Date | undefined): string => {
        if (!date) return '';
        return date.toISOString().split('T')[0];
    };

    /**
     * Parse date from input
     */
    const parseDateFromInput = (dateStr: string): Date | undefined => {
        if (!dateStr) return undefined;
        return new Date(dateStr);
    };

    const statusOptions: { value: IncidentStatus; label: string }[] = [
        { value: 'open', label: 'Open' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'dismissed', label: 'Dismissed' },
    ];

    const severityOptions: { value: AlertSeverity; label: string }[] = [
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
    ];

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className || ''}`}>
            {/* Filter Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            Filters
                        </h3>
                        {hasActiveFilters() && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {Object.keys(filters).length} active
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        {hasActiveFilters() && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={clearFilters}
                                className="text-xs"
                            >
                                Clear All
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-xs"
                        >
                            {isExpanded ? 'Hide' : 'Show'} Filters
                            <svg
                                className={`w-4 h-4 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Filter Content */}
            {isExpanded && (
                <div className="px-6 py-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Status Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Status
                            </label>
                            <div className="space-y-2">
                                {statusOptions.map((option) => (
                                    <label key={option.value} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={Array.isArray(localFilters.status)
                                                ? localFilters.status.includes(option.value)
                                                : localFilters.status === option.value
                                            }
                                            onChange={(e) => {
                                                const currentStatus = localFilters.status;
                                                let newStatus: IncidentStatus[] | undefined;

                                                if (e.target.checked) {
                                                    if (Array.isArray(currentStatus)) {
                                                        newStatus = [...currentStatus, option.value];
                                                    } else if (currentStatus) {
                                                        newStatus = [currentStatus, option.value];
                                                    } else {
                                                        newStatus = [option.value];
                                                    }
                                                } else {
                                                    if (Array.isArray(currentStatus)) {
                                                        newStatus = currentStatus.filter(s => s !== option.value);
                                                        if (newStatus.length === 0) newStatus = undefined;
                                                    } else {
                                                        newStatus = undefined;
                                                    }
                                                }

                                                handleFilterChange('status', newStatus);
                                            }}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-900 dark:text-white">
                                            {option.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Severity Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Severity
                            </label>
                            <div className="space-y-2">
                                {severityOptions.map((option) => (
                                    <label key={option.value} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={Array.isArray(localFilters.severity)
                                                ? localFilters.severity.includes(option.value)
                                                : localFilters.severity === option.value
                                            }
                                            onChange={(e) => {
                                                const currentSeverity = localFilters.severity;
                                                let newSeverity: AlertSeverity[] | undefined;

                                                if (e.target.checked) {
                                                    if (Array.isArray(currentSeverity)) {
                                                        newSeverity = [...currentSeverity, option.value];
                                                    } else if (currentSeverity) {
                                                        newSeverity = [currentSeverity, option.value];
                                                    } else {
                                                        newSeverity = [option.value];
                                                    }
                                                } else {
                                                    if (Array.isArray(currentSeverity)) {
                                                        newSeverity = currentSeverity.filter(s => s !== option.value);
                                                        if (newSeverity.length === 0) newSeverity = undefined;
                                                    } else {
                                                        newSeverity = undefined;
                                                    }
                                                }

                                                handleFilterChange('severity', newSeverity);
                                            }}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-900 dark:text-white">
                                            {option.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Date Range Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={formatDateForInput(localFilters.startDate)}
                                onChange={(e) => handleFilterChange('startDate', parseDateFromInput(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={formatDateForInput(localFilters.endDate)}
                                onChange={(e) => handleFilterChange('endDate', parseDateFromInput(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Apply Filters Button */}
                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                            onClick={applyFilters}
                            size="sm"
                            className="px-4 py-2"
                        >
                            Apply Filters
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}