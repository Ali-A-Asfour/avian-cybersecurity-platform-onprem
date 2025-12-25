'use client';

import React, { useState } from 'react';
import { AssetType, ComplianceStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface AssetFiltersProps {
  onFiltersChange: (filters: AssetFilterOptions) => void;
  onSearch: (searchTerm: string) => void;
}

export interface AssetFilterOptions {
  assetTypes: AssetType[];
  complianceStatuses: ComplianceStatus[];
  riskScoreRange: { min: number; max: number };
  hasVulnerabilities: boolean | null;
  securityToolsInstalled: boolean | null;
  lastScanDays: number | null;
}

export function AssetFilters({ onFiltersChange, onSearch }: AssetFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<AssetFilterOptions>({
    assetTypes: [],
    complianceStatuses: [],
    riskScoreRange: { min: 0, max: 100 },
    hasVulnerabilities: null,
    securityToolsInstalled: null,
    lastScanDays: null,
  });

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onSearch(value);
  };

  const handleFilterChange = (key: keyof AssetFilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleAssetTypeToggle = (assetType: AssetType) => {
    const newTypes = filters.assetTypes.includes(assetType)
      ? filters.assetTypes.filter(t => t !== assetType)
      : [...filters.assetTypes, assetType];
    handleFilterChange('assetTypes', newTypes);
  };

  const handleComplianceStatusToggle = (status: ComplianceStatus) => {
    const newStatuses = filters.complianceStatuses.includes(status)
      ? filters.complianceStatuses.filter(s => s !== status)
      : [...filters.complianceStatuses, status];
    handleFilterChange('complianceStatuses', newStatuses);
  };

  const clearAllFilters = () => {
    const clearedFilters: AssetFilterOptions = {
      assetTypes: [],
      complianceStatuses: [],
      riskScoreRange: { min: 0, max: 100 },
      hasVulnerabilities: null,
      securityToolsInstalled: null,
      lastScanDays: null,
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    setSearchTerm('');
    onSearch('');
  };

  const hasActiveFilters = () => {
    return (
      filters.assetTypes.length > 0 ||
      filters.complianceStatuses.length > 0 ||
      filters.riskScoreRange.min > 0 ||
      filters.riskScoreRange.max < 100 ||
      filters.hasVulnerabilities !== null ||
      filters.securityToolsInstalled !== null ||
      filters.lastScanDays !== null ||
      searchTerm.length > 0
    );
  };

  return (
    <Card>
      <div className="p-6">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search assets by name, IP address, or description..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            size="sm"
            variant={showAdvanced ? "primary" : "outline"}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Advanced Filters
          </Button>

          {hasActiveFilters() && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearAllFilters}
            >
              Clear All Filters
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Asset Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Asset Types
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.values(AssetType).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleAssetTypeToggle(type)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filters.assetTypes.includes(type)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                  >
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            {/* Compliance Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Compliance Status
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.values(ComplianceStatus).map((status) => {
                  // Map compliance status to standard status types
                  const getStatusMapping = (complianceStatus: ComplianceStatus) => {
                    switch (complianceStatus) {
                      case ComplianceStatus.COMPLETED:
                        return 'resolved';
                      case ComplianceStatus.IN_PROGRESS:
                        return 'in_progress';
                      case ComplianceStatus.FAILED:
                        return 'escalated';
                      case ComplianceStatus.NOT_STARTED:
                        return 'new';
                      default:
                        return 'closed';
                    }
                  };

                  return (
                    <button
                      key={status}
                      onClick={() => handleComplianceStatusToggle(status)}
                      className={`transition-all ${filters.complianceStatuses.includes(status)
                        ? 'ring-2 ring-blue-300'
                        : 'opacity-60 hover:opacity-100'
                        }`}
                    >
                      <StatusBadge
                        status={getStatusMapping(status) as any}
                        size="sm"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Risk Score Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Risk Score Range: {filters.riskScoreRange.min} - {filters.riskScoreRange.max}
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.riskScoreRange.min}
                    onChange={(e) => handleFilterChange('riskScoreRange', {
                      ...filters.riskScoreRange,
                      min: parseInt(e.target.value)
                    })}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Min: {filters.riskScoreRange.min}</div>
                </div>
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.riskScoreRange.max}
                    onChange={(e) => handleFilterChange('riskScoreRange', {
                      ...filters.riskScoreRange,
                      max: parseInt(e.target.value)
                    })}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max: {filters.riskScoreRange.max}</div>
                </div>
              </div>
            </div>

            {/* Boolean Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Has Vulnerabilities
                </label>
                <select
                  value={filters.hasVulnerabilities === null ? 'all' : filters.hasVulnerabilities.toString()}
                  onChange={(e) => handleFilterChange('hasVulnerabilities',
                    e.target.value === 'all' ? null : e.target.value === 'true'
                  )}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Assets</option>
                  <option value="true">With Vulnerabilities</option>
                  <option value="false">No Vulnerabilities</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Security Tools
                </label>
                <select
                  value={filters.securityToolsInstalled === null ? 'all' : filters.securityToolsInstalled.toString()}
                  onChange={(e) => handleFilterChange('securityToolsInstalled',
                    e.target.value === 'all' ? null : e.target.value === 'true'
                  )}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Assets</option>
                  <option value="true">With Security Tools</option>
                  <option value="false">No Security Tools</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Scan
                </label>
                <select
                  value={filters.lastScanDays?.toString() || 'all'}
                  onChange={(e) => handleFilterChange('lastScanDays',
                    e.target.value === 'all' ? null : parseInt(e.target.value)
                  )}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">Any Time</option>
                  <option value="1">Last 24 hours</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters() && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Active Filters:</div>
            <div className="flex flex-wrap gap-2">
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Search: "{searchTerm}"
                </span>
              )}
              {filters.assetTypes.map(type => (
                <span key={type} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Type: {type.replace('_', ' ')}
                </span>
              ))}
              {filters.complianceStatuses.map(status => (
                <span key={status} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Status: {status.replace('_', ' ')}
                </span>
              ))}
              {(filters.riskScoreRange.min > 0 || filters.riskScoreRange.max < 100) && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  Risk: {filters.riskScoreRange.min}-{filters.riskScoreRange.max}
                </span>
              )}
              {filters.hasVulnerabilities !== null && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  Vulnerabilities: {filters.hasVulnerabilities ? 'Yes' : 'No'}
                </span>
              )}
              {filters.securityToolsInstalled !== null && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  Security Tools: {filters.securityToolsInstalled ? 'Yes' : 'No'}
                </span>
              )}
              {filters.lastScanDays !== null && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  Scanned: Last {filters.lastScanDays} days
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}