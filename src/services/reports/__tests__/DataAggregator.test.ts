/**
 * DataAggregator Service Tests
 * 
 * Tests for the DataAggregator service that orchestrates data retrieval
 * and processing for report generation.
 */

import { DataAggregator } from '../DataAggregator';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { AlertClassificationService } from '../AlertClassificationService';
import {
    EnhancedDateRange,
    AlertClassification,
    AlertSource,
    AlertSeverity,
    AlertRecord
} from '@/types/reports';

// Mock the dependencies
jest.mock('../HistoricalDataStore');
jest.mock('../AlertClassificationService');

describe('DataAggregator', () => {
    let dataAggregator: DataAggregator;
    let mockHistoricalDataStore: jest.Mocked<HistoricalDataStore>;
    let mockAlertClassificationService: jest.Mocked<AlertClassificationService>;

    const mockDateRange: EnhancedDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday'
    };

    const mockTenantId = 'test-tenant-123';

    beforeEach(() => {
        mockHistoricalDataStore = new HistoricalDataStore() as jest.Mocked<HistoricalDataStore>;
        mockAlertClassificationService = new AlertClassificationService() as jest.Mocked<AlertClassificationService>;

        dataAggregator = new DataAggregator(
            mockHistoricalDataStore,
            mockAlertClassificationService
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Input Validation', () => {
        it('should reject invalid tenant ID', async () => {
            await expect(dataAggregator.getAlertsDigest('', mockDateRange))
                .rejects.toThrow('Valid tenant ID is required');
        });

        it('should reject invalid date range', async () => {
            const invalidDateRange = {
                ...mockDateRange,
                startDate: new Date('2024-01-07'),
                endDate: new Date('2024-01-01') // End before start
            };

            await expect(dataAggregator.getAlertsDigest(mockTenantId, invalidDateRange))
                .rejects.toThrow('Start date must be before end date');
        });

        it('should reject missing timezone', async () => {
            const invalidDateRange = {
                ...mockDateRange,
                timezone: ''
            };

            await expect(dataAggregator.getAlertsDigest(mockTenantId, invalidDateRange))
                .rejects.toThrow('Timezone is required for proper date handling');
        });

        it('should reject non-Monday week start', async () => {
            const invalidDateRange = {
                ...mockDateRange,
                weekStart: 'sunday' as any
            };

            await expect(dataAggregator.getAlertsDigest(mockTenantId, invalidDateRange))
                .rejects.toThrow('Week start must be Monday for ISO week compliance');
        });
    });

    const mockAlerts: AlertRecord[] = [
        {
            id: 'alert-1',
            tenantId: mockTenantId,
            rawAlertType: 'malware detected',
            normalizedType: AlertClassification.MALWARE,
            severity: AlertSeverity.HIGH,
            outcome: 'security_incident',
            createdAt: new Date('2024-01-01T10:00:00Z'),
            resolvedAt: new Date('2024-01-01T11:00:00Z'),
            deviceId: 'device-1',
            source: AlertSource.DEFENDER,
            sourceSubtype: 'microsoft_defender'
        },
        {
            id: 'alert-2',
            tenantId: mockTenantId,
            rawAlertType: 'phishing email',
            normalizedType: AlertClassification.PHISHING,
            severity: AlertSeverity.MEDIUM,
            outcome: 'benign_activity',
            createdAt: new Date('2024-01-02T14:00:00Z'),
            resolvedAt: new Date('2024-01-02T15:00:00Z'),
            deviceId: 'device-2',
            source: AlertSource.DEFENDER,
            sourceSubtype: 'microsoft_defender'
        }
    ];

    describe('AlertsDigest Aggregation', () => {

        beforeEach(() => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue(mockAlerts);
            mockHistoricalDataStore.getAlertOutcomeClassification.mockResolvedValue({
                securityIncidents: [mockAlerts[0]],
                benignActivity: [mockAlerts[1]],
                falsePositives: []
            });
        });

        it('should generate AlertsDigest with correct totals', async () => {
            const result = await dataAggregator.getAlertsDigest(mockTenantId, mockDateRange);

            expect(result.totalAlertsDigested).toBe(2);
            expect(result.alertClassification[AlertClassification.MALWARE]).toBe(1);
            expect(result.alertClassification[AlertClassification.PHISHING]).toBe(1);
            expect(result.alertOutcomes.securityIncidents).toBe(1);
            expect(result.alertOutcomes.benignActivity).toBe(1);
            expect(result.alertOutcomes.falsePositives).toBe(0);
        });

        it('should generate weekly timeline with 7 days', async () => {
            const result = await dataAggregator.getAlertsDigest(mockTenantId, mockDateRange);

            expect(result.weeklyTimeline).toHaveLength(7);
            expect(result.weeklyTimeline[0].dayOfWeek).toBe('sunday'); // Jan 1, 2024 was Sunday
            expect(result.weeklyTimeline[6].dayOfWeek).toBe('saturday'); // Jan 7, 2024 was Saturday

            // Check that dates are properly formatted
            result.weeklyTimeline.forEach(day => {
                expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(typeof day.count).toBe('number');
                expect(day.count).toBeGreaterThanOrEqual(0);
            });
        });

        it('should calculate source breakdown correctly', async () => {
            const result = await dataAggregator.getAlertsDigest(mockTenantId, mockDateRange);

            expect(result.sourceBreakdown[AlertSource.DEFENDER]).toBe(2);
            expect(result.sourceBreakdown[AlertSource.SONICWALL]).toBe(0);
            expect(result.sourceBreakdown[AlertSource.AVAST]).toBe(0);
            expect(result.sourceBreakdown[AlertSource.FIREWALL_EMAIL]).toBe(0);
        });

        it('should handle empty alert data gracefully', async () => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([]);
            mockHistoricalDataStore.getAlertOutcomeClassification.mockResolvedValue({
                securityIncidents: [],
                benignActivity: [],
                falsePositives: []
            });

            const result = await dataAggregator.getAlertsDigest(mockTenantId, mockDateRange);

            expect(result.totalAlertsDigested).toBe(0);
            expect(result.weeklyTimeline).toHaveLength(7);
            expect(result.weeklyTimeline.every(day => day.count === 0)).toBe(true);
        });
    });

    describe('UpdatesSummary Aggregation', () => {
        beforeEach(() => {
            mockHistoricalDataStore.getUpdateSummaryAggregation.mockResolvedValue({
                totalUpdatesApplied: 150,
                updatesBySource: {
                    windows: 80,
                    microsoftOffice: 30,
                    firewall: 20,
                    other: 20
                },
                progressVisualizationData: {
                    completionRates: {
                        windows: 95,
                        microsoftOffice: 98,
                        firewall: 100,
                        other: 85
                    },
                    dailyProgress: []
                }
            });
        });

        it('should generate UpdatesSummary with correct totals', async () => {
            const result = await dataAggregator.getUpdatesSummary(mockTenantId, mockDateRange);

            expect(result.totalUpdatesApplied).toBe(150);
            expect(result.updatesBySource.windows).toBe(80);
            expect(result.updatesBySource.microsoftOffice).toBe(30);
            expect(result.updatesBySource.firewall).toBe(20);
            expect(result.updatesBySource.other).toBe(20);
        });

        it('should validate mathematical consistency', async () => {
            const result = await dataAggregator.getUpdatesSummary(mockTenantId, mockDateRange);

            const calculatedTotal = Object.values(result.updatesBySource).reduce((sum, count) => sum + count, 0);
            expect(calculatedTotal).toBe(result.totalUpdatesApplied);
        });
    });

    describe('VulnerabilityPosture Aggregation', () => {
        beforeEach(() => {
            mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockResolvedValue({
                totalDetected: 45,
                totalMitigated: 32,
                severityBreakdown: {
                    critical: 5,
                    high: 15,
                    medium: 25
                },
                classBreakdown: {
                    'Remote Code Execution': 8,
                    'Privilege Escalation': 12,
                    'Information Disclosure': 10,
                    'Other': 15
                },
                topCVEs: [
                    { cveId: 'CVE-2024-0001', severity: 'critical', affectedDevices: 3, mitigated: true },
                    { cveId: 'CVE-2024-0002', severity: 'high', affectedDevices: 5, mitigated: false }
                ]
            });
        });

        it('should generate VulnerabilityPosture for weekly report', async () => {
            const result = await dataAggregator.getVulnerabilityPosture(mockTenantId, mockDateRange, 'weekly');

            expect(result.totalDetected).toBe(45);
            expect(result.totalMitigated).toBe(32);
            expect(result.severityBreakdown).toBeDefined();
            expect(result.severityBreakdown.critical).toBe(5);
            expect(result.severityBreakdown.high).toBe(15);
            expect(result.severityBreakdown.medium).toBe(25);

            // Weekly should include topCVEs but not classBreakdown
            expect(result.topCVEs).toBeDefined();
            expect(result.topCVEs).toHaveLength(2);
            expect(result.classBreakdown).toBeUndefined();
        });

        it('should generate VulnerabilityPosture for monthly report', async () => {
            const result = await dataAggregator.getVulnerabilityPosture(mockTenantId, mockDateRange, 'monthly');

            expect(result.totalDetected).toBe(45);
            expect(result.totalMitigated).toBe(32);
            expect(result.severityBreakdown).toBeDefined();

            // Monthly should include both topCVEs and classBreakdown
            expect(result.topCVEs).toBeDefined();
            expect(result.classBreakdown).toBeDefined();
            expect(result.classBreakdown['Remote Code Execution']).toBe(8);
        });

        it('should generate VulnerabilityPosture for quarterly report', async () => {
            mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockResolvedValue({
                totalDetected: 45,
                totalMitigated: 32,
                severityBreakdown: {
                    critical: 5,
                    high: 15,
                    medium: 25
                },
                riskReductionTrend: {
                    quarterStart: 60,
                    quarterEnd: 45,
                    percentReduction: 25.0,
                    criticalReduced: 4,
                    highReduced: 10,
                    mediumReduced: 15
                }
            });

            const result = await dataAggregator.getVulnerabilityPosture(mockTenantId, mockDateRange, 'quarterly');

            expect(result.totalDetected).toBe(45);
            expect(result.totalMitigated).toBe(32);
            expect(result.severityBreakdown).toBeDefined();

            // Quarterly should include riskReductionTrend but exclude topCVEs
            expect(result.riskReductionTrend).toBeDefined();
            expect(result.riskReductionTrend.percentReduction).toBe(25.0);
            expect(result.topCVEs).toBeUndefined();
        });
    });

    describe('Trend Analysis', () => {
        beforeEach(() => {
            // Mock current period alerts
            mockHistoricalDataStore.getAlertHistory
                .mockResolvedValue(mockAlerts); // Will be used for both current and previous periods

            mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockResolvedValue({
                totalDetected: 45,
                totalMitigated: 32,
                severityBreakdown: { critical: 5, high: 15, medium: 25 },
                vulnerabilityAging: {
                    lessThan30Days: 20,
                    thirtyTo90Days: 15,
                    moreThan90Days: 10
                }
            });
        });

        it('should calculate week-over-week trends', async () => {
            const result = await dataAggregator.getTrendAnalysis(mockTenantId, mockDateRange);

            expect(result.weekOverWeekTrends).toBeDefined();
            expect(result.weekOverWeekTrends.length).toBeGreaterThan(0);

            const alertTrend = result.weekOverWeekTrends.find(t => t.metric === 'Total Alerts');
            expect(alertTrend).toBeDefined();
            expect(alertTrend?.currentPeriod).toBe(2);
            expect(alertTrend?.previousPeriod).toBe(2); // Same as current since we're using mockResolvedValue
            expect(alertTrend?.trend).toBe('stable'); // No change since both periods have same count
        });

        it('should identify recurring alert types', async () => {
            // Mock alerts with recurring patterns
            const recurringAlerts = [
                ...mockAlerts,
                { ...mockAlerts[0], id: 'alert-3', createdAt: new Date('2024-01-03T10:00:00Z') },
                { ...mockAlerts[0], id: 'alert-4', createdAt: new Date('2024-01-04T10:00:00Z') }
            ];

            mockHistoricalDataStore.getAlertHistory.mockResolvedValue(recurringAlerts);

            const result = await dataAggregator.getTrendAnalysis(mockTenantId, mockDateRange);

            expect(result.recurringAlertTypes).toBeDefined();
            expect(result.recurringAlertTypes.length).toBeGreaterThan(0);

            const malwareRecurring = result.recurringAlertTypes.find(r => r.alertType === AlertClassification.MALWARE);
            expect(malwareRecurring).toBeDefined();
            expect(malwareRecurring?.frequency).toBe(3);
        });

        it('should calculate vulnerability aging', async () => {
            const result = await dataAggregator.getTrendAnalysis(mockTenantId, mockDateRange);

            expect(result.vulnerabilityAging).toBeDefined();
            expect(result.vulnerabilityAging.openVulnerabilities.lessThan30Days).toBe(20);
            expect(result.vulnerabilityAging.openVulnerabilities.thirtyTo90Days).toBe(15);
            expect(result.vulnerabilityAging.openVulnerabilities.moreThan90Days).toBe(10);
        });
    });

    describe('Aggregation Consistency Validation', () => {
        beforeEach(() => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue(mockAlerts);
            mockHistoricalDataStore.getAlertOutcomeClassification.mockResolvedValue({
                securityIncidents: [mockAlerts[0]],
                benignActivity: [mockAlerts[1]],
                falsePositives: []
            });
            mockHistoricalDataStore.getUpdateSummaryAggregation.mockResolvedValue({
                totalUpdatesApplied: 100,
                updatesBySource: { windows: 50, microsoftOffice: 25, firewall: 15, other: 10 },
                progressVisualizationData: { completionRates: {}, dailyProgress: [] }
            });
            mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockResolvedValue({
                totalDetected: 30,
                totalMitigated: 20,
                severityBreakdown: { critical: 5, high: 10, medium: 15 }
            });
        });

        it('should validate aggregation consistency', async () => {
            const result = await dataAggregator.validateAggregationConsistency(mockTenantId, mockDateRange);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect inconsistencies in alert totals', async () => {
            // Mock inconsistent data
            mockHistoricalDataStore.getAlertOutcomeClassification.mockResolvedValue({
                securityIncidents: [mockAlerts[0]],
                benignActivity: [], // Missing one alert
                falsePositives: []
            });

            const result = await dataAggregator.validateAggregationConsistency(mockTenantId, mockDateRange);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Alert outcome totals');
        });

        it('should detect inconsistencies in update totals', async () => {
            // Mock inconsistent update data
            mockHistoricalDataStore.getUpdateSummaryAggregation.mockResolvedValue({
                totalUpdatesApplied: 100,
                updatesBySource: { windows: 50, microsoftOffice: 25, firewall: 15, other: 5 }, // Sum = 95, not 100
                progressVisualizationData: { completionRates: {}, dailyProgress: [] }
            });

            const result = await dataAggregator.validateAggregationConsistency(mockTenantId, mockDateRange);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Updates by source totals'))).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle HistoricalDataStore errors gracefully', async () => {
            mockHistoricalDataStore.getAlertHistory.mockRejectedValue(new Error('Database connection failed'));

            await expect(dataAggregator.getAlertsDigest(mockTenantId, mockDateRange))
                .rejects.toThrow('Failed to generate AlertsDigest: Database connection failed');
        });

        it('should handle UpdatesSummary errors gracefully', async () => {
            mockHistoricalDataStore.getUpdateSummaryAggregation.mockRejectedValue(new Error('Update data unavailable'));

            await expect(dataAggregator.getUpdatesSummary(mockTenantId, mockDateRange))
                .rejects.toThrow('Failed to generate UpdatesSummary: Update data unavailable');
        });

        it('should handle VulnerabilityPosture errors gracefully', async () => {
            mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockRejectedValue(new Error('Vulnerability data error'));

            await expect(dataAggregator.getVulnerabilityPosture(mockTenantId, mockDateRange))
                .rejects.toThrow('Failed to generate VulnerabilityPosture: Vulnerability data error');
        });
    });
});