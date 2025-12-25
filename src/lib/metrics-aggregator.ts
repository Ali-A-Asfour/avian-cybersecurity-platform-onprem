/**
 * Metrics Aggregator for SonicWall Firewall Monitoring
 * 
 * Creates daily rollup records at midnight UTC with final counter values
 * from the previous day's polling data.
 * 
 * Requirements: 9.1-9.8
 */

import { logger } from '@/lib/logger';
import { db } from '@/lib/database';
import { firewallDevices, firewallMetricsRollup } from '../../database/schemas/firewall';
import { eq, lt } from 'drizzle-orm';
import * as cron from 'node-cron';
import { FirewallPollingStateService } from '@/lib/firewall-polling-state';

/**
 * Metrics rollup data
 */
export interface MetricsRollup {
    deviceId: string;
    date: Date;
    threatsBlocked: number; // Sum of IPS + GAV + ATP + Botnet
    malwareBlocked: number; // GAV blocks
    ipsBlocked: number; // IPS blocks
    blockedConnections: number; // Total denied connections
    webFilterHits: number; // Content filter blocks
    bandwidthTotalMb: number; // If available from API
    activeSessionsCount: number; // Average or final value
}

/**
 * Metrics Aggregator
 * 
 * Runs daily at midnight UTC to create rollup records for the previous day.
 * Uses final cumulative counter values from SonicWall (not calculated by summing increments).
 */
export class MetricsAggregator {
    private cronJob: cron.ScheduledTask | null = null;
    private isRunning: boolean = false;

