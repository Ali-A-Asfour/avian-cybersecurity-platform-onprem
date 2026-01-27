'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserRole } from '@/types';
import { DEMO_USERS, type DemoUser } from '@/components/demo/RoleSwitcher';

interface DemoContextType {
  currentUser: DemoUser;
  setCurrentUser: (user: DemoUser) => void;
  currentTenant: { id: string; name: string; key: string } | null;
  setCurrentTenant: (tenant: { id: string; name: string; key: string } | null) => void;
  isDemo: boolean;
  setIsDemo: (isDemo: boolean) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  // Start with a default user
  const [currentUser, setCurrentUser] = useState<DemoUser>(
    DEMO_USERS.find(user => user.role === UserRole.SECURITY_ANALYST) || DEMO_USERS[2]
  );
  
  // Current tenant state
  const [currentTenant, setCurrentTenant] = useState<{ id: string; name: string; key: string } | null>(null);
  
  // Demo mode state
  const [isDemo, setIsDemo] = useState(false);

  // Load actual logged-in user from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authUserStr = localStorage.getItem('auth-user');
      if (authUserStr) {
        try {
          const authUser = JSON.parse(authUserStr);
          // Map the authenticated user to a DemoUser format
          const mappedUser: DemoUser = {
            id: authUser.id,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role as UserRole,
            avatar: authUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
            tenant: authUser.tenantId || 'Demo Corporation',
            description: `${authUser.role} - Authenticated User`
          };
          setCurrentUser(mappedUser);
        } catch {
          console.error('Failed to parse auth user');
        }
      }
    }
  }, []);

  const handleSetCurrentUser = (user: DemoUser) => {
    setCurrentUser(user);

    // Update localStorage to persist the role change
    if (typeof window !== 'undefined') {
      const authUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant
      };
      localStorage.setItem('auth-user', JSON.stringify(authUser));
    }
  };

  return (
    <DemoContext.Provider
      value={{
        currentUser,
        setCurrentUser: handleSetCurrentUser,
        currentTenant,
        setCurrentTenant: handleSetCurrentTenant,
        isDemo,
        setIsDemo,
      }}
    >
      {children}
    </DemoContext.Provider>
  );

  function handleSetCurrentTenant(tenant: { id: string; name: string; key: string } | null) {
    setCurrentTenant(tenant);
    
    // Set global variable for API client to use
    if (typeof window !== 'undefined') {
      if (tenant) {
        (window as any).__SELECTED_TENANT_ID__ = tenant.id;
        console.log('DemoContext: Set global tenant ID:', tenant.id);
      } else {
        delete (window as any).__SELECTED_TENANT_ID__;
        console.log('DemoContext: Cleared global tenant ID');
      }
    }
  }
}

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemoContext must be used within a DemoProvider');
  }
  return context;
}

// Hook to safely use demo context (returns null if not in demo mode)
export function useDemoContextSafe() {
  try {
    return useContext(DemoContext);
  } catch {
    return null;
  }
}