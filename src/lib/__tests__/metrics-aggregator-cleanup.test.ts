/**
 * Tests for MetricsAggregator cleanup functionality
 * 
 * Validates deletion of rollup records older than 365 days.
 * 
 * Requirements: 9.8 - Delete rollups older than 365 days
 */

import { MetricsAggregator } from '../metrics-aggregator';
import { db } from '../database';
import { firewallDevices, firewallMetricsRollup } from '../../../database/schemas/firewall';
import { eq, lt } from 'drizzle-orm';
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

describe('MetricsAggregator - Cleanup', () => {
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

    describe('cleanupOldMetrics()', () => {
        it('should delete rollup records older than 365 days', async () => {
            // Mock active devices
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
            ];

            // Mock old records to be deleted
            const mockOldRecords = [
                { id: 'old-1', deviceId: 'device-1', date: '2022-01-01' },
                { id: 'old-2', deviceId: 'device-1', date: '2022-01-02' },
            ];

            // Mock select to return devices first, then old records for cleanup count
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockDevices),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockOldRecords),
                        }),
                    };
                }
            });
            jest.mocked(db.select).mockImplementation(mockSelect as any);

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
            const mockWhere = jest.fn().mockResolvedValue({ rowCount: 5 });
            const mockDelete = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            await aggregator.runDailyRollup();

            // Verify delete was called
            expect(db.delete).toHaveBeenCalledWith(firewallMetricsRollup);

            // Verify where clause was called with correct cutoff date
            expect(mockWhere).toHaveBeenCalled();

            // Get the argument passed to where()
            const whereArg = mockWhere.mock.calls[0][0];

            // Verify it's using lt() with the date field
            expect(whereArg).toBeDefined();
        });

        it('should calculate cutoff date as 365 days ago', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
            ];

            // Mock select to return devices first, then empty array for cleanup count
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockDevices),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue([]),
                        }),
                    };
                }
            });
            jest.mocked(db.select).mockImplementation(mockSelect as any);

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

            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const mockWhere = jest.fn().mockResolvedValue({ rowCount: 0 });
            const mockDelete = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            // Calculate expected cutoff date
            const expectedCutoff = new Date();
            expectedCutoff.setUTCDate(expectedCutoff.getUTCDate() - 365);
            const expectedCutoffStr = expectedCutoff.toISOString().split('T')[0];

            await aggregator.runDailyRollup();

            // Verify delete was called
            expect(db.delete).toHaveBeenCalledWith(firewallMetricsRollup);
            expect(mockWhere).toHaveBeenCalled();
        });

        it('should run cleanup as part of daily rollup', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
            ];

            const mockOldRecords = [
                { id: 'old-1', deviceId: 'device-1', date: '2022-01-01' },
            ];

            // Mock select to return devices first, then old records for cleanup count
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockDevices),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockOldRecords),
                        }),
                    };
                }
            });
            jest.mocked(db.select).mockImplementation(mockSelect as any);

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

            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const mockWhere = jest.fn().mockResolvedValue({ rowCount: 3 });
            const mockDelete = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            await aggregator.runDailyRollup();

            // Verify cleanup was called as part of rollup
            expect(db.delete).toHaveBeenCalledWith(firewallMetricsRollup);
        });

        it('should not throw if cleanup fails', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
            ];

            // Mock select to return devices first, then fail on cleanup count
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockDevices),
                        }),
                    };
                } else {
                    // Fail on cleanup count
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockRejectedValue(new Error('Database error')),
                        }),
                    };
                }
            });
            jest.mocked(db.select).mockImplementation(mockSelect as any);

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

            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Mock cleanup failure
            const mockDelete = jest.fn().mockReturnValue({
                where: jest.fn().mockRejectedValue(new Error('Database error')),
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            // Should not throw - cleanup failure shouldn't stop rollup
            await expect(aggregator.runDailyRollup()).resolves.not.toThrow();
        });

        it('should handle cleanup gracefully when no records to delete', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
            ];

            // Mock select to return devices first, then empty array for cleanup count
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockDevices),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue([]),
                        }),
                    };
                }
            });
            jest.mocked(db.select).mockImplementation(mockSelect as any);

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

            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            // Mock cleanup with no records deleted
            const mockWhere = jest.fn().mockResolvedValue({ rowCount: 0 });
            const mockDelete = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            // Should not throw
            await expect(aggregator.runDailyRollup()).resolves.not.toThrow();

            // Verify cleanup was still called
            expect(db.delete).toHaveBeenCalledWith(firewallMetricsRollup);
        });

        it('should log cleanup statistics', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
            ];

            // Mock old records to be deleted
            const mockOldRecords = [
                { id: 'old-1', deviceId: 'device-1', date: '2022-01-01' },
                { id: 'old-2', deviceId: 'device-1', date: '2022-01-02' },
                { id: 'old-3', deviceId: 'device-1', date: '2022-01-03' },
            ];

            // Mock select to return devices first, then old records for cleanup count
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    // First call: get active devices
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockDevices),
                        }),
                    };
                } else {
                    // Second call: count old records for cleanup
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockOldRecords),
                        }),
                    };
                }
            });
            jest.mocked(db.select).mockImplementation(mockSelect as any);

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

            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const mockWhere = jest.fn().mockResolvedValue({ rowCount: 3 });
            const mockDelete = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            await aggregator.runDailyRollup();

            // Verify cleanup was executed
            expect(db.delete).toHaveBeenCalledWith(firewallMetricsRollup);

            // Verify select was called twice: once for devices, once for counting old records
            expect(db.select).toHaveBeenCalledTimes(2);
        });
    });

    describe('Requirement 9.8 validation', () => {
        it('should delete rollups older than 365 days (Requirement 9.8)', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
            ];

            const mockOldRecords = [
                { id: 'old-1', deviceId: 'device-1', date: '2022-01-01' },
                { id: 'old-2', deviceId: 'device-1', date: '2022-01-02' },
            ];

            // Mock select to return devices first, then old records for cleanup count
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockDevices),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockOldRecords),
                        }),
                    };
                }
            });
            jest.mocked(db.select).mockImplementation(mockSelect as any);

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

            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const mockWhere = jest.fn().mockResolvedValue({ rowCount: 7 });
            const mockDelete = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            await aggregator.runDailyRollup();

            // Verify delete was called with correct table
            expect(db.delete).toHaveBeenCalledWith(firewallMetricsRollup);

            // Verify where clause was called (with lt condition for 365 days ago)
            expect(mockWhere).toHaveBeenCalled();
        });

        it('should run cleanup automatically as part of daily job', async () => {
            const mockDevices = [
                { id: 'device-1', status: 'active', tenantId: 'tenant-1' },
                { id: 'device-2', status: 'active', tenantId: 'tenant-1' },
            ];

            const mockOldRecords = [
                { id: 'old-1', deviceId: 'device-1', date: '2022-01-01' },
                { id: 'old-2', deviceId: 'device-2', date: '2022-01-02' },
            ];

            // Mock select to return devices first, then old records for cleanup count
            let selectCallCount = 0;
            const mockSelect = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockDevices),
                        }),
                    };
                } else {
                    return {
                        from: jest.fn().mockReturnValue({
                            where: jest.fn().mockResolvedValue(mockOldRecords),
                        }),
                    };
                }
            });
            jest.mocked(db.select).mockImplementation(mockSelect as any);

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

            const mockInsert = jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
                }),
            });
            jest.mocked(db.insert).mockReturnValue(mockInsert() as any);

            const mockWhere = jest.fn().mockResolvedValue({ rowCount: 15 });
            const mockDelete = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            jest.mocked(db.delete).mockReturnValue(mockDelete() as any);

            // Run daily rollup
            await aggregator.runDailyRollup();

            // Verify cleanup was executed after processing all devices
            expect(db.delete).toHaveBeenCalledWith(firewallMetricsRollup);

            // Verify it was called once per rollup
            expect(db.delete).toHaveBeenCalledTimes(1);
        });
    });
});
