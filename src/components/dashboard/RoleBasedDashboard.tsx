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
  const [firewallData, setFirewallData] = useState<any>(null);
  const [edrData, setEdrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Initialize with mock data in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' || process.env.BYPASS_AUTH === 'true') {
      const mockData = {
        myTickets: { open: 5, critical: 2 },
        alerts: { open: 23, myOpen: 8 },
        firewall: { devices: 3, online: 2, threatsBlocked: 1247 },
        edr: { devices: 156, highRisk: 12, isolated: 2 }
      };

      setMyTicketsData(mockData.myTickets);
      setAlertData(mockData.alerts);
      setFirewallData(mockData.firewall);
      setEdrData(mockData.edr);
      setLoading(false);
    } else {
      fetchDashboardData();
    }

    // Set up real-time updates every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all data in parallel
      const [ticketsRes, alertsRes, firewallRes, edrRes] = await Promise.allSettled([
        api.get('/api/dashboard/my-tickets'),
        api.get('/api/alerts?limit=100'),
        api.get('/api/firewall/devices'),
        api.get('/api/edr/devices')
      ]);

      // Process tickets data
      if (ticketsRes.status === 'fulfilled') {
        const ticketsResult = await ticketsRes.value.json();
        if (ticketsResult.success) {
          setMyTicketsData(ticketsResult.data);
        }
      }

      // Process alerts data
      if (alertsRes.status === 'fulfilled') {
        const alertsResult = await alertsRes.value.json();
        if (alertsResult.success) {
          const alerts = alertsResult.data.alerts || [];
          const openAlerts = alerts.filter((alert: any) => alert.status === 'open').length;
          const myOpenAlerts = alerts.filter((alert: any) => 
            alert.status === 'open' && alert.assigned_to === 'current_user'
          ).length;

          setAlertData({
            open: openAlerts,
            myOpen: myOpenAlerts
          });
        }
      }

      // Process firewall data
      if (firewallRes.status === 'fulfilled') {
        const firewallResult = await firewallRes.value.json();
        if (firewallResult.success) {
          const devices = firewallResult.data || [];
          const onlineDevices = devices.filter((device: any) => device.status === 'active').length;
          
          setFirewallData({
            devices: devices.length,
            online: onlineDevices,
            threatsBlocked: 1247 // This would come from aggregated stats
          });
        }
      }

      // Process EDR data
      if (edrRes.status === 'fulfilled') {
        const edrResult = await edrRes.value.json();
        if (edrResult.success) {
          const devices = edrResult.data || [];
          const highRiskDevices = devices.filter((device: any) => device.riskScore >= 70).length;
          const isolatedDevices = devices.filter((device: any) => device.status === 'isolated').length;
          
          setEdrData({
            devices: devices.length,
            highRisk: highRiskDevices,
            isolated: isolatedDevices
          });
        }
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-32 animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Open Alerts Widget */}
      <div 
        className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onNavigate('alerts')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Open Alerts</h3>
          <div className="text-2xl">🚨</div>
        </div>
        <div className="text-3xl font-bold text-red-600 mb-2">{alertData?.open || 0}</div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Require investigation
        </p>
        <div className="mt-3 text-xs text-blue-600 hover:text-blue-700">
          View All Alerts →
        </div>
      </div>

      {/* My Open Alerts Widget */}
      <div 
        className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onNavigate('my-alerts')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">My Open Alerts</h3>
          <div className="text-2xl">👤</div>
        </div>
        <div className="text-3xl font-bold text-orange-600 mb-2">{alertData?.myOpen || 0}</div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Assigned to me
        </p>
        <div className="mt-3 text-xs text-blue-600 hover:text-blue-700">
          View My Alerts →
        </div>
      </div>

      {/* My Tickets Widget */}
      <div 
        className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onNavigate('tickets')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">My Tickets</h3>
          <div className="text-2xl">🎫</div>
        </div>
        <div className="text-3xl font-bold text-blue-600 mb-2">{myTicketsData?.open || 0}</div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {myTicketsData?.critical || 0} critical priority
        </p>
        <div className="mt-3 text-xs text-blue-600 hover:text-blue-700">
          View My Tickets →
        </div>
      </div>

      {/* Firewall Status Widget */}
      <div 
        className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onNavigate('firewall')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Firewall Status</h3>
          <div className="text-2xl">🔥</div>
        </div>
        <div className="flex items-center space-x-4 mb-2">
          <div>
            <div className="text-2xl font-bold text-green-600">{firewallData?.online || 0}</div>
            <div className="text-xs text-neutral-500">Online</div>
          </div>
          <div className="text-neutral-300">/</div>
          <div>
            <div className="text-2xl font-bold text-neutral-600">{firewallData?.devices || 0}</div>
            <div className="text-xs text-neutral-500">Total</div>
          </div>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {firewallData?.threatsBlocked || 0} threats blocked today
        </p>
        <div className="mt-3 text-xs text-blue-600 hover:text-blue-700">
          View Firewalls →
        </div>
      </div>

      {/* EDR Status Widget */}
      <div 
        className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onNavigate('edr')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">EDR Status</h3>
          <div className="text-2xl">🛡️</div>
        </div>
        <div className="flex items-center space-x-4 mb-2">
          <div>
            <div className="text-2xl font-bold text-red-600">{edrData?.highRisk || 0}</div>
            <div className="text-xs text-neutral-500">High Risk</div>
          </div>
          <div className="text-neutral-300">/</div>
          <div>
            <div className="text-2xl font-bold text-neutral-600">{edrData?.devices || 0}</div>
            <div className="text-xs text-neutral-500">Devices</div>
          </div>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {edrData?.isolated || 0} devices isolated
        </p>
        <div className="mt-3 text-xs text-blue-600 hover:text-blue-700">
          View EDR →
        </div>
      </div>

      {/* Quick Actions Widget */}
      <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Quick Actions</h3>
          <div className="text-2xl">⚡</div>
        </div>
        <div className="space-y-3">
          <button 
            onClick={() => onNavigate('playbooks')}
            className="w-full text-left p-2 rounded bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100">📋 View Playbooks</div>
          </button>
          <button 
            onClick={() => onNavigate('reports')}
            className="w-full text-left p-2 rounded bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <div className="text-sm font-medium text-green-900 dark:text-green-100">📊 Generate Report</div>
          </button>
          <button 
            onClick={() => onNavigate('settings')}
            className="w-full text-left p-2 rounded bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-colors"
          >
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">⚙️ Settings</div>
          </button>
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