'use client';

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';

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

    // Session timeout state
    const [isWarningVisible, setIsWarningVisible] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const warningShownRef = useRef(false);
    const expiredHandledRef = useRef(false);

    /**
     * Logout user
     */
    const logout = useCallback(async () => {
        try {
            const sessionId = localStorage.getItem('session-id');
            
            // Stub: Will be replaced with Redis session deletion
            if (sessionId) {
                // await deleteSession(sessionId);
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            localStorage.removeItem('auth-user');
            localStorage.removeItem('auth-token');
            localStorage.removeItem('session-id');
            localStorage.removeItem('selected-tenant');
            sessionStorage.removeItem('selectedTenant');
            router.push('/login');
        }
    }, [router]);

    /**
     * Get session expiration time from localStorage
     */
    const getSessionExpiration = useCallback((): Date | null => {
        try {
            const authToken = localStorage.getItem('auth-token');
            if (!authToken) {
                return null;
            }

            // Decode JWT to get expiration (without verification)
            const parts = authToken.split('.');
            if (parts.length !== 3) {
                return null;
            }

            const payload = JSON.parse(atob(parts[1]));
            if (!payload.exp) {
                return null;
            }

            // JWT exp is in seconds, convert to milliseconds
            return new Date(payload.exp * 1000);
        } catch (error) {
            console.error('Failed to get session expiration:', error);
            return null;
        }
    }, []);

    /**
     * Calculate time remaining until session expires
     */
    const calculateTimeRemaining = useCallback((): number => {
        const expirationDate = getSessionExpiration();
        if (!expirationDate) {
            return 0;
        }

        const now = new Date();
        const remaining = Math.floor((expirationDate.getTime() - now.getTime()) / 1000);
        return Math.max(0, remaining);
    }, [getSessionExpiration]);

    /**
     * Check session status and update state
     */
    const checkSessionStatus = useCallback(() => {
        if (!user || authDisabled) {
            // No user logged in or auth disabled, reset state
            setIsWarningVisible(false);
            setTimeRemaining(0);
            warningShownRef.current = false;
            expiredHandledRef.current = false;
            return;
        }

        // Check if we have a JWT token - if not, skip session timeout checks
        // This handles stub/mock authentication scenarios
        const authToken = localStorage.getItem('auth-token');
        if (!authToken) {
            console.log('[SessionTimeout] No JWT token found, skipping session timeout checks');
            return;
        }

        const remaining = calculateTimeRemaining();
        
        // If we can't calculate remaining time (invalid token), skip checks
        if (remaining === 0 && !getSessionExpiration()) {
            console.log('[SessionTimeout] Cannot determine session expiration, skipping checks');
            return;
        }

        const warningThresholdSeconds = 5 * 60; // 5 minutes

        // Check if session has expired
        if (remaining <= 0) {
            if (!expiredHandledRef.current) {
                console.log('[SessionTimeout] Session expired, logging out...');
                setIsWarningVisible(false);
                setTimeRemaining(0);
                expiredHandledRef.current = true;
                
                // Logout user
                logout();
            }
            return;
        }

        // Check if we should show warning
        if (remaining <= warningThresholdSeconds) {
            if (!warningShownRef.current) {
                console.log(`[SessionTimeout] Warning: ${remaining} seconds remaining`);
                warningShownRef.current = true;
            }

            setIsWarningVisible(true);
            setTimeRemaining(remaining);
        } else {
            // Session is healthy
            setIsWarningVisible(false);
            setTimeRemaining(remaining);
            warningShownRef.current = false;
        }
    }, [user, authDisabled, calculateTimeRemaining, getSessionExpiration, logout]);

    /**
     * Extend the session by refreshing the token
     */
    const extendSession = useCallback(async (): Promise<boolean> => {
        try {
            console.log('[SessionTimeout] Extending session...');
            
            const response = await fetch('/api/auth/extend-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error('[SessionTimeout] Failed to extend session:', response.statusText);
                return false;
            }

            const data = await response.json();
            
            if (data.success) {
                console.log('[SessionTimeout] Session extended successfully');
                
                // Update token in localStorage
                if (data.token) {
                    localStorage.setItem('auth-token', data.token);
                }

                // Reset warning state
                warningShownRef.current = false;
                setIsWarningVisible(false);
                setTimeRemaining(calculateTimeRemaining());

                return true;
            }

            return false;
        } catch (error) {
            console.error('[SessionTimeout] Error extending session:', error);
            return false;
        }
    }, [calculateTimeRemaining]);

    /**
     * Dismiss the warning (user acknowledges but doesn't extend)
     */
    const dismissWarning = useCallback(() => {
        setIsWarningVisible(false);
    }, []);

    /**
     * Check authentication status
     */
    const checkAuth = useCallback(async (): Promise<boolean> => {
        // TEMPORARY: Development mode - bypass authentication
        if (authDisabled) {
            const mockUser: AuthUser = {
                id: 'dev-user',
                email: 'dev@example.com',
                name: 'Development User',
                role: 'super_admin',
                tenantId: 'dev-tenant'
            };
            setUser(mockUser);
            localStorage.setItem('auth-user', JSON.stringify(mockUser));
            return true;
        }

        try {
            const sessionId = localStorage.getItem('session-id');
            const authToken = localStorage.getItem('auth-token');
            const storedUser = localStorage.getItem('auth-user');
            
            console.log('[AuthContext] checkAuth - sessionId:', !!sessionId, 'authToken:', !!authToken, 'storedUser:', !!storedUser);
            
            // Check if either session-id or auth-token exists
            if (!sessionId && !authToken) {
                console.log('[AuthContext] No session or token found');
                setUser(null);
                return false;
            }

            // Stub: Will be replaced with Redis session validation
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    console.log('[AuthContext] Setting user from localStorage:', parsedUser);
                    setUser(parsedUser);
                    return true;
                } catch (parseError) {
                    console.error('[AuthContext] Failed to parse stored user:', parseError);
                    // Clear invalid data
                    localStorage.removeItem('auth-user');
                    localStorage.removeItem('session-id');
                    localStorage.removeItem('auth-token');
                    setUser(null);
                    return false;
                }
            }

            console.log('[AuthContext] No valid stored user found');
            return false;
        } catch (error) {
            console.error('[AuthContext] Auth check failed:', error);
            setUser(null);
            localStorage.removeItem('auth-user');
            localStorage.removeItem('session-id');
            localStorage.removeItem('auth-token');
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
            // Stub implementation - will be replaced with real authentication
            const authUser: AuthUser = {
                id: 'stub-user-id',
                email: email,
                name: 'Stub User',
                role: 'admin',
                tenantId: 'stub-tenant',
            };

            setUser(authUser);
            localStorage.setItem('session-id', 'stub-session-id');
            localStorage.setItem('auth-user', JSON.stringify(authUser));

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
     * Check auth on mount and set up periodic checks
     */
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            console.log('[AuthContext] Initializing auth...');
            
            // First check localStorage for quick load
            const storedUser = localStorage.getItem('auth-user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    console.log('[AuthContext] Found stored user on init:', parsedUser);
                    if (mounted) {
                        setUser(parsedUser);
                    }
                } catch (err) {
                    console.error('[AuthContext] Failed to parse stored user:', err);
                }
            } else {
                console.log('[AuthContext] No stored user found on init');
            }

            // Then verify with server
            const isAuthenticated = await checkAuth();
            console.log('[AuthContext] Auth check result:', isAuthenticated);

            if (mounted) {
                setLoading(false);
                console.log('[AuthContext] Auth initialization complete');
            }
        };

        initAuth();

        // Set up periodic auth check (every 5 minutes)
        const interval = setInterval(() => {
            console.log('[AuthContext] Periodic auth check');
            checkAuth();
        }, 5 * 60 * 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [checkAuth]);

    /**
     * Set up session timeout monitoring
     */
    useEffect(() => {
        if (!user || authDisabled) {
            return;
        }

        // Initial check
        checkSessionStatus();

        // Set up interval for periodic checks (every 30 seconds)
        const interval = setInterval(() => {
            checkSessionStatus();
        }, 30 * 1000);

        return () => {
            clearInterval(interval);
        };
    }, [user, authDisabled, checkSessionStatus]);

    /**
     * Update countdown every second when warning is visible
     */
    useEffect(() => {
        if (!isWarningVisible) {
            return;
        }

        const interval = setInterval(() => {
            setTimeRemaining(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [isWarningVisible]);

    const value: AuthContextType = {
        user,
        loading,
        isAuthenticated: authDisabled || !!user,
        login,
        logout,
        refreshUser,
        checkAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            
            {/* Session Timeout Warning Modal */}
            {!authDisabled && (
                <SessionTimeoutWarning
                    isVisible={isWarningVisible}
                    timeRemaining={timeRemaining}
                    onExtend={extendSession}
                    onDismiss={dismissWarning}
                    onLogout={logout}
                />
            )}
        </AuthContext.Provider>
    );
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
                    router.push('/dashboard');
                }
            }
        }
    }, [loading, isAuthenticated, user, allowedRoles, router]);

    return { user, loading, isAuthenticated };
}
