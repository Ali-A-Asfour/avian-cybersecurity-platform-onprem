/**
 * Microsoft Defender Integration Service for Alerts & Security Incidents Module
 * 
 * Provides read-only context retrieval from Microsoft Defender for Endpoint
 * and generates deep-links for external navigation. This service enriches
 * AVIAN alerts with Defender metadata without embedding external UIs.
 * 
 * Features:
 * - Read-only Microsoft Defender context retrieval
 * - Deep-link generation for external navigation (new tab, no embedding)
 * - Graceful API failure handling with connection status indicators
 * - Alert and incident metadata enrichment
 * 
 * Requirements: 4.3, 4.4, 4.5, 12.2, 12.4
 */

import { MicrosoftGraphClient } from '../../lib/microsoft-graph-client';
import { logger } from '../../lib/logger';
import type {
    DefenderDevice,
    DefenderAlert,
    MicrosoftGraphCredentials,
    GraphAPIError,
} from '../../types/edr';
import type {
    DefenderContext,
    DefenderIntegrationConfig,
    SecurityAlert,
} from '../../types/alerts-incidents';

/**
 * Connection status for Microsoft Defender integration
 */
export interface DefenderConnectionStatus {
    isConnected: boolean;
    lastChecked: Date;
    error?: string;
    latencyMs?: number;
}

/**
 * Enriched alert context from Microsoft Defender
 */
export interface DefenderAlertContext {
    // Core Defender metadata
    incidentId: string;
    alertId: string;
    severity: string;
    threatName: string;
    affectedDevice: string;
    affectedUser: string;

    // Deep-link for external navigation
    deepLink: string;

    // Additional context (read-only)
    status?: string;
    classification?: string;
    determination?: string;
    investigationState?: string;
    assignedTo?: string;

    // Device context
    deviceInfo?: {
        computerDnsName: string;
        osPlatform: string;
        osVersion: string;
        healthStatus: string;
        riskScore: number;
        exposureLevel: string;
    };

    // Connection status
    connectionStatus: DefenderConnectionStatus;
}

/**
 * Microsoft Defender Integration Service
 * 
 * Provides read-only access to Microsoft Defender context for AVIAN alerts.
 * Does not embed external UIs - only provides metadata and deep-links.
 */
export class DefenderIntegrationService {
    private graphClient: MicrosoftGraphClient;
    private config: DefenderIntegrationConfig;
    private connectionStatus: DefenderConnectionStatus;

    constructor(config: DefenderIntegrationConfig) {
        this.config = config;

        const credentials: MicrosoftGraphCredentials = {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            tenantId: config.tenantId,
        };

        this.graphClient = new MicrosoftGraphClient(credentials);

        this.connectionStatus = {
            isConnected: false,
            lastChecked: new Date(),
        };
    }

    // ========================================================================
    // Alert Context Enrichment
    // ========================================================================

