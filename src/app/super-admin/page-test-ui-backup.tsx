'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';

export default function SuperAdminPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
      <p>Testing UI components...</p>
      
      <div className="mt-4 space-y-4">
        <Card className="p-4">
          <h2 className="text-xl font-semibold">Test Card</h2>
          <p>This is a test card component.</p>
        </Card>
        
        <div className="space-x-2">
          <Button onClick={() => console.log('Primary clicked')}>
            Primary Button
          </Button>
          <Button variant="outline" onClick={() => console.log('Outline clicked')}>
            Outline Button
          </Button>
        </div>
        
        <div className="space-x-2">
          <Badge>Default Badge</Badge>
          <Badge variant="secondary">Secondary Badge</Badge>
        </div>
      </div>
    </div>
  );
}