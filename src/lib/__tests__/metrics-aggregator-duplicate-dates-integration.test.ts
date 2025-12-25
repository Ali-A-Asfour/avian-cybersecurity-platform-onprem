/**
 * Tests for MetricsAggregator duplicate date handling
 * 
 * Validates that duplicate dates are handled correctly using UPSERT logic.
 * Tests verify that when the same device and date combination is processed
 * multiple times, the metrics are updated rather than creating duplicate records.
 * 
 * Requirements: Task 7.5 - Test duplicate date handling
 */

import { MetricsAggregator } from '../metrics-aggregator';
import { db } from '../database';
import { firewallDevices, firewallMetricsRollup } from '../../../database/schemas/firewall';
import { eq } from 'drizzle-orm';
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

describe('MetricsAggregator - Duplicate Date Handling', () => {
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

    describe('Duplicate date handling with UPSERT', () => {
        const deviceId = 'device-123';
        const testDate = new Date('2024-01-15');
        testDate.setUTCHours(0, 0, 0, 0);

        it('should use UPSERT to handle duplicate dates', async () => {
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

            // Verify UPSERT was used with correct target
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.objectContaining({
                    threatsBlocked: 200,
                    malwareBlocked: 50,
                    ipsBlocked: 100,
                }),
            });
        });

        it('should update metrics when processing same date twice', async () => {
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
                ipsBlocks: 150,
                gavBlocks: 75,
                dpiSslBlocks: 30,
                atpVerdicts: 45,
                appControlBlocks: 15,
                botnetBlocks: 30,
                contentFilterBlocks: 20,
                blockedConnections: 60,
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

            // Verify UPSERT was called with updated values
            expect(mockOnConflictDoUpdate2).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.objectContaining({
                    threatsBlocked: 300, // 150 + 75 + 45 + 30
                    malwareBlocked: 75,
                    ipsBlocked: 150,
                    blockedConnections: 60,
                    webFilterHits: 20,
                }),
            });
        });

        it('should handle multiple updates to same date', async () => {
            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // First update
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue({
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            });

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Second update
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue({
                ipsBlocks: 150,
                gavBlocks: 75,
                dpiSslBlocks: 30,
                atpVerdicts: 45,
                appControlBlocks: 15,
                botnetBlocks: 30,
                contentFilterBlocks: 20,
                blockedConnections: 60,
            });

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Third update
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue({
                ipsBlocks: 200,
                gavBlocks: 100,
                dpiSslBlocks: 40,
                atpVerdicts: 60,
                appControlBlocks: 20,
                botnetBlocks: 40,
                contentFilterBlocks: 25,
                blockedConnections: 80,
            });

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify UPSERT was called 3 times (once for each update)
            expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(3);

            // Verify final call had correct values
            expect(mockOnConflictDoUpdate).toHaveBeenLastCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.objectContaining({
                    threatsBlocked: 400, // 200 + 100 + 60 + 40
                    malwareBlocked: 100,
                    ipsBlocked: 200,
                    blockedConnections: 80,
                    webFilterHits: 25,
                }),
            });
        });

        it('should target unique constraint on (device_id, date)', async () => {
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

        it('should allow same date for different devices', async () => {
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

            // Aggregate for both devices with same date
            await aggregator.aggregateDeviceMetrics(device1Id, testDate);
            await aggregator.aggregateDeviceMetrics(device2Id, testDate);

            // Verify both inserts were called
            expect(db.insert).toHaveBeenCalledTimes(2);

            // Verify first device values
            expect(mockValues).toHaveBeenNthCalledWith(1, expect.objectContaining({
                deviceId: device1Id,
                threatsBlocked: 200,
            }));

            // Verify second device values
            expect(mockValues).toHaveBeenNthCalledWith(2, expect.objectContaining({
                deviceId: device2Id,
                threatsBlocked: 400,
            }));
        });

        it('should update all metric fields on duplicate date', async () => {
            const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
            const mockValues = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate,
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockValues,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // First insert
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue({
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
                bandwidthTotalMb: 1000,
                activeSessionsCount: 100,
            });

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            jest.clearAllMocks();

            // Second insert with all fields changed
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue({
                ipsBlocks: 200,
                gavBlocks: 100,
                dpiSslBlocks: 50,
                atpVerdicts: 60,
                appControlBlocks: 20,
                botnetBlocks: 40,
                contentFilterBlocks: 30,
                blockedConnections: 80,
                bandwidthTotalMb: 5000,
                activeSessionsCount: 250,
            });

            const mockOnConflictDoUpdate2 = jest.fn().mockResolvedValue(undefined);
            const mockValues2 = jest.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflictDoUpdate2,
            });
            const mockInsert2 = jest.fn().mockReturnValue({
                values: mockValues2,
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert2() as any);

            await aggregator.aggregateDeviceMetrics(deviceId, testDate);

            // Verify all fields are included in the set clause
            expect(mockOnConflictDoUpdate2).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: {
                    threatsBlocked: 400,
                    malwareBlocked: 100,
                    ipsBlocked: 200,
                    blockedConnections: 80,
                    webFilterHits: 30,
                    bandwidthTotalMb: 5000,
                    activeSessionsCount: 250,
                },
            });
        });
    });

    describe('Manual rollup with duplicate dates', () => {
        const testDate = new Date('2024-02-20');
        testDate.setUTCHours(0, 0, 0, 0);

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

            // Run manual rollup first time
            await aggregator.manualRollup(testDate);

            jest.clearAllMocks();

            // Update counters
            const updatedCounters = {
                ipsBlocks: 150,
                gavBlocks: 75,
                dpiSslBlocks: 30,
                atpVerdicts: 45,
                appControlBlocks: 15,
                botnetBlocks: 30,
                contentFilterBlocks: 20,
                blockedConnections: 60,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(updatedCounters);

            // Mock again for second run
            jest.mocked(db.select).mockReturnValue(mockSelect() as any);
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Run manual rollup second time for same date
            await aggregator.manualRollup(testDate);

            // Verify UPSERT was used both times
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
                target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                set: expect.objectContaining({
                    threatsBlocked: 300,
                    malwareBlocked: 75,
                    ipsBlocked: 150,
                }),
            });
        });
    });

    describe('Date formatting for duplicate detection', () => {
        it('should format date consistently as YYYY-MM-DD', async () => {
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

            // Verify date is formatted correctly for duplicate detection
            expect(mockValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    date: '2024-03-15',
                })
            );
        });
    });
});
