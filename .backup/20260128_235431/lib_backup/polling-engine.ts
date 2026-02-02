/**
 * Polling Engine for SonicWall Firewall Monitoring
 * 
 * Polls SonicWall devices at configurable intervals (default 30 seconds)
 * and detects changes in counters, status, and health metrics.
 * 
 * Requirements: 2.1-2.12
 */

import { logger } from '@/lib/logger';
import { SonicWallAPI } from '@/lib/sonicwall-api';
import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallHealthSnapshots,
    firewallSecurityPosture,
    firewallLicenses,
    firewallAlerts
} from '../../database/schemas/firewall';
import { eq } from 'drizzle-orm';
import * as cron from 'node-cron';
import { FirewallPollingStateService, DevicePollingState } from '@/lib/firewall-polling-state';
import { FirewallEncryption } from '@/lib/firewall-encryption';
import { connectRedis } from '@/lib/redis';
import type { SecurityStats, SystemHealth, InterfaceStatus, VPNPolicy, LicenseInfo } from '@/types/firewall';

/**
 * Polling state stored in Redis for each device
 */
export interface PollingState {
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
    };
    lastStatus: {
        wanStatus: 'up' | 'down';
        vpnStatus: 'up' | 'down';
    };
}

/**
 * Firewall device with decrypted credentials
 */
interface FirewallDevice {
    deviceId: string;
    tenantId: string;
    model: string | null;
    firmwareVersion: string | null;
    serialNumber: string | null;
    managementIp: string;
    apiUsername: string | null;
    apiPasswordEncrypted: string | null;
    status: string | null;
}

/**
 * Polling Engine
 * 
 * Manages periodic polling of SonicWall devices and change detection.
 * Uses node-cron for scheduling and supports graceful shutdown.
 */
export class PollingEngine {
    private devices: FirewallDevice[] = [];
    private pollingInterval: number = 30000; // Default 30 seconds
    private cronJob: cron.ScheduledTask | null = null;
    private isRunning: boolean = false;
    private shutdownRequested: boolean = false;

    /**
     * Create a new Polling Engine
     * 
     * @param pollingInterval - Polling interval in milliseconds (default: 30000)
     */
    constructor(pollingInterval: number = 30000) {
        this.pollingInterval = pollingInterval;
    }

    /**
     * Start the polling engine
     * 
     * Loads active devices from database and starts the cron job.
     * 
     * Requirements: 2.1 - Poll at configurable interval
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Polling engine is already running');
            return;
        }

        logger.info('Starting polling engine', {
            pollingInterval: this.pollingInterval,
        });

        try {
            // Load active devices from database
            await this.loadDevices();

            if (this.devices.length === 0) {
                logger.warn('No active devices found to poll');
            } else {
                logger.info(`Loaded ${this.devices.length} active devices for polling`);
            }

            // Calculate cron expression based on polling interval
            // For 30 seconds: */30 * * * * *
            const cronExpression = this.getCronExpression(this.pollingInterval);

            // Start cron job
            this.cronJob = cron.schedule(cronExpression, async () => {
                if (this.shutdownRequested) {
                    logger.info('Shutdown requested, skipping poll cycle');
                    return;
                }

                await this.pollAllDevices();
            });

            this.isRunning = true;
            logger.info('Polling engine started successfully');

