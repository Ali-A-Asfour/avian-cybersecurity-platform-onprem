'use client';

import React from 'react';
import { PlaybookRecommendations } from '@/components/playbooks';

interface PlaybookRecommendationsPageProps {
  params: {
    alertId: string;
  };
}

export default function PlaybookRecommendationsPage({ params }: PlaybookRecommendationsPageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <PlaybookRecommendations alertId={params.alertId} />
    </div>
  );
}