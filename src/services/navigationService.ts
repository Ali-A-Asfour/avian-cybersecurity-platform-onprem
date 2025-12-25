import { NavigationTarget } from '@/types/dashboard';

class NavigationService {
    /**
     * Get the current role context for navigation
     * This method determines the user's role context for preserving it during navigation
     */
    private getCurrentRoleContext(): string | null {
        // Check if window is available (browser environment or test environment)
        if (typeof window === 'undefined' || !window.location) {
            return null;
        }

        const currentPath = window.location.pathname;

        // Check if we're in tenant-admin context
        if (currentPath.startsWith('/dashboard/tenant-admin')) {
            return 'tenant_admin';
        }

        // Check if we're in super-admin context  
        if (currentPath.startsWith('/super-admin')) {
            return 'super_admin';
        }

        // Fallback - try to determine from auth context
        try {
            const authUser = localStorage.getItem('auth-user');
            if (authUser) {
                const user = JSON.parse(authUser);
                return user.role || null;
            }
        } catch (error) {
            console.warn('Failed to parse auth user for navigation context:', error);
        }

        return null;
    }

    /**
     * Build a simple URL - just ensure it starts with a slash
     * Navigation to existing pages with simple paths as requested by user
     */
    private buildRoleAwareUrl(relativePath: string): string {
        // Ensure the path starts with a slash for absolute navigation
        return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    }
    /**
     * Generate URL for KPI card navigation
     */
    generateKPIUrl(cardType: 'criticalAlerts' | 'securityTickets' | 'helpdeskTickets' | 'compliance'): string {
        let relativePath: string;
        const roleContext = this.getCurrentRoleContext();

        switch (cardType) {
            case 'criticalAlerts':
                // Tenant admins don't have access to alerts & incidents
                if (roleContext === 'tenant_admin') {
                    relativePath = 'dashboard/tenant-admin';
                } else {
                    relativePath = 'alerts-incidents?severity=critical&timeRange=24h';
                }
                break;
            case 'securityTickets':
                // Tenant admins don't have access to security tickets or alerts & incidents
                if (roleContext === 'tenant_admin') {
                    relativePath = 'dashboard/tenant-admin';
                } else {
                    relativePath = 'tickets/security?status=open';
                }
                break;
            case 'helpdeskTickets':
                // Tenant admins don't have access to helpdesk tickets or alerts & incidents
                if (roleContext === 'tenant_admin') {
                    relativePath = 'dashboard/tenant-admin';
                } else {
                    relativePath = 'tickets/helpdesk?status=open';
                }
                break;
            case 'compliance':
                relativePath = 'compliance?view=full-report';
                break;
            default:
                if (roleContext === 'tenant_admin') {
                    return '/dashboard/tenant-admin';
                }
                return '/dashboard';
        }

        return this.buildRoleAwareUrl(relativePath);
    }

    /**
     * Generate URL for alerts trend graph navigation
     */
    generateAlertsTrendUrl(date?: string, startDate?: string, endDate?: string): string {
        const params = new URLSearchParams();

        if (date) {
            params.set('date', date);
        } else if (startDate && endDate) {
            params.set('startDate', startDate);
            params.set('endDate', endDate);
        }

        const queryString = params.toString() ? '?' + params.toString() : '';
        return this.buildRoleAwareUrl(`alerts${queryString}`);
    }

    /**
     * Generate URL for device coverage chart navigation
     */
    generateDeviceCoverageUrl(segment: 'protected' | 'missing-agent' | 'with-alerts'): string {
        const filterMap = {
            'protected': 'protected',
            'missing-agent': 'missing-agent',
            'with-alerts': 'with-alerts'
        };

        return this.buildRoleAwareUrl(`assets?filter=${filterMap[segment]}`);
    }

    /**
     * Generate URL for ticket breakdown chart navigation
     * For tenant admin, redirects to dashboard
     */
    generateTicketBreakdownUrl(type: 'security' | 'helpdesk'): string {
        const roleContext = this.getCurrentRoleContext();

        // Tenant admins don't have access to separate ticket pages
        // Redirect them to dashboard instead
        if (roleContext === 'tenant_admin') {
            return this.buildRoleAwareUrl('dashboard/tenant-admin');
        }

        return this.buildRoleAwareUrl(`tickets/${type}`);
    }

    /**
     * Generate URL for integration health navigation
     */
    generateIntegrationUrl(serviceName: string, eventId?: string): string {
        const params = new URLSearchParams();
        params.set('service', serviceName);

        if (eventId) {
            params.set('event', eventId);
        }

        return this.buildRoleAwareUrl(`settings?${params.toString()}`);
    }

