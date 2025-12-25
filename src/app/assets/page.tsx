'use client';

import React from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AssetInventory } from '@/components/assets/AssetInventory';
import { useDemoContext } from '@/contexts/DemoContext';

export default function AssetsPage() {
  const { currentTenant } = useDemoContext();

  return (
    <ClientLayout>
      <AssetInventory tenantId={currentTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}