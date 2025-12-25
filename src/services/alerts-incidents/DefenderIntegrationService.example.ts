/**
 * Example integration of DefenderIntegrationService with Alert API endpoints
 * 
 * This example demonstrates how to integrate the DefenderIntegrationService
 * with existing alert API endpoints to provide enriched Defender context.
 */

import { DefenderIntegrationService, createDefenderIntegrationService } from './DefenderIntegrationService';
import { AlertManager } from './AlertManager';
import type { SecurityAlert, DefenderIntegrationConfig } from '../../types/alerts-incidents';

/**
 * Example: Enriched Alert API Response
 */
interface EnrichedAlertResponse {
    alert: SecurityAlert;
    defenderContext?: {
        incidentId: string;
        alertId: string;
        severity: string;
        threatName: string;
        affectedDevice: string;
        affectedUser: string;
        deepLink: string;
        status?: string;
        classification?: string;
        deviceInfo?: {
            computerDnsName: string;
            osPlatform: string;
            healthStatus: string;
            riskScore: number;
        };
        connectionStatus: {
            isConnected: boolean;
            error?: string;
        };
    };
}

/**
 * Example: Enhanced Alert Service with Defender Integration
 */
export class EnhancedAlertService {
    private defenderService: DefenderIntegrationService;

    constructor(defenderConfig: DefenderIntegrationConfig) {
        this.defenderService = createDefenderIntegrationService(defenderConfig);
    }

    /**
     * Get alerts with enriched Defender context
     */
    async getAlertsWithDefenderContext(
        tenantId: string,
        filters: any
    ): Promise<EnrichedAlertResponse[]> {
        // Get alerts from AlertManager
        const alerts = await AlertManager.getAlerts({
            tenantId,
            ...filters,
        });

        // Enrich alerts with Defender context in batch
        const contextMap = await this.defenderService.enrichAlertsWithDefenderContext(alerts);

        // Build enriched response
        return alerts.map(alert => {
            const defenderContext = contextMap.get(alert.id);

            return {
                alert,
                defenderContext: defenderContext ? {
                    incidentId: defenderContext.incidentId,
                    alertId: defenderContext.alertId,
                    severity: defenderContext.severity,
                    threatName: defenderContext.threatName,
                    affectedDevice: defenderContext.affectedDevice,
                    affectedUser: defenderContext.affectedUser,
                    deepLink: defenderContext.deepLink,
                    status: defenderContext.status,
                    classification: defenderContext.classification,
                    deviceInfo: defenderContext.deviceInfo ? {
                        computerDnsName: defenderContext.deviceInfo.computerDnsName,
                        osPlatform: defenderContext.deviceInfo.osPlatform,
                        healthStatus: defenderContext.deviceInfo.healthStatus,
                        riskScore: defenderContext.deviceInfo.riskScore,
                    } : undefined,
                    connectionStatus: {
                        isConnected: defenderContext.connectionStatus.isConnected,
                        error: defenderContext.connectionStatus.error,
                    },
                } : undefined,
            };
        });
    }

    /**
     * Get single alert with Defender context
     */
    async getAlertWithDefenderContext(
        alertId: string,
        tenantId: string
    ): Promise<EnrichedAlertResponse | null> {
        // Get alert from AlertManager
        const alerts = await AlertManager.getAlerts({
            tenantId,
            // Note: In real implementation, you'd have a getAlertById method
        });

        const alert = alerts.find(a => a.id === alertId);
        if (!alert) {
            return null;
        }

        // Enrich with Defender context
        const defenderContext = await this.defenderService.enrichAlertWithDefenderContext(alert);

        return {
            alert,
            defenderContext: defenderContext ? {
                incidentId: defenderContext.incidentId,
                alertId: defenderContext.alertId,
                severity: defenderContext.severity,
                threatName: defenderContext.threatName,
                affectedDevice: defenderContext.affectedDevice,
                affectedUser: defenderContext.affectedUser,
                deepLink: defenderContext.deepLink,
                status: defenderContext.status,
                classification: defenderContext.classification,
                deviceInfo: defenderContext.deviceInfo ? {
                    computerDnsName: defenderContext.deviceInfo.computerDnsName,
                    osPlatform: defenderContext.deviceInfo.osPlatform,
                    healthStatus: defenderContext.deviceInfo.healthStatus,
                    riskScore: defenderContext.deviceInfo.riskScore,
                } : undefined,
                connectionStatus: {
                    isConnected: defenderContext.connectionStatus.isConnected,
                    error: defenderContext.connectionStatus.error,
                },
            } : undefined,
        };
    }

    /**
     * Check Defender integration health
     */
    async getDefenderIntegrationStatus() {
        const status = await this.defenderService.checkConnectionStatus();

        return {
            isConnected: status.isConnected,
            lastChecked: status.lastChecked,
            latencyMs: status.latencyMs,
            error: status.error,
        };
    }
}

/**
 * Example: API Route Handler with Defender Integration
 */
