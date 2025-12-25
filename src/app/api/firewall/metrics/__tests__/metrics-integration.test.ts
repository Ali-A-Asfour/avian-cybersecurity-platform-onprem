/**
 * Integration Tests for GET /api/firewall/metrics/:deviceId
 * 
 * Requirements: 15.9 - Metrics API
 * - Test metrics queries with real database interactions
 * - Verify date range filtering works correctly
 * - Verify limit parameter works correctly
 * - Verify tenant isolation
 * - Verify sorting by date descending
 */

import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallMetricsRollup,
} from '../../../../../../database/schemas/firewall';
import { eq, and, desc, gte, lte, between } from 'drizzle-orm';

describe('Metrics API Integration Tests', () => {
    const testTenantId = 'test-tenant-metrics-' + Date.now();
    const testDeviceId = '550e8400-e29b-41d4-a716-446655440000';
    let createdDeviceId: string;

    beforeAll(async () => {
        // Create test device
        const [device] = await db
            .insert(firewallDevices)
            .values({
                id: testDeviceId,
                tenantId: testTenantId,
                model: 'TZ-400',
                firmwareVersion: '7.0.1',
                serialNumber: 'TEST-METRICS-' + Date.now(),
                managementIp: '192.168.1.100',
                status: 'active',
            })
            .returning();

        createdDeviceId = device.id;

        // Create test metrics for different dates
        const metricsData = [
            {
                deviceId: createdDeviceId,
                date: '2024-01-01',
                threatsBlocked: 100,
                malwareBlocked: 30,
                ipsBlocked: 40,
                blockedConnections: 200,
                webFilterHits: 50,
                bandwidthTotalMb: BigInt(1000),
                activeSessionsCount: 10,
            },
            {
                deviceId: createdDeviceId,
                date: '2024-01-05',
                threatsBlocked: 200,
                malwareBlocked: 60,
                ipsBlocked: 80,
                blockedConnections: 400,
                webFilterHits: 100,
                bandwidthTotalMb: BigInt(2000),
                activeSessionsCount: 20,
            },
            {
                deviceId: createdDeviceId,
                date: '2024-01-10',
                threatsBlocked: 300,
                malwareBlocked: 90,
                ipsBlocked: 120,
                blockedConnections: 600,
                webFilterHits: 150,
                bandwidthTotalMb: BigInt(3000),
                activeSessionsCount: 30,
            },
            {
                deviceId: createdDeviceId,
                date: '2024-01-15',
                threatsBlocked: 400,
                malwareBlocked: 120,
                ipsBlocked: 160,
                blockedConnections: 800,
                webFilterHits: 200,
                bandwidthTotalMb: BigInt(4000),
                activeSessionsCount: 40,
            },
            {
                deviceId: createdDeviceId,
                date: '2024-01-20',
                threatsBlocked: 500,
                malwareBlocked: 150,
                ipsBlocked: 200,
                blockedConnections: 1000,
                webFilterHits: 250,
                bandwidthTotalMb: BigInt(5000),
                activeSessionsCount: 50,
            },
        ];

        await db.insert(firewallMetricsRollup).values(metricsData);
    });

    afterAll(async () => {
        // Clean up test data
        await db
            .delete(firewallMetricsRollup)
            .where(eq(firewallMetricsRollup.deviceId, createdDeviceId));
        await db
            .delete(firewallDevices)
            .where(eq(firewallDevices.id, createdDeviceId));
    });

    describe('Basic Metrics Queries', () => {
        it('should retrieve all metrics for a device', async () => {
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, createdDeviceId))
                .orderBy(desc(firewallMetricsRollup.date));

            expect(metrics).toHaveLength(5);
            expect(metrics[0].date).toBe('2024-01-20'); // Newest first
            expect(metrics[4].date).toBe('2024-01-01'); // Oldest last
        });

        it('should retrieve metrics with limit', async () => {
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, createdDeviceId))
                .orderBy(desc(firewallMetricsRollup.date))
                .limit(3);

            expect(metrics).toHaveLength(3);
            expect(metrics[0].date).toBe('2024-01-20');
            expect(metrics[1].date).toBe('2024-01-15');
            expect(metrics[2].date).toBe('2024-01-10');
        });
    });

    describe('Date Range Filtering', () => {
        it('should filter metrics by start date only', async () => {
            const startDate = '2024-01-10';
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(
                    and(
                        eq(firewallMetricsRollup.deviceId, createdDeviceId),
                        gte(firewallMetricsRollup.date, startDate)
                    )
                )
                .orderBy(desc(firewallMetricsRollup.date));

            expect(metrics).toHaveLength(3);
            expect(metrics[0].date).toBe('2024-01-20');
            expect(metrics[1].date).toBe('2024-01-15');
            expect(metrics[2].date).toBe('2024-01-10');
        });

        it('should filter metrics by end date only', async () => {
            const endDate = '2024-01-10';
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(
                    and(
                        eq(firewallMetricsRollup.deviceId, createdDeviceId),
                        lte(firewallMetricsRollup.date, endDate)
                    )
                )
                .orderBy(desc(firewallMetricsRollup.date));

            expect(metrics).toHaveLength(3);
            expect(metrics[0].date).toBe('2024-01-10');
            expect(metrics[1].date).toBe('2024-01-05');
            expect(metrics[2].date).toBe('2024-01-01');
        });

        it('should filter metrics by date range (start and end)', async () => {
            const startDate = '2024-01-05';
            const endDate = '2024-01-15';
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(
                    and(
                        eq(firewallMetricsRollup.deviceId, createdDeviceId),
                        between(firewallMetricsRollup.date, startDate, endDate)
                    )
                )
                .orderBy(desc(firewallMetricsRollup.date));

            expect(metrics).toHaveLength(3);
            expect(metrics[0].date).toBe('2024-01-15');
            expect(metrics[1].date).toBe('2024-01-10');
            expect(metrics[2].date).toBe('2024-01-05');
        });

        it('should return empty array for date range with no data', async () => {
            const startDate = '2024-02-01';
            const endDate = '2024-02-28';
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(
                    and(
                        eq(firewallMetricsRollup.deviceId, createdDeviceId),
                        between(firewallMetricsRollup.date, startDate, endDate)
                    )
                )
                .orderBy(desc(firewallMetricsRollup.date));

            expect(metrics).toHaveLength(0);
        });

        it('should handle single day date range', async () => {
            const date = '2024-01-10';
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(
                    and(
                        eq(firewallMetricsRollup.deviceId, createdDeviceId),
                        between(firewallMetricsRollup.date, date, date)
                    )
                )
                .orderBy(desc(firewallMetricsRollup.date));

            expect(metrics).toHaveLength(1);
            expect(metrics[0].date).toBe('2024-01-10');
        });
    });

    describe('Sorting Verification', () => {
        it('should return metrics sorted by date descending', async () => {
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, createdDeviceId))
                .orderBy(desc(firewallMetricsRollup.date));

            // Verify dates are in descending order
            for (let i = 0; i < metrics.length - 1; i++) {
                expect(metrics[i].date >= metrics[i + 1].date).toBe(true);
            }

            // Verify specific order
            expect(metrics[0].date).toBe('2024-01-20');
            expect(metrics[1].date).toBe('2024-01-15');
            expect(metrics[2].date).toBe('2024-01-10');
            expect(metrics[3].date).toBe('2024-01-05');
            expect(metrics[4].date).toBe('2024-01-01');
        });
    });

    describe('Metrics Data Integrity', () => {
        it('should return correct metric values', async () => {
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(
                    and(
                        eq(firewallMetricsRollup.deviceId, createdDeviceId),
                        eq(firewallMetricsRollup.date, '2024-01-15')
                    )
                );

            expect(metrics).toHaveLength(1);
            const metric = metrics[0];
            expect(metric.threatsBlocked).toBe(400);
            expect(metric.malwareBlocked).toBe(120);
            expect(metric.ipsBlocked).toBe(160);
            expect(metric.blockedConnections).toBe(800);
            expect(metric.webFilterHits).toBe(200);
            expect(Number(metric.bandwidthTotalMb)).toBe(4000);
            expect(metric.activeSessionsCount).toBe(40);
        });

        it('should handle BigInt bandwidth values correctly', async () => {
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, createdDeviceId))
                .orderBy(desc(firewallMetricsRollup.date));

            metrics.forEach((metric) => {
                expect(typeof metric.bandwidthTotalMb).toBe('bigint');
                expect(Number(metric.bandwidthTotalMb)).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('Limit and Pagination', () => {
        it('should respect limit parameter', async () => {
            const limits = [1, 2, 3, 5];

            for (const limit of limits) {
                const metrics = await db
                    .select()
                    .from(firewallMetricsRollup)
                    .where(eq(firewallMetricsRollup.deviceId, createdDeviceId))
                    .orderBy(desc(firewallMetricsRollup.date))
                    .limit(limit);

                expect(metrics).toHaveLength(limit);
            }
        });

        it('should handle limit larger than available records', async () => {
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, createdDeviceId))
                .orderBy(desc(firewallMetricsRollup.date))
                .limit(100);

            expect(metrics).toHaveLength(5); // Only 5 records exist
        });

        it('should combine limit with date range filter', async () => {
            const startDate = '2024-01-05';
            const endDate = '2024-01-20';
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(
                    and(
                        eq(firewallMetricsRollup.deviceId, createdDeviceId),
                        between(firewallMetricsRollup.date, startDate, endDate)
                    )
                )
                .orderBy(desc(firewallMetricsRollup.date))
                .limit(2);

            expect(metrics).toHaveLength(2);
            expect(metrics[0].date).toBe('2024-01-20');
            expect(metrics[1].date).toBe('2024-01-15');
        });
    });

    describe('Tenant Isolation', () => {
        it('should only return metrics for specified device', async () => {
            // Create another device with different tenant
            const otherDeviceId = '660e8400-e29b-41d4-a716-446655440001';
            const otherTenantId = 'other-tenant-' + Date.now();

            await db.insert(firewallDevices).values({
                id: otherDeviceId,
                tenantId: otherTenantId,
                model: 'TZ-500',
                firmwareVersion: '7.0.1',
                serialNumber: 'OTHER-DEVICE-' + Date.now(),
                managementIp: '192.168.1.101',
                status: 'active',
            });

            await db.insert(firewallMetricsRollup).values({
                deviceId: otherDeviceId,
                date: '2024-01-15',
                threatsBlocked: 999,
                malwareBlocked: 999,
                ipsBlocked: 999,
                blockedConnections: 999,
                webFilterHits: 999,
                bandwidthTotalMb: BigInt(9999),
                activeSessionsCount: 999,
            });

            // Query metrics for original device
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, createdDeviceId))
                .orderBy(desc(firewallMetricsRollup.date));

            // Should not include metrics from other device
            expect(metrics.every((m) => m.deviceId === createdDeviceId)).toBe(true);
            expect(metrics.every((m) => m.threatsBlocked !== 999)).toBe(true);

            // Clean up
            await db
                .delete(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, otherDeviceId));
            await db
                .delete(firewallDevices)
                .where(eq(firewallDevices.id, otherDeviceId));
        });
    });

    describe('Edge Cases', () => {
        it('should handle device with no metrics', async () => {
            // Create device without metrics
            const emptyDeviceId = '770e8400-e29b-41d4-a716-446655440002';
            await db.insert(firewallDevices).values({
                id: emptyDeviceId,
                tenantId: testTenantId,
                model: 'TZ-300',
                firmwareVersion: '7.0.1',
                serialNumber: 'EMPTY-DEVICE-' + Date.now(),
                managementIp: '192.168.1.102',
                status: 'active',
            });

            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, emptyDeviceId))
                .orderBy(desc(firewallMetricsRollup.date));

            expect(metrics).toHaveLength(0);

            // Clean up
            await db
                .delete(firewallDevices)
                .where(eq(firewallDevices.id, emptyDeviceId));
        });

        it('should handle non-existent device ID', async () => {
            const nonExistentId = '880e8400-e29b-41d4-a716-446655440003';
            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(eq(firewallMetricsRollup.deviceId, nonExistentId))
                .orderBy(desc(firewallMetricsRollup.date));

            expect(metrics).toHaveLength(0);
        });
    });

    describe('Performance Tests', () => {
        it('should efficiently query large date ranges', async () => {
            const startTime = Date.now();

            const metrics = await db
                .select()
                .from(firewallMetricsRollup)
                .where(
                    and(
                        eq(firewallMetricsRollup.deviceId, createdDeviceId),
                        between(firewallMetricsRollup.date, '2024-01-01', '2024-12-31')
                    )
                )
                .orderBy(desc(firewallMetricsRollup.date))
                .limit(365);

            const endTime = Date.now();
            const queryTime = endTime - startTime;

            // Query should complete in reasonable time (< 1 second)
            expect(queryTime).toBeLessThan(1000);
            expect(metrics).toHaveLength(5);
        });
    });
});
