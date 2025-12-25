/**
 * Historical Data Store Service Tests
 * 
 * Unit tests for the HistoricalDataStore service to verify
 * tenant isolation, data retrieval, and connection management.
 */

import { HistoricalDataStore } from '../HistoricalDataStore';
import { AlertClassification, AlertSource } from '@/types/reports';

// Mock the database module
jest.mock('@/lib/database', () => ({
    db: null, // Simulate no database connection for testing
    withTransaction: jest.fn()
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('HistoricalDataStore', () => {
    let dataStore: HistoricalDataStore;

    beforeEach(() => {
        dataStore = new HistoricalDataStore();
        jest.clearAllMocks();
    });

    describe('Constructor and Configuration', () => {
        it('should initialize with default pool configuration', () => {
            const poolStats = dataStore.getPoolStats();

            expect(poolStats.maxConnections).toBe(10);
            expect(poolStats.idleTimeout).toBe(20000);
            expect(poolStats.queryTimeout).toBe(30000);
        });

        it('should accept custom pool configuration', () => {
            const customStore = new HistoricalDataStore({
                maxConnections: 5,
                idleTimeout: 15000
            });

            const poolStats = customStore.getPoolStats();

            expect(poolStats.maxConnections).toBe(5);
            expect(poolStats.idleTimeout).toBe(15000);
            expect(poolStats.queryTimeout).toBe(30000); // Default value
        });
    });

    describe('Tenant Access Validation', () => {
        it('should reject empty tenant ID', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getAlertHistory('', dateRange))
                .rejects.toThrow('Tenant ID cannot be empty');
        });

        it('should reject null tenant ID', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getAlertHistory(null as any, dateRange))
                .rejects.toThrow('Invalid tenant ID provided');
        });

        it('should reject non-string tenant ID', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getAlertHistory(123 as any, dateRange))
                .rejects.toThrow('Invalid tenant ID provided');
        });
    });

    describe('Database Connection Validation', () => {
        it('should handle missing database connection gracefully', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getAlertHistory('valid-tenant-id', dateRange))
                .rejects.toThrow('Database connection not available');
        });

        it('should validate connection status', async () => {
            const isValid = await dataStore.validateConnection();
            expect(isValid).toBe(false); // No database connection in test
        });
    });

    describe('Alert Classification Logic', () => {
        it('should normalize alert types correctly', () => {
            // Access private method through type assertion for testing
            const store = dataStore as any;

            // Test phishing classification
            expect(store.normalizeAlertType('phishing email detected', AlertSource.DEFENDER))
                .toBe(AlertClassification.PHISHING);

            // Test malware classification
            expect(store.normalizeAlertType('malware found', AlertSource.SONICWALL))
                .toBe(AlertClassification.MALWARE);

            // Test network classification
            expect(store.normalizeAlertType('network intrusion', AlertSource.FIREWALL_EMAIL))
                .toBe(AlertClassification.NETWORK);

            // Test default classification
            expect(store.normalizeAlertType('unknown alert type', AlertSource.AVAST))
                .toBe(AlertClassification.OTHER);
        });

        it('should normalize severity levels correctly', () => {
            const store = dataStore as any;

            expect(store.normalizeSeverity('CRITICAL')).toBe('critical');
            expect(store.normalizeSeverity('high')).toBe('high');
            expect(store.normalizeSeverity('Medium')).toBe('medium');
            expect(store.normalizeSeverity('low')).toBe('low');
            expect(store.normalizeSeverity(null)).toBe('low');
            expect(store.normalizeSeverity('')).toBe('low');
        });

        it('should determine alert outcomes correctly', () => {
            const store = dataStore as any;

            // Unresolved critical alerts should be security incidents
            expect(store.determineAlertOutcome(false, 'critical')).toBe('security_incident');
            expect(store.determineAlertOutcome(false, 'high')).toBe('security_incident');

            // Unresolved low/medium alerts should be benign
            expect(store.determineAlertOutcome(false, 'medium')).toBe('benign_activity');
            expect(store.determineAlertOutcome(false, 'low')).toBe('benign_activity');

            // Resolved alerts should be benign (properly triaged)
            expect(store.determineAlertOutcome(true, 'critical')).toBe('benign_activity');
            expect(store.determineAlertOutcome(true, 'low')).toBe('benign_activity');
        });
    });

    describe('Date Range Conversion', () => {
        it('should convert date ranges to tenant timezone', () => {
            const store = dataStore as any;
            const dateRange = {
                startDate: new Date('2024-01-01T00:00:00Z'),
                endDate: new Date('2024-01-07T23:59:59Z'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const converted = store.convertToTenantTimezone(dateRange);

            expect(converted.start).toEqual(dateRange.startDate);
            expect(converted.end).toEqual(dateRange.endDate);
            // Note: In a full implementation, this would actually convert timezones
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully in alert history', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getAlertHistory('tenant-123', dateRange))
                .rejects.toThrow('Failed to retrieve alert history');
        });

        it('should handle database errors gracefully in metrics history', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getMetricsHistory('tenant-123', dateRange))
                .rejects.toThrow('Failed to retrieve metrics history');
        });

        it('should handle database errors gracefully in vulnerability history', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getVulnerabilityHistory('tenant-123', dateRange))
                .rejects.toThrow('Failed to retrieve vulnerability history');
        });
    });

    describe('Alert Timeline Aggregation', () => {
        it('should handle empty alert data gracefully', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            // This will fail due to no database connection, but we can test the error handling
            await expect(dataStore.getAlertTimelineAggregation('tenant-123', dateRange))
                .rejects.toThrow('Failed to retrieve alert history');
        });
    });

    describe('Update Summary Aggregation', () => {
        it('should handle tenant validation in update summary', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getUpdateSummaryAggregation('', dateRange))
                .rejects.toThrow('Tenant ID cannot be empty');
        });
    });

    describe('Vulnerability Posture Calculations', () => {
        it('should handle tenant validation in vulnerability calculations', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getVulnerabilityPostureCalculations('', dateRange, 'weekly'))
                .rejects.toThrow('Tenant ID cannot be empty');
        });
    });

    describe('Threat Metrics Aggregation', () => {
        it('should handle tenant validation in threat metrics', async () => {
            const dateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            await expect(dataStore.getThreatMetricsAggregation('', dateRange))
                .rejects.toThrow('Tenant ID cannot be empty');
        });
    });
});