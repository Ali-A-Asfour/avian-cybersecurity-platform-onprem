'use client';

import React, { useEffect, useState } from 'react';
import { Asset, ComplianceStatus } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';

interface AssetComplianceReportProps {
  tenantId: string;
}

interface ComplianceReportData {
  summary: {
    total_assets: number;
    compliant_assets: number;
    non_compliant_assets: number;
    in_progress_assets: number;
    not_started_assets: number;
    compliance_percentage: number;
  };
  by_asset_type: Record<string, {
    total: number;
    compliant: number;
    compliance_percentage: number;
  }>;
  security_controls: {
    antivirus_coverage: number;
    firewall_coverage: number;
    backup_coverage: number;
    edr_coverage: number;
  };
  vulnerability_summary: {
    assets_with_critical: number;
    assets_with_high: number;
    assets_with_medium: number;
    assets_with_low: number;
    assets_clean: number;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    affected_assets: number;
  }>;
  assets: Asset[];
}

export function AssetComplianceReport({ tenantId }: AssetComplianceReportProps) {
  const [reportData, setReportData] = useState<ComplianceReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'summary' | 'details' | 'recommendations'>('summary');

  useEffect(() => {
    fetchComplianceReport();
  }, [tenantId]);

  const fetchComplianceReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/assets/compliance-report?tenant_id=${tenantId}`);
      const data = await response.json();

      if (data.success) {
        setReportData(data.data);
      } else {
        setError(data.error?.message || 'Failed to fetch compliance report');
      }
    } catch (error) {
      setError('Failed to fetch compliance report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'csv') => {
    try {
      const response = await fetch(`/api/assets/compliance-report/export?format=${format}&tenant_id=${tenantId}`, {
        method: 'POST',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `asset-compliance-report.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to export report');
      }
    } catch (error) {
      alert('Failed to export report');
    }
  };

  const getComplianceStatusBadge = (status: ComplianceStatus) => {
    const config = {
      [ComplianceStatus.COMPLETED]: { color: 'green' as const, label: 'Compliant' },
      [ComplianceStatus.IN_PROGRESS]: { color: 'yellow' as const, label: 'In Progress' },
      [ComplianceStatus.NON_COMPLIANT]: { color: 'red' as const, label: 'Non-Compliant' },
      [ComplianceStatus.NOT_STARTED]: { color: 'gray' as const, label: 'Not Started' },
    };
    return <Badge color={config[status].color}>{config[status].label}</Badge>;
  };

  const getRiskScoreBadge = (score: number) => {
    let color: 'green' | 'yellow' | 'orange' | 'red' = 'green';
    let label = 'Low';

    if (score >= 75) {
      color = 'red';
      label = 'Critical';
    } else if (score >= 50) {
      color = 'orange';
      label = 'High';
    } else if (score >= 25) {
      color = 'yellow';
      label = 'Medium';
    }

    return <Badge color={color}>{label} ({score})</Badge>;
  };

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    // Map priority to severity levels for visual consistency
    const mapPriority = (prio: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' => {
      switch (prio) {
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'low';
      }
    };

    return <SeverityBadge severity={mapPriority(priority)} size="sm" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <Card>
        <div className="p-6">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 mb-2">Error</div>
            <div className="text-gray-600 dark:text-gray-400 mb-4">{error}</div>
            <Button onClick={fetchComplianceReport}>Retry</Button>
          </div>
        </div>
      </Card>
    );
  }

  const assetColumns = [
    {
      key: 'name',
      label: 'Asset Name',
      render: (asset: Asset) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{asset.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{asset.ip_address}</div>
        </div>
      ),
    },
    {
      key: 'asset_type',
      label: 'Type',
      render: (asset: Asset) => (
        <Badge color="blue">{asset.asset_type.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'compliance_status',
      label: 'Compliance Status',
      render: (asset: Asset) => getComplianceStatusBadge(asset.compliance_status),
    },
    {
      key: 'risk_score',
      label: 'Risk Score',
      render: (asset: Asset) => getRiskScoreBadge(asset.risk_score),
    },
    {
      key: 'security_tools',
      label: 'Security Tools',
      render: (asset: Asset) => (
        <div className="text-sm">
          <div className="text-gray-900 dark:text-white">{asset.security_tools.length} installed</div>
          <div className="text-gray-500 dark:text-gray-400">
            {asset.security_tools.filter(t => t.status === 'active').length} active
          </div>
        </div>
      ),
    },
    {
      key: 'vulnerabilities',
      label: 'Vulnerabilities',
      render: (asset: Asset) => {
        const critical = asset.vulnerabilities.filter(v => v.severity === 'critical').length;
        const high = asset.vulnerabilities.filter(v => v.severity === 'high').length;
        return (
          <div className="text-sm">
            <div className="text-gray-900 dark:text-white">{asset.vulnerabilities.length} total</div>
            {(critical > 0 || high > 0) && (
              <div className="text-red-600 dark:text-red-400">
                {critical > 0 && `${critical} critical`}
                {critical > 0 && high > 0 && ', '}
                {high > 0 && `${high} high`}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Asset Compliance Report
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive compliance assessment across all managed assets
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => exportReport('csv')}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => exportReport('pdf')}>
            Export PDF
          </Button>
          <Button onClick={fetchComplianceReport}>
            Refresh Report
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { key: 'summary', label: 'Summary' },
            { key: 'details', label: 'Asset Details' },
            { key: 'recommendations', label: 'Recommendations' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedView(tab.key as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${selectedView === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {selectedView === 'summary' && (
        <div className="space-y-6">
          {/* Overall Compliance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <div className="p-6 text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {reportData.summary.total_assets}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Assets</div>
              </div>
            </Card>
            <Card>
              <div className="p-6 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {reportData.summary.compliant_assets}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Compliant</div>
              </div>
            </Card>
            <Card>
              <div className="p-6 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {reportData.summary.non_compliant_assets}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Non-Compliant</div>
              </div>
            </Card>
            <Card>
              <div className="p-6 text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {reportData.summary.in_progress_assets}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">In Progress</div>
              </div>
            </Card>
            <Card>
              <div className="p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {reportData.summary.compliance_percentage}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Compliance Rate</div>
              </div>
            </Card>
          </div>

          {/* Compliance by Asset Type */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Compliance by Asset Type
              </h3>
              <div className="space-y-4">
                {Object.entries(reportData.by_asset_type).map(([assetType, data]) => (
                  <div key={assetType} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge color="purple">
                        {assetType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {data.compliant} of {data.total} assets
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${data.compliance_percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {data.compliance_percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Security Controls Coverage */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Security Controls Coverage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.security_controls.antivirus_coverage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Antivirus Coverage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.security_controls.firewall_coverage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Firewall Coverage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.security_controls.edr_coverage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">EDR Coverage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.security_controls.backup_coverage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Backup Coverage</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Vulnerability Summary */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Vulnerability Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {reportData.vulnerability_summary.assets_with_critical}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Critical Vulnerabilities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {reportData.vulnerability_summary.assets_with_high}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">High Vulnerabilities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {reportData.vulnerability_summary.assets_with_medium}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Medium Vulnerabilities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {reportData.vulnerability_summary.assets_with_low}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Low Vulnerabilities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {reportData.vulnerability_summary.assets_clean}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Clean Assets</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {selectedView === 'details' && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Asset Compliance Details
            </h3>
            <DataTable
              data={reportData.assets}
              columns={assetColumns}
            />
          </div>
        </Card>
      )}

      {selectedView === 'recommendations' && (
        <div className="space-y-4">
          {reportData.recommendations.map((recommendation, index) => (
            <Card key={index}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getPriorityBadge(recommendation.priority)}
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {recommendation.title}
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      {recommendation.description}
                    </p>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Affects {recommendation.affected_assets} assets
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}