'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

import { useTenant } from '@/contexts/TenantContext';
import { useDemoContext } from '@/contexts/DemoContext';
import { UserRole } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TenantAwareLayoutProps {
  children: React.ReactNode;
  requireTenant?: boolean;
}

export function TenantAwareLayout({ children, requireTenant = true }: TenantAwareLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { selectedTenant } = useTenant();
  const { currentUser } = useDemoContext();

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // If super admin and no tenant selected, show tenant selection prompt
  if (currentUser.role === UserRole.SUPER_ADMIN && requireTenant && !selectedTenant) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md mx-4">
          <div className="text-6xl mb-4">🏢</div>
          <h2 className="text-2xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">Select a Client</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            You need to select a client to access this section. Choose a client to view their specific data and manage their security infrastructure.
          </p>
          <Button onClick={() => window.location.href = '/super-admin'}>
            Select Client
          </Button>
        </Card>
      </div>
    );
  }

  // If tenant is selected or tenant not required, show full layout with sidebar
  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} currentUser={currentUser} />

      {/* Header */}
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={handleSidebarToggle}
        currentUser={currentUser}
      />

      {/* Main Content */}
      <main
        className={`transition-all duration-300 pt-16 ${sidebarCollapsed ? 'ml-16' : 'ml-60'
          }`}
      >
        <div className="p-6">
          {children}
        </div>
      </main>

    </div>
  );
}