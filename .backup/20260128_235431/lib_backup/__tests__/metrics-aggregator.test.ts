/**
 * Tests for MetricsAggregator
 * 
 * Validates daily metrics rollup functionality.
 * 
 * Requirements: 9.1-9.8
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

describe('MetricsAggregator', () => {
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

    describe('start() and stop()', () => {
        it('should start the aggregator successfully', async () => {
            await aggregator.start();
            expect(aggregator.isAggregating()).toBe(true);
        });

        it('should not start if already running', async () => {
            await aggregator.start();
            await aggregator.start(); // Second call should be ignored
            expect(aggregator.isAggregating()).toBe(true);
        });

        it('should stop the aggregator successfully', async () => {
            await aggregator.start();
            await aggregator.stop();
            expect(aggregator.isAggregating()).toBe(false);
        });

        it('should not stop if not running', async () => {
            await aggregator.stop(); // Should not throw
            expect(aggregator.isAggregating()).toBe(false);
        });
    });

    describe('aggregateDeviceMetrics()', () => {
        const deviceId = 'device-123';
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        it('should aggregate metrics from daily snapshot (preferred)', async () => {
            // Mock daily snapshot with counter values
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

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Verify calculations
            // threats_blocked = IPS + GAV + ATP + Botnet = 100 + 50 + 30 + 20 = 200
            expect(result.threatsBlocked).toBe(200);
            expect(result.malwareBlocked).toBe(50); // GAV blocks
            expect(result.ipsBlocked).toBe(100); // IPS blocks
            expect(result.webFilterHits).toBe(15); // Content filter blocks
            expect(result.deviceId).toBe(deviceId);
            expect(result.date).toEqual(yesterday);

            // Verify daily snapshot was used
            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalledWith(deviceId, yesterday);
        });

        it('should fall back to polling state if no daily snapshot exists', async () => {
            // Mock no daily snapshot
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(null);

            // Mock polling state with counter values
            const mockState = {
                deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 25,
                    atpVerdicts: 30,
                    appControlBlocks: 10,
                    botnetBlocks: 20,
                    contentFilterBlocks: 15,
                    blockedConnections: 40,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };

            jest.mocked(FirewallPollingStateService.getState).mockResolvedValue(mockState);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Verify calculations
            // threats_blocked = IPS + GAV + ATP + Botnet = 100 + 50 + 30 + 20 = 200
            expect(result.threatsBlocked).toBe(200);
            expect(result.malwareBlocked).toBe(50); // GAV blocks
            expect(result.ipsBlocked).toBe(100); // IPS blocks
            expect(result.webFilterHits).toBe(15); // Content filter blocks
            expect(result.deviceId).toBe(deviceId);
            expect(result.date).toEqual(yesterday);

            // Verify fallback was used
            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalledWith(deviceId, yesterday);
            expect(FirewallPollingStateService.getState).toHaveBeenCalledWith(deviceId);
        });

        it('should handle missing polling state with zero values', async () => {
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(null);
            jest.mocked(FirewallPollingStateService.getState).mockResolvedValue(null);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Should use zero values
            expect(result.threatsBlocked).toBe(0);
            expect(result.malwareBlocked).toBe(0);
            expect(result.ipsBlocked).toBe(0);
            expect(result.webFilterHits).toBe(0);
        });

        it('should handle null counter values', async () => {
            const mockCounters = {
                ipsBlocks: 0,
                gavBlocks: 0,
                dpiSslBlocks: 0,
                atpVerdicts: 0,
                appControlBlocks: 0,
                botnetBlocks: 0,
                contentFilterBlocks: 0,
                blockedConnections: 0,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            expect(result.threatsBlocked).toBe(0);
            expect(result.malwareBlocked).toBe(0);
            expect(result.ipsBlocked).toBe(0);
        });
    });

    describe('runDailyRollup()', () => {
        it('should process all active devices', async () => {
            // Mock active devices
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-2', status: 'active', tenantId: 'tenant-1' },
            ];

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockDevices),
                }),
            });
            jest.mocked(db.select).mockReturnValue(mockSelect() as any);

            // Mock daily snapshot
            const mockCounters = {
                ipsBlocks: 10,
                gavBlocks: 5,
                dpiSslBlocks: 2,
                atpVerdicts: 3,
                appControlBlocks: 1,
                botnetBlocks: 2,
                contentFilterBlocks: 1,
                blockedConnections: 8,
            };
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Mock database delete for cleanup
            const mockDelete = jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue({ rowCount: 0 }),
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            await aggregator.runDailyRollup();

            // Verify devices were processed
            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalledTimes(2);
        });

        it('should handle no active devices', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([]),
                }),
            });
            jest.mocked(db.select).mockReturnValue(mockSelect() as any);

            await aggregator.runDailyRollup();

            // Should not throw and should not call getDailySnapshot
            expect(FirewallPollingStateService.getDailySnapshot).not.toHaveBeenCalled();
        });

        it('should continue processing if one device fails', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-2', status: 'active', tenantId: 'tenant-1' },
            ];

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockDevices),
                }),
            });
            jest.mocked(db.select).mockReturnValue(mockSelect() as any);

            // First device fails, second succeeds
            jest.mocked(FirewallPollingStateService.getDailySnapshot)
                .mockRejectedValueOnce(new Error('Redis error'))
                .mockResolvedValueOnce({
                    ipsBlocks: 10,
                    gavBlocks: 5,
                    dpiSslBlocks: 2,
                    atpVerdicts: 3,
                    appControlBlocks: 1,
                    botnetBlocks: 2,
                    contentFilterBlocks: 1,
                    blockedConnections: 8,
                });

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Mock database delete for cleanup
            const mockDelete = jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue({ rowCount: 0 }),
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            await aggregator.runDailyRollup();

            // Should have attempted both devices
            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalledTimes(2);
        });
    });

    describe('manualRollup()', () => {
        it('should run rollup for specified date', async () => {
            const customDate = new Date('2024-01-15');
            customDate.setUTCHours(0, 0, 0, 0);

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
                ipsBlocks: 10,
                gavBlocks: 5,
                dpiSslBlocks: 2,
                atpVerdicts: 3,
                appControlBlocks: 1,
                botnetBlocks: 2,
                contentFilterBlocks: 1,
                blockedConnections: 8,
            };
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.manualRollup(customDate);

            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalled();
        });

        it('should default to yesterday if no date provided', async () => {
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
                ipsBlocks: 10,
                gavBlocks: 5,
                dpiSslBlocks: 2,
                atpVerdicts: 3,
                appControlBlocks: 1,
                botnetBlocks: 2,
                contentFilterBlocks: 1,
                blockedConnections: 8,
            };
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            await aggregator.manualRollup();

            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalled();
        });
    });

    describe('Daily snapshot retrieval', () => {
        it('should retrieve counter values from previous day snapshot', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // Mock daily snapshot from end of previous day
            const mockCounters = {
                ipsBlocks: 150,
                gavBlocks: 75,
                dpiSslBlocks: 30,
                atpVerdicts: 45,
                appControlBlocks: 15,
                botnetBlocks: 25,
                contentFilterBlocks: 20,
                blockedConnections: 60,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Verify we used the snapshot from the previous day
            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalledWith(deviceId, yesterday);
            expect(result.ipsBlocked).toBe(150);
            expect(result.malwareBlocked).toBe(75);
            expect(result.threatsBlocked).toBe(295); // 150 + 75 + 45 + 25
        });
    });

    describe('Requirements validation', () => {
        it('should use final cumulative counter values (Requirement 9.2)', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // Mock daily snapshot with specific counter values
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

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Verify we're using the exact counter values, not summing increments
            expect(result.ipsBlocked).toBe(100);
            expect(result.malwareBlocked).toBe(50);
            expect(result.webFilterHits).toBe(15);
        });

        it('should calculate threats_blocked correctly (Requirement 9.3)', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

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

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // threats_blocked = IPS + GAV + ATP + Botnet
            // = 100 + 50 + 30 + 20 = 200
            expect(result.threatsBlocked).toBe(200);
        });

        it('should store blocked_connections count (Requirement 9.4)', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 75,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Verify blocked_connections is stored correctly
            expect(result.blockedConnections).toBe(75);
        });

        it('should store active_sessions_count (Requirement 9.5)', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 75,
                activeSessionsCount: 250, // Active sessions count from API
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Verify active_sessions_count is stored correctly
            expect(result.activeSessionsCount).toBe(250);
        });

        it('should handle missing active_sessions_count with zero value', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 75,
                // activeSessionsCount is missing
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Verify active_sessions_count defaults to 0 when missing
            expect(result.activeSessionsCount).toBe(0);
        });

        it('should store bandwidth_total_mb (Requirement 9.4)', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                dpiSslBlocks: 25,
                atpVerdicts: 30,
                appControlBlocks: 10,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 75,
                bandwidthTotalMb: 5000, // Bandwidth from API
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // Verify bandwidth_total_mb is stored correctly
            expect(result.bandwidthTotalMb).toBe(5000);
        });
    });
});
