/**
 * EDR Polling Worker Service
 * 
 * Scheduled service that polls Microsoft Graph API for EDR data across all active tenants.
 * Retrieves devices, alerts, vulnerabilities, and compliance data, normalizes it,
 * stores it in the database, and calculates posture scores.
 * 
 * Features:
 * - Multi-tenant support with error isolation
 * - Credential retrieval from AWS Secrets Manager
 * - Retry logic with exponential backoff
 * - Comprehensive logging and metrics
 * - Tenant-level failure isolation
 * 
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 8.2, 8.3
 */

import { logger } from '../lib/logger';
import { db } from '../lib/database';
import { tenants } from '../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { createMicrosoftGraphClient } from '../lib/microsoft-graph-client';
import {
    normalizeDevice,
    mergeDevices,
    normalizeAlert,
    normalizeVulnerability,
    normalizeCompliance,
} from '../lib/edr-normalizer';
import {
    upsertDevices,
    upsertAlerts,
    upsertVulnerabilities,
    upsertComplianceRecords,
    getDeviceById,
    linkDeviceVulnerabilities,
} from '../lib/edr-database-operations';
import { calculateAndStorePostureScore } from '../lib/edr-posture-calculator';
import type { MicrosoftGraphCredentials } from '../types/edr';

// Secrets Manager
import { getCredentials as getSecretsManagerCredentials, clearCache as clearCredentialsCache } from '../lib/secrets-manager';

/**
 * Polling execution result for a single tenant
 */
export interface TenantPollResult {
    tenantId: string;
    tenantName: string;
    success: boolean;
    duration: number; // milliseconds
    deviceCount: number;
    alertCount: number;
    vulnerabilityCount: number;
    complianceCount: number;
    postureScore?: number;
    error?: string;
}

/**
 * Overall polling execution result
 */
export interface PollResult {
    executionId: string;
    startTime: Date;
    endTime: Date;
    duration: number; // milliseconds
    tenantResults: TenantPollResult[];
    successCount: number;
    failureCount: number;
    totalDevices: number;
    totalAlerts: number;
    totalVulnerabilities: number;
}

/**
 * Retry configuration
 */
interface RetryConfig {
    maxRetries: number;
    initialDelay: number; // milliseconds
    maxDelay: number; // milliseconds
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 60000, // 1 minute
    backoffMultiplier: 2,
};

// Secrets Manager client is now handled by the secrets-manager module

/**
 * EDR Polling Worker
 */
export class EDRPollingWorker {
    private retryConfig: RetryConfig;

    constructor(retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
        this.retryConfig = retryConfig;
    }

