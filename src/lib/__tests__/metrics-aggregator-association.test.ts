/**
 * Tests for MetricsAggregator device_id and date association
 * 
 * Validates that metrics are correctly associated with device_id and date,
 * and that the unique constraint is properly enforced.
 * 
 * Requirements: Task 7.3 - Associate with device_id and date, Verify unique constraint
 */

import { MetricsAggregator } from '../metrics-aggregator';
import { db } from '../database';
import { firewallDevices, firewallMetricsRollup } from '../../../database/schemas/firewall';
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

describe('MetricsAggregator - Device ID and Date Association', () => {
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

    describe('Associate with device_id and date', () => {
        it('should store metrics with correct device_id', async () => {
            const deviceId = 'device-abc-123';
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

            // Verify device_id is included in the values
            expect(mockValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    deviceId: 'device-abc-123',
                })
            );
        });

        it('should store metrics with correct date', async () => {
            const deviceId = 'device-123';
            const testDate = new Date('2024-03-20');
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
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify date is included in the values and formatted correctly
            expect(mockValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    date: '2024-03-20',
                })
            );
        });

        it('should store metrics with both device_id and date', async () => {
            const deviceId = 'device-xyz-789';
            const testDate = new Date('2024-02-14');
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
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify both device_id and date are included
            expect(mockValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    deviceId: 'device-xyz-789',
                    date: '2024-02-14',
                })
            );
        });

        it('should maintain device_id and date association across multiple metrics', async () => {
            const deviceId = 'device-multi-test';
            const testDate = new Date('2024-01-10');
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

            // Verify all metrics are stored with the same device_id and date
            expect(mockValues).toHaveBeenCalledWith({
                deviceId: 'device-multi-test',
                date: '2024-01-10',
                threatsBlocked: 200,
                malwareBlocked: 50,
                ipsBlocked: 100,
                blockedConnections: 40,
                webFilterHits: 15,
                bandwidthTotalMb: 5000,
                activeSessionsCount: 250,
            });
        });
    });

    describe('Verify unique constraint (device_id, date)', () => {
        it('should use device_id and date as conflict target', async () => {
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

            // Verify the unique constraint target includes both deviceId and date
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.any(Object),
            });
        });

        it('should enforce uniqueness on (device_id, date) combination', async () => {
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

            // Verify the constraint uses the schema column references
            const callArgs = mockOnConflictDoUpdate.mock.calls[0][0];
            expect(callArgs.target).toHaveLength(2);
            expect(callArgs.target[0]).toBe(firewallMetricsRollup.deviceId);
            expect(callArgs.target[1]).toBe(firewallMetricsRollup.date);
        });

        it('should allow same date for different devices', async () => {
            const device1Id = 'device-1';
            const device2Id = 'device-2';
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

            // Store metrics for device 1
            await aggregator.aggregateDeviceMetrics(device1Id, testDate);

            // Store metrics for device 2 with same date
            await aggregator.aggregateDeviceMetrics(device2Id, testDate);

            // Verify both inserts were called with different device_ids but same date
            expect(mockValues).toHaveBeenNthCalledWith(1, expect.objectContaining({
                deviceId: 'device-1',
                date: '2024-01-15',
            }));

            expect(mockValues).toHaveBeenNthCalledWith(2, expect.objectContaining({
                deviceId: 'device-2',
                date: '2024-01-15',
            }));
        });

        it('should allow same device for different dates', async () => {
            const deviceId = 'device-123';
            const date1 = new Date('2024-01-15');
            date1.setUTCHours(0, 0, 0, 0);
            const date2 = new Date('2024-01-16');
            date2.setUTCHours(0, 0, 0, 0);

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
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Store metrics for date 1
            await aggregator.aggregateDeviceMetrics(deviceId, date1);

            // Store metrics for date 2
            await aggregator.aggregateDeviceMetrics(deviceId, date2);

            // Verify both inserts were called with same device_id but different dates
            expect(mockValues).toHaveBeenNthCalledWith(1, expect.objectContaining({
                deviceId: 'device-123',
                date: '2024-01-15',
            }));

            expect(mockValues).toHaveBeenNthCalledWith(2, expect.objectContaining({
                deviceId: 'device-123',
                date: '2024-01-16',
            }));
        });

        it('should prevent duplicate (device_id, date) through UPSERT', async () => {
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

            // Store metrics twice for same device and date
            await aggregator.aggregateDeviceMetrics(deviceId, testDate);
            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify UPSERT was used both times (no error thrown)
            expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(2);

            // Verify the target is the same for both calls
            expect(mockOnConflictDoUpdate).toHaveBeenNthCalledWith(1, {
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.any(Object),
            });

            expect(mockOnConflictDoUpdate).toHaveBeenNthCalledWith(2, {
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.any(Object),
            });
        });
    });
});