            // Run initial poll immediately
            await this.pollAllDevices();
        } catch (error) {
            logger.error('Failed to start polling engine', error instanceof Error ? error : undefined);
            throw error;
        }
    }

    /**
     * Stop the polling engine
     * 
     * Gracefully shuts down the polling engine and stops the cron job.
     * 
     * Requirements: Graceful shutdown handling
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Polling engine is not running');
            return;
        }

        logger.info('Stopping polling engine');
        this.shutdownRequested = true;

        // Stop cron job
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        this.isRunning = false;
        logger.info('Polling engine stopped successfully');
    }

    /**
     * Load all active devices from database
     * 
     * Requirements: Load all active devices from database
     */
    private async loadDevices(): Promise<void> {
        try {
            logger.debug('Loading active devices from database');

            if (!db) {
                throw new Error('Database connection not initialized');
            }

            const devices = await db
                .select()
                .from(firewallDevices)
                .where(eq(firewallDevices.status, 'active'));

            this.devices = devices.map(device => ({
                deviceId: device.id,
                tenantId: device.tenantId,
                model: device.model,
                firmwareVersion: device.firmwareVersion,
                serialNumber: device.serialNumber,
                managementIp: device.managementIp,
                apiUsername: device.apiUsername,
                apiPasswordEncrypted: device.apiPasswordEncrypted,
                status: device.status,
            }));

            logger.debug(`Loaded ${this.devices.length} active devices`);
        } catch (error) {
            logger.error('Failed to load devices from database', error instanceof Error ? error : undefined);
            throw error;
        }
    }

    /**
     * Poll all active devices
     * 
     * Iterates through all devices and polls each one.
     */
    private async pollAllDevices(): Promise<void> {
        if (this.devices.length === 0) {
            logger.debug('No devices to poll');
            return;
        }

        logger.debug(`Polling ${this.devices.length} devices`);

        // Poll devices in parallel (with reasonable concurrency)
        const pollPromises = this.devices.map(device =>
            this.pollDevice(device).catch(error => {
                logger.error(`Failed to poll device ${device.deviceId}`, error instanceof Error ? error : undefined, {
                    deviceId: device.deviceId,
                    managementIp: device.managementIp,
                });
            })
        );

        await Promise.all(pollPromises);

        logger.debug('Completed poll cycle for all devices');
    }

    /**
     * Poll a single device
     * 
     * Calls SonicWall API endpoints and processes the results.
     * 
     * Requirements: 2.1-2.12 - Poll device and extract data
     * 
     * @param device - Device to poll
     */
    async pollDevice(device: FirewallDevice): Promise<void> {
        logger.debug(`Polling device ${device.deviceId}`, {
            deviceId: device.deviceId,
            managementIp: device.managementIp,
        });

        try {
            // 1. Decrypt credentials and create API client
            if (!device.apiPasswordEncrypted || !device.apiUsername) {
                throw new Error('Device credentials not configured');
            }

            const password = await FirewallEncryption.decryptPassword(device.apiPasswordEncrypted);
            const api = new SonicWallAPI({
                baseUrl: `https://${device.managementIp}`,
                username: device.apiUsername,
                password,
            });

            // 2. Get previous state from Redis
            const previousState = await FirewallPollingStateService.getState(device.deviceId);

            // 3. Poll all API endpoints
            const [stats, interfaces, systemStatus, vpnPolicies, licenses] = await Promise.all([
                api.getSecurityStatistics(),
                api.getInterfaces(),
                api.getSystemStatus(),
                api.getVPNPolicies(),
                api.getLicenses(),
            ]);

            // 4. Detect counter changes (Task 3.2)
            if (previousState) {
                await this.detectAndAlertCounterChanges(device, stats, previousState);
            }

            // 5. Detect status changes (Task 3.3)
            if (previousState) {
                await this.detectAndAlertStatusChanges(device, systemStatus, interfaces, vpnPolicies, previousState);
            }

            // 6. Create health snapshot if needed (Task 3.4)
            const shouldSnapshot = await FirewallPollingStateService.shouldCreateSnapshot(device.deviceId);
            if (shouldSnapshot) {
                await this.storeHealthSnapshot(device.deviceId, systemStatus, interfaces, vpnPolicies);
                await FirewallPollingStateService.updateSnapshotTime(device.deviceId);
            }

            // 7. Store security posture (Task 3.5)
            await this.storeSecurityPosture(device.deviceId, stats, licenses);

            // 8. Track licenses and generate alerts (Task 3.6)
            await this.trackLicenses(device.deviceId, device.tenantId, licenses);

            // 9. Check health metrics and generate alerts (Task 3.7)
            await this.checkHealthMetrics(device.deviceId, device.tenantId, systemStatus);

            // 10. Update device last_seen_at
            await this.updateDeviceLastSeen(device.deviceId);

            // 11. Store current state in Redis for next poll
            await this.storeCurrentState(device.deviceId, stats, systemStatus, interfaces, vpnPolicies);

            logger.debug(`Successfully polled device ${device.deviceId}`);
        } catch (error) {
            logger.error(`Failed to poll device ${device.deviceId}`, error instanceof Error ? error : undefined, {
                deviceId: device.deviceId,
                managementIp: device.managementIp,
            });
            throw error;
        }
    }

    /**
     * Set polling interval
     * 
     * Updates the polling interval and restarts the cron job if running.
     * 
     * @param interval - New polling interval in milliseconds
     */
    setPollingInterval(interval: number): void {
        if (interval < 1000) {
            throw new Error('Polling interval must be at least 1000ms (1 second)');
        }

        logger.info(`Updating polling interval from ${this.pollingInterval}ms to ${interval}ms`);
        this.pollingInterval = interval;

        // Restart cron job if running
        if (this.isRunning) {
            logger.info('Restarting polling engine with new interval');
            this.stop().then(() => this.start());
        }
    }

    /**
     * Convert polling interval to cron expression
     * 
     * @param intervalMs - Interval in milliseconds
     * @returns Cron expression
     */
    private getCronExpression(intervalMs: number): string {
        const seconds = Math.floor(intervalMs / 1000);

        if (seconds < 60) {
            // Every N seconds: */N * * * * *
            return `*/${seconds} * * * * *`;
        } else if (seconds < 3600) {
            // Every N minutes: 0 */N * * * *
            const minutes = Math.floor(seconds / 60);
            return `0 */${minutes} * * * *`;
        } else {
            // Every N hours: 0 0 */N * * *
            const hours = Math.floor(seconds / 3600);
            return `0 0 */${hours} * * *`;
        }
    }

    /**
     * Get current running status
     * 
     * @returns True if polling engine is running
     */
    isPolling(): boolean {
        return this.isRunning;
    }

    /**
     * Get number of devices being polled
     * 
     * @returns Number of active devices
     */
    getDeviceCount(): number {
        return this.devices.length;
    }

    /**
     * Reload devices from database
     * 
     * Useful when devices are added/removed/updated.
     */
    async reloadDevices(): Promise<void> {
        logger.info('Reloading devices from database');
        await this.loadDevices();
        logger.info(`Reloaded ${this.devices.length} active devices`);
    }

    /**
     * Detect counter changes and generate alerts (Task 3.2)
     * 
     * Requirements: 2.7 - Generate alerts when counters increase
     */
    private async detectAndAlertCounterChanges(
        device: FirewallDevice,
        stats: SecurityStats,
        previousState: DevicePollingState
    ): Promise<void> {
        const alerts: any[] = [];

        // Check IPS blocks
        if (stats.ips_blocks_today > previousState.lastCounters.ipsBlocks) {
            alerts.push({
                tenantId: device.tenantId,
                deviceId: device.deviceId,
                alertType: 'ips_counter_increase',
                severity: 'info',
                message: `IPS blocks increased from ${previousState.lastCounters.ipsBlocks} to ${stats.ips_blocks_today}`,
                source: 'api',
                metadata: {
                    previous: previousState.lastCounters.ipsBlocks,
                    current: stats.ips_blocks_today,
                    delta: stats.ips_blocks_today - previousState.lastCounters.ipsBlocks,
                },
            });
        }

        // Check GAV blocks
        if (stats.gav_blocks_today > previousState.lastCounters.gavBlocks) {
            alerts.push({
                tenantId: device.tenantId,
                deviceId: device.deviceId,
                alertType: 'gav_counter_increase',
                severity: 'info',
                message: `Gateway AV blocks increased from ${previousState.lastCounters.gavBlocks} to ${stats.gav_blocks_today}`,
                source: 'api',
                metadata: {
                    previous: previousState.lastCounters.gavBlocks,
                    current: stats.gav_blocks_today,
                    delta: stats.gav_blocks_today - previousState.lastCounters.gavBlocks,
                },
            });
        }

        // Check ATP verdicts
        if (stats.atp_verdicts_today > previousState.lastCounters.atpVerdicts) {
            alerts.push({
                tenantId: device.tenantId,
                deviceId: device.deviceId,
                alertType: 'atp_counter_increase',
                severity: 'info',
                message: `ATP verdicts increased from ${previousState.lastCounters.atpVerdicts} to ${stats.atp_verdicts_today}`,
                source: 'api',
                metadata: {
                    previous: previousState.lastCounters.atpVerdicts,
                    current: stats.atp_verdicts_today,
                    delta: stats.atp_verdicts_today - previousState.lastCounters.atpVerdicts,
                },
            });
        }

        // Create alerts in database
        if (alerts.length > 0 && db) {
            await db.insert(firewallAlerts).values(alerts);
            logger.info(`Generated ${alerts.length} counter change alerts for device ${device.deviceId}`);
        }
    }

    /**
     * Detect status changes and generate alerts (Task 3.3)
     * 
     * Requirements: 2.8-2.10 - Detect WAN/VPN/feature status changes
     */
    private async detectAndAlertStatusChanges(
        device: FirewallDevice,
        systemStatus: SystemHealth,
        interfaces: InterfaceStatus[],
        vpnPolicies: VPNPolicy[],
        previousState: DevicePollingState
    ): Promise<void> {
        const alerts: any[] = [];

        // Determine current statuses
        const currentWANStatus = this.determineWANStatus(interfaces);
        const currentVPNStatus = this.determineVPNStatus(vpnPolicies);

        // Check WAN status change
        if (currentWANStatus !== previousState.lastStatus.wanStatus) {
            const severity = currentWANStatus === 'down' ? 'critical' : 'info';
            alerts.push({
                tenantId: device.tenantId,
                deviceId: device.deviceId,
                alertType: 'wan_status_change',
                severity,
                message: `WAN status changed from ${previousState.lastStatus.wanStatus} to ${currentWANStatus}`,
                source: 'api',
                metadata: {
                    previous: previousState.lastStatus.wanStatus,
                    current: currentWANStatus,
                },
            });
        }

        // Check VPN status change
        if (currentVPNStatus !== previousState.lastStatus.vpnStatus) {
            const severity = currentVPNStatus === 'down' ? 'high' : 'info';
            alerts.push({
                tenantId: device.tenantId,
                deviceId: device.deviceId,
                alertType: 'vpn_status_change',
                severity,
                message: `VPN status changed from ${previousState.lastStatus.vpnStatus} to ${currentVPNStatus}`,
                source: 'api',
                metadata: {
                    previous: previousState.lastStatus.vpnStatus,
                    current: currentVPNStatus,
                },
            });
        }

        // Create alerts in database
        if (alerts.length > 0 && db) {
            await db.insert(firewallAlerts).values(alerts);
            logger.info(`Generated ${alerts.length} status change alerts for device ${device.deviceId}`);
        }
    }

    /**
     * Store health snapshot (Task 3.4)
     * 
     * Requirements: 3.1-3.8 - Create snapshot every 4-6 hours
     */
    private async storeHealthSnapshot(
        deviceId: string,
        systemStatus: SystemHealth,
        interfaces: InterfaceStatus[],
        vpnPolicies: VPNPolicy[]
    ): Promise<void> {
        if (!db) {
            logger.warn('Database not available, skipping health snapshot');
            return;
        }

        const wanStatus = this.determineWANStatus(interfaces);
        const vpnStatus = this.determineVPNStatus(vpnPolicies);
        const interfaceStatus = this.buildInterfaceStatusMap(interfaces);

        await db.insert(firewallHealthSnapshots).values({
            deviceId,
            cpuPercent: systemStatus.cpu_percent,
            ramPercent: systemStatus.ram_percent,
            uptimeSeconds: systemStatus.uptime_seconds,
            wanStatus,
            vpnStatus,
            interfaceStatus,
            wifiStatus: 'unknown', // TODO: Extract from API if available
            haStatus: this.determineHAStatus(systemStatus),
            timestamp: new Date(),
        });

        logger.debug(`Stored health snapshot for device ${deviceId}`);
    }

    /**
     * Store security posture (Task 3.5)
     * 
     * Requirements: 4.1-4.7, 7.11-7.17 - Infer feature status from counters
     */
    private async storeSecurityPosture(
        deviceId: string,
        stats: SecurityStats,
        licenses: LicenseInfo
    ): Promise<void> {
        if (!db) {
            logger.warn('Database not available, skipping security posture');
            return;
        }

        // Infer feature status from counter presence (Requirements 7.11-7.17)
        const ipsEnabled = stats.ips_blocks_today !== null && stats.ips_blocks_today !== undefined;
        const gavEnabled = stats.gav_blocks_today !== null && stats.gav_blocks_today !== undefined;
        const dpiSslEnabled = stats.dpi_ssl_blocks_today !== null && stats.dpi_ssl_blocks_today !== undefined;
        const atpEnabled = stats.atp_verdicts_today !== null && stats.atp_verdicts_today !== undefined;
        const botnetEnabled = stats.botnet_blocks_today !== null && stats.botnet_blocks_today !== undefined;
        const appControlEnabled = stats.app_control_blocks_today !== null && stats.app_control_blocks_today !== undefined;

        const contentFilterEnabled = stats.content_filter_blocks_today !== null && stats.content_filter_blocks_today !== undefined;

        await db.insert(firewallSecurityPosture).values({
            deviceId,
            ipsEnabled,
            ipsLicenseStatus: this.determineLicenseStatus(licenses.ips_expiry),
            ipsDailyBlocks: stats.ips_blocks_today || 0,
            gavEnabled,
            gavLicenseStatus: this.determineLicenseStatus(licenses.gav_expiry),
            gavDailyBlocks: stats.gav_blocks_today || 0,
            dpiSslEnabled,
            dpiSslCertificateStatus: 'valid', // TODO: Extract from API if available
            dpiSslDailyBlocks: stats.dpi_ssl_blocks_today || 0,
            atpEnabled,
            atpLicenseStatus: this.determineLicenseStatus(licenses.atp_expiry),
            atpDailyVerdicts: stats.atp_verdicts_today || 0,
            botnetFilterEnabled: botnetEnabled,
            botnetDailyBlocks: stats.botnet_blocks_today || 0,
            appControlEnabled,
            appControlLicenseStatus: this.determineLicenseStatus(licenses.app_control_expiry),
            appControlDailyBlocks: stats.app_control_blocks_today || 0,
            contentFilterEnabled,
            contentFilterLicenseStatus: this.determineLicenseStatus(licenses.content_filter_expiry),
            contentFilterDailyBlocks: stats.content_filter_blocks_today || 0,
            timestamp: new Date(),
        });

        logger.debug(`Stored security posture for device ${deviceId}`);
    }

    /**
     * Track licenses and generate alerts (Task 3.6)
     * 
     * Requirements: 5.1-5.7 - Alert on license expiry
     */
    private async trackLicenses(
        deviceId: string,
        tenantId: string,
        licenses: LicenseInfo
    ): Promise<void> {
        if (!db) {
            logger.warn('Database not available, skipping license tracking');
            return;
        }

        const alerts: any[] = [];
        const licenseWarnings: string[] = [];

        // Check each license
        const licenseChecks = [
            { name: 'IPS', expiry: licenses.ips_expiry },
            { name: 'Gateway AV', expiry: licenses.gav_expiry },
            { name: 'ATP', expiry: licenses.atp_expiry },
            { name: 'App Control', expiry: licenses.app_control_expiry },
            { name: 'Content Filter', expiry: licenses.content_filter_expiry },
            { name: 'Support', expiry: licenses.support_expiry },
        ];

        for (const license of licenseChecks) {
            if (!license.expiry) continue;

            const daysRemaining = this.calculateDaysRemaining(license.expiry);

            if (daysRemaining < 0) {
                // Expired
                alerts.push({
                    tenantId,
                    deviceId,
                    alertType: 'license_expired',
                    severity: 'critical',
                    message: `${license.name} license expired ${Math.abs(daysRemaining)} days ago`,
                    source: 'api',
                    metadata: { licenseName: license.name, expiryDate: license.expiry, daysRemaining },
                });
                licenseWarnings.push(`${license.name} expired`);
            } else if (daysRemaining < 30) {
                // Expiring soon
                alerts.push({
                    tenantId,
                    deviceId,
                    alertType: 'license_expiring',
                    severity: 'warning',
                    message: `${license.name} license expiring in ${daysRemaining} days`,
                    source: 'api',
                    metadata: { licenseName: license.name, expiryDate: license.expiry, daysRemaining },
                });
                licenseWarnings.push(`${license.name} expiring in ${daysRemaining} days`);
            }
        }

        // Store license information
        const licenseData: any = {
            deviceId,
            ipsExpiry: licenses.ips_expiry ? new Date(licenses.ips_expiry) : null,
            gavExpiry: licenses.gav_expiry ? new Date(licenses.gav_expiry) : null,
            atpExpiry: licenses.atp_expiry ? new Date(licenses.atp_expiry) : null,
            appControlExpiry: licenses.app_control_expiry ? new Date(licenses.app_control_expiry) : null,
            contentFilterExpiry: licenses.content_filter_expiry ? new Date(licenses.content_filter_expiry) : null,
            supportExpiry: licenses.support_expiry ? new Date(licenses.support_expiry) : null,
            licenseWarnings,
            timestamp: new Date(),
        };
        await db.insert(firewallLicenses).values(licenseData);

        // Create alerts
        if (alerts.length > 0) {
            await db.insert(firewallAlerts).values(alerts);
            logger.info(`Generated ${alerts.length} license alerts for device ${deviceId}`);
        }
    }

    /**
     * Check health metrics and generate alerts (Task 3.7)
     * 
     * Requirements: 2.11 - Alert on high CPU/RAM
     * Requirements: 12.2 - Deduplicate alerts within 2 minutes
     */
    private async checkHealthMetrics(
        deviceId: string,
        tenantId: string,
        systemStatus: SystemHealth
    ): Promise<void> {
        if (!db) {
            logger.warn('Database not available, skipping health metric alerts');
            return;
        }

        const alerts: any[] = [];

        // Check CPU threshold (> 80%)
        if (systemStatus.cpu_percent > 80) {
            const shouldAlert = await this.shouldGenerateAlert(
                deviceId,
                'high_cpu',
                'warning',
                { cpuPercent: systemStatus.cpu_percent }
            );

            if (shouldAlert) {
                alerts.push({
                    tenantId,
                    deviceId,
                    alertType: 'high_cpu',
                    severity: 'warning',
                    message: `CPU usage is ${systemStatus.cpu_percent.toFixed(1)}% (threshold: 80%)`,
                    source: 'api',
                    metadata: { cpuPercent: systemStatus.cpu_percent, threshold: 80 },
                });
            } else {
                logger.debug('Skipping duplicate high_cpu alert', { deviceId, cpuPercent: systemStatus.cpu_percent });
            }
        }

        // Check RAM threshold (> 90%)
        if (systemStatus.ram_percent > 90) {
            const shouldAlert = await this.shouldGenerateAlert(
                deviceId,
                'high_ram',
                'warning',
                { ramPercent: systemStatus.ram_percent }
            );

            if (shouldAlert) {
                alerts.push({
                    tenantId,
                    deviceId,
                    alertType: 'high_ram',
                    severity: 'warning',
                    message: `RAM usage is ${systemStatus.ram_percent.toFixed(1)}% (threshold: 90%)`,
                    source: 'api',
                    metadata: { ramPercent: systemStatus.ram_percent, threshold: 90 },
                });
            } else {
                logger.debug('Skipping duplicate high_ram alert', { deviceId, ramPercent: systemStatus.ram_percent });
            }
        }

        // Create alerts
        if (alerts.length > 0) {
            // Store alert keys in Redis for deduplication
            for (const alert of alerts) {
                await this.recordAlertGenerated(alert.deviceId, alert.alertType, alert.severity, alert.metadata);
            }

            await db.insert(firewallAlerts).values(alerts);
            logger.info(`Generated ${alerts.length} health metric alerts for device ${deviceId}`);
        }
    }

    /**
     * Update device last_seen_at timestamp
     */
    private async updateDeviceLastSeen(deviceId: string): Promise<void> {
        if (!db) {
            return;
        }

        await db
            .update(firewallDevices)
            .set({ lastSeenAt: new Date(), updatedAt: new Date() })
            .where(eq(firewallDevices.id, deviceId));
    }

    /**
     * Store current state in Redis for next poll
     */
    private async storeCurrentState(
        deviceId: string,
        stats: SecurityStats,
        systemStatus: SystemHealth,
        interfaces: InterfaceStatus[],
        vpnPolicies: VPNPolicy[]
    ): Promise<void> {
        const counters = {
            ipsBlocks: stats.ips_blocks_today || 0,
            gavBlocks: stats.gav_blocks_today || 0,
            dpiSslBlocks: stats.dpi_ssl_blocks_today || 0,
            atpVerdicts: stats.atp_verdicts_today || 0,
            appControlBlocks: stats.app_control_blocks_today || 0,
            botnetBlocks: stats.botnet_blocks_today || 0,
            contentFilterBlocks: stats.content_filter_blocks_today || 0,
            blockedConnections: stats.blocked_connections || 0,
        };

        await FirewallPollingStateService.storeState(deviceId, {
            deviceId,
            lastPollTime: new Date(),
            lastCounters: counters,
            lastStatus: {
                wanStatus: this.determineWANStatus(interfaces),
                vpnStatus: this.determineVPNStatus(vpnPolicies),
                cpuPercent: systemStatus.cpu_percent,
                ramPercent: systemStatus.ram_percent,
            },
            lastSecurityFeatures: {
                ipsEnabled: stats.ips_blocks_today !== null && stats.ips_blocks_today !== undefined,
                gavEnabled: stats.gav_blocks_today !== null && stats.gav_blocks_today !== undefined,
                dpiSslEnabled: stats.dpi_ssl_blocks_today !== null && stats.dpi_ssl_blocks_today !== undefined,
                atpEnabled: stats.atp_verdicts_today !== null && stats.atp_verdicts_today !== undefined,
                botnetEnabled: stats.botnet_blocks_today !== null && stats.botnet_blocks_today !== undefined,
                appControlEnabled: stats.app_control_blocks_today !== null && stats.app_control_blocks_today !== undefined,
            },
        });

        // Store daily snapshot for metrics rollup
        // Requirements: 9.2 - Capture final counter values from end of day
        // We store a snapshot on every poll, and the metrics aggregator will retrieve
        // the snapshot from the previous day. This ensures we capture the final values
        // before SonicWall resets daily counters.
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        await FirewallPollingStateService.storeDailySnapshot(deviceId, today, counters);
    }

    /**
     * Helper: Determine WAN status from interfaces
     */
    private determineWANStatus(interfaces: InterfaceStatus[]): 'up' | 'down' {
        const wanInterface = interfaces.find(iface => iface.zone.toLowerCase() === 'wan');
        return wanInterface?.status === 'up' ? 'up' : 'down';
    }

    /**
     * Helper: Determine VPN status from policies
     */
    private determineVPNStatus(vpnPolicies: VPNPolicy[]): 'up' | 'down' {
        if (vpnPolicies.length === 0) {
            return 'down';
        }
        const anyUp = vpnPolicies.some(policy => policy.status === 'up');
        return anyUp ? 'up' : 'down';
    }

    /**
     * Helper: Build interface status map
     */
    private buildInterfaceStatusMap(interfaces: InterfaceStatus[]): Record<string, string> {
        const map: Record<string, string> = {};
        for (const iface of interfaces) {
            map[iface.interface_name] = iface.status;
        }
        return map;
    }

    /**
     * Helper: Determine HA status
     */
    private determineHAStatus(systemStatus: SystemHealth): string {
        if (systemStatus.ha_role === 'primary') {
            return 'active';
        } else if (systemStatus.ha_role === 'secondary') {
            return 'standby';
        } else if (systemStatus.ha_state === 'failover') {
            return 'failover';
        }
        return 'standalone';
    }

    /**
     * Helper: Determine license status
     */
    private determineLicenseStatus(expiryDate: string | null): string {
        if (!expiryDate) {
            return 'unknown';
        }

        const daysRemaining = this.calculateDaysRemaining(expiryDate);

        if (daysRemaining < 0) {
            return 'expired';
        } else if (daysRemaining < 30) {
            return 'expiring';
        }
        return 'active';
    }

    /**
     * Helper: Calculate days remaining until expiry
     */
    private calculateDaysRemaining(expiryDate: string): number {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffMs = expiry.getTime() - now.getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Check if an alert should be generated (deduplication)
     * 
     * Requirements: 12.2 - Deduplicate alerts within 2 minutes if values haven't changed
     * 
     * @param deviceId - Device ID
     * @param alertType - Alert type
     * @param severity - Alert severity
     * @param metadata - Alert metadata (for value comparison)
     * @returns True if alert should be generated
     */
    private async shouldGenerateAlert(
        deviceId: string,
        alertType: string,
        severity: string,
        metadata: Record<string, any>
    ): Promise<boolean> {
        try {
            const client = await connectRedis();
            if (!client) {
                // If Redis unavailable, allow alert (fail open)
                logger.warn('Redis not available for alert deduplication, allowing alert', {
                    deviceId,
                    alertType,
                });
                return true;
            }

            // Create deduplication key
            const dedupKey = `firewall:alert:dedup:${deviceId}:${alertType}:${severity}`;

            // Check if alert exists in Redis
            const existingData = await client.get(dedupKey);

            if (existingData) {
                // Alert exists, check if values have changed
                const existingMetadata = JSON.parse(existingData);

                // Compare metadata values
                const valuesChanged = this.hasMetadataChanged(existingMetadata, metadata);

                if (!valuesChanged) {
                    // Values haven't changed, skip duplicate alert
                    logger.debug('Skipping duplicate alert (values unchanged)', {
                        deviceId,
                        alertType,
                        severity,
                    });
                    return false;
                }

                // Values changed, allow new alert
                logger.debug('Allowing alert (values changed)', {
                    deviceId,
                    alertType,
                    severity,
                    previous: existingMetadata,
                    current: metadata,
                });
                return true;
            }

            // No existing alert, allow new alert
            return true;
        } catch (error) {
            logger.error('Failed to check alert deduplication', error instanceof Error ? error : undefined, {
                deviceId,
                alertType,
            });
            // On error, allow alert (fail open)
            return true;
        }
    }

    /**
     * Record that an alert was generated (for deduplication)
     * 
     * Stores alert metadata in Redis with 2-minute TTL for deduplication.
     * 
     * @param deviceId - Device ID
     * @param alertType - Alert type
     * @param severity - Alert severity
     * @param metadata - Alert metadata
     */
    private async recordAlertGenerated(
        deviceId: string,
        alertType: string,
        severity: string,
        metadata: Record<string, any>
    ): Promise<void> {
        try {
            const client = await connectRedis();
            if (!client) {
                return;
            }

            const dedupKey = `firewall:alert:dedup:${deviceId}:${alertType}:${severity}`;
            const ttl = 120; // 2 minutes in seconds

            await client.setEx(dedupKey, ttl, JSON.stringify(metadata));

            logger.debug('Recorded alert for deduplication', {
                deviceId,
                alertType,
                severity,
                ttl,
            });
        } catch (error) {
            logger.error('Failed to record alert for deduplication', error instanceof Error ? error : undefined, {
                deviceId,
                alertType,
            });
        }
    }

    /**
     * Check if metadata values have changed
     * 
     * Compares two metadata objects to determine if values have changed.
     * 
     * @param previous - Previous metadata
     * @param current - Current metadata
     * @returns True if values have changed
     */
    private hasMetadataChanged(
        previous: Record<string, any>,
        current: Record<string, any>
    ): boolean {
        // Get all keys from both objects
        const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

        // Check if any value has changed
        for (const key of allKeys) {
            const prevValue = previous[key];
            const currValue = current[key];

            // For numeric values, check if difference is significant (> 1%)
            if (typeof prevValue === 'number' && typeof currValue === 'number') {
                const percentChange = Math.abs((currValue - prevValue) / prevValue) * 100;
                if (percentChange > 1) {
                    return true;
                }
            } else if (prevValue !== currValue) {
                // For non-numeric values, check exact equality
                return true;
            }
        }

        return false;
    }
}
