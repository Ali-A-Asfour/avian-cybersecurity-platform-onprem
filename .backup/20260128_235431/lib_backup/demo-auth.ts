/**
 * Demo Authentication Helper
 * Provides utilities for setting up demo users for development and testing
 */

import { UserRole } from '@/types';

export interface DemoAuthUser {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
}

export const DEMO_AUTH_USERS: DemoAuthUser[] = [
    {
        id: '1',
        name: 'Abdullah Asfour',
        email: 'abdullah.asfour@acmecorp.com',
        role: UserRole.SUPER_ADMIN,
        tenantId: 'acme-corp'
    },
    {
        id: '2',
        name: 'Anita V',
        email: 'anita.v@acmecorp.com',
        role: UserRole.TENANT_ADMIN,
        tenantId: 'acme-corp'
    },
    {
        id: '3',
        name: 'Ali Asfour',
        email: 'ali.asfour@acmecorp.com',
        role: UserRole.SECURITY_ANALYST,
        tenantId: 'acme-corp'
    },
    {
        id: '4',
        name: 'Sarah Mitchell',
        email: 'sarah.mitchell@acmecorp.com',
        role: UserRole.IT_HELPDESK_ANALYST,
        tenantId: 'acme-corp'
    },
    {
        id: '5',
        name: 'Mr Linux',
        email: 'mr.linux@acmecorp.com',
        role: UserRole.USER,
        tenantId: 'acme-corp'
    }
];

/**
 * Initialize a demo user in localStorage if no user is currently authenticated
 */
export function initializeDemoUser(preferredRole: UserRole = UserRole.SECURITY_ANALYST): DemoAuthUser | null {
    if (typeof window === 'undefined') return null;

    // Check if user is already authenticated
    const existingUser = localStorage.getItem('auth-user');
    if (existingUser) {
        try {
            return JSON.parse(existingUser);
        } catch (error) {
            console.error('Failed to parse existing auth user:', error);
            // Clear invalid data and continue with demo setup
            localStorage.removeItem('auth-user');
        }
    }

    // Set up demo user
    const demoUser = DEMO_AUTH_USERS.find(user => user.role === preferredRole) || DEMO_AUTH_USERS[2];

    console.log('Initializing demo user:', demoUser.name, `(${demoUser.role})`);
    localStorage.setItem('auth-user', JSON.stringify(demoUser));

    return demoUser;
}

/**
 * Switch to a different demo user
 */
export function switchDemoUser(role: UserRole): DemoAuthUser | null {
    if (typeof window === 'undefined') return null;

    const demoUser = DEMO_AUTH_USERS.find(user => user.role === role);
    if (!demoUser) {
        console.error('Demo user not found for role:', role);
        return null;
    }

    console.log('Switching to demo user:', demoUser.name, `(${demoUser.role})`);
    localStorage.setItem('auth-user', JSON.stringify(demoUser));

    return demoUser;
}

/**
 * Get current demo user from localStorage
 */
export function getCurrentDemoUser(): DemoAuthUser | null {
    if (typeof window === 'undefined') return null;

    const authUserStr = localStorage.getItem('auth-user');
    if (!authUserStr) return null;

    try {
        return JSON.parse(authUserStr);
    } catch (error) {
        console.error('Failed to parse auth user:', error);
        return null;
    }
}

/**
 * Clear demo user authentication
 */
export function clearDemoUser(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('auth-user');
    localStorage.removeItem('selected-tenant');
    sessionStorage.removeItem('selectedTenant');
}