    /**
     * Enrich AVIAN alert with Microsoft Defender context
     * Requirements: 4.3, 4.4, 4.5, 12.2, 12.4
     */
    async enrichAlertWithDefenderContext(alert: SecurityAlert): Promise<DefenderAlertContext | null> {
        try {
            // Only process EDR alerts with Defender context
            if (alert.sourceSystem !== 'edr' || !alert.defenderAlertId || !alert.defenderIncidentId) {
                logger.debug('Alert does not have Defender context', {
                    alertId: alert.id,
                    sourceSystem: alert.sourceSystem,
                    hasDefenderAlertId: !!alert.defenderAlertId,
                    hasDefenderIncidentId: !!alert.defenderIncidentId,
                });
                return null;
            }

            // Check connection status first
            await this.checkConnectionStatus();

            if (!this.connectionStatus.isConnected) {
                logger.warn('Microsoft Defender integration unavailable', {
                    alertId: alert.id,
                    error: this.connectionStatus.error,
                });

                // Return basic context with connection status
                return this.createBasicDefenderContext(alert, this.connectionStatus);
            }

            // Retrieve detailed context from Microsoft Defender
            const defenderAlert = await this.getDefenderAlert(alert.defenderAlertId);
            const deviceInfo = alert.affectedDevice
                ? await this.getDeviceInfo(alert.affectedDevice)
                : undefined;

            // Build enriched context
            const context: DefenderAlertContext = {
                incidentId: alert.defenderIncidentId,
                alertId: alert.defenderAlertId,
                severity: alert.defenderSeverity || 'unknown',
                threatName: alert.threatName || 'Unknown Threat',
                affectedDevice: alert.affectedDevice || 'Unknown Device',
                affectedUser: alert.affectedUser || 'Unknown User',
                deepLink: this.generateDeepLink(alert.defenderIncidentId, alert.defenderAlertId),
                connectionStatus: this.connectionStatus,
            };

            // Add detailed Defender alert context if available
            if (defenderAlert) {
                context.status = defenderAlert.status;
                context.classification = defenderAlert.classification;
                context.determination = defenderAlert.determination;
                context.investigationState = defenderAlert.investigationState;
                context.assignedTo = defenderAlert.assignedTo;
            }

            // Add device context if available
            if (deviceInfo) {
                context.deviceInfo = {
                    computerDnsName: deviceInfo.computerDnsName,
                    osPlatform: deviceInfo.osPlatform,
                    osVersion: deviceInfo.osVersion,
                    healthStatus: deviceInfo.healthStatus,
                    riskScore: deviceInfo.riskScore,
                    exposureLevel: deviceInfo.exposureLevel,
                };
            }

            logger.info('Alert enriched with Defender context', {
                alertId: alert.id,
                defenderIncidentId: context.incidentId,
                defenderAlertId: context.alertId,
                hasDeviceInfo: !!context.deviceInfo,
            });

            return context;
        } catch (error) {
            logger.error('Failed to enrich alert with Defender context', error instanceof Error ? error : new Error(String(error)), {
                alertId: alert.id,
                defenderAlertId: alert.defenderAlertId,
                defenderIncidentId: alert.defenderIncidentId,
            });

            // Return basic context with error status
            const errorStatus: DefenderConnectionStatus = {
                isConnected: false,
                lastChecked: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };

            return this.createBasicDefenderContext(alert, errorStatus);
        }
    }

    /**
     * Get multiple alerts' Defender context in batch
     * Requirements: 4.3, 4.4, 4.5
     */
    async enrichAlertsWithDefenderContext(alerts: SecurityAlert[]): Promise<Map<string, DefenderAlertContext | null>> {
        const contextMap = new Map<string, DefenderAlertContext | null>();

        // Process alerts in parallel with concurrency limit
        const BATCH_SIZE = 5;
        const batches = [];

        for (let i = 0; i < alerts.length; i += BATCH_SIZE) {
            batches.push(alerts.slice(i, i + BATCH_SIZE));
        }

        for (const batch of batches) {
            const promises = batch.map(async (alert) => {
                const context = await this.enrichAlertWithDefenderContext(alert);
                contextMap.set(alert.id, context);
            });

            await Promise.allSettled(promises);
        }

        return contextMap;
    }

    // ========================================================================
    // Deep-Link Generation
    // ========================================================================

    /**
     * Generate deep-link to Microsoft Defender Security Center
     * Requirements: 4.4, 4.5
     */
    generateDeepLink(incidentId: string, alertId?: string): string {
        const baseUrl = 'https://security.microsoft.com';

        if (alertId) {
            // Link to specific alert within incident
            return `${baseUrl}/alerts/${alertId}?tid=${this.config.tenantId}`;
        } else {
            // Link to incident overview
            return `${baseUrl}/incidents/${incidentId}?tid=${this.config.tenantId}`;
        }
    }

    /**
     * Generate deep-link to device page in Microsoft Defender
     * Requirements: 4.4, 4.5
     */
    generateDeviceDeepLink(deviceId: string): string {
        const baseUrl = 'https://security.microsoft.com';
        return `${baseUrl}/machines/${deviceId}?tid=${this.config.tenantId}`;
    }

    // ========================================================================
    // Connection Status Management
    // ========================================================================

