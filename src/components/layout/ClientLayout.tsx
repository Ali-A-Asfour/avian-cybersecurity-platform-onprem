'use client';

import { AppLayout } from './AppLayout';
import { TenantAwareLayout } from './TenantAwareLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoContextSafe } from '@/contexts/DemoContext';
import { UserRole } from '@/types';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  // Try to get user from AuthContext first (production auth)
  const { user: authUser } = useAuth();
  
  // Fallback to DemoContext if available (demo mode)
  const demoContext = useDemoContextSafe();
  const demoUser = demoContext?.currentUser;

  // Use auth user if available, otherwise fall back to demo user
  const currentUser = authUser || demoUser;

  // If no user is available, use AppLayout as default
  if (!currentUser) {
    return <AppLayout>{children}</AppLayout>;
  }

  // Super Admin users get tenant-aware layout
  if (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === 'super_admin') {
    return <TenantAwareLayout>{children}</TenantAwareLayout>;
  }

  // All other users get the standard app layout
  return <AppLayout>{children}</AppLayout>;
}