    /**
     * Main execution function - polls all active tenants
     */
    async execute(): Promise<PollResult> {
        const executionId = `poll-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const startTime = new Date();

        logger.info('Starting EDR polling execution', { executionId });

        try {
            // Retrieve list of active tenants with Microsoft integration enabled
            const activeTenants = await this.getActiveTenants();

            logger.info('Retrieved active tenants', {
                executionId,
                tenantCount: activeTenants.length,
            });

            // Poll each tenant with error isolation
            const tenantResults: TenantPollResult[] = [];

            for (const tenant of activeTenants) {
                try {
                    const result = await this.pollTenant(tenant.id, tenant.name);
                    tenantResults.push(result);

                    if (result.success) {
                        logger.info('Tenant polling succeeded', {
                            executionId,
                            tenantId: tenant.id,
                            tenantName: tenant.name,
                            duration: result.duration,
                            deviceCount: result.deviceCount,
                            alertCount: result.alertCount,
                        });
                    } else {
                        logger.error('Tenant polling failed', new Error(result.error), {
                            executionId,
                            tenantId: tenant.id,
                            tenantName: tenant.name,
                        });
                    }
                } catch (error) {
                    // Catch any unexpected errors to prevent one tenant from breaking the entire execution
                    logger.error('Unexpected error polling tenant', error as Error, {
                        executionId,
                        tenantId: tenant.id,
                        tenantName: tenant.name,
                    });

                    tenantResults.push({
                        tenantId: tenant.id,
                        tenantName: tenant.name,
                        success: false,
                        duration: 0,
                        deviceCount: 0,
                        alertCount: 0,
                        vulnerabilityCount: 0,
                        complianceCount: 0,
                        error: (error as Error).message,
                    });
                }
            }

            // Calculate summary metrics
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            const successCount = tenantResults.filter((r) => r.success).length;
            const failureCount = tenantResults.filter((r) => !r.success).length;
            const totalDevices = tenantResults.reduce((sum, r) => sum + r.deviceCount, 0);
            const totalAlerts = tenantResults.reduce((sum, r) => sum + r.alertCount, 0);
            const totalVulnerabilities = tenantResults.reduce((sum, r) => sum + r.vulnerabilityCount, 0);

            const result: PollResult = {
                executionId,
                startTime,
                endTime,
                duration,
                tenantResults,
                successCount,
                failureCount,
                totalDevices,
                totalAlerts,
                totalVulnerabilities,
            };

            logger.info('EDR polling execution completed', {
                executionId,
                duration,
                successCount,
                failureCount,
                totalDevices,
                totalAlerts,
                totalVulnerabilities,
            });

            return result;
        } catch (error) {
            logger.error('EDR polling execution failed', error as Error, { executionId });
            throw error;
        } finally {
            // Always clear credential cache after polling cycle completes
            clearCredentialsCache();
            logger.debug('Cleared credential cache after polling cycle');
        }
    }

    /**
     * Poll a single tenant
     */
    async pollTenant(tenantId: string, tenantName: string): Promise<TenantPollResult> {
        const startTime = Date.now();

        try {
            logger.info('Starting tenant polling', { tenantId, tenantName });

            // Retrieve credentials from AWS Secrets Manager
            const credentials = await this.getCredentials(tenantId);

            // Create Microsoft Graph API client
            const graphClient = createMicrosoftGraphClient(credentials);

            // Fetch all data types
            const [defenderDevices, intuneDevices, alerts, vulnerabilities, compliance] =
                await Promise.all([
                    this.fetchDefenderDevices(graphClient, tenantId),
                    this.fetchIntuneDevices(graphClient, tenantId),
                    this.fetchAlerts(graphClient, tenantId),
                    this.fetchVulnerabilities(graphClient, tenantId),
                    this.fetchCompliance(graphClient, tenantId),
                ]);

            // Normalize and merge device data
            const normalizedDevices = mergeDevices(defenderDevices, intuneDevices, tenantId);

            // Store devices
            const storedDevices = await upsertDevices(normalizedDevices);

            logger.info('Stored devices', {
                tenantId,
                count: storedDevices.length,
            });

            // Normalize and store alerts
            const normalizedAlerts = [];
            for (const alert of alerts) {
                // Find the device ID for this alert
                const deviceMicrosoftId = alert.devices?.[0]?.deviceId;
                if (!deviceMicrosoftId) {
                    logger.warn('Alert has no associated device', {
                        tenantId,
                        alertId: alert.id,
                    });
                    continue;
                }

                // Find the stored device
                const storedDevice = storedDevices.find(
                    (d) => normalizedDevices.find((nd) => nd.microsoftDeviceId === deviceMicrosoftId)
                );

                if (!storedDevice) {
                    logger.warn('Could not find stored device for alert', {
                        tenantId,
                        alertId: alert.id,
                        deviceMicrosoftId,
                    });
                    continue;
                }

                normalizedAlerts.push(normalizeAlert(alert, tenantId, storedDevice.id));
            }

            const storedAlerts = await upsertAlerts(normalizedAlerts);

            logger.info('Stored alerts', {
                tenantId,
                count: storedAlerts.length,
            });

            // Normalize and store vulnerabilities
            const normalizedVulnerabilities = vulnerabilities.map((vuln) =>
                normalizeVulnerability(vuln, tenantId)
            );

            const storedVulnerabilities = await upsertVulnerabilities(normalizedVulnerabilities);

            logger.info('Stored vulnerabilities', {
                tenantId,
                count: storedVulnerabilities.length,
            });

            // Link vulnerabilities to devices
            for (let i = 0; i < vulnerabilities.length; i++) {
                const vuln = vulnerabilities[i];
                const storedVuln = storedVulnerabilities[i];

                if (vuln.affectedDevices && vuln.affectedDevices.length > 0) {
                    // Find the stored device IDs for affected devices
                    const affectedDeviceIds: string[] = [];

                    for (const microsoftDeviceId of vuln.affectedDevices) {
                        const storedDevice = storedDevices.find(
                            (d) =>
                                normalizedDevices.find(
                                    (nd) => nd.microsoftDeviceId === microsoftDeviceId
                                )
                        );

                        if (storedDevice) {
                            affectedDeviceIds.push(storedDevice.id);
                        }
                    }

                    if (affectedDeviceIds.length > 0) {
                        await linkDeviceVulnerabilities(storedVuln.id, affectedDeviceIds);
                    }
                }
            }

            // Normalize and store compliance
            const normalizedCompliance = [];
            for (const comp of compliance) {
                // Find the stored device for this compliance record
                const storedDevice = storedDevices.find(
                    (d) => normalizedDevices.find((nd) => nd.microsoftDeviceId === comp.deviceId)
                );

                if (!storedDevice) {
                    logger.warn('Could not find stored device for compliance', {
                        tenantId,
                        deviceId: comp.deviceId,
                    });
                    continue;
                }

                normalizedCompliance.push(normalizeCompliance(comp, tenantId, storedDevice.id));
            }

            const storedCompliance = await upsertComplianceRecords(normalizedCompliance);

            logger.info('Stored compliance records', {
                tenantId,
                count: storedCompliance.length,
            });

            // Calculate and store posture score
            const postureScore = await calculateAndStorePostureScore(tenantId);

            logger.info('Calculated posture score', {
                tenantId,
                score: postureScore.score,
            });

            const duration = Date.now() - startTime;

            return {
                tenantId,
                tenantName,
                success: true,
                duration,
                deviceCount: storedDevices.length,
                alertCount: storedAlerts.length,
                vulnerabilityCount: storedVulnerabilities.length,
                complianceCount: storedCompliance.length,
                postureScore: postureScore.score,
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error('Tenant polling failed', error as Error, {
                tenantId,
                tenantName,
                duration,
            });

            return {
                tenantId,
                tenantName,
                success: false,
                duration,
                deviceCount: 0,
                alertCount: 0,
                vulnerabilityCount: 0,
                complianceCount: 0,
                error: (error as Error).message,
            };
        }
    }

    /**
     * Get list of active tenants with Microsoft integration enabled
     */
    private async getActiveTenants(): Promise<Array<{ id: string; name: string }>> {
        try {
            const result = await db
                .select({
                    id: tenants.id,
                    name: tenants.name,
                })
                .from(tenants)
                .where(eq(tenants.is_active, true));

            return result;
        } catch (error) {
            logger.error('Failed to retrieve active tenants', error as Error);
            throw error;
        }
    }

    /**
     * Retrieve Microsoft API credentials from AWS Secrets Manager
     * Credentials are cached in memory for the duration of the polling cycle only
     */
    private async getCredentials(tenantId: string): Promise<MicrosoftGraphCredentials> {
        try {
            logger.debug('Retrieving credentials from Secrets Manager', {
                tenantId,
            });

            // Use the centralized secrets manager module
            const credentials = await getSecretsManagerCredentials(tenantId);

            logger.debug('Successfully retrieved credentials', { tenantId });

            return credentials as MicrosoftGraphCredentials;
        } catch (error) {
            logger.error('Failed to retrieve credentials from Secrets Manager', error as Error, {
                tenantId,
            });
            throw new Error(`Failed to retrieve credentials for tenant ${tenantId}: ${(error as Error).message}`);
        }
    }

    /**
     * Fetch Defender devices with retry logic
     */
    private async fetchDefenderDevices(
        graphClient: ReturnType<typeof createMicrosoftGraphClient>,
        tenantId: string
    ) {
        return this.withRetry(
            async () => {
                const devices = await graphClient.getDefenderDevices(tenantId);
                logger.debug('Fetched Defender devices', {
                    tenantId,
                    count: devices.length,
                });
                return devices;
            },
            'fetchDefenderDevices',
            tenantId
        );
    }

    /**
     * Fetch Intune devices with retry logic
     */
    private async fetchIntuneDevices(
        graphClient: ReturnType<typeof createMicrosoftGraphClient>,
        tenantId: string
    ) {
        return this.withRetry(
            async () => {
                const devices = await graphClient.getIntuneDevices(tenantId);
                logger.debug('Fetched Intune devices', {
                    tenantId,
                    count: devices.length,
                });
                return devices;
            },
            'fetchIntuneDevices',
            tenantId
        );
    }

    /**
     * Fetch alerts with retry logic
     */
    private async fetchAlerts(
        graphClient: ReturnType<typeof createMicrosoftGraphClient>,
        tenantId: string
    ) {
        return this.withRetry(
            async () => {
                // Fetch alerts from the last 7 days
                const since = new Date();
                since.setDate(since.getDate() - 7);

                const alerts = await graphClient.getDefenderAlerts(tenantId, since);
                logger.debug('Fetched alerts', {
                    tenantId,
                    count: alerts.length,
                });
                return alerts;
            },
            'fetchAlerts',
            tenantId
        );
    }

    /**
     * Fetch vulnerabilities with retry logic
     */
    private async fetchVulnerabilities(
        graphClient: ReturnType<typeof createMicrosoftGraphClient>,
        tenantId: string
    ) {
        return this.withRetry(
            async () => {
                const vulnerabilities = await graphClient.getVulnerabilities(tenantId);
                logger.debug('Fetched vulnerabilities', {
                    tenantId,
                    count: vulnerabilities.length,
                });
                return vulnerabilities;
            },
            'fetchVulnerabilities',
            tenantId
        );
    }

    /**
     * Fetch compliance data with retry logic
     */
    private async fetchCompliance(
        graphClient: ReturnType<typeof createMicrosoftGraphClient>,
        tenantId: string
    ) {
        return this.withRetry(
            async () => {
                const compliance = await graphClient.getDeviceCompliance(tenantId);
                logger.debug('Fetched compliance data', {
                    tenantId,
                    count: compliance.length,
                });
                return compliance;
            },
            'fetchCompliance',
            tenantId
        );
    }

    /**
     * Execute a function with retry logic and exponential backoff
     */
    private async withRetry<T>(
        fn: () => Promise<T>,
        operation: string,
        tenantId: string
    ): Promise<T> {
        let lastError: Error | null = null;
        let delay = this.retryConfig.initialDelay;

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;

                if (attempt < this.retryConfig.maxRetries) {
                    logger.warn('Operation failed, retrying', {
                        operation,
                        tenantId,
                        attempt: attempt + 1,
                        maxRetries: this.retryConfig.maxRetries,
                        delay,
                        error: lastError.message,
                    });

                    // Wait before retrying
                    await this.sleep(delay);

                    // Calculate next delay with exponential backoff
                    delay = Math.min(
                        delay * this.retryConfig.backoffMultiplier,
                        this.retryConfig.maxDelay
                    );
                } else {
                    logger.error('Operation failed after all retries', lastError, {
                        operation,
                        tenantId,
                        attempts: attempt + 1,
                    });
                }
            }
        }

        throw lastError;
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * Create and execute the polling worker
 * This is the main entry point for scheduled executions
 */
export async function runPollingWorker(): Promise<PollResult> {
    const worker = new EDRPollingWorker();
    return worker.execute();
}

/**
 * Lambda handler for AWS Lambda execution
 */
export async function handler(): Promise<{
    statusCode: number;
    body: string;
}> {
    try {
        const result = await runPollingWorker();

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                result,
            }),
        };
    } catch (error) {
        logger.error('Lambda handler error', error as Error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: (error as Error).message,
            }),
        };
    }
}