    /**
     * Start the metrics aggregator
     * 
     * Schedules daily job at 00:00 UTC using node-cron.
     * 
     * Requirements: 9.1 - Create rollup at midnight UTC
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Metrics aggregator is already running');
            return;
        }

        logger.info('Starting metrics aggregator');

        try {
            // Schedule daily job at 00:00 UTC
            // Cron expression: 0 0 * * * (minute hour day month dayOfWeek)
            this.cronJob = cron.schedule(
                '0 0 * * *',
                async () => {
                    logger.info('Running daily metrics rollup');
                    await this.runDailyRollup();
                },
                {
                    timezone: 'UTC',
                }
            );

            this.isRunning = true;
            logger.info('Metrics aggregator started successfully');
        } catch (error) {
            logger.error('Failed to start metrics aggregator', error instanceof Error ? error : undefined);
            throw error;
        }
    }

    /**
     * Stop the metrics aggregator
     * 
     * Stops the cron job gracefully.
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Metrics aggregator is not running');
            return;
        }

        logger.info('Stopping metrics aggregator');

        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        this.isRunning = false;
        logger.info('Metrics aggregator stopped successfully');
    }

    /**
     * Run daily rollup for all active devices
     * 
     * Iterates through all active devices and creates rollup records
     * for the previous day using final counter values.
     * 
     * Requirements: 9.1-9.7
     */
    async runDailyRollup(): Promise<void> {
        logger.info('Starting daily metrics rollup');

        try {
            if (!db) {
                throw new Error('Database connection not initialized');
            }

            // Get all active devices
            const devices = await db
                .select()
                .from(firewallDevices)
                .where(eq(firewallDevices.status, 'active'));

            if (devices.length === 0) {
                logger.info('No active devices found for metrics rollup');
                return;
            }

            logger.info(`Processing metrics rollup for ${devices.length} devices`);

            // Calculate date for previous day
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);

            // Process each device
            let successCount = 0;
            let errorCount = 0;

            for (const device of devices) {
                try {
                    await this.aggregateDeviceMetrics(device.id, yesterday);
                    successCount++;
                } catch (error) {
                    logger.error(
                        `Failed to aggregate metrics for device ${device.id}`,
                        error instanceof Error ? error : undefined,
                        { deviceId: device.id }
                    );
                    errorCount++;
                }
            }

            logger.info('Daily metrics rollup completed', {
                totalDevices: devices.length,
                successCount,
                errorCount,
            });

            // Run cleanup of old records
            await this.cleanupOldMetrics();
        } catch (error) {
            logger.error('Failed to run daily metrics rollup', error instanceof Error ? error : undefined);
            throw error;
        }
    }

    /**
     * Aggregate metrics for a single device
     * 
     * Gets final counter values from last poll of previous day and stores rollup.
     * 
     * Requirements: 9.2-9.6
     * 
     * @param deviceId - Device ID
     * @param date - Date for rollup (previous day)
     * @returns Metrics rollup data
     */
    async aggregateDeviceMetrics(deviceId: string, date: Date): Promise<MetricsRollup> {
        logger.debug(`Aggregating metrics for device ${deviceId}`, {
            deviceId,
            date: date.toISOString(),
        });

        try {
            // Get final counter values from last poll of previous day
            // Requirements: 9.2 - Use final cumulative counter from previous day
            // Try to get the daily snapshot first (preferred method)
            let counters = await FirewallPollingStateService.getDailySnapshot(deviceId, date);

            // If no daily snapshot exists, fall back to current polling state
            // This can happen if the polling engine hasn't stored a snapshot yet
            if (!counters) {
                logger.debug(`No daily snapshot found for device ${deviceId}, using current state`, {
                    deviceId,
                    date: date.toISOString(),
                });

                const pollingState = await FirewallPollingStateService.getState(deviceId);

                if (!pollingState) {
                    logger.warn(`No polling state found for device ${deviceId}, using zero values`);
                    // Create rollup with zero values if no state exists
                    const rollup: MetricsRollup = {
                        deviceId,
                        date,
                        threatsBlocked: 0,
                        malwareBlocked: 0,
                        ipsBlocked: 0,
                        blockedConnections: 0,
                        webFilterHits: 0,
                        bandwidthTotalMb: 0,
                        activeSessionsCount: 0,
                    };

                    await this.storeMetricsRollup(rollup);
                    return rollup;
                }

                counters = pollingState.lastCounters;
            }

            // Use final cumulative counter values from SonicWall
            // Requirements: 9.2 - Use final cumulative counter, NOT calculated by summing increments

            // Calculate totals
            // Requirements: 9.3 - threats_blocked = sum of IPS + GAV + ATP + Botnet
            const threatsBlocked =
                (counters.ipsBlocks || 0) +
                (counters.gavBlocks || 0) +
                (counters.atpVerdicts || 0) +
                (counters.botnetBlocks || 0);

            const rollup: MetricsRollup = {
                deviceId,
                date,
                threatsBlocked,
                malwareBlocked: counters.gavBlocks || 0,
                ipsBlocked: counters.ipsBlocks || 0,
                blockedConnections: counters.blockedConnections || 0,
                webFilterHits: counters.contentFilterBlocks || 0,
                bandwidthTotalMb: counters.bandwidthTotalMb || 0, // Use bandwidth if available from API
                activeSessionsCount: counters.activeSessionsCount || 0, // Use active sessions if available from API
            };

            // Store rollup in database
            await this.storeMetricsRollup(rollup);

            logger.debug(`Aggregated metrics for device ${deviceId}`, {
                deviceId,
                threatsBlocked: rollup.threatsBlocked,
                malwareBlocked: rollup.malwareBlocked,
                ipsBlocked: rollup.ipsBlocked,
            });

            return rollup;
        } catch (error) {
            logger.error(
                `Failed to aggregate metrics for device ${deviceId}`,
                error instanceof Error ? error : undefined,
                { deviceId }
            );
            throw error;
        }
    }

    /**
     * Store metrics rollup in database
     * 
     * Inserts rollup record with UPSERT to handle duplicate dates.
     * 
     * Requirements: 9.5 - Insert into firewall_metrics_rollup table
     * 
     * @param rollup - Metrics rollup data
     */
    private async storeMetricsRollup(rollup: MetricsRollup): Promise<void> {
        if (!db) {
            throw new Error('Database connection not initialized');
        }

        try {
            // Format date as YYYY-MM-DD for database
            const dateStr = rollup.date.toISOString().split('T')[0];

            // Insert with ON CONFLICT DO UPDATE (UPSERT)
            // This handles duplicate dates by updating existing records
            await db
                .insert(firewallMetricsRollup)
                .values({
                    deviceId: rollup.deviceId,
                    date: dateStr,
                    threatsBlocked: rollup.threatsBlocked,
                    malwareBlocked: rollup.malwareBlocked,
                    ipsBlocked: rollup.ipsBlocked,
                    blockedConnections: rollup.blockedConnections,
                    webFilterHits: rollup.webFilterHits,
                    bandwidthTotalMb: rollup.bandwidthTotalMb,
                    activeSessionsCount: rollup.activeSessionsCount,
                })
                .onConflictDoUpdate({
                    target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
                    set: {
                        threatsBlocked: rollup.threatsBlocked,
                        malwareBlocked: rollup.malwareBlocked,
                        ipsBlocked: rollup.ipsBlocked,
                        blockedConnections: rollup.blockedConnections,
                        webFilterHits: rollup.webFilterHits,
                        bandwidthTotalMb: rollup.bandwidthTotalMb,
                        activeSessionsCount: rollup.activeSessionsCount,
                    },
                });

            logger.debug(`Stored metrics rollup for device ${rollup.deviceId}`, {
                deviceId: rollup.deviceId,
                date: dateStr,
            });
        } catch (error) {
            logger.error(
                `Failed to store metrics rollup for device ${rollup.deviceId}`,
                error instanceof Error ? error : undefined,
                { deviceId: rollup.deviceId }
            );
            throw error;
        }
    }

    /**
     * Cleanup old metrics rollup records
     * 
     * Deletes rollup records older than 365 days.
     * 
     * Requirements: 9.8 - Delete rollups older than 365 days
     */
    private async cleanupOldMetrics(): Promise<void> {
        if (!db) {
            return;
        }

        try {
            logger.info('Cleaning up old metrics rollup records');

            // Calculate cutoff date (365 days ago)
            const cutoffDate = new Date();
            cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 365);
            const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

            // Count records before deletion
            const recordsToDelete = await db
                .select()
                .from(firewallMetricsRollup)
                .where(lt(firewallMetricsRollup.date, cutoffDateStr));

            const deletedCount = recordsToDelete.length;

            // Delete old records
            await db
                .delete(firewallMetricsRollup)
                .where(lt(firewallMetricsRollup.date, cutoffDateStr));

            logger.info('Cleaned up old metrics rollup records', {
                cutoffDate: cutoffDateStr,
                deletedCount,
            });
        } catch (error) {
            logger.error('Failed to cleanup old metrics', error instanceof Error ? error : undefined);
            // Don't throw - cleanup failure shouldn't stop the rollup process
        }
    }

    /**
     * Get current running status
     * 
     * @returns True if aggregator is running
     */
    isAggregating(): boolean {
        return this.isRunning;
    }

    /**
     * Manually trigger rollup (for testing or manual runs)
     * 
     * @param date - Optional date to run rollup for (defaults to yesterday)
     */
    async manualRollup(date?: Date): Promise<void> {
        const rollupDate = date || (() => {
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            yesterday.setUTCHours(0, 0, 0, 0);
            return yesterday;
        })();

        logger.info('Running manual metrics rollup', {
            date: rollupDate.toISOString(),
        });

        if (!db) {
            throw new Error('Database connection not initialized');
        }

        // Get all active devices
        const devices = await db
            .select()
            .from(firewallDevices)
            .where(eq(firewallDevices.status, 'active'));

        logger.info(`Processing manual rollup for ${devices.length} devices`);

        // Process each device
        for (const device of devices) {
            try {
                await this.aggregateDeviceMetrics(device.id, rollupDate);
            } catch (error) {
                logger.error(
                    `Failed to aggregate metrics for device ${device.id}`,
                    error instanceof Error ? error : undefined,
                    { deviceId: device.id }
                );
            }
        }

        logger.info('Manual metrics rollup completed');
    }
}