export async function handleGetAlertsWithDefender(
    request: any,
    tenantId: string
): Promise<Response> {
    try {
        // Initialize Defender service (in real app, this would be dependency injected)
        const defenderConfig: DefenderIntegrationConfig = {
            tenantId: process.env.MICROSOFT_TENANT_ID!,
            clientId: process.env.MICROSOFT_CLIENT_ID!,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
            authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
            scope: ['https://graph.microsoft.com/.default'],
        };

        const enhancedService = new EnhancedAlertService(defenderConfig);

        // Parse query parameters
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const severity = url.searchParams.get('severity');
        const assignedTo = url.searchParams.get('assignedTo');

        // Get enriched alerts
        const enrichedAlerts = await enhancedService.getAlertsWithDefenderContext(tenantId, {
            status,
            severity,
            assignedTo,
        });

        return new Response(JSON.stringify({
            alerts: enrichedAlerts,
            total: enrichedAlerts.length,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Failed to get alerts with Defender context:', error);

        return new Response(JSON.stringify({
            error: 'Failed to retrieve alerts',
            message: error instanceof Error ? error.message : 'Unknown error',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Example: React Component Usage
 */
export const AlertListWithDefenderContext = `
// Example React component that would consume the enriched alert data

interface AlertCardProps {
    alert: EnrichedAlertResponse;
}

function AlertCard({ alert }: AlertCardProps) {
    const { alert: alertData, defenderContext } = alert;
    
    return (
        <div className="alert-card">
            <div className="alert-header">
                <h3>{alertData.title}</h3>
                <span className={\`severity-\${alertData.severity}\`}>
                    {alertData.severity.toUpperCase()}
                </span>
            </div>
            
            <div className="alert-content">
                <p>{alertData.description}</p>
                
                {defenderContext && (
                    <div className="defender-context">
                        <h4>Microsoft Defender Context</h4>
                        
                        {defenderContext.connectionStatus.isConnected ? (
                            <>
                                <div className="defender-details">
                                    <p><strong>Threat:</strong> {defenderContext.threatName}</p>
                                    <p><strong>Affected Device:</strong> {defenderContext.affectedDevice}</p>
                                    <p><strong>Affected User:</strong> {defenderContext.affectedUser}</p>
                                    
                                    {defenderContext.status && (
                                        <p><strong>Status:</strong> {defenderContext.status}</p>
                                    )}
                                    
                                    {defenderContext.deviceInfo && (
                                        <div className="device-info">
                                            <p><strong>Device Health:</strong> {defenderContext.deviceInfo.healthStatus}</p>
                                            <p><strong>Risk Score:</strong> {defenderContext.deviceInfo.riskScore}</p>
                                        </div>
                                    )}
                                </div>
                                
                                <a 
                                    href={defenderContext.deepLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="defender-link"
                                >
                                    View in Microsoft Defender ↗
                                </a>
                            </>
                        ) : (
                            <div className="defender-unavailable">
                                <p>⚠️ Microsoft Defender context unavailable</p>
                                {defenderContext.connectionStatus.error && (
                                    <p className="error-message">
                                        {defenderContext.connectionStatus.error}
                                    </p>
                                )}
                                
                                {/* Still show basic info and deep link */}
                                <a 
                                    href={defenderContext.deepLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="defender-link"
                                >
                                    View in Microsoft Defender ↗
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
`;

/**
 * Example: Environment Configuration
 */
export const environmentConfigExample = `
# Environment variables for Microsoft Defender integration

# Microsoft Azure AD Application Registration
MICROSOFT_TENANT_ID=your-tenant-id-here
MICROSOFT_CLIENT_ID=your-client-id-here
MICROSOFT_CLIENT_SECRET=your-client-secret-here

# Optional: Custom authority URL (defaults to login.microsoftonline.com)
MICROSOFT_AUTHORITY=https://login.microsoftonline.com/your-tenant-id

# Optional: Custom Graph API scopes (defaults to https://graph.microsoft.com/.default)
MICROSOFT_SCOPES=https://graph.microsoft.com/.default
`;

/**
 * Example: Error Handling Patterns
 */
export const errorHandlingExamples = {
    // Handle API unavailable
    handleApiUnavailable: `
    const context = await defenderService.enrichAlertWithDefenderContext(alert);
    
    if (context && !context.connectionStatus.isConnected) {
        // Show user-friendly message
        showNotification({
            type: 'warning',
            message: 'Microsoft Defender integration is currently unavailable. Basic alert information is shown.',
            action: {
                label: 'View in Defender',
                onClick: () => window.open(context.deepLink, '_blank'),
            },
        });
    }
    `,

    // Handle authentication errors
    handleAuthError: `
    const status = await defenderService.checkConnectionStatus();
    
    if (!status.isConnected && status.error?.includes('Authentication')) {
        // Log for admin attention
        logger.error('Microsoft Defender authentication failed', {
            error: status.error,
            tenantId: config.tenantId,
        });
        
        // Show admin notification
        showAdminAlert({
            type: 'error',
            message: 'Microsoft Defender integration requires attention. Please check credentials.',
            priority: 'high',
        });
    }
    `,

    // Handle partial data
    handlePartialData: `
    const context = await defenderService.enrichAlertWithDefenderContext(alert);
    
    if (context) {
        // Always available: basic context and deep link
        const basicInfo = {
            deepLink: context.deepLink,
            threatName: context.threatName,
            affectedDevice: context.affectedDevice,
        };
        
        // Conditionally available: detailed context
        const detailedInfo = context.deviceInfo ? {
            deviceHealth: context.deviceInfo.healthStatus,
            riskScore: context.deviceInfo.riskScore,
        } : null;
        
        // Render UI with graceful degradation
        return (
            <DefenderContextCard 
                basicInfo={basicInfo}
                detailedInfo={detailedInfo}
                connectionStatus={context.connectionStatus}
            />
        );
    }
    `,
};