'use client';

import React, { useEffect, useState } from 'react';
import { Asset, Vulnerability, SecurityTool, SoftwareItem, ComplianceStatus } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';

interface AssetDetailViewProps {
  assetId: string;
  onClose: () => void;
}

export function AssetDetailView({ assetId, onClose }: AssetDetailViewProps) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'software' | 'security' | 'vulnerabilities' | 'compliance'>('overview');

  useEffect(() => {
    fetchAssetDetails();
  }, [assetId]);

  const fetchAssetDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/assets/${assetId}`);
      const data = await response.json();

      if (data.success) {
        setAsset(data.data);
      } else {
        setError(data.error?.message || 'Failed to fetch asset details');
      }
    } catch {
      setError('Failed to fetch asset details');
    } finally {
      setLoading(false);
    }
  };

  const handleScanAsset = async () => {
    try {
      const response = await fetch(`/api/assets/${assetId}/scan`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        alert(`Scan completed. Found ${data.data.vulnerabilities_found} vulnerabilities.`);
        fetchAssetDetails(); // Refresh asset data
      } else {
        alert(`Scan failed: ${data.error?.message}`);
      }
    } catch {
      alert('Failed to initiate scan');
    }
  };

  const getStatusBadge = (status: string, type: 'security' | 'compliance' | 'risk') => {
    if (type === 'security') {
      const config = {
        active: { color: 'green' as const, label: 'Active' },
        inactive: { color: 'red' as const, label: 'Inactive' },
        error: { color: 'red' as const, label: 'Error' },
        updating: { color: 'yellow' as const, label: 'Updating' },
      };
      return <Badge color={config[status as keyof typeof config]?.color || 'gray'}>
        {config[status as keyof typeof config]?.label || status}
      </Badge>;
    }

    if (type === 'compliance') {
      const config = {
        [ComplianceStatus.COMPLETED]: { color: 'green' as const, label: 'Compliant' },
        [ComplianceStatus.IN_PROGRESS]: { color: 'yellow' as const, label: 'In Progress' },
        [ComplianceStatus.NON_COMPLIANT]: { color: 'red' as const, label: 'Non-Compliant' },
        [ComplianceStatus.NOT_STARTED]: { color: 'gray' as const, label: 'Not Started' },
      };
      return <Badge color={config[status as ComplianceStatus]?.color || 'gray'}>
        {config[status as ComplianceStatus]?.label || status}
      </Badge>;
    }

    return <Badge color="gray">{status}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    // Map to standard severity levels
    const mapSeverity = (sev: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
      switch (sev.toLowerCase()) {
        case 'critical': return 'critical';
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapSeverity(severity)} size="sm" />;
  };

  const getRiskScoreBadge = (score: number) => {
    let color: 'green' | 'yellow' | 'orange' | 'red' = 'green';
    let label = 'Low Risk';

    if (score >= 75) {
      color = 'red';
      label = 'Critical Risk';
    } else if (score >= 50) {
      color = 'orange';
      label = 'High Risk';
    } else if (score >= 25) {
      color = 'yellow';
      label = 'Medium Risk';
    }

    return <Badge color={color}>{label} ({score})</Badge>;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md">
          <div className="p-6 text-center">
            <div className="text-red-600 dark:text-red-400 mb-2">Error</div>
            <div className="text-gray-600 dark:text-gray-400 mb-4">{error}</div>
            <div className="flex space-x-2 justify-center">
              <Button onClick={fetchAssetDetails}>Retry</Button>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const vulnerabilityColumns = [
    {
      key: 'title',
      label: 'Vulnerability',
      render: (vuln: Vulnerability) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{vuln.title}</div>
          {vuln.cve_id && (
            <div className="text-sm text-gray-500 dark:text-gray-400">{vuln.cve_id}</div>
          )}
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (vuln: Vulnerability) => getSeverityBadge(vuln.severity),
    },
    {
      key: 'cvss_score',
      label: 'CVSS Score',
      render: (vuln: Vulnerability) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {vuln.cvss_score || 'N/A'}
        </span>
      ),
    },
    {
      key: 'affected_software',
      label: 'Affected Software',
      render: (vuln: Vulnerability) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {vuln.affected_software}
        </span>
      ),
    },
    {
      key: 'remediation_status',
      label: 'Status',
      render: (vuln: Vulnerability) => getStatusBadge(vuln.remediation_status, 'security'),
    },
  ];

  const softwareColumns = [
    {
      key: 'name',
      label: 'Software',
      render: (software: SoftwareItem) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{software.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{software.vendor}</div>
        </div>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      render: (software: SoftwareItem) => (
        <span className="text-sm text-gray-900 dark:text-white">{software.version}</span>
      ),
    },
    {
      key: 'size_mb',
      label: 'Size',
      render: (software: SoftwareItem) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {software.size_mb ? formatBytes(software.size_mb * 1024 * 1024) : 'N/A'}
        </span>
      ),
    },
    {
      key: 'install_date',
      label: 'Installed',
      render: (software: SoftwareItem) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {software.install_date ? new Date(software.install_date).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      key: 'is_security_related',
      label: 'Security Related',
      render: (software: SoftwareItem) => (
        <Badge color={software.is_security_related ? 'blue' : 'gray'}>
          {software.is_security_related ? 'Yes' : 'No'}
        </Badge>
      ),
    },
  ];

  const securityToolColumns = [
    {
      key: 'name',
      label: 'Security Tool',
      render: (tool: SecurityTool) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{tool.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{tool.vendor}</div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (tool: SecurityTool) => (
        <Badge color="blue">{tool.type.toUpperCase()}</Badge>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      render: (tool: SecurityTool) => (
        <span className="text-sm text-gray-900 dark:text-white">{tool.version}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (tool: SecurityTool) => getStatusBadge(tool.status, 'security'),
    },
    {
      key: 'last_update',
      label: 'Last Update',
      render: (tool: SecurityTool) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(tool.last_update)}
        </span>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {asset.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {asset.ip_address} • {asset.asset_type}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={handleScanAsset}>
                Scan Asset
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'software', label: 'Software' },
              { key: 'security', label: 'Security Tools' },
              { key: 'vulnerabilities', label: 'Vulnerabilities' },
              { key: 'compliance', label: 'Compliance' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <div className="p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Compliance Status
                    </div>
                    {getStatusBadge(asset.compliance_status, 'compliance')}
                  </div>
                </Card>
                <Card>
                  <div className="p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Risk Score
                    </div>
                    {getRiskScoreBadge(asset.risk_score)}
                  </div>
                </Card>
                <Card>
                  <div className="p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Last Scan
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatDate(asset.last_scan)}
                    </div>
                  </div>
                </Card>
              </div>

              {/* System Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      System Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Operating System:</span>
                        <span className="text-gray-900 dark:text-white">{asset.os_info.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Version:</span>
                        <span className="text-gray-900 dark:text-white">{asset.os_info.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Architecture:</span>
                        <span className="text-gray-900 dark:text-white">{asset.os_info.architecture}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">IP Address:</span>
                        <span className="text-gray-900 dark:text-white">{asset.ip_address}</span>
                      </div>
                      {asset.mac_address && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">MAC Address:</span>
                          <span className="text-gray-900 dark:text-white">{asset.mac_address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Hardware Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Manufacturer:</span>
                        <span className="text-gray-900 dark:text-white">{asset.hardware_info.manufacturer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Model:</span>
                        <span className="text-gray-900 dark:text-white">{asset.hardware_info.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">CPU:</span>
                        <span className="text-gray-900 dark:text-white">
                          {asset.hardware_info.cpu.model} ({asset.hardware_info.cpu.cores} cores)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Memory:</span>
                        <span className="text-gray-900 dark:text-white">
                          {asset.hardware_info.memory.total_gb} GB ({asset.hardware_info.memory.type})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Storage:</span>
                        <span className="text-gray-900 dark:text-white">
                          {asset.hardware_info.storage.reduce((total, storage) => total + storage.size_gb, 0)} GB
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {asset.software_inventory.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Software Installed
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {asset.security_tools.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Security Tools
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {asset.vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Critical/High Vulns
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {asset.security_tools.filter(t => t.status === 'active').length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Active Security Tools
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'software' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Software Inventory ({asset.software_inventory.length} items)
                </h3>
              </div>
              <DataTable
                data={asset.software_inventory}
                columns={softwareColumns}
              />
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Security Tools ({asset.security_tools.length} tools)
                </h3>
              </div>
              <DataTable
                data={asset.security_tools}
                columns={securityToolColumns}
              />
            </div>
          )}

          {activeTab === 'vulnerabilities' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Vulnerabilities ({asset.vulnerabilities.length} found)
                </h3>
              </div>
              {asset.vulnerabilities.length === 0 ? (
                <Card>
                  <div className="p-8 text-center">
                    <div className="text-green-600 dark:text-green-400 mb-2">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No vulnerabilities found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      This asset appears to be secure with no known vulnerabilities.
                    </p>
                  </div>
                </Card>
              ) : (
                <DataTable
                  data={asset.vulnerabilities}
                  columns={vulnerabilityColumns}
                />
              )}
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Compliance Assessment
                </h3>
              </div>

              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">
                      Overall Compliance Status
                    </h4>
                    {getStatusBadge(asset.compliance_status, 'compliance')}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Security Controls
                      </h5>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Antivirus/EDR:</span>
                          <StatusBadge
                            status={asset.security_tools.some(t => t.type === 'edr' || t.type === 'antivirus') ? 'resolved' : 'escalated'}
                            size="sm"
                          />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Firewall:</span>
                          <StatusBadge
                            status={asset.security_tools.some(t => t.type === 'firewall') ? 'resolved' : 'escalated'}
                            size="sm"
                          />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Backup Solution:</span>
                          <StatusBadge
                            status={asset.security_tools.some(t => t.type === 'backup') ? 'resolved' : 'investigating'}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Vulnerability Management
                      </h5>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Critical Vulnerabilities:</span>
                          <SeverityBadge
                            severity={asset.vulnerabilities.filter(v => v.severity === 'critical').length === 0 ? 'low' : 'critical'}
                            size="sm"
                          />
                          <span className="ml-1 text-sm">
                            {asset.vulnerabilities.filter(v => v.severity === 'critical').length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">High Vulnerabilities:</span>
                          <SeverityBadge
                            severity={asset.vulnerabilities.filter(v => v.severity === 'high').length === 0 ? 'low' : 'high'}
                            size="sm"
                          />
                          <span className="ml-1 text-sm">
                            {asset.vulnerabilities.filter(v => v.severity === 'high').length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Last Security Scan:</span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {new Date(asset.last_scan).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                    Risk Assessment
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Overall Risk Score:</span>
                    {getRiskScoreBadge(asset.risk_score)}
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${asset.risk_score >= 75 ? 'bg-red-600' :
                          asset.risk_score >= 50 ? 'bg-orange-500' :
                            asset.risk_score >= 25 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                        style={{ width: `${asset.risk_score}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}