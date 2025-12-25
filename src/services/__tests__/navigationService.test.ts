/**
 * Unit tests for NavigationService
 * Tests URL generation, query parameter construction, and deep linking functionality
 * Including role-aware navigation to prevent unwanted role switching
 */

import { navigationService } from '../navigationService';

// Mock localStorage for testing
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};

// Mock window.location
const mockLocation = {
    pathname: '/dashboard/tenant-admin',
    href: '',
};

// Mock window and localStorage
(global as any).localStorage = mockLocalStorage;
(global as any).window = {
    location: mockLocation,
    localStorage: mockLocalStorage,
};

describe('NavigationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocation.pathname = '/dashboard/tenant-admin';
        mockLocation.href = '';
    });
    describe('Role-aware navigation', () => {
        describe('from tenant-admin context', () => {
            beforeEach(() => {
                mockLocation.pathname = '/dashboard/tenant-admin';
            });

            it('should generate tenant-admin URLs for KPI cards', () => {
                expect(navigationService.generateKPIUrl('criticalAlerts')).toBe('/dashboard/tenant-admin/alerts?severity=critical&timeRange=24h');
                expect(navigationService.generateKPIUrl('securityTickets')).toBe('/dashboard/tenant-admin/tickets?type=security&status=open');
                expect(navigationService.generateKPIUrl('helpdeskTickets')).toBe('/dashboard/tenant-admin/tickets?type=helpdesk&status=open');
                expect(navigationService.generateKPIUrl('compliance')).toBe('/dashboard/tenant-admin/compliance?view=full-report');
            });

            it('should generate tenant-admin URLs for chart navigation', () => {
                expect(navigationService.generateAlertsTrendUrl('2024-01-15')).toBe('/dashboard/tenant-admin/alerts?date=2024-01-15');
                expect(navigationService.generateDeviceCoverageUrl('protected')).toBe('/dashboard/tenant-admin/assets?filter=protected');
                expect(navigationService.generateTicketBreakdownUrl('security')).toBe('/dashboard/tenant-admin/tickets?type=security');
            });

            it('should generate tenant-admin URLs for activity navigation', () => {
                expect(navigationService.generateActivityUrl('alert', 'alert-123')).toBe('/dashboard/tenant-admin/alerts?id=alert-123');
                expect(navigationService.generateActivityUrl('ticket', 'ticket-456')).toBe('/dashboard/tenant-admin/tickets?id=ticket-456');
                expect(navigationService.generateActivityUrl('device', 'device-789')).toBe('/dashboard/tenant-admin/assets?deviceId=device-789');
            });
        });

        describe('from super-admin context', () => {
            beforeEach(() => {
                mockLocation.pathname = '/super-admin';
            });

            it('should generate super-admin URLs for KPI cards', () => {
                expect(navigationService.generateKPIUrl('criticalAlerts')).toBe('/super-admin/alerts?severity=critical&timeRange=24h');
                expect(navigationService.generateKPIUrl('securityTickets')).toBe('/super-admin/tickets?type=security&status=open');
                expect(navigationService.generateKPIUrl('helpdeskTickets')).toBe('/super-admin/tickets?type=helpdesk&status=open');
                expect(navigationService.generateKPIUrl('compliance')).toBe('/super-admin/compliance?view=full-report');
            });

            it('should generate super-admin URLs for chart navigation', () => {
                expect(navigationService.generateAlertsTrendUrl('2024-01-15')).toBe('/super-admin/alerts?date=2024-01-15');
                expect(navigationService.generateDeviceCoverageUrl('protected')).toBe('/super-admin/assets?filter=protected');
                expect(navigationService.generateTicketBreakdownUrl('security')).toBe('/super-admin/tickets?type=security');
            });
        });

        describe('fallback behavior', () => {
            beforeEach(() => {
                mockLocation.pathname = '/some-other-page';
                mockLocalStorage.getItem.mockReturnValue(null);
            });

            it('should fallback to relative URLs when no role context is available', () => {
                expect(navigationService.generateKPIUrl('criticalAlerts')).toBe('alerts?severity=critical&timeRange=24h');
                expect(navigationService.generateAlertsTrendUrl('2024-01-15')).toBe('alerts?date=2024-01-15');
            });

            it('should use auth context as fallback when available', () => {
                mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ role: 'super_admin' }));
                expect(navigationService.generateKPIUrl('criticalAlerts')).toBe('/super-admin/alerts?severity=critical&timeRange=24h');
            });
        });
    });

    describe('generateKPIUrl (legacy tests)', () => {
        beforeEach(() => {
            mockLocation.pathname = '/dashboard/tenant-admin';
        });

        it('should generate correct URL for critical alerts', () => {
            const url = navigationService.generateKPIUrl('criticalAlerts');
            expect(url).toBe('/dashboard/tenant-admin/alerts?severity=critical&timeRange=24h');
        });

        it('should generate correct URL for security tickets', () => {
            const url = navigationService.generateKPIUrl('securityTickets');
            expect(url).toBe('/dashboard/tenant-admin/tickets?type=security&status=open');
        });

        it('should generate correct URL for helpdesk tickets', () => {
            const url = navigationService.generateKPIUrl('helpdeskTickets');
            expect(url).toBe('/dashboard/tenant-admin/tickets?type=helpdesk&status=open');
        });

        it('should generate correct URL for compliance', () => {
            const url = navigationService.generateKPIUrl('compliance');
            expect(url).toBe('/dashboard/tenant-admin/compliance?view=full-report');
        });
    });

    describe('generateAlertsTrendUrl (legacy tests)', () => {
        beforeEach(() => {
            mockLocation.pathname = '/dashboard/tenant-admin';
        });

        it('should generate URL with single date parameter', () => {
            const url = navigationService.generateAlertsTrendUrl('2024-01-15');
            expect(url).toBe('/dashboard/tenant-admin/alerts?date=2024-01-15');
        });

        it('should generate URL with date range parameters', () => {
            const url = navigationService.generateAlertsTrendUrl(undefined, '2024-01-01', '2024-01-31');
            expect(url).toBe('/dashboard/tenant-admin/alerts?startDate=2024-01-01&endDate=2024-01-31');
        });

        it('should generate base URL when no parameters provided', () => {
            const url = navigationService.generateAlertsTrendUrl();
            expect(url).toBe('/dashboard/tenant-admin/alerts');
        });

        it('should prioritize single date over date range', () => {
            const url = navigationService.generateAlertsTrendUrl('2024-01-15', '2024-01-01', '2024-01-31');
            expect(url).toBe('/dashboard/tenant-admin/alerts?date=2024-01-15');
        });
    });

    describe('generateDeviceCoverageUrl', () => {
        it('should generate URL for protected devices', () => {
            const url = navigationService.generateDeviceCoverageUrl('protected');
            expect(url).toBe('/assets?filter=protected');
        });

        it('should generate URL for missing agent devices', () => {
            const url = navigationService.generateDeviceCoverageUrl('missing-agent');
            expect(url).toBe('/assets?filter=missing-agent');
        });

        it('should generate URL for devices with alerts', () => {
            const url = navigationService.generateDeviceCoverageUrl('with-alerts');
            expect(url).toBe('/assets?filter=with-alerts');
        });
    });

    describe('generateTicketBreakdownUrl', () => {
        it('should generate URL for security tickets', () => {
            const url = navigationService.generateTicketBreakdownUrl('security');
            expect(url).toBe('/tickets?type=security');
        });

        it('should generate URL for helpdesk tickets', () => {
            const url = navigationService.generateTicketBreakdownUrl('helpdesk');
            expect(url).toBe('/tickets?type=helpdesk');
        });
    });

    describe('generateIntegrationUrl', () => {
        it('should generate URL with service name only', () => {
            const url = navigationService.generateIntegrationUrl('microsoft');
            expect(url).toBe('/settings/integrations?service=microsoft');
        });

        it('should generate URL with service name and event ID', () => {
            const url = navigationService.generateIntegrationUrl('sonicwall', 'event-123');
            expect(url).toBe('/settings/integrations?service=sonicwall&event=event-123');
        });
    });

    describe('generateActivityUrl', () => {
        it('should generate URL for alert activity', () => {
            const url = navigationService.generateActivityUrl('alert', 'alert-123');
            expect(url).toBe('/alerts?id=alert-123');
        });

        it('should generate URL for ticket activity', () => {
            const url = navigationService.generateActivityUrl('ticket', 'ticket-456');
            expect(url).toBe('/tickets?id=ticket-456');
        });

        it('should generate URL for device activity', () => {
            const url = navigationService.generateActivityUrl('device', 'device-789');
            expect(url).toBe('/assets?deviceId=device-789');
        });

        it('should generate URL for compliance activity', () => {
            const url = navigationService.generateActivityUrl('compliance', 'compliance-101');
            expect(url).toBe('/compliance?event=compliance-101');
        });

        it('should generate URL for integration activity with service name', () => {
            const url = navigationService.generateActivityUrl('integration', 'integration-202', {
                serviceName: 'microsoft'
            });
            expect(url).toBe('/settings/integrations?service=microsoft&event=integration-202');
        });

        it('should return dashboard URL for unknown activity type', () => {
            const url = navigationService.generateActivityUrl('unknown', 'item-404');
            expect(url).toBe('/dashboard');
        });
    });

    describe('query parameter encoding', () => {
        it('should properly encode special characters in query parameters', () => {
            const url = navigationService.generateAlertsTrendUrl('2024-01-15T10:30:00Z');
            expect(url).toBe('/alerts?date=2024-01-15T10%3A30%3A00Z');
        });
    });

    describe('URL building with filters', () => {
        it('should build URLs with multiple query parameters', () => {
            // Test through the generateActivityUrl method which uses buildUrl internally
            const url = navigationService.generateIntegrationUrl('microsoft', 'event-123');
            expect(url).toBe('/settings/integrations?service=microsoft&event=event-123');
        });

        it('should handle empty parameters correctly', () => {
            const url = navigationService.generateAlertsTrendUrl();
            expect(url).toBe('/alerts');
        });
    });
});