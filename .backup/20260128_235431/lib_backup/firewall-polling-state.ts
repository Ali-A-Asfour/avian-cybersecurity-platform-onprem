/**
 * Firewall Polling State Service
 * 
 * Manages polling state storage in Redis for counter tracking and change detection.
 * 
 * Requirements: 2.7, 2.8-2.10
 */

import { connectRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * Polling state for a device
 */
export interface DevicePollingState {
    deviceId: string;
    lastPollTime: Date;
    lastCounters: {
        ipsBlocks: number;
        gavBlocks: number;
        dpiSslBlocks: number;
        atpVerdicts: number;
        appControlBlocks: number;
        botnetBlocks: number;
        contentFilterBlocks: number;
        blockedConnections: number;
        bandwidthTotalMb?: number; // Optional: if available from API
        activeSessionsCount?: number; // Optional: if available from API
    };
    lastStatus: {
        wanStatus: 'up' | 'down';
        vpnStatus: 'up' | 'down';
        cpuPercent: number;
        ramPercent: number;
    };
    lastSecurityFeatures: {
        ipsEnabled: boolean;
        gavEnabled: boolean;
        dpiSslEnabled: boolean;
        atpEnabled: boolean;
        botnetEnabled: boolean;
        appControlEnabled: boolean;
    };
    lastSnapshotTime?: Date;
}

/**
 * Firewall Polling State Service
 * 
 * Stores and retrieves polling state from Redis for change detection.
 */
export class FirewallPollingStateService {
    private static readonly STATE_PREFIX = 'firewall:polling:';
    private static readonly STATE_TTL = 86400; // 24 hours

    /**
     * Store polling state for a device
     * 
     * @param deviceId - Device ID
     * @param state - Polling state
     */
    static async storeState(deviceId: string, state: DevicePollingState): Promise<void> {
        try {
            const client = await connectRedis();
            if (!client) {
                logger.warn('Redis not available, skipping state storage', { deviceId });
                return;
            }

            const key = `${this.STATE_PREFIX}${deviceId}`;
            await client.setEx(key, this.STATE_TTL, JSON.stringify(state));

            logger.debug('Stored polling state', { deviceId });
        } catch (error) {
            logger.error('Failed to store polling state', error instanceof Error ? error : undefined, {
                deviceId,
            });
        }
    }

    /**
     * Get polling state for a device
     * 
     * @param deviceId - Device ID
     * @returns Polling state or null if not found
     */
    static async getState(deviceId: string): Promise<DevicePollingState | null> {
        try {
            const client = await connectRedis();
            if (!client) {
                logger.warn('Redis not available, returning null state', { deviceId });
                return null;
            }

            const key = `${this.STATE_PREFIX}${deviceId}`;
            const data = await client.get(key);

            if (!data) {
                return null;
            }

            const state = JSON.parse(data);

            // Convert date strings back to Date objects
            if (state.lastPollTime) {
                state.lastPollTime = new Date(state.lastPollTime);
            }
            if (state.lastSnapshotTime) {
                state.lastSnapshotTime = new Date(state.lastSnapshotTime);
            }

            return state;
        } catch (error) {
            logger.error('Failed to get polling state', error instanceof Error ? error : undefined, {
                deviceId,
            });
            return null;
        }
    }

    /**
     * Delete polling state for a device
     * 
     * @param deviceId - Device ID
     */
    static async deleteState(deviceId: string): Promise<void> {
        try {
            const client = await connectRedis();
            if (!client) {
                return;
            }

            const key = `${this.STATE_PREFIX}${deviceId}`;
            await client.del(key);

            logger.debug('Deleted polling state', { deviceId });
        } catch (error) {
            logger.error('Failed to delete polling state', error instanceof Error ? error : undefined, {
                deviceId,
            });
        }
    }

    /**
     * Check if enough time has elapsed for a health snapshot
     * 
     * Requirements: 3.1-3.8 - Create snapshot every 4-6 hours
     * 
     * @param deviceId - Device ID
     * @param minHours - Minimum hours between snapshots (default: 4)
     * @returns True if snapshot should be created
     */
    static async shouldCreateSnapshot(deviceId: string, minHours: number = 4): Promise<boolean> {
        try {
            const state = await this.getState(deviceId);

            if (!state || !state.lastSnapshotTime) {
                // No previous snapshot, create one
                return true;
            }

            const now = new Date();
            const hoursSinceLastSnapshot =
                (now.getTime() - state.lastSnapshotTime.getTime()) / (1000 * 60 * 60);

            return hoursSinceLastSnapshot >= minHours;
        } catch (error) {
            logger.error('Failed to check snapshot timing', error instanceof Error ? error : undefined, {
                deviceId,
            });
            // Default to creating snapshot on error
            return true;
        }
    }

    /**
     * Update last snapshot time
     * 
     * @param deviceId - Device ID
     */
    static async updateSnapshotTime(deviceId: string): Promise<void> {
        try {
            const state = await this.getState(deviceId);

            if (state) {
                state.lastSnapshotTime = new Date();
                await this.storeState(deviceId, state);
            }
        } catch (error) {
            logger.error('Failed to update snapshot time', error instanceof Error ? error : undefined, {
                deviceId,
            });
        }
    }

    /**
     * Store daily snapshot of counter values for metrics rollup
     * 
     * This creates a snapshot of the current counter values that can be retrieved
     * later for daily metrics aggregation. The snapshot is stored with a date key
     * so we can retrieve the final values from a specific day.
     * 
     * Requirements: 9.2 - Use final cumulative counter from previous day
     * 
     * @param deviceId - Device ID
     * @param date - Date for the snapshot (typically end of day)
     * @param counters - Counter values to snapshot
     */
    static async storeDailySnapshot(
        deviceId: string,
        date: Date,
        counters: {
            ipsBlocks: number;
            gavBlocks: number;
            dpiSslBlocks: number;
            atpVerdicts: number;
            appControlBlocks: number;
            botnetBlocks: number;
            contentFilterBlocks: number;
            blockedConnections: number;
            bandwidthTotalMb?: number;
            activeSessionsCount?: number;
        }
    ): Promise<void> {
        try {
            const client = await connectRedis();
            if (!client) {
                logger.warn('Redis not available, skipping daily snapshot storage', { deviceId });
                return;
            }

            // Format date as YYYY-MM-DD for key
            const dateStr = date.toISOString().split('T')[0];
            const key = `${this.STATE_PREFIX}${deviceId}:daily:${dateStr}`;

            // Store snapshot with 7 day TTL (enough for rollup processing)
            await client.setEx(key, 7 * 24 * 60 * 60, JSON.stringify(counters));

            logger.debug('Stored daily counter snapshot', { deviceId, date: dateStr });
        } catch (error) {
            logger.error('Failed to store daily snapshot', error instanceof Error ? error : undefined, {
                deviceId,
            });
        }
    }

    /**
     * Get daily snapshot of counter values
     * 
     * Retrieves the counter snapshot for a specific date. This is used by the
     * metrics aggregator to get the final counter values from the end of a day.
     * 
     * Requirements: 9.2 - Use final cumulative counter from previous day
     * 
     * @param deviceId - Device ID
     * @param date - Date to retrieve snapshot for
     * @returns Counter values or null if not found
     */
    static async getDailySnapshot(
        deviceId: string,
        date: Date
    ): Promise<{
        ipsBlocks: number;
        gavBlocks: number;
        dpiSslBlocks: number;
        atpVerdicts: number;
        appControlBlocks: number;
        botnetBlocks: number;
        contentFilterBlocks: number;
        blockedConnections: number;
        bandwidthTotalMb?: number;
        activeSessionsCount?: number;
    } | null> {
        try {
            const client = await connectRedis();
            if (!client) {
                logger.warn('Redis not available, returning null snapshot', { deviceId });
                return null;
            }

            // Format date as YYYY-MM-DD for key
            const dateStr = date.toISOString().split('T')[0];
            const key = `${this.STATE_PREFIX}${deviceId}:daily:${dateStr}`;

            const data = await client.get(key);

            if (!data) {
                return null;
            }

            return JSON.parse(data);
        } catch (error) {
            logger.error('Failed to get daily snapshot', error instanceof Error ? error : undefined, {
                deviceId,
            });
            return null;
        }
    }
}
