'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { Button } from '@/components/ui/Button';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { api } from '@/lib/api-client';

interface DeviceDetail {
    id: string;
    deviceName: string;
    operatingSystem: string;
    osVersion: string;
    primaryUser: string;
    defenderHealthStatus: string;
    riskScore: number;
    exposureLevel: string;
    intuneComplianceState: string;
    intuneEnrollmentStatus: string;
    lastSeenAt: Date | string;
}

interface Alert {
    id: string;
    severity: string;
    threatType: string;
    threatName: string;
    status: string;
    description: string;
    detectedAt: Date | string;
}

interface Vulnerability {
    id: string;
    cveId: string;
    severity: string;
    cvssScore: number | null;
    exploitability: string;
    description: string;
    detectedAt: Date | string;
}

interface Compliance {
    complianceState: string;
    failedRules: Array<{ ruleName: string; state: string }>;
    securityBaselineStatus: string;
    requiredAppsStatus: Array<{ appName: string; installed: boolean }>;
    checkedAt: Date | string;
}

interface AvailableAction {
    type: string;
    label: string;
    description: string;
}

interface DeviceDetailResponse {
    device: DeviceDetail;
    alerts: Alert[];
    vulnerabilities: Vulnerability[];
    compliance: Compliance | null;
    availableActions: AvailableAction[];
}

interface DeviceDetailPageProps {
    deviceId: string;
}

