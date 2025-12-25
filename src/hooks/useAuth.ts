'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
}

export function useAuth(requireAuth: boolean = true) {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is authenticated
        const authUserStr = localStorage.getItem('auth-user');

        if (authUserStr) {
            try {
                const authUser = JSON.parse(authUserStr);
                setUser(authUser);
            } catch (error) {
                console.error('Failed to parse auth user:', error);
                if (requireAuth) {
                    router.push('/login');
                }
            }
        } else if (requireAuth) {
            // No auth user and auth is required - redirect to login
            router.push('/login');
        }

        setLoading(false);
    }, [requireAuth, router]);

    return { user, loading, isAuthenticated: !!user };
}
