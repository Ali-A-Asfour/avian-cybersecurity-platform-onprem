/**
 * Comprehensive tests for daily rollup calculation
 * 
 * Tests the complete flow of daily metrics rollup including:
 * - Counter retrieval from previous day
 * - Metrics calculation
 * - Database storage
 * - Error handling
 * 
 * Requirements: 9.1-9.8
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

describe('MetricsAggregator - Daily Rollup Calculation', () => {
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

    describe('Complete daily rollup flow', () => {
        it('should calculate rollup for single device with all counters', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // Mock final counter values from previous day
            const mockCounters = {
                ipsBlocks: 250,
                gavBlocks: 180,
                dpiSslBlocks: 45,
                atpVerdicts: 95,
                appControlBlocks: 30,
                botnetBlocks: 65,
                contentFilterBlocks: 120,
                blockedConnections: 340,
                bandwidthTotalMb: 8500,
                activeSessionsCount: 450,
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

            // Verify all calculations
            expect(result.deviceId).toBe(deviceId);
            expect(result.date).toEqual(yesterday);

            // threats_blocked = IPS + GAV + ATP + Botnet = 250 + 180 + 95 + 65 = 590
            expect(result.threatsBlocked).toBe(590);

            // Individual counters
            expect(result.malwareBlocked).toBe(180); // GAV blocks
            expect(result.ipsBlocked).toBe(250); // IPS blocks
            expect(result.webFilterHits).toBe(120); // Content filter blocks
            expect(result.blockedConnections).toBe(340);
            expect(result.bandwidthTotalMb).toBe(8500);
            expect(result.activeSessionsCount).toBe(450);

            // Verify database insert was called with correct values
            expect(db.insert).toHaveBeenCalledWith(firewallMetricsRollup);
        });

        it('should calculate rollup for multiple devices', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-2', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-3', status: 'active', tenantId: 'tenant-2' },
            ];

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockDevices),
                }),
            });
            jest.mocked(db.select).mockReturnValue(mockSelect() as any);

            // Mock different counter values for each device
            const mockCounters1 = {
                ipsBlocks: 100,
                gavBlocks: 50,
                atpVerdicts: 30,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            const mockCounters2 = {
                ipsBlocks: 200,
                gavBlocks: 100,
                atpVerdicts: 60,
                botnetBlocks: 40,
                contentFilterBlocks: 30,
                blockedConnections: 80,
            };

            const mockCounters3 = {
                ipsBlocks: 150,
                gavBlocks: 75,
                atpVerdicts: 45,
                botnetBlocks: 30,
                contentFilterBlocks: 22,
                blockedConnections: 60,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot)
                .mockResolvedValueOnce(mockCounters1)
                .mockResolvedValueOnce(mockCounters2)
                .mockResolvedValueOnce(mockCounters3);

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

            // Verify all devices were processed
            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalledTimes(3);
            expect(db.insert).toHaveBeenCalledTimes(3);
        });

        it('should use final cumulative counter values, not increments', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // These are final cumulative values from SonicWall at end of day
            // NOT calculated by summing increments throughout the day
            const mockCounters = {
                ipsBlocks: 1500, // Final cumulative value
                gavBlocks: 800,  // Final cumulative value
                atpVerdicts: 450, // Final cumulative value
                botnetBlocks: 300, // Final cumulative value
                contentFilterBlocks: 200,
                blockedConnections: 500,
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

            // Verify we're using the exact final values from SonicWall
            expect(result.ipsBlocked).toBe(1500);
            expect(result.malwareBlocked).toBe(800);

            // threats_blocked uses final cumulative values
            // = 1500 + 800 + 450 + 300 = 3050
            expect(result.threatsBlocked).toBe(3050);
        });

        it('should handle zero counter values correctly', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // Device with no activity
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

            // Mock database insert
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const result = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

            // All values should be zero
            expect(result.threatsBlocked).toBe(0);
            expect(result.malwareBlocked).toBe(0);
            expect(result.ipsBlocked).toBe(0);
            expect(result.webFilterHits).toBe(0);
            expect(result.blockedConnections).toBe(0);
            expect(result.bandwidthTotalMb).toBe(0);
            expect(result.activeSessionsCount).toBe(0);
        });

        it('should handle partial counter data', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // Some counters present, others missing
            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                // atpVerdicts missing
                // botnetBlocks missing
                contentFilterBlocks: 15,
                blockedConnections: 40,
                // bandwidthTotalMb missing
                // activeSessionsCount missing
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

            // threats_blocked = IPS + GAV + ATP + Botnet = 100 + 50 + 0 + 0 = 150
            expect(result.threatsBlocked).toBe(150);
            expect(result.malwareBlocked).toBe(50);
            expect(result.ipsBlocked).toBe(100);
            expect(result.webFilterHits).toBe(15);
            expect(result.blockedConnections).toBe(40);
            expect(result.bandwidthTotalMb).toBe(0); // Missing values default to 0
            expect(result.activeSessionsCount).toBe(0);
        });
    });

    describe('Date handling', () => {
        it('should calculate rollup for previous day at midnight UTC', async () => {
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
                atpVerdicts: 30,
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

            // Mock database delete for cleanup
            const mockDelete = jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue({ rowCount: 0 }),
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            await aggregator.runDailyRollup();

            // Verify getDailySnapshot was called with yesterday's date
            const callArgs = jest.mocked(FirewallPollingStateService.getDailySnapshot).mock.calls[0];
            const dateArg = callArgs[1] as Date;

            // Should be yesterday at midnight UTC
            expect(dateArg.getUTCHours()).toBe(0);
            expect(dateArg.getUTCMinutes()).toBe(0);
            expect(dateArg.getUTCSeconds()).toBe(0);
            expect(dateArg.getUTCMilliseconds()).toBe(0);

            // Should be one day before today
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);

            expect(dateArg.getTime()).toBe(yesterday.getTime());
        });

        it('should support manual rollup for specific date', async () => {
            const customDate = new Date('2024-01-15T00:00:00Z');

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
                atpVerdicts: 30,
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

            await aggregator.manualRollup(customDate);

            // Verify getDailySnapshot was called with the custom date
            const callArgs = jest.mocked(FirewallPollingStateService.getDailySnapshot).mock.calls[0];
            const dateArg = callArgs[1] as Date;

            expect(dateArg.getTime()).toBe(customDate.getTime());
        });
    });

    describe('Error handling', () => {
        it('should continue processing other devices if one fails', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-2', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-3', status: 'active', tenantId: 'tenant-1' },
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
                atpVerdicts: 30,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            // First device fails, second succeeds, third succeeds
            jest.mocked(FirewallPollingStateService.getDailySnapshot)
                .mockRejectedValueOnce(new Error('Redis connection failed'))
                .mockResolvedValueOnce(mockCounters)
                .mockResolvedValueOnce(mockCounters);

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

            // Should have attempted all 3 devices
            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalledTimes(3);

            // Should have successfully inserted 2 rollups (device-2 and device-3)
            expect(db.insert).toHaveBeenCalledTimes(2);
        });

        it('should handle database insert failures gracefully', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                atpVerdicts: 30,
                botnetBlocks: 20,
                contentFilterBlocks: 15,
                blockedConnections: 40,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(mockCounters);

            // Mock database insert failure
            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockRejectedValue(new Error('Database error')),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Should throw error
            await expect(aggregator.aggregateDeviceMetrics(deviceId, yesterday)).rejects.toThrow('Database error');
        });

        it('should handle missing daily snapshot by falling back to polling state', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // No daily snapshot available
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(null);

            // But polling state is available
            const mockState = {
                deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    atpVerdicts: 30,
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

            // Should use polling state counters
            expect(result.ipsBlocked).toBe(100);
            expect(result.malwareBlocked).toBe(50);
            expect(result.threatsBlocked).toBe(200); // 100 + 50 + 30 + 20
        });

        it('should use zero values when both snapshot and polling state are missing', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // No daily snapshot
            jest.mocked(FirewallPollingStateService.getDailySnapshot).mockResolvedValue(null);

            // No polling state
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
            expect(result.blockedConnections).toBe(0);
        });
    });

    describe('Requirements validation', () => {
        it('should meet Requirement 9.1: Create rollup at midnight UTC for previous day', async () => {
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
                atpVerdicts: 30,
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

            // Mock database delete for cleanup
            const mockDelete = jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue({ rowCount: 0 }),
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            await aggregator.runDailyRollup();

            // Verify date is previous day at midnight UTC
            const callArgs = jest.mocked(FirewallPollingStateService.getDailySnapshot).mock.calls[0];
            const dateArg = callArgs[1] as Date;

            expect(dateArg.getUTCHours()).toBe(0);
            expect(dateArg.getUTCMinutes()).toBe(0);
            expect(dateArg.getUTCSeconds()).toBe(0);
        });

        it('should meet Requirement 9.2: Use final cumulative counter from SonicWall', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // Final cumulative values from SonicWall (NOT summed increments)
            const mockCounters = {
                ipsBlocks: 2500,
                gavBlocks: 1800,
                atpVerdicts: 950,
                botnetBlocks: 650,
                contentFilterBlocks: 400,
                blockedConnections: 1200,
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

            // Verify we use exact final values, not calculated sums
            expect(result.ipsBlocked).toBe(2500);
            expect(result.malwareBlocked).toBe(1800);
        });

        it('should meet Requirement 9.3: Calculate threats_blocked correctly', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 500,
                gavBlocks: 300,
                atpVerdicts: 200,
                botnetBlocks: 150,
                contentFilterBlocks: 100,
                blockedConnections: 250,
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
            // = 500 + 300 + 200 + 150 = 1150
            expect(result.threatsBlocked).toBe(1150);
        });

        it('should meet Requirement 9.4: Store all required metrics', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            const mockCounters = {
                ipsBlocks: 500,
                gavBlocks: 300,
                atpVerdicts: 200,
                botnetBlocks: 150,
                contentFilterBlocks: 100,
                blockedConnections: 250,
                bandwidthTotalMb: 12000,
                activeSessionsCount: 600,
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

            // Verify all required metrics are stored
            expect(result.threatsBlocked).toBe(1150); // IPS + GAV + ATP + Botnet
            expect(result.malwareBlocked).toBe(300); // GAV blocks
            expect(result.ipsBlocked).toBe(500); // IPS blocks
            expect(result.blockedConnections).toBe(250); // Total denied connections
            expect(result.webFilterHits).toBe(100); // Content filter blocks
            expect(result.bandwidthTotalMb).toBe(12000); // Bandwidth if available
            expect(result.activeSessionsCount).toBe(600); // Active sessions
        });

        it('should meet Requirement 9.6: Associate rollup with device_id and date', async () => {
            const deviceId = 'device-123';
            const yesterday = new Date('2024-01-15T00:00:00Z');

            const mockCounters = {
                ipsBlocks: 100,
                gavBlocks: 50,
                atpVerdicts: 30,
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

            // Verify association
            expect(result.deviceId).toBe(deviceId);
            expect(result.date).toEqual(yesterday);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle realistic daily rollup with mixed device states', async () => {
            const mockDevices = [
                { id: 'device-high-traffic', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-low-traffic', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-no-traffic', status: 'active', tenantId: 'tenant-2' },
            ];

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockDevices),
                }),
            });
            jest.mocked(db.select).mockReturnValue(mockSelect() as any);

            // High traffic device
            const highTrafficCounters = {
                ipsBlocks: 5000,
                gavBlocks: 3000,
                atpVerdicts: 1500,
                botnetBlocks: 1000,
                contentFilterBlocks: 800,
                blockedConnections: 2500,
                bandwidthTotalMb: 50000,
                activeSessionsCount: 1200,
            };

            // Low traffic device
            const lowTrafficCounters = {
                ipsBlocks: 50,
                gavBlocks: 30,
                atpVerdicts: 15,
                botnetBlocks: 10,
                contentFilterBlocks: 8,
                blockedConnections: 25,
                bandwidthTotalMb: 500,
                activeSessionsCount: 50,
            };

            // No traffic device
            const noTrafficCounters = {
                ipsBlocks: 0,
                gavBlocks: 0,
                atpVerdicts: 0,
                botnetBlocks: 0,
                contentFilterBlocks: 0,
                blockedConnections: 0,
                bandwidthTotalMb: 0,
                activeSessionsCount: 0,
            };

            jest.mocked(FirewallPollingStateService.getDailySnapshot)
                .mockResolvedValueOnce(highTrafficCounters)
                .mockResolvedValueOnce(lowTrafficCounters)
                .mockResolvedValueOnce(noTrafficCounters);

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

            // Verify all devices were processed
            expect(FirewallPollingStateService.getDailySnapshot).toHaveBeenCalledTimes(3);
            expect(db.insert).toHaveBeenCalledTimes(3);
        });
    });
});
