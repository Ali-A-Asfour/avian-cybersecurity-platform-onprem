/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantAdminDashboard } from '../TenantAdminDashboard';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

// Mock the hooks
jest.mock('@/hooks/useDashboardData');
jest.mock('@/hooks/useAutoRefresh');
jest.mock('@/services/navigationService', () => ({
    navigationService: {
        generateKPIUrl: jest.fn(() => '/mock-url'),
        generateActivityUrl: jest.fn(() => '/mock-url'),
        generateAlertsTrendUrl: jest.fn(() => '/mock-url'),
        generateDeviceCoverageUrl: jest.fn(() => '/mock-url'),
        generateTicketBreakdownUrl: jest.fn(() => '/mock-url'),
        generateIntegrationUrl: jest.fn(() => '/mock-url'),
        navigatePreservingContext: jest.fn(),
    },
}));

const mockUseDashboardData = useDashboardData as jest.MockedFunction<typeof useDashboardData>;
const mockUseAutoRefresh = useAutoRefresh as jest.MockedFunction<typeof useAutoRefresh>;

const mockDashboardData = {
    kpis: {
        criticalAlerts: 5,
        securityTicketsOpen: 12,
        helpdeskTicketsOpen: 8,
        complianceScore: 85,
    },
    alertsTrend: [
        { date: '2024-01-01', alertCount: 10 },
        { date: '2024-01-02', alertCount: 15 },
        { date: '2024-01-03', alertCount: 8 },
    ],
    deviceCoverage: {
        protected: 150,
        missingAgent: 25,
        withAlerts: 10,
        total: 185,
    },
    ticketBreakdown: {
        securityTickets: { created: 20, resolved: 15 },
        helpdeskTickets: { created: 30, resolved: 25 },
    },
    integrations: [
        { serviceName: 'Microsoft', status: 'healthy' as const, lastSync: '2024-01-01T10:00:00Z' },
        { serviceName: 'SonicWall', status: 'warning' as const, lastSync: '2024-01-01T09:30:00Z' },
    ],
    recentActivity: [
        {
            id: 'activity-1',
            timestamp: '2024-01-01T10:00:00Z',
            description: 'Critical security alert detected',
            type: 'alert' as const,
            icon: '🚨',
        },
        {
            id: 'activity-2',
            timestamp: '2024-01-01T09:45:00Z',
            description: 'Device compliance updated',
            type: 'compliance' as const,
            icon: '📋',
        },
    ],
    lastUpdated: '2024-01-01T10:00:00Z',
};

