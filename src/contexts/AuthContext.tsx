'use client';

import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authenticateUser, getCurrentUser, signOutUser, CognitoUser } from '@/lib/aws/cognito-auth';

/**
 * Auth Context for managing authentication state
 * Uses AWS Cognito for secure authentication
 */

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    // TEMPORARY: Disable auth for development - set DISABLE_AUTH=true in .env.local to bypass login
    const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

    /**
     * Check authentication status
     */
    const checkAuth = useCallback(async (): Promise<boolean> => {
        // TEMPORARY: Skip auth check if disabled
        if (authDisabled) {
            const mockUser: AuthUser = {
                id: 'dev-user',
                email: 'dev@example.com',
                name: 'Development User',
                role: 'super_admin', // Set as super_admin to access super-admin page
                tenantId: 'dev-tenant'
            };
            setUser(mockUser);
            // Also store in localStorage so useAuth hook can find it
            localStorage.setItem('auth-user', JSON.stringify(mockUser));
            return true;
        }

        try {
            // Check for session ID in localStorage
            const sessionId = localStorage.getItem('session-id');
            if (!sessionId) {
                setUser(null);
                return false;
            }

            // Validate session with DynamoDB
            // TODO: Move session validation to server-side API
            // const sessionResult = await DynamoSessionService.validateSession(sessionId);
            if (!sessionResult.valid || !sessionResult.user) {
                setUser(null);
                localStorage.removeItem('session-id');
                localStorage.removeItem('auth-user');
                return false;
            }

            const authUser: AuthUser = {
                id: sessionResult.user.id,
                email: sessionResult.user.email,
                name: sessionResult.user.name,
                role: sessionResult.user.role,
                tenantId: sessionResult.user.tenantId,
            };

            setUser(authUser);
            localStorage.setItem('auth-user', JSON.stringify(authUser));

            // Extend session if it needs refresh
            if (sessionResult.needsRefresh) {
                // TODO: Move session extension to server-side API
                // await DynamoSessionService.extendSession(sessionId);
            }

            return true;
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
            localStorage.removeItem('auth-user');
            localStorage.removeItem('session-id');
            return false;
        }
    }, [authDisabled]);

    /**
     * Refresh user data from server
     */
    const refreshUser = useCallback(async () => {
        await checkAuth();
    }, [checkAuth]);

    /**
     * Login user
     */
    const login = useCallback(async (
        email: string,
        password: string,
        rememberMe: boolean = false
    ) => {
        try {
            const cognitoUser = await authenticateUser(email, password);
            
            const authUser: AuthUser = {
                id: cognitoUser.id,
                email: cognitoUser.email,
                name: cognitoUser.name,
                role: cognitoUser.role,
                tenantId: cognitoUser.tenantId,
            };

            // Create DynamoDB session
            // TODO: Move session creation to server-side API
            // const sessionId = await DynamoSessionService.createSession(
            //     cognitoUser.id,
            //     {
            //         email: cognitoUser.email,
            //         name: cognitoUser.name,
            //         role: cognitoUser.role,
            //         tenantId: cognitoUser.tenantId,
            //     },
            //     {
            //         rememberMe,
            //         metadata: {
            //             cognitoTokens: {
            //                 accessToken: cognitoUser.accessToken,
            //                 refreshToken: cognitoUser.refreshToken,
            //                 idToken: cognitoUser.idToken,
            //             }
            //         }
            //     }
            // );
            const sessionId = 'temp-session-id'; // Temporary until server-side implementation

            setUser(authUser);
            
            // Store session ID and user data
            localStorage.setItem('session-id', sessionId);
            localStorage.setItem('auth-user', JSON.stringify(authUser));

            // Redirect based on role
            if (authUser.role === 'super_admin') {
                localStorage.removeItem('selected-tenant');
                sessionStorage.removeItem('selectedTenant');
                router.push('/super-admin');
            } else {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }, [router]);

    /**
     * Logout user
     */
    const logout = useCallback(async () => {
        try {
            const sessionId = localStorage.getItem('session-id');
            
            // Delete DynamoDB session
            if (sessionId) {
                // TODO: Move session deletion to server-side API
                // await DynamoSessionService.deleteSession(sessionId);
            }

            // Get Cognito tokens from session metadata if available
            if (sessionId) {
                // TODO: Move session retrieval to server-side API
                // const session = await DynamoSessionService.getSession(sessionId);
                if (session?.metadata?.cognitoTokens?.accessToken) {
                    await signOutUser(session.metadata.cognitoTokens.accessToken);
                }
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear state regardless of API response
            setUser(null);
            localStorage.removeItem('auth-user');
            localStorage.removeItem('session-id');
            localStorage.removeItem('selected-tenant');
            sessionStorage.removeItem('selectedTenant');
            router.push('/login');
        }
    }, [router]);

    /**
     * Check auth on mount and set up periodic checks
     */
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            // First check localStorage for quick load
            const storedUser = localStorage.getItem('auth-user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    if (mounted) {
                        setUser(parsedUser);
                    }
                } catch {
                    console.error('Failed to parse stored user:', error);
                }
            }

            // Then verify with server
            await checkAuth();

            if (mounted) {
                setLoading(false);
            }
        };

        initAuth();

        // Set up periodic auth check (every 5 minutes)
        const interval = setInterval(() => {
            checkAuth();
        }, 5 * 60 * 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [checkAuth]);

    const value: AuthContextType = {
        user,
        loading,
        isAuthenticated: authDisabled || !!user, // Always authenticated if auth is disabled
        login,
        logout,
        refreshUser,
        checkAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

/**
 * Hook to require authentication
 */
export function useRequireAuth() {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/login');
        }
    }, [loading, isAuthenticated, router]);

    return { user, loading, isAuthenticated };
}

/**
 * Hook to require specific role
 */
export function useRequireRole(allowedRoles: string | string[]) {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!isAuthenticated) {
                router.push('/login');
            } else if (user) {
                const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
                if (!roles.includes(user.role)) {
                    router.push('/dashboard'); // Redirect to dashboard if wrong role
                }
            }
        }
    }, [loading, isAuthenticated, user, allowedRoles, router]);

    return { user, loading, isAuthenticated };
}
