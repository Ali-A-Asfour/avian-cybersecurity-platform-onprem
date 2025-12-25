/**
 * Worker Entry Point
 * 
 * This script is the entry point for background workers that run as scheduled ECS tasks.
 * It routes execution to the appropriate worker based on the WORKER_TYPE environment variable.
 * 
 * Supported Worker Types:
 * - edr-polling: Polls Microsoft Graph API for EDR data (every 15 minutes)
 * - metrics-aggregation: Creates daily metrics rollup records (daily at midnight)
 * - email-alerts: Processes SonicWall alert emails (every 5 minutes)
 * 
 * Usage:
 *   WORKER_TYPE=edr-polling node dist/workers/index.js
 *   WORKER_TYPE=metrics-aggregation node dist/workers/index.js
 *   WORKER_TYPE=email-alerts node dist/workers/index.js
 * 
 * Requirements: 8.1, 8.6
 */

import { runPollingWorker } from '../services/edr-polling-worker';
import { MetricsAggregator } from '../lib/metrics-aggregator';
import { EmailAlertListener, getImapConfig } from '../lib/email-alert-listener';
import { logger } from '../lib/logger';

/**
 * Main worker execution function
 */
async function main(): Promise<void> {
    const workerType = process.env.WORKER_TYPE;

    if (!workerType) {
        logger.error('WORKER_TYPE environment variable not set');
        logger.error('Valid values: edr-polling, metrics-aggregation, email-alerts');
        process.exit(1);
    }

    logger.info(`Starting worker: ${workerType}`, {
        workerType,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });

    const startTime = Date.now();

    try {
        switch (workerType) {
            case 'edr-polling':
                await runEDRPolling();
                break;

            case 'metrics-aggregation':
                await runMetricsAggregation();
                break;

            case 'email-alerts':
                await runEmailAlertProcessing();
                break;

            default:
                logger.error(`Unknown worker type: ${workerType}`);
                logger.error('Valid values: edr-polling, metrics-aggregation, email-alerts');
                process.exit(1);
        }

        const duration = Date.now() - startTime;
        logger.info(`Worker ${workerType} completed successfully`, {
            workerType,
            duration,
            durationSeconds: (duration / 1000).toFixed(2),
        });

        process.exit(0);
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Worker ${workerType} failed`, error as Error, {
            workerType,
            duration,
            durationSeconds: (duration / 1000).toFixed(2),
        });

        process.exit(1);
    }
}

/**
 * Run EDR polling worker
 * 
 * Polls Microsoft Graph API for EDR data across all active tenants.
 * Retrieves devices, alerts, vulnerabilities, and compliance data.
 * 
 * Requirements: 8.3
 */
async function runEDRPolling(): Promise<void> {
    logger.info('Running EDR polling worker');

    const result = await runPollingWorker();

    logger.info('EDR polling completed', {
        executionId: result.executionId,
        duration: result.duration,
        successCount: result.successCount,
        failureCount: result.failureCount,
        totalDevices: result.totalDevices,
        totalAlerts: result.totalAlerts,
        totalVulnerabilities: result.totalVulnerabilities,
    });

    // Log tenant-level results
    for (const tenantResult of result.tenantResults) {
        if (tenantResult.success) {
            logger.info('Tenant polling succeeded', {
                tenantId: tenantResult.tenantId,
                tenantName: tenantResult.tenantName,
                deviceCount: tenantResult.deviceCount,
                alertCount: tenantResult.alertCount,
                vulnerabilityCount: tenantResult.vulnerabilityCount,
                postureScore: tenantResult.postureScore,
            });
        } else {
            logger.error('Tenant polling failed', new Error(tenantResult.error), {
                tenantId: tenantResult.tenantId,
                tenantName: tenantResult.tenantName,
            });
        }
    }

    // Exit with error if all tenants failed
    if (result.failureCount > 0 && result.successCount === 0) {
        throw new Error('All tenant polling attempts failed');
    }
}

/**
 * Run metrics aggregation worker
 * 
 * Creates daily rollup records for firewall metrics using final counter values.
 * 
 * Requirements: 8.4
 */
async function runMetricsAggregation(): Promise<void> {
    logger.info('Running metrics aggregation worker');

    const aggregator = new MetricsAggregator();

    // Run daily rollup for yesterday
    await aggregator.runDailyRollup();

    logger.info('Metrics aggregation completed');
}

/**
 * Run email alert processing worker
 * 
 * Checks for new SonicWall alert emails and creates alert records.
 * 
 * Requirements: 8.5
 */
async function runEmailAlertProcessing(): Promise<void> {
    logger.info('Running email alert processing worker');

    const config = getImapConfig();

    // Validate IMAP configuration
    if (!config.host || !config.user || !config.password) {
        logger.error('IMAP configuration incomplete', {
            hasHost: !!config.host,
            hasUser: !!config.user,
            hasPassword: !!config.password,
        });
        throw new Error('IMAP configuration incomplete. Check environment variables.');
    }

    const emailListener = new EmailAlertListener(config);

    // Check for new emails (single execution, not continuous)
    await emailListener.checkForNewEmails();

    logger.info('Email alert processing completed');
}

// Run main function
main();
