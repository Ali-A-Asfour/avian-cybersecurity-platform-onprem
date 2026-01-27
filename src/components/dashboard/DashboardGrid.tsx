'use client';

import { useEffect, useState } from 'react';
import { MetricCard } from './MetricCard';
import { AlertSeverityChart } from './AlertSeverityChart';
import { ComplianceGauge } from './ComplianceGauge';
import { SLAMetrics } from './SLAMetrics';
import { ActivityFeed } from './ActivityFeed';
import {
  TicketSummary,
  AlertSummary,
  ComplianceSummary,
  SLASummary,
  ActivityFeedItem
} from '@/services/dashboard.service';
import { UserRole } from '@/types';
import { api } from '@/lib/api-client';

interface DashboardData {
  tickets: TicketSummary;
  alerts: AlertSummary;
  compliance: ComplianceSummary;
  sla: SLASummary;
  activity: ActivityFeedItem[];
}

interface DashboardGridProps {
  onNavigate?: (section: string) => void;
  userRole?: UserRole;
}

export function DashboardGrid({ onNavigate, userRole }: DashboardGridProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();

    // Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Use mock endpoint for development
      const endpoint = process.env.NODE_ENV === 'development' ? '/api/dashboard/mock' : '/api/dashboard/widgets';
      const response = await api.get(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-32 animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-64 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-error-600 dark:text-error-400 mb-4">
          ⚠️ Failed to load dashboard data
        </div>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Helper function to determine which widgets to show based on role
  const getVisibleWidgets = () => {
    switch (userRole) {
      case UserRole.SECURITY_ANALYST:
        return {
          showAlerts: true,
          showCompliance: true,
          showSLA: true,
          showActivity: true,
          ticketTitle: 'Security Tickets',
          ticketSubtitle: 'Active security incidents'
        };
      case UserRole.IT_HELPDESK_ANALYST:
        return {
          showAlerts: false, // IT Helpdesk cannot see alerts
          showCompliance: false,
          showSLA: true,
          showActivity: true,
          ticketTitle: 'IT Support Tickets',
          ticketSubtitle: 'Active IT support requests'
        };
      default:
        return {
          showAlerts: true,
          showCompliance: true,
          showSLA: true,
          showActivity: true,
          ticketTitle: 'Active Tickets',
          ticketSubtitle: 'All active tickets'
        };
    }
  };

  const widgets = getVisibleWidgets();

  return (
    <div className="space-y-6">
      {/* Key Metrics Row - Role-based filtering */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title={widgets.ticketTitle}
          value={data.tickets.open}
          subtitle={`${data.tickets.overdue} overdue`}
          trend={{
            value: 2,
            label: 'from yesterday',
            direction: 'up',
          }}
          color="warning"
          onClick={() => onNavigate?.('tickets')}
        />

        {widgets.showAlerts && (
          <MetricCard
            title="Critical Alerts"
            value={data.alerts.critical}
            subtitle="Requires immediate attention"
            color="error"
            onClick={() => onNavigate?.('alerts')}
          />
        )}

        {widgets.showCompliance && (
          <MetricCard
            title="Compliance Score"
            value={`${(data.compliance?.overallScore || 0).toFixed(1)}%`}
            subtitle="Above target threshold"
            trend={{
              value: 1.2,
              label: 'this month',
              direction: 'up',
            }}
            color="success"
            onClick={() => onNavigate?.('compliance')}
          />
        )}

        {widgets.showSLA && (
          <MetricCard
            title="SLA Performance"
            value={`${(data.sla?.responseTime?.percentage || 0).toFixed(1)}%`}
            subtitle="Meeting targets"
            trend={{
              value: 0.3,
              label: 'this week',
              direction: 'up',
            }}
            color="primary"
            onClick={() => onNavigate?.('reports')}
          />
        )}

        {/* Fill remaining slots for IT Helpdesk Analyst */}
        {userRole === UserRole.IT_HELPDESK_ANALYST && (
          <>
            <MetricCard
              title="Pending Requests"
              value={data.tickets.awaiting_response}
              subtitle="Awaiting user response"
              color="warning"
              onClick={() => onNavigate?.('tickets')}
            />
            <MetricCard
              title="Resolved Today"
              value={data.tickets.resolved_today}
              subtitle="Tickets closed today"
              color="success"
              onClick={() => onNavigate?.('tickets')}
            />
          </>
        )}
      </div>

      {/* Detailed Widgets Row - Role-based filtering */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${widgets.showAlerts && widgets.showCompliance ? 'xl:grid-cols-3' : 'xl:grid-cols-2'} gap-6`}>
        {widgets.showAlerts && (
          <AlertSeverityChart
            data={data.alerts}
            onClick={() => onNavigate?.('alerts')}
          />
        )}

        {widgets.showCompliance && (
          <ComplianceGauge
            data={data.compliance}
            onClick={() => onNavigate?.('compliance')}
          />
        )}

        {widgets.showActivity && (
          <ActivityFeed
            data={data.activity}
            onClick={() => onNavigate?.('activity')}
          />
        )}
      </div>

      {/* SLA Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {widgets.showSLA && (
          <SLAMetrics
            data={data.sla}
            onClick={() => onNavigate?.('reports')}
          />
        )}

        {/* Recent Tickets - Role-specific filtering */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Recent {userRole === UserRole.SECURITY_ANALYST ? 'Security' : userRole === UserRole.IT_HELPDESK_ANALYST ? 'IT Support' : ''} Tickets
          </h3>
          <div className="space-y-3">
            {data?.tickets?.recent?.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    #{ticket.id} - {ticket.title}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {ticket.assignee ? `Assigned to ${ticket.assignee}` : 'Unassigned'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${ticket.severity === 'critical'
                    ? 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-200'
                    : ticket.severity === 'high'
                      ? 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200'
                      : ticket.severity === 'medium'
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200'
                        : 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200'
                    }`}>
                    {ticket.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate?.('tickets')}
            className="w-full mt-4 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
          >
            View All {userRole === UserRole.SECURITY_ANALYST ? 'Security' : userRole === UserRole.IT_HELPDESK_ANALYST ? 'IT Support' : ''} Tickets →
          </button>
        </div>
      </div>
    </div>
  );
}