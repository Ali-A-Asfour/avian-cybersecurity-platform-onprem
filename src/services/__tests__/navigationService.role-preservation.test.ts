/**
 * Role Preservation Tests for NavigationService
 * Tests that navigation preserves role and tenant context
 */

import { navigationService } from '../navigationService';

// Mock window and localStorage
const mockLocation = {
    pathname: '/dashboard/tenant-admin',
    href: '',
};

const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};

// Setup mocks
(global as any).window = {
    location: mockLocation,
    localStorage: mockLocalStorage,
};

describe('NavigationService Role Preservation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocation.pathname = '/dashboard/tenant-admin';
        mockLocation.href = '';
    });

    describe('Role-aware URL generation', () => {
        it('should preserve tenant-admin context in KPI URLs', () => {
            mockLocation.pathname = '/dashboard/tenant-admin';

            const criticalAlertsUrl = navigationService.generateKPIUrl('criticalAlerts');
            const securityTicketsUrl = navigationService.generateKPIUrl('securityTickets');
            const helpdeskTicketsUrl = navigationService.generateKPIUrl('helpdeskTickets');
            const complianceUrl = navigationService.generateKPIUrl('compliance');

            expect(criticalAlertsUrl).toBe('/dashboard/tenant-admin/alerts?severity=critical&timeRange=24h');
            expect(securityTicketsUrl).toBe('/dashboard/tenant-admin/tickets?type=security&status=open');
            expect(helpdeskTicketsUrl).toBe('/dashboard/tenant-admin/tickets?type=helpdesk&status=open');
            expect(complianceUrl).toBe('/dashboard/tenant-admin/compliance?view=full-report');
        });

        it('should preserve super-admin context in KPI URLs', () => {
            mockLocation.pathname = '/super-admin';

            const criticalAlertsUrl = navigationService.generateKPIUrl('criticalAlerts');
            const securityTicketsUrl = navigationService.generateKPIUrl('securityTickets');

            expect(criticalAlertsUrl).toBe('/super-admin/alerts?severity=critical&timeRange=24h');
            expect(securityTicketsUrl).toBe('/super-admin/tickets?type=security&status=open');
        });

        it('should preserve tenant-admin context in chart navigation', () => {
            mockLocation.pathname = '/dashboard/tenant-admin';

            const alertsTrendUrl = navigationService.generateAlertsTrendUrl('2024-01-15');
            const deviceCoverageUrl = navigationService.generateDeviceCoverageUrl('protected');
            const ticketBreakdownUrl = navigationService.generateTicketBreakdownUrl('security');

            expect(alertsTrendUrl).toBe('/dashboard/tenant-admin/alerts?date=2024-01-15');
            expect(deviceCoverageUrl).toBe('/dashboard/tenant-admin/assets?filter=protected');
            expect(ticketBreakdownUrl).toBe('/dashboard/tenant-admin/tickets?type=security');
        });

        it('should preserve tenant-admin context in activity navigation', () => {
            mockLocation.pathname = '/dashboard/tenant-admin';

            const alertActivityUrl = navigationService.generateActivityUrl('alert', 'alert-123');
            const ticketActivityUrl = navigationService.generateActivityUrl('ticket', 'ticket-456');
            const deviceActivityUrl = navigationService.generateActivityUrl('device', 'device-789');

            expect(alertActivityUrl).toBe('/dashboard/tenant-admin/alerts?id=alert-123');
            expect(ticketActivityUrl).toBe('/dashboard/tenant-admin/tickets?id=ticket-456');
            expect(deviceActivityUrl).toBe('/dashboard/tenant-admin/assets?deviceId=device-789');
        });
    });

    describe('Navigation context preservation', () => {
        it('should use navigatePreservingContext method', () => {
            mockLocation.pathname = '/dashboard/tenant-admin';

            // Mock window.location.href assignment
            const mockHrefSetter = jest.fn();
            Object.defineProperty(mockLocation, 'href', {
                set: mockHrefSetter,
                configurable: true,
            });

            const testUrl = '/dashboard/tenant-admin/alerts?severity=critical';
            navigationService.navigatePreservingContext(testUrl);

            expect(mockHrefSetter).toHaveBeenCalledWith(testUrl);
        });
    });

    describe('Fallback behavior', () => {
        it('should fallback to relative URLs when no context available', () => {
            mockLocation.pathname = '/unknown-page';
            mockLocalStorage.getItem.mockReturnValue(null);

            const url = navigationService.generateKPIUrl('criticalAlerts');
            expect(url).toBe('alerts?severity=critical&timeRange=24h');
        });

        it('should use auth context as fallback', () => {
            mockLocation.pathname = '/unknown-page';
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
                role: 'tenant_admin',
                tenantId: 'test-tenant'
            }));

            const url = navigationService.generateKPIUrl('criticalAlerts');
            expect(url).toBe('/dashboard/tenant-admin/alerts?severity=critical&timeRange=24h');
        });
    });
});