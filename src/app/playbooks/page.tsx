'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { PlaybookList } from '@/components/playbooks';
import { UserRole } from '@/types';

export default function PlaybooksPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      // Use demo context instead of API calls
      setUserRole(UserRole.SECURITY_ANALYST); // Default to security analyst for demo
      setLoading(false);
    }
  }, [isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </ClientLayout>
    );
  }

  if (userRole === UserRole.TENANT_ADMIN) {
    return null; // Will redirect
  }

  return (
    <ClientLayout>
      <PlaybookList />
    </ClientLayout>
  );
}