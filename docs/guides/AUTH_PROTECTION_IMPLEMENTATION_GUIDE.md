# Authentication Protection Implementation Guide

## Summary
Adding authentication protection to all pages to prevent unauthorized access.

## Standard Pattern

For every protected page, add this pattern:

```typescript
'use client';

import { useEffect } from 'react'; // or React if already imported
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
// ... other imports

export default function PageName() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  // ... other hooks

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  // ... rest of component
}
```

## Pages Completed (7/47)
1. ✅ src/app/dashboard/page.tsx
2. ✅ src/app/admin/page.tsx
3. ✅ src/app/admin/tenants/page.tsx
4. ✅ src/app/admin/users/page.tsx (already had ProtectedRoute)
5. ✅ src/app/agents/page.tsx
6. ✅ src/app/agents/deploy/page.tsx
7. ✅ src/app/alerts/page.tsx

## Remaining Pages (40/47)

I will continue adding auth protection to all remaining pages methodically.

## Verification Steps
After all pages are protected:
1. Sign out
2. Try to access each protected page directly via URL
3. Should be redirected to /login
4. Sign in
5. Should be able to access all pages
