'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTicketCounts } from '@/hooks/useTicketCounts';
import { UserRole } from '@/types';

interface SidebarProps {
  collapsed: boolean;
  currentUser: {
    role: string;
    name: string;
    tenant: string;
  };
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

// Navigation icons
const DashboardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
  </svg>
);

const TicketsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const AlertsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const ComplianceIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ReportsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const AdminIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
  </svg>
);

const NotificationsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const CloudCostIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
  </svg>
);

const AssetsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const FirewallIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const EDRIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const HelpDeskIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DatabaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
  </svg>
);

const ThreatLakeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);



const getNavigationForRole = (role: string, ticketCounts: { helpDesk: number; alerts: number; tickets: number }): NavItem[] => {
  const baseNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  ];

  switch (role) {
    case 'super_admin':
      return [
        ...baseNavigation,
        { name: 'Client Management', href: '/super-admin', icon: AdminIcon },
        { name: 'Data Sources', href: '/data-sources', icon: DatabaseIcon },
        { name: 'Threat Lake', href: '/threat-lake', icon: ThreatLakeIcon },
        { name: 'Tickets', href: '/tickets', icon: TicketsIcon, badge: ticketCounts.tickets || undefined },
        { name: 'Alerts', href: '/alerts', icon: AlertsIcon, badge: ticketCounts.alerts || undefined },
        { name: 'Firewall', href: '/firewall', icon: FirewallIcon },
        { name: 'EDR', href: '/edr', icon: EDRIcon },
        { name: 'Assets', href: '/assets', icon: AssetsIcon },
        { name: 'Compliance', href: '/compliance', icon: ComplianceIcon },
        { name: 'Cloud Cost', href: '/cloud-cost', icon: CloudCostIcon },
        { name: 'Reports', href: '/reports', icon: ReportsIcon },
        { name: 'Platform Admin', href: '/admin', icon: AdminIcon },
        { name: 'Tenants', href: '/admin/tenants', icon: AdminIcon },
        { name: 'Performance', href: '/performance', icon: ReportsIcon },
        { name: 'Settings', href: '/settings', icon: SettingsIcon },
      ];

    case 'tenant_admin':
      return [
        ...baseNavigation,
        { name: 'Compliance', href: '/compliance', icon: ComplianceIcon },
        { name: 'Asset Inventory', href: '/assets', icon: AssetsIcon },
        { name: 'Team Members', href: '/admin/users', icon: AdminIcon },
        { name: 'Notifications', href: '/notifications', icon: NotificationsIcon },
        { name: 'Settings', href: '/settings', icon: SettingsIcon },
      ];

    case 'security_analyst':
      return [
        ...baseNavigation,
        { name: 'Alerts & Incidents', href: '/alerts-incidents', icon: AlertsIcon, badge: ticketCounts.alerts || undefined },
        { name: 'Compliance', href: '/compliance', icon: ComplianceIcon },
        { name: 'Asset Inventory', href: '/assets', icon: AssetsIcon },
        { name: 'Reports', href: '/reports', icon: ReportsIcon },
        { name: 'Settings', href: '/settings', icon: SettingsIcon },
      ];

    case 'it_helpdesk_analyst':
      return [
        ...baseNavigation,
        { name: 'Help Desk', href: '/help-desk', icon: HelpDeskIcon, badge: ticketCounts.helpDesk || undefined },
        { name: 'Asset Inventory', href: '/assets', icon: AssetsIcon },
        { name: 'Settings', href: '/settings', icon: SettingsIcon },
      ];

    case 'user':
      return [
        ...baseNavigation,
        { name: 'Help Desk', href: '/help-desk', icon: HelpDeskIcon, badge: ticketCounts.helpDesk || undefined },
        { name: 'Settings', href: '/settings', icon: SettingsIcon },
      ];

    default:
      return baseNavigation;
  }
};

export function Sidebar({ collapsed, currentUser }: SidebarProps) {
  const pathname = usePathname();
  const { counts: ticketCounts } = useTicketCounts(currentUser.role as UserRole);
  const navigation = getNavigationForRole(currentUser.role, ticketCounts);

  return (
    <div
      className={cn(
        'fixed left-0 top-0 z-40 h-full bg-white border-r border-neutral-200 transition-all duration-300 ease-in-out',
        'dark:bg-neutral-900 dark:border-neutral-800',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className={cn('flex items-center space-x-3', collapsed && 'justify-center')}>
          {/* AVIAN Logo */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                AVIAN
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {currentUser.tenant}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                isActive
                  ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'text-neutral-700 dark:text-neutral-300',
                collapsed ? 'justify-center px-2' : 'justify-start'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={cn('flex-shrink-0 w-5 h-5', !collapsed && 'mr-3')} />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-primary-500 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info at bottom */}
      {!collapsed && (
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-medium">{currentUser.name.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{currentUser.name}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{currentUser.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}