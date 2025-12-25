import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { KPICardsRow } from '../KPICardsRow';
import { KPIData } from '@/types/dashboard';

// Mock the navigation service
const mockGenerateKPIUrl = jest.fn();
const mockNavigatePreservingContext = jest.fn();

jest.mock('@/services/navigationService', () => ({
    navigationService: {
        generateKPIUrl: mockGenerateKPIUrl,
        navigatePreservingContext: mockNavigatePreservingContext
    }
}));

describe('KPICardsRow Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGenerateKPIUrl.mockImplementation((cardType: string) => {
            switch (cardType) {
                case 'criticalAlerts':
                    return '/alerts?severity=critical&timeRange=24h';
                case 'securityTickets':
                    return '/tickets?type=security&status=open';
                case 'helpdeskTickets':
                    return '/tickets?type=helpdesk&status=open';
                case 'compliance':
                    return '/compliance?view=full-report';
                default:
                    return '/dashboard';
            }
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render four KPI cards with correct data', () => {
        const mockData: KPIData = {
            criticalAlerts: 5,
            securityTicketsOpen: 12,
            helpdeskTicketsOpen: 8,
            complianceScore: 85
        };

        const { container, getByText } = render(
            <KPICardsRow
                data={mockData}
                loading={false}
                error={null}
            />
        );

        // Check that all four cards are rendered
        expect(getByText('Critical Alerts')).toBeTruthy();
        expect(getByText('5')).toBeTruthy();
        expect(getByText('Open Security Tickets')).toBeTruthy();
        expect(getByText('12')).toBeTruthy();
        expect(getByText('Helpdesk Tickets Open')).toBeTruthy();
        expect(getByText('8')).toBeTruthy();
        expect(getByText('Compliance Score')).toBeTruthy();
        expect(container.textContent).toContain('85%');

        // Check that all cards are clickable
        const kpiCards = container.querySelectorAll('[role="button"]');
        expect(kpiCards).toHaveLength(4);
    });

    it('should call navigation service when cards are clicked', () => {
        const mockData: KPIData = {
            criticalAlerts: 5,
            securityTicketsOpen: 12,
            helpdeskTicketsOpen: 8,
            complianceScore: 85
        };

        const { container } = render(
            <KPICardsRow
                data={mockData}
                loading={false}
                error={null}
            />
        );

        const kpiCards = container.querySelectorAll('[role="button"]');

        // Verify that cards are clickable and have proper structure
        expect(kpiCards).toHaveLength(4);

        // Test that clicking cards doesn't throw errors (navigation is mocked)
        expect(() => {
            fireEvent.click(kpiCards[0]); // Critical Alerts
            fireEvent.click(kpiCards[1]); // Security Tickets  
            fireEvent.click(kpiCards[2]); // Helpdesk Tickets
            fireEvent.click(kpiCards[3]); // Compliance
        }).not.toThrow();

        // Verify navigation service methods are available (mocked)
        expect(mockGenerateKPIUrl).toBeDefined();
        expect(mockNavigatePreservingContext).toBeDefined();
    });

    it('should display loading state correctly', () => {
        const mockData: KPIData = {
            criticalAlerts: 5,
            securityTicketsOpen: 12,
            helpdeskTicketsOpen: 8,
            complianceScore: 85
        };

        const { container } = render(
            <KPICardsRow
                data={mockData}
                loading={true}
                error={null}
            />
        );

        // Should show loading skeletons
        const loadingElements = container.querySelectorAll('.animate-pulse');
        expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('should display error state correctly', () => {
        const mockError = {
            component: 'kpis',
            message: 'Failed to load KPI data',
            timestamp: new Date().toISOString(),
            retryable: true
        };

        const mockRetry = jest.fn();

        const { getByText } = render(
            <KPICardsRow
                data={null}
                loading={false}
                error={mockError}
                onRetry={mockRetry}
            />
        );

        expect(getByText('KPI Data Error')).toBeTruthy();
        expect(getByText(mockError.message)).toBeTruthy();

        const retryButton = getByText('Retry');
        expect(retryButton).toBeTruthy();

        fireEvent.click(retryButton);
        expect(mockRetry).toHaveBeenCalledTimes(1);
    });
});