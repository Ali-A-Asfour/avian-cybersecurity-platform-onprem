'use client';

import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function SuperAdminContent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mount = () => setMounted(true);
    mount();
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
      <p>This is a minimal super admin page to test for client-side errors.</p>
      <div className="mt-4">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => console.log('Button clicked')}
        >
          Test Button
        </button>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <ErrorBoundary>
      <SuperAdminContent />
    </ErrorBoundary>
  );
}