/**
 * Tests for MetricsAggregator Storage Functionality
 * 
 * Validates that metrics are correctly stored in the firewall_metrics_rollup table
 * with proper data types, values, and database operations.
 * 
 * Requirements: Task 7.5 - Test metrics storage
 * Requirements: 9.5 - Insert into firewall_metrics_rollup table
 */

import { MetricsAggregator } from '../metrics-aggregator';
import { db } from '../database';
import { firewallMetricsRollup } from '../../../database/schemas/firewall';
import { FirewallPollingStateService } from '../firewall-polling-state';

// Mock dependencies
jest.mock('../database', () => ({
    db: {
        select: jest.fn(),
        insert: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('../firewall-polling-state');
jest.mock('../logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('MetricsAggregator - Storage Functionality', () => {
    let aggregator: MetricsAggregator;

    beforeEach(() => {
        aggregator = new MetricsAggregator();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        if (aggregator.isAggregating()) {
            await aggregator.stop();
        }
    });

    describe('Insert into firewall_metrics_rollup table', () => {
        it('should insert metrics with all required fields', async () => {
            const deviceId = 'device-123';
            const testDate = new Date('2024-01-15');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
                bandwidthTotalMb: 5000,
                activeSessionsCount: 250,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify insert was called with correct table
            expect(db.insert).toHaveBeenCalledWith(firewallMetricsRollup);

            // Verify all required fields are present
            expect(mockValues).toHaveBeenCalledWith({
                deviceId: 'device-123',
                date: '2024-01-15',
                threatsBlocked: 200, // 100 + 50 + 30 + 20
                malwareBlocked: 50,
                ipsBlocked: 100,
                blockedConnections: 40,
                webFilterHits: 15,
                bandwidthTotalMb: 5000,
                activeSessionsCount: 250,
            });
        });

        it('should store correct data types for each field', async () => {
            const deviceId = 'device-456';
            const testDate = new Date('2024-02-20');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 150,
                gavBlocks: 75,
                dpiSslBlocks: 30,
                atpVerdicts: 45,
                appControlBlocks: 15,
                botnetBlocks: 25,
                contentFilterBlocks: 20,
                blockedConnections: 60,
                bandwidthTotalMb: 7500,
                activeSessionsCount: 300,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            const storedValues = mockValues.mock.calls[0][0];

            // Verify data types
            expect(typeof storedValues.deviceId).toBe('string');
            expect(typeof storedValues.date).toBe('string');
            expect(typeof storedValues.threatsBlocked).toBe('number');
            expect(typeof storedValues.malwareBlocked).toBe('number');
            expect(typeof storedValues.ipsBlocked).toBe('number');
            expect(typeof storedValues.blockedConnections).toBe('number');
            expect(typeof storedValues.webFilterHits).toBe('number');
            expect(typeof storedValues.bandwidthTotalMb).toBe('number');
            expect(typeof storedValues.activeSessionsCount).toBe('number');

            // Verify all numeric fields are integers
            expect(Number.isInteger(storedValues.threatsBlocked)).toBe(true);
            expect(Number.isInteger(storedValues.malwareBlocked)).toBe(true);
            expect(Number.isInteger(storedValues.ipsBlocked)).toBe(true);
            expect(Number.isInteger(storedValues.blockedConnections)).toBe(true);
            expect(Number.isInteger(storedValues.webFilterHits)).toBe(true);
            expect(Number.isInteger(storedValues.bandwidthTotalMb)).toBe(true);
            expect(Number.isInteger(storedValues.activeSessionsCount)).toBe(true);
        });

        it('should store zero values when counters are zero', async () => {
            const deviceId = 'device-789';
            const testDate = new Date('2024-03-10');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 0,
                gavBlocks: 0,
                dpiSslBlocks: 0,
                atpVerdicts: 0,
                appControlBlocks: 0,
                botnetBlocks: 0,
                contentFilterBlocks: 0,
                blockedConnections: 0,
                bandwidthTotalMb: 0,
                activeSessionsCount: 0,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify zero values are stored correctly
            expect(mockValues).toHaveBeenCalledWith({
                deviceId: 'device-789',
                date: '2024-03-10',
                threatsBlocked: 0,
                malwareBlocked: 0,
                ipsBlocked: 0,
                blockedConnections: 0,
                webFilterHits: 0,
                bandwidthTotalMb: 0,
                activeSessionsCount: 0,
            });
        });

        it('should store large counter values correctly', async () => {
            const deviceId = 'device-large';
            const testDate = new Date('2024-04-05');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 999999,
                gavBlocks: 888888,
                dpiSslBlocks: 777777,
                atpVerdicts: 666666,
                appControlBlocks: 555555,
                botnetBlocks: 444444,
                contentFilterBlocks: 333333,
                blockedConnections: 222222,
                bandwidthTotalMb: 1000000,
                activeSessionsCount: 50000,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            const storedValues = mockValues.mock.calls[0][0];

            // Verify large values are stored correctly
            expect(storedValues.threatsBlocked).toBe(2999997); // 999999 + 888888 + 666666 + 444444
            expect(storedValues.malwareBlocked).toBe(888888);
            expect(storedValues.ipsBlocked).toBe(999999);
            expect(storedValues.blockedConnections).toBe(222222);
            expect(storedValues.webFilterHits).toBe(333333);
            expect(storedValues.bandwidthTotalMb).toBe(1000000);
            expect(storedValues.activeSessionsCount).toBe(50000);
        });

        it('should handle missing optional fields with default values', async () => {
            const deviceId = 'device-minimal';
            const testDate = new Date('2024-05-12');
            testDate.setUTCHours(0, 0, 0, 0);

            // Mock counters without optional fields
            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
                // bandwidthTotalMb and activeSessionsCount are missing
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            const storedValues = mockValues.mock.calls[0][0];

            // Verify optional fields default to 0
            expect(storedValues.bandwidthTotalMb).toBe(0);
            expect(storedValues.activeSessionsCount).toBe(0);

            // Verify required fields are still present
            expect(storedValues.threatsBlocked).toBe(200);
            expect(storedValues.malwareBlocked).toBe(50);
            expect(storedValues.ipsBlocked).toBe(100);
        });
    });

    describe('Storage error handling', () => {
        it('should throw error when database insert fails', async () => {
            const deviceId = 'device-error';
            const testDate = new Date('2024-06-01');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert failure
            const mockOnConflictDoUpdate = jest.fn().mockRejectedValue(new Error('Database connection failed'));
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Verify error is thrown
            await expect(aggregator.aggregateDeviceMetrics(deviceId, testDate)).rejects.toThrow('Database connection failed');
        });

        it('should throw error when database is not initialized', async () => {
            const deviceId = 'device-no-db';
            const testDate = new Date('2024-06-15');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Save original insert function
            const originalInsert = jest.mocked(db).insert;

            // Mock database as null
            jest.mocked(db).insert = undefined as any;

            try {
                // Verify error is thrown
                await expect(aggregator.aggregateDeviceMetrics(deviceId, testDate)).rejects.toThrow();
            } finally {
                // Restore original insert function
                jest.mocked(db).insert = originalInsert;
            }
        });
    });

    describe('Date formatting for storage', () => {
        it('should format date as YYYY-MM-DD string', async () => {
            const deviceId = 'device-date-format';
            const testDate = new Date('2024-07-25T15:30:45.123Z');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db).insert = jest.fn().mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            const storedValues = mockValues.mock.calls[0][0];

            // Verify date is formatted correctly
            expect(storedValues.date).toBe('2024-07-25');
            expect(storedValues.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should handle dates at year boundaries correctly', async () => {
            const deviceId = 'device-year-boundary';
            const testDate = new Date('2023-12-31');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db).insert = jest.fn().mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            const storedValues = mockValues.mock.calls[0][0];

            // Verify date is formatted correctly at year boundary
            expect(storedValues.date).toBe('2023-12-31');
        });

        it('should handle dates at month boundaries correctly', async () => {
            const deviceId = 'device-month-boundary';
            const testDate = new Date('2024-02-29'); // Leap year
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db).insert = jest.fn().mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            const storedValues = mockValues.mock.calls[0][0];

            // Verify date is formatted correctly for leap year
            expect(storedValues.date).toBe('2024-02-29');
        });
    });

    describe('Storage operation sequence', () => {
        it('should call database operations in correct order', async () => {
            const deviceId = 'device-sequence';
            const testDate = new Date('2024-08-10');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            const callOrder: string[] = [];

            const mockOnConflictDoUpdate = jest.fn().mockImplementation(() => {
                callOrder.push('onConflictDoUpdate');
                return Promise.resolve(undefined);
            });

            const mockValues = jest.fn().mockImplementation(() => {
                callOrder.push('values');
                return {
                    onConflictDoUpdate: mockOnConflictDoUpdate,
                };
            });

            const mockInsert = jest.fn().mockImplementation(() => {
                callOrder.push('insert');
                return {
                    values: mockValues,
                };
            });

            jest.mocked(db).insert = jest.fn().mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify operations were called in correct order
            expect(callOrder).toEqual(['insert', 'values', 'onConflictDoUpdate']);
        });

        it('should complete storage before returning result', async () => {
            const deviceId = 'device-completion';
            const testDate = new Date('2024-09-05');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            let storageCompleted = false;

            const mockOnConflictDoUpdate = jest.fn().mockImplementation(async () => {
                // Simulate async storage operation
                await new Promise(resolve => setTimeout(resolve, 10));
                storageCompleted = true;
                return undefined;
            });

            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });

            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });

            jest.mocked(db).insert = jest.fn().mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify storage completed before result was returned
            expect(storageCompleted).toBe(true);
            expect(result).toBeDefined();
            expect(result.deviceId).toBe(deviceId);
        });
    });

    describe('Multiple device storage', () => {
        it('should store metrics for multiple devices independently', async () => {
            const device1Id = 'device-multi-1';
            const device2Id = 'device-multi-2';
            const device3Id = 'device-multi-3';
            const testDate = new Date('2024-10-15');
            testDate.setUTCHours(0, 0, 0, 0);

            const mockCounters1 = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            const mockCounters2 = {
                ipsBlocks: 200,
                gavBlocks: 100,
                dpiSslBlocks: 50,
                atpVerdicts: 60,
                appControlBlocks: 20,
                botnetBlocks: 40,
                contentFilterBlocks: 30,
                blockedConnections: 80,
            };

            const mockCounters3 = {
                ipsBlocks: 300,
                gavBlocks: 150,
                dpiSslBlocks: 75,
                atpVerdicts: 90,
                appControlBlocks: 30,
                botnetBlocks: 60,
                contentFilterBlocks: 45,
                blockedConnections: 120,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot)
                .mockResolvedValueOnce(mockCounters1)
                .mockResolvedValueOnce(mockCounters2)
                .mockResolvedValueOnce(mockCounters3);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db).insert = jest.fn().mockReturnValue(mockInsert() as any);

            // Store metrics for all three devices
            await aggregator.aggregateDeviceMetrics(device1Id, testDate);
            await aggregator.aggregateDeviceMetrics(device2Id, testDate);
            await aggregator.aggregateDeviceMetrics(device3Id, testDate);

            // Verify all three inserts were called
            expect(db.insert).toHaveBeenCalledTimes(3);

            // Verify each device has correct values
            expect(mockValues).toHaveBeenNthCalledWith(1, expect.objectContaining({
                deviceId: device1Id,
                threatsBlocked: 200,
            }));

            expect(mockValues).toHaveBeenNthCalledWith(2, expect.objectContaining({
                deviceId: device2Id,
                threatsBlocked: 400,
            }));

            expect(mockValues).toHaveBeenNthCalledWith(3, expect.objectContaining({
                deviceId: device3Id,
                threatsBlocked: 600,
            }));
        });
    });
});
