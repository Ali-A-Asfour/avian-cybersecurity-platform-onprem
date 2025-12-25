/**
 * Alert Manager
 * 
 * Manages firewall alerts including creation, deduplication, acknowledgment, and querying.
 * Implements alert storm detection and Redis-based deduplication.
 * 
 * Requirements: 12.1-12.7
 */

import { db } from './database';
import { firewallAlerts } from '../../database/schemas/firewall';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import { connectRedis } from './redis';
import { logger } from './logger';
import crypto from 'crypto';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Alert source types
 */
export type AlertSource = 'api' | 'email';

/**
 * Input for creating a new alert
 */
export interface CreateAlertInput {
    tenantId: string;
    deviceId?: string;
    alertType: string;
    severity: AlertSeverity;
    message: string;
    source: AlertSource;
    metadata?: Record<string, any>;
}

/**
 * Filters for querying alerts
 */
export interface AlertFilters {
    tenantId: string;
    deviceId?: string;
    severity?: AlertSeverity | AlertSeverity[];
    acknowledged?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

/**
 * Alert record from database
 */
export interface Alert {
    id: string;
    tenantId: string;
    deviceId: string | null;
    alertType: string;
    severity: AlertSeverity;
    message: string;
    source: AlertSource;
    metadata: Record<string, any>;
    acknowledged: boolean;
    acknowledgedBy: string | null;
    acknowledgedAt: Date | null;
    createdAt: Date;
}

/**
 * Alert Manager Class
 * 
 * Provides methods for managing firewall alerts with deduplication and storm detection.
 */
export class AlertManager {
    private static readonly DEDUP_WINDOW_SECONDS = 120; // 2 minutes (Requirement 12.2)
    private static readonly DEDUP_KEY_PREFIX = 'alert:dedup:';
    private static readonly STORM_WINDOW_SECONDS = 300; // 5 minutes (Requirement 12.7)
    private static readonly STORM_THRESHOLD = 10; // 10 alerts in 5 minutes (Requirement 12.7)
    private static readonly STORM_SUPPRESSION_SECONDS = 900; // 15 minutes (Requirement 12.7)
    private static readonly STORM_KEY_PREFIX = 'alert:storm:';
    private static readonly STORM_SUPPRESSION_PREFIX = 'alert:suppress:';

    /**
     * Create a new alert with deduplication and storm detection
     * 
     * Requirements: 12.1, 12.2, 12.7
     */
    static async createAlert(input: CreateAlertInput): Promise<string | null> {
        try {
            // Check if device is currently suppressed due to alert storm
            if (input.deviceId) {
                const isSuppressed = await this.isDeviceSuppressed(input.deviceId);
                if (isSuppressed) {
                    logger.debug('Alert suppressed due to alert storm', {
                        deviceId: input.deviceId,
                        alertType: input.alertType,
                    });
                    return null;
                }
            }

            // Check for duplicate alert
            const isDuplicate = await this.deduplicateAlert(input);
            if (isDuplicate) {
                logger.debug('Duplicate alert skipped', {
                    tenantId: input.tenantId,
                    deviceId: input.deviceId,
                    alertType: input.alertType,
                    severity: input.severity,
                    message: input.message,
                    source: input.source,
                    metadata: input.metadata,
                    timestamp: new Date().toISOString(),
                    dedupWindowSeconds: this.DEDUP_WINDOW_SECONDS,
                });
                return null;
            }

            // Create alert in database
            const [alert] = await db.insert(firewallAlerts).values({
                tenantId: input.tenantId,
                deviceId: input.deviceId || null,
                alertType: input.alertType,
                severity: input.severity,
                message: input.message,
                source: input.source,
                metadata: input.metadata || {},
                acknowledged: false,
                acknowledgedBy: null,
                acknowledgedAt: null,
            }).returning();

            logger.info('Alert created', {
                alertId: alert.id,
                tenantId: input.tenantId,
                deviceId: input.deviceId,
                alertType: input.alertType,
                severity: input.severity,
            });

            // Check for alert storm after creating alert
            if (input.deviceId) {
                await this.checkAlertStorm(input.deviceId);
            }

            return alert.id;
        } catch (error) {
            logger.error('Failed to create alert', error instanceof Error ? error : new Error(String(error)), {
                tenantId: input.tenantId,
                deviceId: input.deviceId,
                alertType: input.alertType,
            });
            throw error;
        }
    }