export function DeviceDetailPage({ deviceId }: DeviceDetailPageProps) {
    const router = useRouter();
    const [data, setData] = useState<DeviceDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Fetch device details
    const fetchDeviceDetails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get(`/api/edr/devices/${deviceId}`);

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                if (response.status === 403) {
                    throw new Error('Access denied to this device');
                }
                if (response.status === 404) {
                    throw new Error('Device not found');
                }
                throw new Error(`Failed to fetch device details: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success && result.data) {
                setData(result.data);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load device details';
            setError(errorMessage);
            console.error('Error fetching device details:', err);
        } finally {
            setLoading(false);
        }
    }, [deviceId, router]);

    // Initial fetch
    useEffect(() => {
        fetchDeviceDetails();
    }, [fetchDeviceDetails]);

    // Auto-refresh every 30 seconds
    useAutoRefresh({
        onRefresh: fetchDeviceDetails,
        interval: 30000,
        enabled: true,
    });

    // Handle remote action execution
    const handleRemoteAction = async (actionType: string) => {
        try {
            setActionLoading(actionType);

            const response = await api.post('/api/edr/actions', {
                deviceId,
                actionType,
            });

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                if (response.status === 403) {
                    throw new Error('You do not have permission to perform this action');
                }
                throw new Error(`Failed to execute action: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                // Refresh device details to show updated status
                await fetchDeviceDetails();
            } else {
                throw new Error(result.error?.message || 'Action failed');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to execute action';
            alert(errorMessage);
            console.error('Error executing remote action:', err);
        } finally {
            setActionLoading(null);
        }
    };

    // Map values to standard badge types
    const mapRiskToSeverity = (riskScore: number): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
        if (riskScore >= 75) return 'critical';
        if (riskScore >= 50) return 'high';
        if (riskScore >= 25) return 'medium';
        return 'low';
    };

    const mapSeverityLevel = (severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
        const s = severity.toLowerCase();
        if (s === 'critical') return 'critical';
        if (s === 'high') return 'high';
        if (s === 'medium') return 'medium';
        if (s === 'low') return 'low';
        return 'info';
    };

    const mapComplianceToStatus = (state: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
        if (state === 'compliant') return 'resolved';
        if (state === 'noncompliant') return 'escalated';
        return 'new';
    };

    const mapHealthToStatus = (status: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
        const s = status.toLowerCase();
        if (s === 'active' || s === 'healthy') return 'resolved';
        if (s === 'inactive' || s === 'isolated') return 'in_progress';
        if (s === 'compromised') return 'escalated';
        return 'new';
    };

    // Format date
    const formatDate = (date: Date | string): string => {
        const d = new Date(date);
        return d.toLocaleString();
    };

    // Format relative time
    const formatRelativeTime = (date: Date | string): string => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString();
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading device details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                    <div className="flex items-center">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Error</h3>
                            <p className="text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/edr/devices')}
                        className="mt-4"
                    >
                        Back to Devices
                    </Button>
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const { device, alerts, vulnerabilities, compliance, availableActions } = data;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/edr/devices')}
                        className="mb-2"
                    >
                        ← Back to Devices
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {device.deviceName}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {device.operatingSystem} {device.osVersion}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <SeverityBadge
                        severity={mapRiskToSeverity(device.riskScore)}
                        size="sm"
                    />
                    <StatusBadge
                        status={mapHealthToStatus(device.defenderHealthStatus)}
                        size="sm"
                    />
                </div>
            </div>

            {/* Device Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Primary User</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {device.primaryUser || 'N/A'}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Exposure Level</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {device.exposureLevel}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Enrollment Status</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {device.intuneEnrollmentStatus}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Last Seen</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {formatRelativeTime(device.lastSeenAt)}
                    </div>
                </div>
            </div>

            {/* Defender Health Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Microsoft Defender Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Health Status</div>
                        <div className="mt-1">
                            <StatusBadge
                                status={mapHealthToStatus(device.defenderHealthStatus)}
                                size="sm"
                            />
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Risk Score</div>
                        <div className="flex items-center mt-1">
                            <SeverityBadge
                                severity={mapRiskToSeverity(device.riskScore)}
                                size="sm"
                            />
                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                                {device.exposureLevel}
                            </span>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Active Alerts</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                            {alerts.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Intune Compliance Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Intune Compliance Status
                </h2>
                {compliance ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Compliance State</div>
                                <div className="mt-1">
                                    <StatusBadge
                                        status={mapComplianceToStatus(compliance.complianceState)}
                                        size="sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Security Baseline</div>
                                <div className="mt-1">
                                    <StatusBadge
                                        status={mapComplianceToStatus(compliance.securityBaselineStatus)}
                                        size="sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Last Checked</div>
                                <div className="text-sm text-gray-900 dark:text-white mt-1">
                                    {formatRelativeTime(compliance.checkedAt)}
                                </div>
                            </div>
                        </div>

                        {compliance.failedRules && compliance.failedRules.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                    Failed Rules ({compliance.failedRules.length})
                                </h3>
                                <div className="space-y-2">
                                    {compliance.failedRules.map((rule, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800"
                                        >
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {rule.ruleName}
                                            </span>
                                            <StatusBadge
                                                status="escalated"
                                                size="sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {compliance.requiredAppsStatus && compliance.requiredAppsStatus.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                    Required Apps
                                </h3>
                                <div className="space-y-2">
                                    {compliance.requiredAppsStatus.map((app, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                                        >
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {app.appName}
                                            </span>
                                            <StatusBadge
                                                status={app.installed ? 'resolved' : 'escalated'}
                                                size="sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-600 dark:text-gray-400">No compliance data available</p>
                )}
            </div>

            {/* Vulnerabilities */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Vulnerabilities ({vulnerabilities.length})
                </h2>
                {vulnerabilities.length > 0 ? (
                    <div className="space-y-3">
                        {vulnerabilities.slice(0, 10).map((vuln) => (
                            <div
                                key={vuln.id}
                                className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <a
                                            href={`https://nvd.nist.gov/vuln/detail/${vuln.cveId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                        >
                                            {vuln.cveId}
                                        </a>
                                        <SeverityBadge
                                            severity={mapSeverityLevel(vuln.severity)}
                                            size="sm"
                                        />
                                        {vuln.cvssScore !== null && (
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                CVSS: {vuln.cvssScore}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {vuln.description}
                                    </p>
                                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                                        <span>Exploitability: {vuln.exploitability}</span>
                                        <span>Detected: {formatRelativeTime(vuln.detectedAt)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {vulnerabilities.length > 10 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                Showing 10 of {vulnerabilities.length} vulnerabilities
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-600 dark:text-gray-400">No vulnerabilities detected</p>
                )}
            </div>

            {/* Active Alerts */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Active Alerts ({alerts.length})
                </h2>
                {alerts.length > 0 ? (
                    <div className="space-y-3">
                        {alerts.map((alert) => (
                            <div
                                key={alert.id}
                                className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <SeverityBadge
                                            severity={mapSeverityLevel(alert.severity)}
                                            size="sm"
                                        />
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {alert.threatName}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {alert.description}
                                    </p>
                                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                                        <span>Type: {alert.threatType}</span>
                                        <span>Status: {alert.status}</span>
                                        <span>Detected: {formatRelativeTime(alert.detectedAt)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-600 dark:text-gray-400">No active alerts</p>
                )}
            </div>

            {/* Remote Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Available Remote Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {availableActions.map((action) => (
                        <div
                            key={action.type}
                            className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                        >
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                {action.label}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                {action.description}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoteAction(action.type)}
                                disabled={actionLoading !== null}
                                className="w-full"
                            >
                                {actionLoading === action.type ? (
                                    <span className="flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                        Executing...
                                    </span>
                                ) : (
                                    action.label
                                )}
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
