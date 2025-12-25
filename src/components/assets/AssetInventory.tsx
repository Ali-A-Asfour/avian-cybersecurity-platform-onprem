'use client';

import React, { useEffect, useState } from 'react';
import { Asset, AssetType, ComplianceStatus } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { AssetDetailView } from './AssetDetailView';
import { AssetFilters, AssetFilterOptions } from './AssetFilters';
import { AssetComplianceReport } from './AssetComplianceReport';

interface AssetInventoryProps {
  tenantId: string;
}

export function AssetInventory({ tenantId }: AssetInventoryProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [inventoryReport, setInventoryReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'inventory' | 'compliance'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<AssetFilterOptions>({
    assetTypes: [],
    complianceStatuses: [],
    riskScoreRange: { min: 0, max: 100 },
    hasVulnerabilities: null,
    securityToolsInstalled: null,
    lastScanDays: null,
  });

  useEffect(() => {
    fetchAssets();
    fetchInventoryReport();
  }, [tenantId]);

  useEffect(() => {
    applyFilters();
  }, [assets, searchTerm, filters]);

  const fetchAssets = async () => {
    try {
      // Use mock data for development
      const { mockAssets } = await import('@/lib/dev-mode');
      const { delay } = await import('@/lib/mock-data');
      await delay(500); // Simulate loading

      // Convert mock data to expected format
      const mockAssetData = mockAssets.map(asset => ({
        id: asset.id,
        name: asset.hostname,
        ip_address: '192.168.1.' + (Math.floor(Math.random() * 254) + 1),
        asset_type: asset.type === 'Workstation' ? 'workstation' : asset.type === 'Server' ? 'server' : 'laptop',
        description: `${asset.type} running ${asset.os}`,
        os_info: {
          name: asset.os,
          version: asset.os.includes('Windows') ? '10.0.19042' : '20.04.3 LTS',
          architecture: 'x64'
        },
        security_tools: [
          { name: 'Windows Defender', version: '4.18.2111.5', status: 'active' },
          { name: 'AVIAN Agent', version: '1.2.3', status: 'active' }
        ],
        vulnerabilities: Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
          id: `vuln-${i}`,
          cve_id: `CVE-2024-${1000 + i}`,
          severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
          title: `Sample Vulnerability ${i + 1}`,
          description: 'Mock vulnerability for demo purposes'
        })),
        compliance_status: ['completed', 'in_progress', 'non_compliant', 'not_started'][Math.floor(Math.random() * 4)],
        risk_score: asset.riskScore,
        last_scan: asset.lastSeen,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tenant_id: 'demo-tenant'
      }));

      setAssets(mockAssetData);
      setFilteredAssets(mockAssetData);
    } catch (error) {
      setError('Failed to fetch assets');
    }
  };

  const applyFilters = () => {
    let filtered = [...assets];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(asset =>
        asset.name.toLowerCase().includes(searchLower) ||
        asset.ip_address.toLowerCase().includes(searchLower) ||
        asset.description?.toLowerCase().includes(searchLower) ||
        asset.os_info.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply asset type filter
    if (filters.assetTypes.length > 0) {
      filtered = filtered.filter(asset => filters.assetTypes.includes(asset.asset_type));
    }

    // Apply compliance status filter
    if (filters.complianceStatuses.length > 0) {
      filtered = filtered.filter(asset => filters.complianceStatuses.includes(asset.compliance_status));
    }

    // Apply risk score range filter
    filtered = filtered.filter(asset =>
      asset.risk_score >= filters.riskScoreRange.min &&
      asset.risk_score <= filters.riskScoreRange.max
    );

    // Apply vulnerabilities filter
    if (filters.hasVulnerabilities !== null) {
      filtered = filtered.filter(asset =>
        filters.hasVulnerabilities ? asset.vulnerabilities.length > 0 : asset.vulnerabilities.length === 0
      );
    }

    // Apply security tools filter
    if (filters.securityToolsInstalled !== null) {
      filtered = filtered.filter(asset =>
        filters.securityToolsInstalled ? asset.security_tools.length > 0 : asset.security_tools.length === 0
      );
    }

    // Apply last scan filter
    if (filters.lastScanDays !== null) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.lastScanDays);
      filtered = filtered.filter(asset => new Date(asset.last_scan) >= cutoffDate);
    }

    setFilteredAssets(filtered);
  };

  const handleFiltersChange = (newFilters: AssetFilterOptions) => {
    setFilters(newFilters);
  };

  const handleSearch = (searchValue: string) => {
    setSearchTerm(searchValue);
  };

  const fetchInventoryReport = async () => {
    try {
      // Use mock data for development
      const { delay } = await import('@/lib/mock-data');
      await delay(300); // Simulate loading

      const mockReport = {
        total_assets: 150,
        compliance_summary: {
          completed: 120,
          in_progress: 20,
          non_compliant: 8,
          not_started: 2
        },
        vulnerabilities: {
          critical: 5,
          high: 15,
          medium: 35,
          low: 45
        },
        security_tools: {
          'Windows Defender': 140,
          'AVIAN Agent': 150,
          'CrowdStrike': 25,
          'Symantec': 10
        }
      };

      setInventoryReport(mockReport);
    } catch (error) {
      console.error('Failed to fetch inventory report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAssetTypeBadge = (type: AssetType) => {
    const typeConfig = {
      [AssetType.WORKSTATION]: { color: 'blue' as const, label: 'Workstation' },
      [AssetType.SERVER]: { color: 'purple' as const, label: 'Server' },
      [AssetType.LAPTOP]: { color: 'green' as const, label: 'Laptop' },
      [AssetType.MOBILE_DEVICE]: { color: 'yellow' as const, label: 'Mobile' },
      [AssetType.NETWORK_DEVICE]: { color: 'gray' as const, label: 'Network' },
      [AssetType.IOT_DEVICE]: { color: 'orange' as const, label: 'IoT' },
      [AssetType.VIRTUAL_MACHINE]: { color: 'indigo' as const, label: 'VM' },
      [AssetType.CONTAINER]: { color: 'pink' as const, label: 'Container' },
    };

    const config = typeConfig[type];
    return <Badge color={config.color}>{config.label}</Badge>;
  };

  const getComplianceStatusBadge = (status: ComplianceStatus) => {
    const statusConfig = {
      [ComplianceStatus.COMPLETED]: { color: 'green' as const, label: 'Compliant' },
      [ComplianceStatus.IN_PROGRESS]: { color: 'yellow' as const, label: 'In Progress' },
      [ComplianceStatus.NON_COMPLIANT]: { color: 'red' as const, label: 'Non-Compliant' },
      [ComplianceStatus.NOT_STARTED]: { color: 'gray' as const, label: 'Not Started' },
    };

    const config = statusConfig[status];
    return <Badge color={config.color}>{config.label}</Badge>;
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

  const handleScanAsset = async (assetId: string) => {
    try {
      // Use mock data for development
      const { delay } = await import('@/lib/mock-data');
      await delay(2000); // Simulate scan time

      // Simulate scan results
      const vulnerabilitiesFound = Math.floor(Math.random() * 8);
      alert(`Scan completed. Found ${vulnerabilitiesFound} vulnerabilities.`);
      fetchAssets(); // Refresh the list
    } catch (error) {
      alert('Failed to initiate scan');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Asset Name',
      render: (asset: Asset) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {asset.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {asset.ip_address}
          </div>
        </div>
      ),
    },
    {
      key: 'asset_type',
      label: 'Type',
      render: (asset: Asset) => getAssetTypeBadge(asset.asset_type),
    },
    {
      key: 'os_info',
      label: 'Operating System',
      render: (asset: Asset) => (
        <div>
          <div className="text-sm text-gray-900 dark:text-white">
            {asset.os_info.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {asset.os_info.version}
          </div>
        </div>
      ),
    },
    {
      key: 'security_tools',
      label: 'Security Tools',
      render: (asset: Asset) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {asset.security_tools.length} installed
        </div>
      ),
    },
    {
      key: 'vulnerabilities',
      label: 'Vulnerabilities',
      render: (asset: Asset) => {
        const critical = asset.vulnerabilities.filter(v => v.severity === 'critical').length;
        const high = asset.vulnerabilities.filter(v => v.severity === 'high').length;
        const total = asset.vulnerabilities.length;

        return (
          <div className="text-sm">
            <div className="text-gray-900 dark:text-white">{total} total</div>
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
    {
      key: 'compliance_status',
      label: 'Compliance',
      render: (asset: Asset) => getComplianceStatusBadge(asset.compliance_status),
    },
    {
      key: 'risk_score',
      label: 'Risk Score',
      render: (asset: Asset) => getRiskScoreBadge(asset.risk_score),
    },
    {
      key: 'last_scan',
      label: 'Last Scan',
      render: (asset: Asset) => (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {new Date(asset.last_scan).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (asset: Asset) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedAssetId(asset.id)}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleScanAsset(asset.id)}
          >
            Scan
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
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

  if (error) {
    return (
      <Card>
        <div className="p-6">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 mb-2">Error</div>
            <div className="text-gray-600 dark:text-gray-400 mb-4">{error}</div>
            <Button onClick={fetchAssets}>Retry</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {selectedAssetId && (
        <AssetDetailView
          assetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Asset Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and manage all assets in your organization
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant={currentView === 'inventory' ? 'default' : 'outline'}
            onClick={() => setCurrentView('inventory')}
          >
            Asset Inventory
          </Button>
          <Button
            variant={currentView === 'compliance' ? 'default' : 'outline'}
            onClick={() => setCurrentView('compliance')}
          >
            Compliance Report
          </Button>
        </div>
      </div>

      {currentView === 'compliance' ? (
        <AssetComplianceReport tenantId={tenantId} />
      ) : (
        <>
          <AssetFilters
            onFiltersChange={handleFiltersChange}
            onSearch={handleSearch}
          />

          {inventoryReport && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <div className="p-6">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {inventoryReport.total_assets}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Assets
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {inventoryReport.compliance_summary?.completed || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Compliant Assets
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {inventoryReport.vulnerabilities?.critical || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Critical Vulnerabilities
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {Object.keys(inventoryReport.security_tools || {}).length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Security Tools Deployed
                  </div>
                </div>
              </Card>
            </div>
          )}

          {assets.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-4">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No assets discovered
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Connect your asset discovery tools to start managing client assets.
                </p>
                <Button onClick={() => window.location.href = '/data-sources'}>
                  Deploy Agent
                </Button>
              </div>
            </Card>
          ) : filteredAssets.length === 0 ? (
            <Card>
              <div className="p-8 text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No assets match your filters
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Try adjusting your search criteria or filters to see more results.
                </p>
                <Button onClick={() => {
                  setSearchTerm('');
                  setFilters({
                    assetTypes: [],
                    complianceStatuses: [],
                    riskScoreRange: { min: 0, max: 100 },
                    hasVulnerabilities: null,
                    securityToolsInstalled: null,
                    lastScanDays: null,
                  });
                }}>
                  Clear Filters
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {filteredAssets.length} of {assets.length} assets
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchAssets}
                  >
                    Refresh
                  </Button>
                </div>
                <DataTable
                  data={filteredAssets}
                  columns={columns}
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}