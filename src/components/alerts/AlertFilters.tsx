'use client';

import { useState } from 'react';
import { AlertFilters as AlertFiltersType, AlertSeverity, AlertCategory, AlertStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface AlertFiltersProps {
  filters: AlertFiltersType;
  onFiltersChange: (filters: AlertFiltersType) => void;
  onRefresh: () => void;
}

export function AlertFilters({ filters, onFiltersChange, onRefresh }: AlertFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState<AlertFiltersType>(filters);

  const severityOptions: { value: AlertSeverity; label: string }[] = [
    { value: AlertSeverity.CRITICAL, label: 'Critical' },
    { value: AlertSeverity.HIGH, label: 'High' },
    { value: AlertSeverity.MEDIUM, label: 'Medium' },
    { value: AlertSeverity.LOW, label: 'Low' },
    { value: AlertSeverity.INFO, label: 'Info' },
  ];

  const categoryOptions: { value: AlertCategory; label: string }[] = [
    { value: AlertCategory.MALWARE, label: 'Malware' },
    { value: AlertCategory.PHISHING, label: 'Phishing' },
    { value: AlertCategory.INTRUSION, label: 'Intrusion' },
    { value: AlertCategory.DATA_BREACH, label: 'Data Breach' },
    { value: AlertCategory.POLICY_VIOLATION, label: 'Policy Violation' },
    { value: AlertCategory.ANOMALY, label: 'Anomaly' },
    { value: AlertCategory.OTHER, label: 'Other' },
  ];

  const statusOptions: { value: AlertStatus; label: string }[] = [
    { value: AlertStatus.OPEN, label: 'Open' },
    { value: AlertStatus.INVESTIGATING, label: 'Investigating' },
    { value: AlertStatus.RESOLVED, label: 'Resolved' },
    { value: AlertStatus.FALSE_POSITIVE, label: 'False Positive' },
  ];

  const handleFilterChange = (key: keyof AlertFiltersType, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
  };

  const handleArrayFilterChange = (key: keyof AlertFiltersType, value: string, checked: boolean) => {
    const currentArray = (localFilters[key] as string[]) || [];
    let newArray: string[];

    if (checked) {
      newArray = [...currentArray, value];
    } else {
      newArray = currentArray.filter(item => item !== value);
    }

    const newFilters = { ...localFilters, [key]: newArray.length > 0 ? newArray : undefined };
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
  };

  const clearFilters = () => {
    const clearedFilters: AlertFiltersType = {
      page: 1,
      limit: 50,
      sort_by: 'created_at',
      sort_order: 'desc',
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = () => {
    return !!(
      localFilters.severity?.length ||
      localFilters.category?.length ||
      localFilters.status?.length ||
      localFilters.source?.length ||
      localFilters.created_after ||
      localFilters.created_before
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Filters
          </h3>
          {hasActiveFilters() && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => handleArrayFilterChange('severity', AlertSeverity.CRITICAL, !localFilters.severity?.includes(AlertSeverity.CRITICAL))}
          className={`transition-all ${localFilters.severity?.includes(AlertSeverity.CRITICAL) ? 'ring-2 ring-red-300' : 'opacity-60 hover:opacity-100'}`}
        >
          <SeverityBadge severity="critical" size="sm" />
        </button>
        <button
          onClick={() => handleArrayFilterChange('severity', AlertSeverity.HIGH, !localFilters.severity?.includes(AlertSeverity.HIGH))}
          className={`transition-all ${localFilters.severity?.includes(AlertSeverity.HIGH) ? 'ring-2 ring-orange-300' : 'opacity-60 hover:opacity-100'}`}
        >
          <SeverityBadge severity="high" size="sm" />
        </button>
        <button
          onClick={() => handleArrayFilterChange('status', AlertStatus.OPEN, !localFilters.status?.includes(AlertStatus.OPEN))}
          className={`transition-all ${localFilters.status?.includes(AlertStatus.OPEN) ? 'ring-2 ring-blue-300' : 'opacity-60 hover:opacity-100'}`}
        >
          <StatusBadge status="open" size="sm" />
        </button>
        <button
          onClick={() => handleArrayFilterChange('status', AlertStatus.INVESTIGATING, !localFilters.status?.includes(AlertStatus.INVESTIGATING))}
          className={`transition-all ${localFilters.status?.includes(AlertStatus.INVESTIGATING) ? 'ring-2 ring-amber-300' : 'opacity-60 hover:opacity-100'}`}
        >
          <StatusBadge status="investigating" size="sm" />
        </button>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Severity
              </label>
              <div className="space-y-2">
                {severityOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localFilters.severity?.includes(option.value) || false}
                      onChange={(e) => handleArrayFilterChange('severity', option.value, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <SeverityBadge
                      severity={option.value.toLowerCase() as any}
                      size="sm"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <div className="space-y-2">
                {categoryOptions.map(option => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={localFilters.category?.includes(option.value) || false}
                      onChange={(e) => handleArrayFilterChange('category', option.value, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <div className="space-y-2">
                {statusOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localFilters.status?.includes(option.value) || false}
                      onChange={(e) => handleArrayFilterChange('status', option.value, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <StatusBadge
                      status={option.value.toLowerCase().replace(' ', '_') as any}
                      size="sm"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <div className="space-y-2">
                <Input
                  type="date"
                  placeholder="From"
                  value={localFilters.created_after ? localFilters.created_after.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('created_after', e.target.value ? new Date(e.target.value) : undefined)}
                  className="text-sm"
                />
                <Input
                  type="date"
                  placeholder="To"
                  value={localFilters.created_before ? localFilters.created_before.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('created_before', e.target.value ? new Date(e.target.value) : undefined)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source
            </label>
            <Input
              type="text"
              placeholder="Filter by source (e.g., Splunk, QRadar)"
              value={localFilters.source?.join(', ') || ''}
              onChange={(e) => {
                const sources = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                handleFilterChange('source', sources.length > 0 ? sources : undefined);
              }}
              className="max-w-md"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={applyFilters}>
              Apply Filters
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}