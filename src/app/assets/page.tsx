'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AssetInventory } from '@/components/assets/AssetInventory';
import { useDemoContext } from '@/contexts/DemoContext';

export default function AssetsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { currentTenant } = useDemoContext();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <ClientLayout>
      <AssetInventory tenantId={currentTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}