    /**
     * Check Microsoft Defender API connection status
     * Requirements: 4.5
     */
    async checkConnectionStatus(): Promise<DefenderConnectionStatus> {
        const startTime = Date.now();

        try {
            // Simple connectivity test - try to authenticate
            await this.graphClient.authenticate(this.config.tenantId);

            const latencyMs = Date.now() - startTime;

            this.connectionStatus = {
                isConnected: true,
                lastChecked: new Date(),
                latencyMs,
            };

            logger.debug('Microsoft Defender connection check successful', {
                latencyMs,
                tenantId: this.config.tenantId,
            });
        } catch (error) {
            const latencyMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            this.connectionStatus = {
                isConnected: false,
                lastChecked: new Date(),
                error: errorMessage,
                latencyMs,
            };

            logger.warn('Microsoft Defender connection check failed', {
                error: errorMessage,
                latencyMs,
                tenantId: this.config.tenantId,
            });
        }

        return this.connectionStatus;
    }

    /**
     * Get current connection status without performing new check
     */
    getConnectionStatus(): DefenderConnectionStatus {
        return { ...this.connectionStatus };
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    /**
     * Get detailed alert information from Microsoft Defender
     */
    private async getDefenderAlert(alertId: string): Promise<DefenderAlert | null> {
        try {
            // Note: This is a simplified implementation
            // The actual Microsoft Graph API endpoint for getting a specific alert
            // would be something like: /security/alerts_v2/{alertId}

            const alerts = await this.graphClient.getDefenderAlerts(this.config.tenantId);
            const alert = alerts.find(a => a.id === alertId);

            return alert || null;
        } catch (error) {
            logger.error('Failed to get Defender alert details', error instanceof Error ? error : new Error(String(error)), {
                alertId,
                tenantId: this.config.tenantId,
            });
            return null;
        }
    }

    /**
     * Get device information from Microsoft Defender
     */
    private async getDeviceInfo(deviceIdentifier: string): Promise<DefenderDevice | null> {
        try {
            const devices = await this.graphClient.getDefenderDevices(this.config.tenantId);

            // Try to match by DNS name or device ID
            const device = devices.find(d =>
                d.computerDnsName === deviceIdentifier ||
                d.id === deviceIdentifier
            );

            return device || null;
        } catch (error) {
            logger.error('Failed to get device information', error instanceof Error ? error : new Error(String(error)), {
                deviceIdentifier,
                tenantId: this.config.tenantId,
            });
            return null;
        }
    }

    /**
     * Create basic Defender context when detailed context is unavailable
     */
    private createBasicDefenderContext(
        alert: SecurityAlert,
        connectionStatus: DefenderConnectionStatus
    ): DefenderAlertContext {
        return {
            incidentId: alert.defenderIncidentId!,
            alertId: alert.defenderAlertId!,
            severity: alert.defenderSeverity || 'unknown',
            threatName: alert.threatName || 'Unknown Threat',
            affectedDevice: alert.affectedDevice || 'Unknown Device',
            affectedUser: alert.affectedUser || 'Unknown User',
            deepLink: this.generateDeepLink(alert.defenderIncidentId!, alert.defenderAlertId!),
            connectionStatus,
        };
    }
}

/**
 * Factory function to create DefenderIntegrationService instance
 */
export function createDefenderIntegrationService(
    config: DefenderIntegrationConfig
): DefenderIntegrationService {
    return new DefenderIntegrationService(config);
}

/**
 * Helper function to check if alert has Defender context
 */
export function hasDefenderContext(alert: SecurityAlert): boolean {
    return alert.sourceSystem === 'edr' &&
        !!alert.defenderAlertId &&
        !!alert.defenderIncidentId;
}

/**
 * Helper function to extract Defender context from alert metadata
 */
export function extractDefenderContextFromAlert(alert: SecurityAlert): DefenderContext | null {
    if (!hasDefenderContext(alert)) {
        return null;
    }

    return {
        incidentId: alert.defenderIncidentId!,
        alertId: alert.defenderAlertId!,
        severity: alert.defenderSeverity || 'unknown',
        threatName: alert.threatName || 'Unknown Threat',
        affectedDevice: alert.affectedDevice || 'Unknown Device',
        affectedUser: alert.affectedUser || 'Unknown User',
        deepLink: `https://security.microsoft.com/incidents/${alert.defenderIncidentId}?tid=${alert.tenantId}`,
    };
}