'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Button } from '@/components/ui/Button';
import { RoleBasedDashboard } from '@/components/dashboard/RoleBasedDashboard';
import { useNotifications } from '@/hooks/useNotifications';
import { useDemoContext } from '@/contexts/DemoContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const router = useRouter();
  const { simulateNotification } = useNotifications();
  const { currentUser } = useDemoContext();
  const { selectedTenant } = useTenant();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Fast loading in development mode
  const [isLoading, setIsLoading] = React.useState(
    process.env.NODE_ENV === 'development' ? false : true
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setIsLoading(false);
    } else {
      // Simulate loading for production
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle role-based redirects in useEffect to avoid render-time navigation
  // Only redirect admin roles, let regular users stay on this dashboard
  useEffect(() => {
    if (currentUser.role === UserRole.SUPER_ADMIN && !selectedTenant) {
      router.push('/super-admin');
    } else if (currentUser.role === UserRole.TENANT_ADMIN) {
      router.push('/dashboard/tenant-admin');
    }
  }, [currentUser.role, selectedTenant, router]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </ClientLayout>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Show loading state while redirecting admin users
  if (currentUser.role === UserRole.SUPER_ADMIN && !selectedTenant) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Redirecting to tenant selection...</div>
        </div>
      </ClientLayout>
    );
  }

  if (currentUser.role === UserRole.TENANT_ADMIN) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Redirecting to tenant admin dashboard...</div>
        </div>
      </ClientLayout>
    );
  }

  const handleNavigation = (section: string) => {
    switch (section) {
      case 'tickets':
        router.push('/tickets');
        break;
      case 'alerts':
        router.push('/alerts');
        break;
      case 'compliance':
        router.push('/compliance');
        break;
      case 'reports':
        router.push('/reports');
        break;
      case 'activity':
        router.push('/activity');
        break;
      case 'admin':
        router.push('/admin');
        break;
      case 'monitoring':
        router.push('/monitoring');
        break;
      case 'performance':
        router.push('/performance');
        break;
      default:
        break;
    }
  };

  const handleGenerateReport = () => {
    // TODO: Implement report generation
    console.log('Generate report clicked');
    simulateNotification();
  };

  const getRoleSpecificActions = () => {
    switch (currentUser.role) {
      case UserRole.SUPER_ADMIN:
        return (
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push('/admin')}
              className="text-sm"
            >
              Platform Admin
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/monitoring')}
              className="text-sm"
            >
              System Health
            </Button>
            <Button onClick={handleGenerateReport}>
              Platform Report
            </Button>
          </div>
        );

      case UserRole.TENANT_ADMIN:
        return (
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/users')}
              className="text-sm"
            >
              Manage Users
            </Button>
            <Button
              variant="outline"
              onClick={simulateNotification}
              className="text-sm"
            >
              Test Notification
            </Button>
            <Button onClick={handleGenerateReport}>
              Generate Report
            </Button>
          </div>
        );

      case UserRole.SECURITY_ANALYST:
        return (
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push('/tickets')}
              className="text-sm"
            >
              Security Tickets
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/alerts')}
              className="text-sm"
            >
              View Alerts
            </Button>
            <Button onClick={handleGenerateReport}>
              Security Report
            </Button>
          </div>
        );

      case UserRole.IT_HELPDESK_ANALYST:
        return (
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push('/tickets')}
              className="text-sm"
            >
              IT Support Tickets
            </Button>
            <Button
              variant="outline"
              onClick={simulateNotification}
              className="text-sm"
            >
              Test Notification
            </Button>
            <Button onClick={handleGenerateReport}>
              IT Report
            </Button>
          </div>
        );

      case UserRole.USER:
        return (
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push('/tickets')}
              className="text-sm"
            >
              My Tickets
            </Button>
            <Button onClick={() => router.push('/tickets/new')}>
              Create Ticket
            </Button>
          </div>
        );

      default:
        return (
          <Button onClick={handleGenerateReport}>
            Generate Report
          </Button>
        );
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Page Header with Role-specific Actions */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {/* Role-based dashboard handles its own title */}
          </div>
          <div className="flex space-x-3">
            {getRoleSpecificActions()}
          </div>
        </div>

        {/* Role-Based Dashboard */}
        <RoleBasedDashboard
          userRole={currentUser.role as UserRole}
          onNavigate={handleNavigation}
        />
      </div>
    </ClientLayout>
  );
}