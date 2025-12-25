'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useDemoContext } from '@/contexts/DemoContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { currentUser } = useDemoContext();

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

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