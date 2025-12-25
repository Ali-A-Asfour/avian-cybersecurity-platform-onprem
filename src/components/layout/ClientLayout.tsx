'use client';

import { AppLayout } from './AppLayout';
import { TenantAwareLayout } from './TenantAwareLayout';
import { useDemoContext } from '@/contexts/DemoContext';
import { UserRole } from '@/types';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const { currentUser } = useDemoContext();

  // Super Admin users get tenant-aware layout
  if (currentUser.role === UserRole.SUPER_ADMIN) {
    return <TenantAwareLayout>{children}</TenantAwareLayout>;
  }

  // All other users get the standard app layout
  return <AppLayout>{children}</AppLayout>;
}