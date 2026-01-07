'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlaybookRecommendations } from '@/components/playbooks';
import { useAuth } from '@/contexts/AuthContext';

interface PlaybookRecommendationsPageProps {
  params: {
    alertId: string;
  };
}

export default function PlaybookRecommendationsPage({ params }: PlaybookRecommendationsPageProps) {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PlaybookRecommendations alertId={params.alertId} />
    </div>
  );
}