    /**
     * Check if alert is a duplicate within the deduplication window
     * 
     * Requirements: 12.1, 12.2
     * 
     * Deduplication logic:
     * - Same alert_type + device_id + severity within 2 minutes = duplicate
     * - Uses Redis for fast deduplication checks with 2-minute TTL
     */
    static async deduplicateAlert(input: CreateAlertInput): Promise<boolean> {
        try {
            const redis = await connectRedis();
            if (!redis) {
                // If Redis not available, skip deduplication
                logger.warn('Redis not available, skipping alert deduplication');
                return false;
            }

            // Create deduplication key based on alert characteristics
            const dedupKey = this.createDedupKey(
                input.tenantId,
                input.deviceId,
                input.alertType,
                input.severity
            );

            // Check if key exists in Redis
            const exists = await redis.exists(dedupKey);

            if (exists) {
                // Duplicate found - log for debugging
                logger.debug('Duplicate alert detected in deduplication check', {
                    tenantId: input.tenantId,
                    deviceId: input.deviceId,
                    alertType: input.alertType,
                    severity: input.severity,
                    dedupKey: dedupKey,
                    dedupWindowSeconds: this.DEDUP_WINDOW_SECONDS,
                });
                return true;
            }

            // Not a duplicate, set key with TTL
            await redis.setEx(
                dedupKey,
                this.DEDUP_WINDOW_SECONDS,
                new Date().toISOString()
            );

            logger.debug('Alert deduplication key created', {
                tenantId: input.tenantId,
                deviceId: input.deviceId,
                alertType: input.alertType,
                severity: input.severity,
                dedupKey: dedupKey,
                ttlSeconds: this.DEDUP_WINDOW_SECONDS,
            });

            return false;
        } catch (error) {
            logger.error('Alert deduplication check failed', error instanceof Error ? error : new Error(String(error)), {
                tenantId: input.tenantId,
                deviceId: input.deviceId,
                alertType: input.alertType,
            });
            // On error, allow alert creation (fail open)
            return false;
        }
    }

    /**
     * Acknowledge an alert
     * 
     * Requirements: 12.5
     */
    static async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
        try {
            const result = await db
                .update(firewallAlerts)
                .set({
                    acknowledged: true,
                    acknowledgedBy: userId,
                    acknowledgedAt: new Date(),
                })
                .where(eq(firewallAlerts.id, alertId))
                .returning();

            if (result.length === 0) {
                throw new Error('Alert not found');
            }

            logger.info('Alert acknowledged', {
                alertId,
                userId,
            });
        } catch (error) {
            logger.error('Failed to acknowledge alert', error instanceof Error ? error : new Error(String(error)), {
                alertId,
                userId,
            });
            throw error;
        }
    }

    /**
     * Get alerts with filtering
     * 
     * Requirements: 12.3, 12.4
     */
    static async getAlerts(filters: AlertFilters): Promise<Alert[]> {
        try {
            const conditions = [eq(firewallAlerts.tenantId, filters.tenantId)];

            // Filter by device
            if (filters.deviceId) {
                conditions.push(eq(firewallAlerts.deviceId, filters.deviceId));
            }

            // Filter by severity
            if (filters.severity) {
                if (Array.isArray(filters.severity)) {
                    conditions.push(inArray(firewallAlerts.severity, filters.severity));
                } else {
                    conditions.push(eq(firewallAlerts.severity, filters.severity));
                }
            }

            // Filter by acknowledged status
            if (filters.acknowledged !== undefined) {
                conditions.push(eq(firewallAlerts.acknowledged, filters.acknowledged));
            }

            // Filter by date range
            if (filters.startDate) {
                conditions.push(gte(firewallAlerts.createdAt, filters.startDate));
            }
            if (filters.endDate) {
                conditions.push(lte(firewallAlerts.createdAt, filters.endDate));
            }

            // Build query
            let query = db
                .select()
                .from(firewallAlerts)
                .where(and(...conditions))
                .orderBy(desc(firewallAlerts.createdAt));

            // Apply pagination
            if (filters.limit) {
                query = query.limit(filters.limit) as any;
            }
            if (filters.offset) {
                query = query.offset(filters.offset) as any;
            }

            const alerts = await query;

            return alerts as Alert[];
        } catch (error) {
            logger.error('Failed to get alerts', error instanceof Error ? error : new Error(String(error)), {
                tenantId: filters.tenantId,
                deviceId: filters.deviceId,
            });
            throw error;
        }
    }

