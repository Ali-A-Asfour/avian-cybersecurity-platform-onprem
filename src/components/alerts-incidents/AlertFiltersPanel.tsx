'use client';

import React, { useState } from 'react';
import { AlertFilters, AlertSeverity, AlertSourceSystem } from '@/types/alerts-incidents';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SeverityBadge } from '@/components/ui/SeverityBadge';

interface AlertFiltersPanelProps {
    filters: Partial<AlertFilters>;
    onFiltersChange: (filters: Partial<AlertFilters>) => void;
    showAssignmentFilters?: boolean;
    className?: string;
}

/**
 * Alert Filters Panel Component
 * 
 * Provides filtering options for alerts including:
 * - Severity filtering
 * - Source system filtering
 * - Classification filtering
 * - Date range filtering
 * 
 * Requirements: 1.1, 1.2
 */
export function AlertFiltersPanel({
    filters,
    onFiltersChange,
    showAssignmentFilters = true,
    className,
}: AlertFiltersPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [localFilters, setLocalFilters] = useState<Partial<AlertFilters>>(filters);

    const severityOptions: AlertSeverity[] = ['critical', 'high', 'medium', 'low'];
    const sourceSystemOptions: { value: AlertSourceSystem; label: string }[] = [
        { value: 'edr', label: 'Microsoft Defender' },
        { value: 'firewall', label: 'SonicWall Firewall' },
        { value: 'email', label: 'Email Alert' },
    ];

    /**
     * Handle filter changes locally
     */
    const handleLocalFilterChange = (key: keyof AlertFilters, value: any) => {
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
     * Toggle severity filter
     */
    const toggleSeverityFilter = (severity: AlertSeverity) => {
        const currentSeverities = Array.isArray(localFilters.severity)
            ? localFilters.severity
            : localFilters.severity
                ? [localFilters.severity]
                : [];

        const newSeverities = currentSeverities.includes(severity)
            ? currentSeverities.filter(s => s !== severity)
            : [...currentSeverities, severity];

        handleLocalFilterChange('severity', newSeverities.length > 0 ? newSeverities : undefined);
    };

    /**
     * Check if severity is selected
     */
    const isSeveritySelected = (severity: AlertSeverity): boolean => {
        if (!localFilters.severity) return false;
        if (Array.isArray(localFilters.severity)) {
            return localFilters.severity.includes(severity);
        }
        return localFilters.severity === severity;
    };

    /**
     * Get active filter count
     */
    const getActiveFilterCount = (): number => {
        let count = 0;
        if (localFilters.severity) count++;
        if (localFilters.sourceSystem) count++;
        if (localFilters.classification) count++;
        if (localFilters.startDate || localFilters.endDate) count++;
        return count;
    };

    const activeFilterCount = getActiveFilterCount();

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className || ''}`}>
            {/* Filter Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            Filters
                        </h3>
                        {activeFilterCount > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {activeFilterCount} active
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        {activeFilterCount > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={clearFilters}
                                className="text-xs"
                            >
                                Clear All
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
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
                <div className="p-4 space-y-4">
                    {/* Severity Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Severity
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {severityOptions.map((severity) => (
                                <button
                                    key={severity}
                                    onClick={() => toggleSeverityFilter(severity)}
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isSeveritySelected(severity)
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <SeverityBadge
                                        severity={severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                                        size="sm"
                                    />
                                    <span className="ml-2 capitalize">{severity}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Source System Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Source System
                        </label>
                        <select
                            value={localFilters.sourceSystem || ''}
                            onChange={(e) => handleLocalFilterChange('sourceSystem', e.target.value || undefined)}
                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Sources</option>
                            {sourceSystemOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Classification Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Classification
                        </label>
                        <Input
                            type="text"
                            placeholder="Enter classification (e.g., malware, phishing)"
                            value={localFilters.classification || ''}
                            onChange={(e) => handleLocalFilterChange('classification', e.target.value || undefined)}
                            className="w-full"
                        />
                    </div>

                    {/* Date Range Filter */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Start Date
                            </label>
                            <Input
                                type="datetime-local"
                                value={localFilters.startDate ? localFilters.startDate.toISOString().slice(0, 16) : ''}
                                onChange={(e) => handleLocalFilterChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                End Date
                            </label>
                            <Input
                                type="datetime-local"
                                value={localFilters.endDate ? localFilters.endDate.toISOString().slice(0, 16) : ''}
                                onChange={(e) => handleLocalFilterChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Apply Filters Button */}
                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                            onClick={applyFilters}
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