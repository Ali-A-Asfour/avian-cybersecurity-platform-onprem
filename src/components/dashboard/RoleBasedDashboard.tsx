'use client';

import React, { useEffect, useState } from 'react';
import { UserRole } from '@/types';
import { DashboardGrid } from './DashboardGrid';
import { UserDashboard } from './UserDashboard';
import { useTenant } from '@/contexts/TenantContext';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DashboardCardSkeleton } from '@/components/ui/LoadingSkeleton';
import { api } from '@/lib/api-client';

interface AnalystMetricsProps {
  onNavigate: (section: string) => void;
}

function SecurityAnalystMetrics({ onNavigate }: AnalystMetricsProps) {
  const [myTicketsData, setMyTicketsData] = useState<any>(null);
  const [alertData, setAlertData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Initialize with mock data in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const mockData = {
        myTickets: { total: 12, urgent: 3, inProgress: 7, resolved: 2 },
        agents: { total: 45, online: 42, offline: 3, alerts: 8 },
        alerts: { total: 156, critical: 12, high: 34, medium: 67, low: 43 }
      };

      setMyTicketsData(mockData.myTickets);
      setAlertData(mockData.alerts);
      setLoading(false);
    } else {
      fetchMyTicketsData();
      fetchAlertData();
    }

    // Set up real-time updates
    const interval = setInterval(() => {
      fetchMyTicketsData();
      fetchAlertData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMyTicketsData = async () => {
    try {
      const response = await api.get('/api/dashboard/my-tickets');
      const result = await response.json();
      if (result.success) {
        setMyTicketsData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch my tickets data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertData = async () => {
    try {
      const response = await api.get('/api/alerts?limit=100');
      const result = await response.json();
      if (result.success) {
        const alerts = result.data.alerts || [];
        const criticalAlerts = alerts.filter((alert: any) => alert.severity === 'critical').length;
        const highAlerts = alerts.filter((alert: any) => alert.severity === 'high').length;
        const openAlerts = alerts.filter((alert: any) => alert.status === 'open').length;

        setAlertData({
          critical: criticalAlerts,
          high: highAlerts,
          open: openAlerts,
          total: alerts.length
        });
      }
    } catch (error) {
      console.error('Failed to fetch alert data:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-24 animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i + 4} className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-24 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Tickets Section */}
      <div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Security Tickets</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">My Open Tickets</h4>
            <div className="text-2xl font-bold text-red-600">{myTicketsData?.open || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
              {myTicketsData?.overdue || 0} overdue • {myTicketsData?.total || 0} total
            </p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Critical Assigned</h4>
            <div className="text-2xl font-bold text-orange-600">{myTicketsData?.by_severity?.critical || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Critical tickets assigned to me</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">In Progress</h4>
            <div className="text-2xl font-bold text-blue-600">{myTicketsData?.in_progress || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Currently working on</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Resolved Today</h4>
            <div className="text-2xl font-bold text-green-600">{myTicketsData?.resolved_today || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Tickets resolved today</p>
          </div>
        </div>
      </div>

      {/* Security Alerts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Security Alerts</h3>
          <button
            onClick={() => onNavigate('alerts')}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View All Alerts →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Critical Alerts</h4>
            <div className="text-2xl font-bold text-red-600">{alertData?.critical || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Require immediate attention</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">High Priority</h4>
            <div className="text-2xl font-bold text-orange-600">{alertData?.high || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">High severity alerts</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Open Alerts</h4>
            <div className="text-2xl font-bold text-yellow-600">{alertData?.open || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Awaiting investigation</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Total Today</h4>
            <div className="text-2xl font-bold text-neutral-600 dark:text-neutral-300">{alertData?.total || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">All alerts received</p>
          </div>
        </div>
      </div>


    </div>
  );
}

function TenantAdminMetrics({ onNavigate }: AnalystMetricsProps) {
  const [tenantData, setTenantData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenantData();
  }, []);

  const fetchTenantData = async () => {
    try {
      // Get current user info to determine tenant
      const authResponse = await api.get('/api/auth/status');
      const authResult = await authResponse.json();

      if (authResult.success && authResult.data.user) {
        const tenantId = authResult.data.user.tenant_id;

        // Generate different data based on tenant ID
        const mockData = generateTenantSpecificData(tenantId);
        setTenantData(mockData);
      }
    } catch (error) {
      console.error('Failed to fetch tenant data:', error);
      // Fallback to default data
      setTenantData({
        teamMembers: 12,
        activeTickets: 8,
        complianceScore: 94,
        slaPerformance: 98
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTenantSpecificData = (_tenantId: string) => {
    // Return data for ACME Corporation
    const acmeData = {
      teamMembers: 25,
      activeTickets: 15,
      complianceScore: 96,
      slaPerformance: 99,
      tenantName: 'ACME Corporation'
    };

    return acmeData;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-20 animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Team Members</h3>
        <div className="text-2xl font-bold text-primary-600">{tenantData?.teamMembers || 0}</div>
      </div>
      <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Active Tickets</h3>
        <div className="text-2xl font-bold text-orange-600">{tenantData?.activeTickets || 0}</div>
      </div>
      <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Compliance Score</h3>
        <div className="text-2xl font-bold text-green-600">{tenantData?.complianceScore || 0}%</div>
      </div>
      <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">SLA Performance</h3>
        <div className="text-2xl font-bold text-green-600">{tenantData?.slaPerformance || 0}%</div>
      </div>
    </div>
  );
}

function ITHelpdeskAnalystMetrics({ onNavigate }: AnalystMetricsProps) {
  const [myTicketsData, setMyTicketsData] = useState<any>(null);
  const [assetData, setAssetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyTicketsData();
    fetchAssetData();
    // Set up real-time updates
    const interval = setInterval(() => {
      fetchMyTicketsData();
      fetchAssetData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMyTicketsData = async () => {
    try {
      const response = await api.get('/api/dashboard/my-tickets');
      const result = await response.json();
      if (result.success) {
        setMyTicketsData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch my tickets data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetData = async () => {
    try {
      const response = await api.get('/api/assets/inventory');
      const result = await response.json();
      if (result.success) {
        // Calculate asset metrics for IT support
        const assets = result.data;
        const totalAssets = assets.length;
        const criticalAssets = assets.filter((asset: any) => asset.risk_score >= 80).length;
        const assetsNeedingAttention = assets.filter((asset: any) =>
          asset.compliance_status === 'non_compliant' ||
          asset.vulnerabilities?.length > 0 ||
          !asset.last_scan_date ||
          new Date(asset.last_scan_date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length;

        setAssetData({
          total: totalAssets,
          critical: criticalAssets,
          needingAttention: assetsNeedingAttention,
          compliant: assets.filter((asset: any) => asset.compliance_status === 'compliant').length
        });
      }
    } catch (error) {
      console.error('Failed to fetch asset data:', error);
    }
  };



  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-24 animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i + 4} className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-24 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* IT Support Tickets Section */}
      <div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">IT Support Tickets</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">My Open Tickets</h4>
            <div className="text-2xl font-bold text-blue-600">{myTicketsData?.open || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
              {myTicketsData?.overdue || 0} overdue • {myTicketsData?.total || 0} total
            </p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Awaiting Response</h4>
            <div className="text-2xl font-bold text-orange-600">{myTicketsData?.awaiting_response || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Waiting for user response</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">In Progress</h4>
            <div className="text-2xl font-bold text-yellow-600">{myTicketsData?.in_progress || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Currently working on</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Resolved Today</h4>
            <div className="text-2xl font-bold text-green-600">{myTicketsData?.resolved_today || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Tickets resolved today</p>
          </div>
        </div>
      </div>

      {/* Asset Information Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Asset Overview</h3>
          <button
            onClick={() => onNavigate('assets')}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View All Assets →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Total Assets</h4>
            <div className="text-2xl font-bold text-neutral-600 dark:text-neutral-300">{assetData?.total || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Managed devices & systems</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Need Attention</h4>
            <div className="text-2xl font-bold text-red-600">{assetData?.needingAttention || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Issues or outdated scans</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Critical Assets</h4>
            <div className="text-2xl font-bold text-orange-600">{assetData?.critical || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">High risk score (≥80)</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Compliant</h4>
            <div className="text-2xl font-bold text-green-600">{assetData?.compliant || 0}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Meeting security standards</p>
          </div>
        </div>
      </div>


    </div>
  );
}

interface RoleBasedDashboardProps {
  userRole: UserRole;
  onNavigate: (section: string) => void;
}

export function RoleBasedDashboard({ userRole, onNavigate }: RoleBasedDashboardProps) {
  const { selectedTenant } = useTenant();

  const getDashboardTitle = () => {
    switch (userRole) {
      case UserRole.SUPER_ADMIN:
        return {
          title: selectedTenant ? `${selectedTenant.name} - Security Dashboard` : 'Platform Administration Dashboard',
          subtitle: selectedTenant ? `Managing security operations for ${selectedTenant.name}` : 'Monitor all tenants and system-wide metrics across the AVIAN platform'
        };
      case UserRole.TENANT_ADMIN:
        return {
          title: 'Tenant Administration Dashboard',
          subtitle: 'Manage your organization\'s security operations and team members'
        };
      case UserRole.SECURITY_ANALYST:
        return {
          title: 'Security Operations Dashboard',
          subtitle: 'Monitor and respond to security incidents, alerts, and compliance requirements'
        };
      case UserRole.IT_HELPDESK_ANALYST:
        return {
          title: 'IT Support Dashboard',
          subtitle: 'Manage IT support tickets and technical assistance requests'
        };
      case UserRole.USER:
        return {
          title: 'Security Portal',
          subtitle: 'View your security tickets and stay informed about security matters'
        };
      default:
        return {
          title: 'Dashboard',
          subtitle: 'Welcome to the AVIAN platform'
        };
    }
  };

  const { title, subtitle } = getDashboardTitle();

  const getRoleSpecificActions = () => {
    switch (userRole) {
      case UserRole.SUPER_ADMIN:
        if (!selectedTenant) {
          return (
            <Card className="p-8 text-center">
              <div className="text-6xl mb-4">🏢</div>
              <h3 className="text-xl font-semibold mb-2">Select a Client</h3>
              <p className="text-gray-600 mb-4">Choose a client to view their security dashboard</p>
              <button
                onClick={() => onNavigate('super-admin')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Select Client
              </button>
            </Card>
          );
        }

        return (
          <div className="space-y-6">
            {/* Tenant Info Header */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">{selectedTenant.name}</h3>
                    <p className="text-blue-700">{selectedTenant.industry} • {selectedTenant.location}</p>
                  </div>
                  <StatusBadge
                    status="in_progress"
                    size="sm"
                  />
                </div>
                <div className="text-right">
                  <div className="text-sm text-blue-600">Status</div>
                  <StatusBadge
                    status="resolved"
                    size="sm"
                  />
                </div>
              </div>
            </Card>

            {/* Tenant Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Data Sources</h3>
                <div className="text-2xl font-bold text-blue-600">{selectedTenant.data_sources_count}</div>
                <div className="text-sm text-gray-500">Active connections</div>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Users</h3>
                <div className="text-2xl font-bold text-green-600">{selectedTenant.users_count}</div>
                <div className="text-sm text-gray-500">Licensed users</div>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Events Today</h3>
                <div className="text-2xl font-bold text-purple-600">
                  {selectedTenant.events_today > 1000
                    ? `${(selectedTenant.events_today / 1000).toFixed(0)}K`
                    : selectedTenant.events_today}
                </div>
                <div className="text-sm text-gray-500">Security events</div>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Health Status</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Operational</span>
                </div>
                <div className="text-sm text-gray-500">All systems healthy</div>
              </Card>
            </div>
          </div>
        );

      case UserRole.TENANT_ADMIN:
        return <TenantAdminMetrics onNavigate={onNavigate} />;

      case UserRole.SECURITY_ANALYST:
        return <SecurityAnalystMetrics onNavigate={onNavigate} />;

      case UserRole.IT_HELPDESK_ANALYST:
        return <ITHelpdeskAnalystMetrics onNavigate={onNavigate} />;

      case UserRole.USER:
        return null; // User dashboard is handled separately

      default:
        return null;
    }
  };

  // For regular users, show the simplified dashboard
  if (userRole === UserRole.USER) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {title}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {subtitle}
          </p>
        </div>
        <UserDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          {title}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          {subtitle}
        </p>
      </div>

      {/* Role-specific quick stats */}
      {getRoleSpecificActions()}

      {/* Main Dashboard Grid */}
      <DashboardGrid onNavigate={onNavigate} userRole={userRole} />
    </div>
  );
}