/**
 * Tests for MetricsAggregator UPSERT functionality
 * 
 * Validates that duplicate dates are handled correctly using UPSERT.
 * 
 * Requirements: Task 7.3 - Handle duplicate dates (UPSERT)
 */

import { MetricsAggregator } from '../metrics-aggregator';
import { db } from '../database';
import { firewallDevices, firewallMetricsRollup } from '../../../database/schemas/firewall';
import { eq, and } from 'drizzle-orm';
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

describe('MetricsAggregator - UPSERT functionality', () => {
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

    describe('Handle duplicate dates (UPSERT)', () => {
        const deviceId = 'device-123';
        const testDate = new Date('2024-01-15');
        testDate.setUTCHours(0, 0, 0, 0);

        it('should insert new metrics rollup when no existing record', async () => {
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

            // Mock database insert with onConflictDoUpdate
            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify insert was called
            expect(db.insert).toHaveBeenCalledWith(firewallMetricsRollup);

            // Verify values were set correctly
            expect(mockValues).toHaveBeenCalledWith({
                deviceId,
                date: '2024-01-15',
                threatsBlocked: 200, // 100 + 50 + 30 + 20
                malwareBlocked: 50,
                ipsBlocked: 100,
                blockedConnections: 40,
                webFilterHits: 15,
                bandwidthTotalMb: 0,
                activeSessionsCount: 0,
            });

            // Verify onConflictDoUpdate was called with correct target and set
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: {
                    threatsBlocked: 200,
                    malwareBlocked: 50,
                    ipsBlocked: 100,
                    blockedConnections: 40,
                    webFilterHits: 15,
                    bandwidthTotalMb: 0,
                    activeSessionsCount: 0,
                },
            });
        });

        it('should update existing metrics rollup when duplicate date exists', async () => {
            // First run with initial values
            const initialCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(initialCounters);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Clear mocks for second run
            jest.clearAllMocks();

            // Second run with updated values (simulating re-run for same date)
            const updatedCounters = {
                ipsBlocks: 150, // Increased
                gavBlocks: 75,  // Increased
                dpiSslBlocks: 30,
                atpVerdicts: 45, // Increased
                appControlBlocks: 15,
                botnetBlocks: 30, // Increased
                contentFilterBlocks: 20,
                blockedConnections: 60, // Increased
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(updatedCounters);

            const mockOnConflictDoUpdate2 = jest.fn().mockResolvedValue(undefined);
            const mockValues2 = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate2,
            });
            const mockInsert2 = jest.fn().mockReturnValue({
                values: mockValues2,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert2() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify insert was called again
            expect(db.insert).toHaveBeenCalledWith(firewallMetricsRollup);

            // Verify updated values were set
            expect(mockValues2).toHaveBeenCalledWith({
                deviceId,
                date: '2024-01-15',
                threatsBlocked: 300, // 150 + 75 + 45 + 30
                malwareBlocked: 75,
                ipsBlocked: 150,
                blockedConnections: 60,
                webFilterHits: 20,
                bandwidthTotalMb: 0,
                activeSessionsCount: 0,
            });

            // Verify onConflictDoUpdate was called with updated values
            expect(mockOnConflictDoUpdate2).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: {
                    threatsBlocked: 300,
                    malwareBlocked: 75,
                    ipsBlocked: 150,
                    blockedConnections: 60,
                    webFilterHits: 20,
                    bandwidthTotalMb: 0,
                    activeSessionsCount: 0,
                },
            });
        });

        it('should handle multiple devices with same date', async () => {
            const device1Id = 'device-1';
            const device2Id = 'device-2';

            const counters1 = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            const counters2 = {
                ipsBlocks: 200,
                gavBlocks: 100,
                dpiSslBlocks: 50,
                atpVerdicts: 60,
                appControlBlocks: 20,
                botnetBlocks: 40,
                contentFilterBlocks: 30,
                blockedConnections: 80,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot)
                .mockResolvedValueOnce(counters1)
                .mockResolvedValueOnce(counters2);

            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Aggregate for device 1
            await aggregator.aggregateDeviceMetrics(device1Id, testDate);

            // Aggregate for device 2 (same date, different device)
            await aggregator.aggregateDeviceMetrics(device2Id, testDate);

            // Verify both inserts were called
            expect(db.insert).toHaveBeenCalledTimes(2);

            // Verify first device values
            expect(mockValues).toHaveBeenNthCalledWith(1, {
                deviceId: device1Id,
                date: '2024-01-15',
                threatsBlocked: 200, // 100 + 50 + 30 + 20
                malwareBlocked: 50,
                ipsBlocked: 100,
                blockedConnections: 40,
                webFilterHits: 15,
                bandwidthTotalMb: 0,
                activeSessionsCount: 0,
            });

            // Verify second device values
            expect(mockValues).toHaveBeenNthCalledWith(2, {
                deviceId: device2Id,
                date: '2024-01-15',
                threatsBlocked: 400, // 200 + 100 + 60 + 40
                malwareBlocked: 100,
                ipsBlocked: 200,
                blockedConnections: 80,
                webFilterHits: 30,
                bandwidthTotalMb: 0,
                activeSessionsCount: 0,
            });

            // Verify unique constraint target includes both deviceId and date
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                })
            );
        });

        it('should preserve unique constraint on (device_id, date)', async () => {
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

            // Verify the unique constraint target is correctly specified
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.any(Object),
            });
        });

        it('should update all metric fields on conflict', async () => {
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

            // Verify all fields are included in the set clause
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: {
                    threatsBlocked: 200,
                    malwareBlocked: 50,
                    ipsBlocked: 100,
                    blockedConnections: 40,
                    webFilterHits: 15,
                    bandwidthTotalMb: 5000,
                    activeSessionsCount: 250,
                },
            });
        });

        it('should handle manual rollup with duplicate dates', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
            ];

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockDevices),
                }),
            });
            jest.mocked(db.select).mockReturnValue(mockSelect() as any);

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

            // Run manual rollup for same date twice
            await aggregator.manualRollup(testDate);

            jest.clearAllMocks();

            // Mock again for second run
            jest.mocked(db.select).mockReturnValue(mockSelect() as any);
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.manualRollup(testDate);

            // Verify UPSERT was used both times
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.any(Object),
            });
        });
    });

    describe('Date formatting', () => {
        it('should format date as YYYY-MM-DD for database', async () => {
            const deviceId = 'device-123';
            const testDate = new Date('2024-03-15T14:30:00Z');
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

            // Verify date is formatted correctly
            expect(mockValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    date: '2024-03-15',
                })
            );
        });
    });
});
