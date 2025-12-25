/**
 * Unit tests for DataAvailabilityValidator
 * 
 * Tests data availability validation, graceful degradation strategies,
 * and informative messaging for data gaps.
 */

import { DataAvailabilityValidator, DataType } from '../DataAvailabilityValidator';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { EnhancedDateRange } from '@/types/reports';

// Mock HistoricalDataStore
jest.mock('../HistoricalDataStore');

describe('DataAvailabilityValidator', () => {
    let validator: DataAvailabilityValidator;
    let mockHistoricalDataStore: jest.Mocked<HistoricalDataStore>;

    const mockDateRange: EnhancedDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday'
    };

    beforeEach(() => {
        mockHistoricalDataStore = new HistoricalDataStore() as jest.Mocked<HistoricalDataStore>;
        validator = new DataAvailabilityValidator(mockHistoricalDataStore);

        // Setup default mocks
        mockHistoricalDataStore.getAlertHistory.mockResolvedValue([
            {
                id: '1',
                tenantId: 'tenant1',
                rawAlertType: 'malware',
                normalizedType: 'malware' as any,
                severity: 'high' as any,
                outcome: 'security_incident',
                createdAt: new Date('2024-01-02'),
                resolvedAt: new Date('2024-01-02'),
                source: 'defender' as any
            }
        ]);

        mockHistoricalDataStore.getMetricsHistory.mockResolvedValue([
            {
                id: '1',
                tenantId: 'tenant1',
                deviceId: 'device1',
                date: new Date('2024-01-02'),
                threatsBlocked: 5,
                updatesApplied: 2,
                vulnerabilitiesDetected: 1,
                vulnerabilitiesMitigated: 1,
                source: 'firewall'
            }
        ]);

        mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockResolvedValue({
            totalDetected: 5,
            totalMitigated: 3,
            severityBreakdown: {
                critical: 1,
                high: 2,
                medium: 2
            }
        });

        mockHistoricalDataStore.getUpdateSummaryAggregation.mockResolvedValue({
            totalUpdatesApplied: 10,
            updatesBySource: {
                windows: 5,
                microsoftOffice: 3,
                firewall: 2,
                other: 0
            }
        });

        mockHistoricalDataStore.getAlertOutcomeClassification.mockResolvedValue({
            securityIncidents: [{ id: '1' }],
            benignActivity: [],
            falsePositives: []
        });
    });

    describe('Data Availability Assessment', () => {
        it('should assess data availability for weekly reports with sufficient data', async () => {
            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.isAvailable).toBe(true);
            expect(assessment.estimatedReportQuality).toBe('good');
            expect(assessment.overallScore).toBeGreaterThan(50);
            expect(assessment.dataTypes[DataType.ALERTS].available).toBe(true);
            expect(assessment.dataTypes[DataType.METRICS].available).toBe(true);
        });

        it('should assess data availability for monthly reports', async () => {
            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'monthly'
            );

            expect(assessment.isAvailable).toBe(true);
            expect(assessment.dataTypes[DataType.ALERTS].available).toBe(true);
            expect(assessment.dataTypes[DataType.METRICS].available).toBe(true);
            expect(assessment.dataTypes[DataType.VULNERABILITIES].available).toBe(true);
        });

        it('should assess data availability for quarterly reports', async () => {
            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'quarterly'
            );

            expect(assessment.isAvailable).toBe(true);
            expect(assessment.dataTypes[DataType.ALERTS].available).toBe(true);
            expect(assessment.dataTypes[DataType.METRICS].available).toBe(true);
            expect(assessment.dataTypes[DataType.VULNERABILITIES].available).toBe(true);
        });

        it('should handle insufficient alert data', async () => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.isAvailable).toBe(false);
            expect(assessment.dataTypes[DataType.ALERTS].available).toBe(false);
            expect(assessment.dataTypes[DataType.ALERTS].recordCount).toBe(0);
            expect(assessment.degradationStrategy).toBeDefined();
            expect(assessment.degradationStrategy?.strategy).toBe('fallback');
        });

        it('should handle missing metrics data', async () => {
            mockHistoricalDataStore.getMetricsHistory.mockResolvedValue([]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.dataTypes[DataType.METRICS].available).toBe(false);
            expect(assessment.dataTypes[DataType.METRICS].recordCount).toBe(0);
        });

        it('should handle vulnerability data unavailability', async () => {
            mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockResolvedValue({
                totalDetected: 0,
                totalMitigated: 0,
                severityBreakdown: undefined as any
            });

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'monthly'
            );

            expect(assessment.dataTypes[DataType.VULNERABILITIES].available).toBe(false);
        });
    });

    describe('Data Quality Assessment', () => {
        it('should assess excellent data quality with high coverage', async () => {
            // Mock data with good coverage
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue(
                Array.from({ length: 20 }, (_, i) => ({
                    id: `${i}`,
                    tenantId: 'tenant1',
                    rawAlertType: 'malware',
                    normalizedType: 'malware' as any,
                    severity: 'high' as any,
                    outcome: 'security_incident',
                    createdAt: new Date(`2024-01-0${(i % 7) + 1}`),
                    resolvedAt: new Date(`2024-01-0${(i % 7) + 1}`),
                    source: 'defender' as any
                }))
            );

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.dataTypes[DataType.ALERTS].quality).toBe('excellent');
            expect(assessment.estimatedReportQuality).toBe('excellent');
        });

        it('should assess poor data quality with low coverage', async () => {
            // Mock sparse data
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([
                {
                    id: '1',
                    tenantId: 'tenant1',
                    rawAlertType: 'malware',
                    normalizedType: 'malware' as any,
                    severity: 'high' as any,
                    outcome: 'security_incident',
                    createdAt: new Date('2024-01-01'), // Only one day
                    resolvedAt: new Date('2024-01-01'),
                    source: 'defender' as any
                }
            ]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.dataTypes[DataType.ALERTS].quality).toBe('fair');
            expect(assessment.dataTypes[DataType.ALERTS].gaps.length).toBeGreaterThan(0);
        });
    });

    describe('Graceful Degradation Strategies', () => {
        it('should create fallback strategy for missing alerts', async () => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.degradationStrategy?.strategy).toBe('fallback');
            expect(assessment.degradationStrategy?.affectedSections).toContain('Alerts Digest');
            expect(assessment.degradationStrategy?.userMessage).toContain('limited information');
            expect(assessment.degradationStrategy?.alternatives).toBeInstanceOf(Array);
        });

        it('should create partial strategy for multiple missing data types', async () => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([]);
            mockHistoricalDataStore.getMetricsHistory.mockResolvedValue([]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.degradationStrategy?.strategy).toBe('partial');
            expect(assessment.degradationStrategy?.affectedSections.length).toBeGreaterThan(1);
            expect(assessment.degradationStrategy?.userMessage).toContain('incomplete');
        });

        it('should create placeholder strategy for poor quality data', async () => {
            // Mock data with gaps but some availability
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([
                {
                    id: '1',
                    tenantId: 'tenant1',
                    rawAlertType: 'malware',
                    normalizedType: 'malware' as any,
                    severity: 'high' as any,
                    outcome: 'security_incident',
                    createdAt: new Date('2024-01-01'),
                    resolvedAt: new Date('2024-01-01'),
                    source: 'defender' as any
                }
            ]);

            // Force poor quality by mocking large gaps
            const assessment = await validator.validateDataAvailability(
                'tenant1',
                {
                    ...mockDateRange,
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-30') // Much larger range
                },
                'monthly'
            );

            // Should have some data but poor quality
            if (assessment.degradationStrategy?.strategy === 'placeholder') {
                expect(assessment.degradationStrategy.userMessage).toContain('incomplete');
                expect(assessment.degradationStrategy.alternatives).toContain('Review the data quality warnings in each section');
            }
        });

        it('should create skip strategy for completely insufficient data', async () => {
            // Mock no data at all
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([]);
            mockHistoricalDataStore.getMetricsHistory.mockResolvedValue([]);
            mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockResolvedValue({
                totalDetected: 0,
                totalMitigated: 0,
                severityBreakdown: undefined as any
            });
            mockHistoricalDataStore.getUpdateSummaryAggregation.mockResolvedValue({
                totalUpdatesApplied: 0,
                updatesBySource: {
                    windows: 0,
                    microsoftOffice: 0,
                    firewall: 0,
                    other: 0
                }
            });

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.isAvailable).toBe(false);
            expect(assessment.degradationStrategy?.strategy).toBe('skip');
            expect(assessment.degradationStrategy?.affectedSections).toContain('Entire Report');
        });
    });

    describe('Data Gap Detection', () => {
        it('should detect gaps in alert data', async () => {
            // Mock alerts with gaps
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([
                {
                    id: '1',
                    tenantId: 'tenant1',
                    rawAlertType: 'malware',
                    normalizedType: 'malware' as any,
                    severity: 'high' as any,
                    outcome: 'security_incident',
                    createdAt: new Date('2024-01-01'),
                    resolvedAt: new Date('2024-01-01'),
                    source: 'defender' as any
                },
                {
                    id: '2',
                    tenantId: 'tenant1',
                    rawAlertType: 'malware',
                    normalizedType: 'malware' as any,
                    severity: 'high' as any,
                    outcome: 'security_incident',
                    createdAt: new Date('2024-01-07'), // Gap in between
                    resolvedAt: new Date('2024-01-07'),
                    source: 'defender' as any
                }
            ]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.dataTypes[DataType.ALERTS].gaps.length).toBeGreaterThan(0);
            expect(assessment.missingDataPeriods.length).toBeGreaterThan(0);
        });

        it('should calculate coverage percentage correctly', async () => {
            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.dataTypes[DataType.ALERTS].coveragePercentage).toBeGreaterThan(0);
            expect(assessment.dataTypes[DataType.ALERTS].coveragePercentage).toBeLessThanOrEqual(100);
        });
    });

    describe('Recommendations Generation', () => {
        it('should generate recommendations for missing alert data', async () => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.recommendations).toContain(
                'Configure your security systems to send alerts to AVIAN for comprehensive threat monitoring'
            );
        });

        it('should generate recommendations for missing metrics data', async () => {
            mockHistoricalDataStore.getMetricsHistory.mockResolvedValue([]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.recommendations.some(r =>
                r.includes('firewall and EDR systems')
            )).toBe(true);
        });

        it('should generate recommendations for missing vulnerability data', async () => {
            mockHistoricalDataStore.getVulnerabilityPostureCalculations.mockResolvedValue({
                totalDetected: 0,
                totalMitigated: 0,
                severityBreakdown: undefined as any
            });

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'monthly'
            );

            expect(assessment.recommendations.some(r =>
                r.includes('vulnerability scanning')
            )).toBe(true);
        });

        it('should generate positive recommendations for good data', async () => {
            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            if (assessment.isAvailable && assessment.estimatedReportQuality === 'good') {
                expect(assessment.recommendations).toContain(
                    'Data availability looks good. Continue monitoring to maintain report quality'
                );
            }
        });
    });

    describe('Data Gap Messaging', () => {
        it('should generate informative message for available data', async () => {
            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            const message = validator.generateDataGapMessage(assessment);

            if (assessment.isAvailable) {
                expect(message).toContain('All required data is available');
            }
        });

        it('should generate informative message for missing data', async () => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            const message = validator.generateDataGapMessage(assessment);

            expect(message).toContain('Report quality:');
            expect(message).toContain('No alerts data available');
        });

        it('should include degradation strategy in message', async () => {
            mockHistoricalDataStore.getAlertHistory.mockResolvedValue([]);

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            const message = validator.generateDataGapMessage(assessment);

            expect(message).toContain('Strategy:');
            expect(message).toContain(assessment.degradationStrategy?.userMessage || '');
        });
    });

    describe('Error Handling', () => {
        it('should handle data store errors gracefully', async () => {
            mockHistoricalDataStore.getAlertHistory.mockRejectedValue(new Error('Database error'));

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.isAvailable).toBe(false);
            expect(assessment.estimatedReportQuality).toBe('insufficient');
            expect(assessment.degradationStrategy?.strategy).toBe('skip');
        });

        it('should create failsafe assessment on validation failure', async () => {
            mockHistoricalDataStore.getAlertHistory.mockRejectedValue(new Error('System failure'));
            mockHistoricalDataStore.getMetricsHistory.mockRejectedValue(new Error('System failure'));

            const assessment = await validator.validateDataAvailability(
                'tenant1',
                mockDateRange,
                'weekly'
            );

            expect(assessment.isAvailable).toBe(false);
            expect(assessment.recommendations).toContain('Unable to validate data availability due to system error');
            expect(assessment.degradationStrategy?.userMessage).toContain('temporarily unavailable');
        });
    });

    describe('Input Validation', () => {
        it('should validate tenant ID', async () => {
            await expect(
                validator.validateDataAvailability('', mockDateRange, 'weekly')
            ).rejects.toThrow('Valid tenant ID is required');
        });

        it('should validate date range', async () => {
            const invalidDateRange = {
                ...mockDateRange,
                startDate: new Date('2024-01-07'),
                endDate: new Date('2024-01-01') // End before start
            };

            await expect(
                validator.validateDataAvailability('tenant1', invalidDateRange, 'weekly')
            ).rejects.toThrow('Start date must be before end date');
        });

        it('should validate timezone', async () => {
            const invalidDateRange = {
                ...mockDateRange,
                timezone: '' // Empty timezone
            };

            await expect(
                validator.validateDataAvailability('tenant1', invalidDateRange, 'weekly')
            ).rejects.toThrow('Timezone is required');
        });

        it('should validate week start', async () => {
            const invalidDateRange = {
                ...mockDateRange,
                weekStart: 'sunday' as any // Invalid week start
            };

            await expect(
                validator.validateDataAvailability('tenant1', invalidDateRange, 'weekly')
            ).rejects.toThrow('Week start must be Monday');
        });
    });
});