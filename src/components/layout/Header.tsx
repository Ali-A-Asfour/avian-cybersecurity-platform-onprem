'use client';

import { useState } from 'react';
import Link from 'next/link';

import { useAuth } from '@/contexts/AuthContext';
import { NotificationDropdown } from '@/components/notifications';
import { UserMenu } from '@/components/auth/UserMenu';
import { cn } from '@/lib/utils';
import { DemoUser, RoleSwitcher } from '@/components/demo/RoleSwitcher';
import { TenantSwitcher } from './TenantSwitcher';
import { TenantSwitcher as DemoTenantSwitcher } from '../demo/TenantSwitcher';
import { UserRole } from '@/types';
import { useDemoContext } from '@/contexts/DemoContext';

interface HeaderProps {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  currentUser: DemoUser;
}

export function Header({ sidebarCollapsed, onSidebarToggle, currentUser }: HeaderProps) {
  const { isAuthenticated } = useAuth();
  const { setCurrentUser, isDemo } = useDemoContext();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-white border-b border-neutral-200 transition-all duration-300',
        'dark:bg-neutral-900 dark:border-neutral-800',
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      <div className="flex items-center justify-between h-full px-6">
        {/* Left side - Mobile menu button and breadcrumb */}
        <div className="flex items-center space-x-4">
          {/* Mobile sidebar toggle */}
          <button
            onClick={onSidebarToggle}
            className="lg:hidden p-2 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-300 dark:hover:bg-neutral-800"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb */}
          <nav className="hidden sm:flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  Dashboard
                </span>
              </li>
            </ol>
          </nav>
        </div>

        {/* Right side - Search, notifications, user menu */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="hidden md:block relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search..."
              className="block w-64 pl-10 pr-3 py-2 border border-neutral-300 rounded-md leading-5 bg-white placeholder-neutral-500 focus:outline-none focus:placeholder-neutral-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:placeholder-neutral-400 dark:text-neutral-100"
            />
          </div>

          {/* Tenant Switcher - Only show for super admin */}
          {currentUser.role === UserRole.SUPER_ADMIN && <TenantSwitcher />}

          {/* Demo Tenant Switcher - Development mode only */}
          <DemoTenantSwitcher userRole={currentUser.role} />

          {/* Notifications */}
          <NotificationDropdown />



          {/* User menu - conditional rendering based on auth state */}
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Role Switcher - positioned absolutely in top right - only in demo mode */}
      {isDemo && (
        <RoleSwitcher
          currentUser={currentUser}
          onUserChange={setCurrentUser}
          isOpen={showRoleSwitcher}
          onToggle={() => setShowRoleSwitcher(!showRoleSwitcher)}
        />
      )}
    </header>
  );
}