    /**
     * Check for alert storm and create meta-alert if threshold exceeded
     * 
     * Requirements: 12.7
     * 
     * Alert storm detection:
     * - If > 10 alerts created for same device in 5 minutes, create meta-alert
     * - Suppress further alerts for device for 15 minutes
     */
    static async checkAlertStorm(deviceId: string): Promise<boolean> {
        try {
            const redis = await connectRedis();
            if (!redis) {
                // If Redis not available, skip storm detection
                logger.warn('Redis not available, skipping alert storm detection');
                return false;
            }

            const stormKey = `${this.STORM_KEY_PREFIX}${deviceId}`;

            // Increment alert count for device
            const count = await redis.incr(stormKey);

            // Set expiry on first increment
            if (count === 1) {
                await redis.expire(stormKey, this.STORM_WINDOW_SECONDS);
            }

            // Check if threshold exceeded
            if (count > this.STORM_THRESHOLD) {
                // Check if we already created a storm alert
                const suppressKey = `${this.STORM_SUPPRESSION_PREFIX}${deviceId}`;
                const alreadySuppressed = await redis.exists(suppressKey);

                if (!alreadySuppressed) {
                    // Create meta-alert for alert storm
                    logger.warn('Alert storm detected', {
                        deviceId,
                        alertCount: count,
                    });

                    // Get device info to find tenant
                    const device = await db.query.firewallDevices.findFirst({
                        where: (devices, { eq }) => eq(devices.id, deviceId),
                    });

                    if (device) {
                        // Create storm meta-alert (bypass deduplication)
                        await db.insert(firewallAlerts).values({
                            tenantId: device.tenantId,
                            deviceId: deviceId,
                            alertType: 'alert_storm_detected',
                            severity: 'high',
                            message: `Alert storm detected: ${count} alerts in ${this.STORM_WINDOW_SECONDS / 60} minutes. Further alerts suppressed for ${this.STORM_SUPPRESSION_SECONDS / 60} minutes.`,
                            source: 'api',
                            metadata: {
                                alertCount: count,
                                windowSeconds: this.STORM_WINDOW_SECONDS,
                                suppressionSeconds: this.STORM_SUPPRESSION_SECONDS,
                            },
                            acknowledged: false,
                        });
                    }

                    // Set suppression flag
                    await redis.setEx(
                        suppressKey,
                        this.STORM_SUPPRESSION_SECONDS,
                        new Date().toISOString()
                    );

                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('Alert storm check failed', error instanceof Error ? error : new Error(String(error)), {
                deviceId,
            });
            // On error, don't suppress alerts (fail open)
            return false;
        }
    }

    /**
     * Check if device is currently suppressed due to alert storm
     */
    private static async isDeviceSuppressed(deviceId: string): Promise<boolean> {
        try {
            const redis = await connectRedis();
            if (!redis) {
                return false;
            }

            const suppressKey = `${this.STORM_SUPPRESSION_PREFIX}${deviceId}`;
            const exists = await redis.exists(suppressKey);

            return exists === 1;
        } catch (error) {
            logger.error('Failed to check device suppression', error instanceof Error ? error : new Error(String(error)), {
                deviceId,
            });
            // On error, don't suppress (fail open)
            return false;
        }
    }

    /**
     * Create deduplication key for Redis
     */
    private static createDedupKey(
        tenantId: string,
        deviceId: string | undefined,
        alertType: string,
        severity: AlertSeverity
    ): string {
        // Create a deterministic key based on alert characteristics
        const components = [
            tenantId,
            deviceId || 'no-device',
            alertType,
            severity,
        ];

        const hash = crypto
            .createHash('sha256')
            .update(components.join(':'))
            .digest('hex')
            .substring(0, 16);

        return `${this.DEDUP_KEY_PREFIX}${hash}`;
    }
}
