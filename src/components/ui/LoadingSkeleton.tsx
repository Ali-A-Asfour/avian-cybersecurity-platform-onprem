'use client';

import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
  height?: string;
  width?: string;
  rounded?: boolean;
}

export function LoadingSkeleton({ 
  className = '', 
  height = 'h-4', 
  width = 'w-full',
  rounded = true 
}: LoadingSkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${height} ${width} ${rounded ? 'rounded' : ''} ${className}`}
    />
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <LoadingSkeleton height="h-6" width="w-32" />
        <LoadingSkeleton height="h-8" width="w-16" rounded={false} />
      </div>
      <LoadingSkeleton height="h-8" width="w-20" className="mb-2" />
      <LoadingSkeleton height="h-4" width="w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-3">
          <LoadingSkeleton height="h-10" width="w-10" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton height="h-4" width="w-3/4" />
            <LoadingSkeleton height="h-3" width="w-1/2" />
          </div>
          <LoadingSkeleton height="h-6" width="w-16" />
        </div>
      ))}
    </div>
  );
}