    /**
     * Generate URL for activity feed item navigation
     */
    generateActivityUrl(activityType: string, itemId: string, additionalParams?: Record<string, string>): string {
        const params = new URLSearchParams();

        switch (activityType) {
            case 'alert':
                // Tenant admins don't have access to alerts
                if (this.getCurrentRoleContext() === 'tenant_admin') {
                    return this.buildRoleAwareUrl('dashboard/tenant-admin');
                }
                params.set('id', itemId);
                return this.buildRoleAwareUrl(`alerts?${params.toString()}`);

            case 'ticket':
                // Tenant admins don't have access to tickets
                if (this.getCurrentRoleContext() === 'tenant_admin') {
                    return this.buildRoleAwareUrl('dashboard/tenant-admin');
                }
                params.set('id', itemId);
                return this.buildRoleAwareUrl(`tickets?${params.toString()}`);

            case 'device':
                params.set('deviceId', itemId);
                return this.buildRoleAwareUrl(`assets?${params.toString()}`);

            case 'compliance':
                params.set('event', itemId);
                return this.buildRoleAwareUrl(`compliance?${params.toString()}`);

            case 'integration':
                if (additionalParams?.serviceName) {
                    params.set('service', additionalParams.serviceName);
                }
                params.set('event', itemId);
                return this.buildRoleAwareUrl(`settings?${params.toString()}`);

            default:
                const roleContext = this.getCurrentRoleContext();
                if (roleContext === 'tenant_admin') {
                    return '/dashboard/tenant-admin';
                }
                return '/dashboard';
        }
    }

    /**
     * Navigate to a specific target with proper query parameters
     * Preserves the current role and tenant context
     */
    navigate(target: NavigationTarget): void {
        let url = '';

        switch (target.type) {
            case 'alerts':
                // Tenant admins don't have access to alerts
                if (this.getCurrentRoleContext() === 'tenant_admin') {
                    url = '/dashboard/tenant-admin';
                } else {
                    url = this.buildRoleAwareUrl(this.buildUrl('alerts', target.filters));
                }
                break;
            case 'tickets':
                // Tenant admins don't have access to tickets
                if (this.getCurrentRoleContext() === 'tenant_admin') {
                    url = '/dashboard/tenant-admin';
                } else {
                    url = this.buildRoleAwareUrl(this.buildUrl('tickets', target.filters));
                }
                break;
            case 'compliance':
                url = this.buildRoleAwareUrl(this.buildUrl('compliance', target.filters));
                break;
            case 'assets':
                url = this.buildRoleAwareUrl(this.buildUrl('assets', target.filters));
                break;
            case 'integrations':
                url = this.buildRoleAwareUrl(this.buildUrl('settings/integrations', target.filters));
                break;
            default:
                const roleContext = this.getCurrentRoleContext();
                if (roleContext === 'tenant_admin') {
                    url = '/dashboard/tenant-admin';
                } else {
                    url = '/dashboard';
                }
        }

        // Preserve scroll position and navigate
        this.preserveScrollPosition();

        // Use Next.js router or window.location for navigation
        if (typeof window !== 'undefined') {
            window.location.href = url;
        }
    }

    /**
     * Navigate while explicitly preserving role and tenant context
     * This method ensures no role switching occurs during navigation
     */
    navigatePreservingContext(url: string): void {
        if (typeof window === 'undefined' || !window.location) {
            return;
        }

        // Preserve scroll position
        this.preserveScrollPosition();

        // Navigate without changing role context
        try {
            window.location.href = url;
        } catch (error) {
            // In test environment, navigation might not be implemented
            // This is expected and should not cause test failures
            if (process.env.NODE_ENV === 'test') {
                console.log(`Navigation to: ${url}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Build URL with query parameters (for internal use)
     */
    private buildUrl(basePath: string, filters?: Record<string, string>): string {
        // Remove leading slash if present since buildRoleAwareUrl will handle the full path
        const cleanBasePath = basePath.startsWith('/') ? basePath.slice(1) : basePath;

        if (!filters || Object.keys(filters).length === 0) {
            return cleanBasePath;
        }

        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            }
        });

        return `${cleanBasePath}?${params.toString()}`;
    }

    /**
     * Parse query parameters from URL
     */
    parseQueryParams(url: string): Record<string, string> {
        const urlObj = new URL(url, window.location.origin);
        const params: Record<string, string> = {};

        urlObj.searchParams.forEach((value, key) => {
            params[key] = value;
        });

        return params;
    }

    /**
     * Preserve current scroll position during navigation
     */
    preserveScrollPosition(): void {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('dashboardScrollPosition', window.scrollY.toString());
        }
    }

    /**
     * Restore scroll position after navigation
     */
    restoreScrollPosition(): void {
        if (typeof window !== 'undefined') {
            const scrollPosition = sessionStorage.getItem('dashboardScrollPosition');
            if (scrollPosition) {
                window.scrollTo(0, parseInt(scrollPosition, 10));
                sessionStorage.removeItem('dashboardScrollPosition');
            }
        }
    }
}

export const navigationService = new NavigationService();