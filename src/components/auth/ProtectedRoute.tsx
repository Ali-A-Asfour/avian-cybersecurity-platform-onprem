'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Protected Route Component
 * Wraps pages that require authentication
 * Part of production authentication system (Task 7.2)
 */

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    allowedRoles?: string[];
    redirectTo?: string;
}

export function ProtectedRoute({
    children,
    requireAuth = true,
    allowedRoles,
    redirectTo = '/login',
}: ProtectedRouteProps) {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            // Check authentication
            if (requireAuth && !isAuthenticated) {
                router.push(redirectTo);
                return;
            }

            // Check role authorization
            if (allowedRoles && user) {
                if (!allowedRoles.includes(user.role)) {
                    // Redirect to dashboard if user doesn't have required role
                    router.push('/dashboard');
                }
            }
        }
    }, [loading, isAuthenticated, user, requireAuth, allowedRoles, redirectTo, router]);

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render if not authenticated and auth is required
    if (requireAuth && !isAuthenticated) {
        return null;
    }

    // Don't render if role check fails
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return null;
    }

    return <>{children}</>;
}

/**
 * Higher-order component to protect pages
 */
export function withAuth<P extends object>(
    Component: React.ComponentType<P>,
    options?: {
        requireAuth?: boolean;
        allowedRoles?: string[];
        redirectTo?: string;
    }
) {
    return function ProtectedComponent(props: P) {
        return (
            <ProtectedRoute
                requireAuth={options?.requireAuth}
                allowedRoles={options?.allowedRoles}
                redirectTo={options?.redirectTo}
            >
                <Component {...props} />
            </ProtectedRoute>
        );
    };
}

/**
 * Component to show only to authenticated users
 */
export function AuthOnly({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading || !isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}

/**
 * Component to show only to guests (non-authenticated)
 */
export function GuestOnly({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading || isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}

/**
 * Component to show based on user role
 */
export function RoleGuard({
    children,
    allowedRoles,
    fallback,
}: {
    children: React.ReactNode;
    allowedRoles: string[];
    fallback?: React.ReactNode;
}) {
    const { user, loading } = useAuth();

    if (loading) {
        return null;
    }

    if (!user || !allowedRoles.includes(user.role)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