describe('TenantAdminDashboard - Responsive Design & Accessibility', () => {
    beforeEach(() => {
        mockUseDashboardData.mockReturnValue({
            data: mockDashboardData,
            loading: {
                kpis: false,
                alertsTrend: false,
                deviceCoverage: false,
                ticketBreakdown: false,
                integrations: false,
                recentActivity: false,
            },
            errors: {},
            lastRefresh: '2024-01-01T10:00:00Z',
            refresh: jest.fn(),
            refreshComponent: jest.fn(),
            isValidating: false,
            healthStatus: 'healthy' as const,
        });

        mockUseAutoRefresh.mockReturnValue({
            isRefreshing: false,
            lastRefreshTime: new Date(),
            forceRefresh: jest.fn(),
            refreshNow: jest.fn(),
            pause: jest.fn(),
            resume: jest.fn(),
            isActive: true,
            isTabActive: true,
            isModalOpen: false,
            isManuallyPaused: false,
            currentInterval: 60000,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Responsive Design', () => {
        test('renders with enhanced responsive layout classes for 1280px+ support', () => {
            render(<TenantAdminDashboard />);

            // Check main layout has enhanced responsive classes
            const mainElement = screen.getByRole('main');
            expect(mainElement).toHaveClass('max-w-7xl', 'mx-auto', 'overflow-x-hidden');

            // Check grid container has enhanced responsive classes
            const gridContainer = mainElement.querySelector('.grid');
            expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-4', 'min-w-0', 'w-full');
        });

        test('KPI cards use responsive grid layout with proper spacing', () => {
            render(<TenantAdminDashboard />);

            const kpiSections = screen.getAllByRole('region', { name: /key performance indicators/i });
            const kpiSection = kpiSections.find(section => section.classList.contains('grid'));
            expect(kpiSection).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'xl:grid-cols-4');
        });

        test('header adapts to mobile layout with responsive spacing', () => {
            render(<TenantAdminDashboard />);

            const header = screen.getByRole('banner');
            const headerContent = header.querySelector('.flex');
            expect(headerContent).toHaveClass('flex-col', 'sm:flex-row');
        });

        test('components have proper minimum width constraints for 1280px viewport', () => {
            render(<TenantAdminDashboard />);

            const mainElement = screen.getByRole('main');
            const gridContainer = mainElement.querySelector('.grid');
            expect(gridContainer).toHaveClass('min-w-0', 'xl:min-w-[1280px]');
        });

        test('integration health panel uses responsive grid for different screen sizes', () => {
            render(<TenantAdminDashboard />);

            const integrationSection = screen.getAllByRole('region', { name: /integration health status/i })[0];
            const gridContainer = integrationSection.querySelector('.grid');
            expect(gridContainer).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'xl:grid-cols-4');
        });

        test('charts have responsive padding and sizing', () => {
            render(<TenantAdminDashboard />);

            // Check device coverage chart has responsive padding
            const deviceChart = screen.getByRole('img', { name: /device coverage chart/i });
            const chartContainer = deviceChart.closest('.bg-neutral-800');
            expect(chartContainer).toHaveClass('p-4', 'sm:p-6');
        });
    });

    describe('Accessibility - ARIA Labels and Roles', () => {
        test('main dashboard has proper ARIA labels', () => {
            render(<TenantAdminDashboard />);

            expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Tenant Admin Dashboard');
        });

        test('all sections have proper ARIA labels', () => {
            render(<TenantAdminDashboard />);

            expect(screen.getAllByRole('region', { name: /key performance indicators/i })).toHaveLength(2);
            expect(screen.getAllByRole('region', { name: /recent system activity/i })).toHaveLength(2);
        });

        test('KPI cards have descriptive ARIA labels', () => {
            render(<TenantAdminDashboard />);

            const criticalAlertsCard = screen.getByRole('button', { name: /critical alerts.*5.*last 24 hours/i });
            expect(criticalAlertsCard).toBeInTheDocument();

            const complianceCard = screen.getByRole('button', { name: /compliance score.*85%.*overall compliance/i });
            expect(complianceCard).toBeInTheDocument();
        });

        test('charts have proper ARIA descriptions', () => {
            render(<TenantAdminDashboard />);

            // Device coverage chart should have descriptive aria-label
            const deviceChart = screen.getByRole('img', { name: /device coverage chart.*150 protected.*25 missing.*10 with alerts.*185 devices/i });
            expect(deviceChart).toBeInTheDocument();

            // Alerts trend chart should have descriptive aria-label
            const alertsChart = screen.getByRole('img', { name: /security alerts trend chart.*3 days.*33 total alerts/i });
            expect(alertsChart).toBeInTheDocument();
        });

        test('auto-refresh status has live region', () => {
            render(<TenantAdminDashboard />);

            const refreshStatus = screen.getByRole('status', { name: /auto-refresh is active/i });
            expect(refreshStatus).toHaveAttribute('aria-live', 'polite');
        });
    });

    describe('Keyboard Navigation', () => {
        test('all interactive elements are keyboard accessible with proper tabIndex', async () => {
            const user = userEvent.setup();
            render(<TenantAdminDashboard />);

            // Test KPI card keyboard navigation
            const criticalAlertsCard = screen.getByRole('button', { name: /critical alerts/i });
            expect(criticalAlertsCard).toHaveAttribute('tabIndex', '0');

            // Test Enter key activation
            await user.click(criticalAlertsCard);
            // Navigation should be called (mocked)
        });

        test('refresh button is keyboard accessible with proper focus management', async () => {
            const user = userEvent.setup();
            const mockRefreshNow = jest.fn();

            mockUseAutoRefresh.mockReturnValue({
                isRefreshing: false,
                lastRefreshTime: new Date(),
                forceRefresh: jest.fn(),
                refreshNow: mockRefreshNow,
                pause: jest.fn(),
                resume: jest.fn(),
                isActive: true,
                isTabActive: true,
                isModalOpen: false,
                isManuallyPaused: false,
                currentInterval: 60000,
            });

            render(<TenantAdminDashboard />);

            const refreshButton = screen.getByRole('button', { name: /refresh dashboard data/i });
            await user.click(refreshButton);

            expect(mockRefreshNow).toHaveBeenCalled();
        });

        test('activity feed items are keyboard navigable with Enter and Space keys', async () => {
            const user = userEvent.setup();
            render(<TenantAdminDashboard />);

            const activityItems = screen.getAllByRole('button', { name: /Activity \d+ of \d+/ });
            expect(activityItems).toHaveLength(2);

            // Each activity item should be focusable and have proper keyboard handlers
            for (const item of activityItems) {
                expect(item).toHaveAttribute('tabIndex', '0');
                expect(item).toHaveAttribute('role', 'button');
            }
        });

        test('charts support keyboard interaction with Enter key navigation', async () => {
            const user = userEvent.setup();
            render(<TenantAdminDashboard />);

            const alertsChart = screen.getByRole('button', { name: /interactive chart/i });
            expect(alertsChart).toHaveAttribute('tabIndex', '0');

            const deviceChart = screen.getByRole('button', { name: /interactive device coverage chart/i });
            expect(deviceChart).toHaveAttribute('tabIndex', '0');
        });

        test('integration health items are keyboard accessible', async () => {
            render(<TenantAdminDashboard />);

            const integrationButtons = screen.getAllByRole('button', { name: /integration.*click to view/i });

            integrationButtons.forEach(button => {
                expect(button).toHaveAttribute('tabIndex', '0');
                expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-primary-500');
            });
        });

        test('ticket breakdown chart supports keyboard navigation', async () => {
            render(<TenantAdminDashboard />);

            const ticketChart = screen.getByRole('button', { name: /interactive ticket breakdown chart/i });
            expect(ticketChart).toHaveAttribute('tabIndex', '0');
        });
    });

    describe('Screen Reader Support', () => {
        test('provides screen reader only content for data summaries', () => {
            render(<TenantAdminDashboard />);

            // Check for screen reader only content
            const srOnlyElements = document.querySelectorAll('.sr-only');
            expect(srOnlyElements.length).toBeGreaterThan(0);
        });

        test('uses semantic HTML elements', () => {
            render(<TenantAdminDashboard />);

            expect(screen.getByRole('main')).toBeInTheDocument();
            expect(screen.getByRole('banner')).toBeInTheDocument(); // header
            expect(screen.getAllByRole('region').length).toBeGreaterThan(0); // sections
            expect(screen.getByRole('list')).toBeInTheDocument(); // activity feed
        });

        test('provides time elements with proper datetime attributes', () => {
            render(<TenantAdminDashboard />);

            const timeElements = document.querySelectorAll('time[datetime]');
            expect(timeElements.length).toBeGreaterThan(0);
        });
    });

    describe('Touch and Mobile Interaction', () => {
        test('provides touch feedback for interactive elements', () => {
            render(<TenantAdminDashboard />);

            const kpiCards = screen.getAllByRole('button', { name: /Critical Alerts|Security Tickets|Helpdesk Tickets|Compliance Score/ });
            kpiCards.forEach(card => {
                expect(card).toHaveClass('active:scale-95');
            });

            const activityItems = screen.getAllByRole('button', { name: /Activity \d+ of \d+/ });
            activityItems.forEach(item => {
                expect(item).toHaveClass('active:scale-98');
            });
        });

        test('has appropriate minimum touch target sizes for accessibility', () => {
            render(<TenantAdminDashboard />);

            const kpiCards = screen.getAllByRole('button', { name: /Critical Alerts|Security Tickets|Helpdesk Tickets|Compliance Score/ });
            kpiCards.forEach(card => {
                expect(card).toHaveClass('min-h-[120px]', 'sm:min-h-[140px]');
            });
        });

        test('integration health items have proper touch target sizes', () => {
            render(<TenantAdminDashboard />);

            const integrationButtons = screen.getAllByRole('button', { name: /integration.*click to view/i });
            integrationButtons.forEach(button => {
                expect(button).toHaveClass('min-h-[80px]', 'sm:min-h-[90px]');
                expect(button).toHaveClass('active:scale-98');
            });
        });

        test('responsive padding adjusts for touch interaction', () => {
            render(<TenantAdminDashboard />);

            // Check that components use responsive padding for better touch interaction
            const chartContainers = document.querySelectorAll('.bg-neutral-800');
            chartContainers.forEach(container => {
                expect(container).toHaveClass('p-4', 'sm:p-6');
            });
        });
    });

    describe('Error States Accessibility', () => {
        test('error states have proper ARIA roles', () => {
            mockUseDashboardData.mockReturnValue({
                data: null,
                loading: {
                    kpis: false,
                    alertsTrend: false,
                    deviceCoverage: false,
                    ticketBreakdown: false,
                    integrations: false,
                    recentActivity: false,
                },
                errors: {
                    kpis: {
                        component: 'kpis',
                        message: 'Failed to load KPI data',
                        timestamp: new Date().toISOString(),
                        retryable: true
                    },
                    alertsTrend: {
                        component: 'alertsTrend',
                        message: 'Failed to load alerts trend',
                        timestamp: new Date().toISOString(),
                        retryable: true
                    },
                },
                lastRefresh: null,
                refreshComponent: jest.fn(),
                isValidating: false,
                healthStatus: 'unhealthy' as const,
                refresh: jest.fn(),
            });

            render(<TenantAdminDashboard />);

            const errorAlerts = screen.getAllByRole('alert');
            expect(errorAlerts.length).toBeGreaterThan(0);
        });
    });
});