/**
 * Microsoft Graph API Client for EDR Integration
 * 
 * Handles authentication, data retrieval, and remote actions for
 * Microsoft Defender for Endpoint and Microsoft Intune.
 * 
 * Features:
 * - OAuth 2.0 client credentials authentication
 * - Token caching and refresh
 * - Rate limiting with exponential backoff
 * - Comprehensive error handling
 * - Device, alert, vulnerability, and compliance retrieval
 * - Remote action execution
 */

import { logger } from './logger';
import type {
    DefenderDevice,
    IntuneDevice,
    DefenderAlert,
    Vulnerability,
    ComplianceStatus,
    ActionResult,
    MicrosoftGraphCredentials,
    TokenResponse,
    GraphAPIError,
    RateLimitInfo,
} from '@/types/edr';

// Microsoft Graph API base URLs
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_API_BETA = 'https://graph.microsoft.com/beta';
const LOGIN_BASE = 'https://login.microsoftonline.com';

// Rate limiting configuration
const MAX_RETRY_DELAY = 5 * 60 * 1000; // 5 minutes in milliseconds
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRIES = 3;

/**
 * Token cache entry
 */
interface TokenCacheEntry {
    accessToken: string;
    expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Microsoft Graph API Client
 */
export class MicrosoftGraphClient {
    private credentials: MicrosoftGraphCredentials;
    private tokenCache: Map<string, TokenCacheEntry> = new Map();

    constructor(credentials: MicrosoftGraphCredentials) {
        this.credentials = credentials;
    }

    // ============================================================================
    // Authentication Methods
    // ============================================================================

    /**
     * Authenticate with Microsoft Graph API using OAuth 2.0 client credentials flow
     * Returns a valid access token, using cache if available
     */
    async authenticate(tenantId: string): Promise<string> {
        // Check cache first
        const cached = this.tokenCache.get(tenantId);
        if (cached && cached.expiresAt > Date.now() + 60000) {
            // Token valid for at least 1 more minute
            logger.debug('Using cached access token', { tenantId });
            return cached.accessToken;
        }

        // Request new token
        logger.info('Requesting new access token', { tenantId });

        const tokenUrl = `${LOGIN_BASE}/${tenantId}/oauth2/v2.0/token`;
        const params = new URLSearchParams({
            client_id: this.credentials.clientId,
            client_secret: this.credentials.clientSecret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
        });

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            if (!response.ok) {
                const error = await response.json() as GraphAPIError;
                const authError = new Error(`Authentication failed: ${error.error.message}`);
                logger.error('Authentication failed', authError, {
                    tenantId,
                    status: response.status,
                    errorCode: error.error.code,
                });
                throw authError;
            }

            const tokenResponse = await response.json() as TokenResponse;

            // Cache the token (expires_in is in seconds)
            const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
            this.tokenCache.set(tenantId, {
                accessToken: tokenResponse.access_token,
                expiresAt,
            });

            logger.info('Successfully authenticated', { tenantId });
            return tokenResponse.access_token;
        } catch (error) {
            logger.error('Authentication error', error as Error, { tenantId });
            throw error;
        }
    }

    /**
     * Refresh access token
     * For client credentials flow, this is the same as authenticate
     */
    async refreshToken(tenantId: string): Promise<string> {
        // Clear cached token to force refresh
        this.tokenCache.delete(tenantId);
        return this.authenticate(tenantId);
    }

    // ============================================================================
    // Device Operations
    // ============================================================================

    /**
     * Get devices from Microsoft Defender for Endpoint
     */
    async getDefenderDevices(tenantId: string): Promise<DefenderDevice[]> {
        const accessToken = await this.authenticate(tenantId);
        const endpoint = `${GRAPH_API_BASE}/security/microsoft.graph.security.runHuntingQuery`;

        // Note: Using standard Defender machines endpoint, not Advanced Hunting
        // The actual endpoint should be: /security/machines or similar
        // This is a placeholder - actual Microsoft endpoint needs to be confirmed
        const machinesEndpoint = `${GRAPH_API_BASE}/security/machines`;

        try {
            const devices = await this.makeRequest<{ value: DefenderDevice[] }>(
                machinesEndpoint,
                accessToken,
                'GET'
            );

            logger.info('Retrieved Defender devices', {
                tenantId,
                count: devices.value?.length || 0,
            });

            return devices.value || [];
        } catch (error) {
            logger.error('Failed to retrieve Defender devices', error as Error, { tenantId });
            throw error;
        }
    }

    /**
     * Get devices from Microsoft Intune
     */
    async getIntuneDevices(tenantId: string): Promise<IntuneDevice[]> {
        const accessToken = await this.authenticate(tenantId);
        const endpoint = `${GRAPH_API_BASE}/deviceManagement/managedDevices`;

        try {
            const devices = await this.makeRequest<{ value: IntuneDevice[] }>(
                endpoint,
                accessToken,
                'GET'
            );

            logger.info('Retrieved Intune devices', {
                tenantId,
                count: devices.value?.length || 0,
            });

            return devices.value || [];
        } catch (error) {
            logger.error('Failed to retrieve Intune devices', error as Error, { tenantId });
            throw error;
        }
    }

    // ============================================================================
    // Alert Operations
    // ============================================================================

    /**
     * Get alerts from Microsoft Defender
     */
    async getDefenderAlerts(
        tenantId: string,
        since?: Date
    ): Promise<DefenderAlert[]> {
        const accessToken = await this.authenticate(tenantId);
        let endpoint = `${GRAPH_API_BASE}/security/alerts_v2`;

        // Add filter for date if provided
        if (since) {
            const isoDate = since.toISOString();
            endpoint += `?$filter=createdDateTime ge ${isoDate}`;
        }

        try {
            const alerts = await this.makeRequest<{ value: DefenderAlert[] }>(
                endpoint,
                accessToken,
                'GET'
            );

            logger.info('Retrieved Defender alerts', {
                tenantId,
                count: alerts.value?.length || 0,
                since: since?.toISOString(),
            });

            return alerts.value || [];
        } catch (error) {
            logger.error('Failed to retrieve Defender alerts', error as Error, { tenantId });
            throw error;
        }
    }

    // ============================================================================
    // Vulnerability Operations
    // ============================================================================

    /**
     * Get vulnerabilities from Microsoft Defender
     */
    async getVulnerabilities(tenantId: string): Promise<Vulnerability[]> {
        const accessToken = await this.authenticate(tenantId);
        const endpoint = `${GRAPH_API_BASE}/security/vulnerabilities`;

        try {
            const vulnerabilities = await this.makeRequest<{ value: Vulnerability[] }>(
                endpoint,
                accessToken,
                'GET'
            );

            logger.info('Retrieved vulnerabilities', {
                tenantId,
                count: vulnerabilities.value?.length || 0,
            });

            return vulnerabilities.value || [];
        } catch (error) {
            logger.error('Failed to retrieve vulnerabilities', error as Error, { tenantId });
            throw error;
        }
    }

    /**
     * Get vulnerabilities for a specific device
     */
    async getDeviceVulnerabilities(
        tenantId: string,
        deviceId: string
    ): Promise<Vulnerability[]> {
        const accessToken = await this.authenticate(tenantId);
        const endpoint = `${GRAPH_API_BASE}/security/machines/${deviceId}/vulnerabilities`;

        try {
            const vulnerabilities = await this.makeRequest<{ value: Vulnerability[] }>(
                endpoint,
                accessToken,
                'GET'
            );

            logger.info('Retrieved device vulnerabilities', {
                tenantId,
                deviceId,
                count: vulnerabilities.value?.length || 0,
            });

            return vulnerabilities.value || [];
        } catch (error) {
            logger.error('Failed to retrieve device vulnerabilities', error as Error, {
                tenantId,
                deviceId,
            });
            throw error;
        }
    }

    // ============================================================================
    // Compliance Operations
    // ============================================================================

    /**
     * Get device compliance status from Microsoft Intune
     */
    async getDeviceCompliance(tenantId: string): Promise<ComplianceStatus[]> {
        const accessToken = await this.authenticate(tenantId);
        const endpoint = `${GRAPH_API_BASE}/deviceManagement/managedDevices?$select=id,complianceState,deviceCompliancePolicyStates`;

        try {
            const compliance = await this.makeRequest<{ value: ComplianceStatus[] }>(
                endpoint,
                accessToken,
                'GET'
            );

            logger.info('Retrieved device compliance', {
                tenantId,
                count: compliance.value?.length || 0,
            });

            return compliance.value || [];
        } catch (error) {
            logger.error('Failed to retrieve device compliance', error as Error, { tenantId });
            throw error;
        }
    }

    // ============================================================================
    // Remote Action Operations
    // ============================================================================

    /**
     * Isolate a device (network isolation)
     */
    async isolateDevice(
        tenantId: string,
        deviceId: string
    ): Promise<ActionResult> {
        const accessToken = await this.authenticate(tenantId);

        // Note: The actual endpoint path needs to be confirmed with Microsoft documentation
        // This is a conceptual implementation
        const endpoint = `${GRAPH_API_BASE}/security/machines/${deviceId}/isolate`;

        try {
            const result = await this.makeRequest<ActionResult>(
                endpoint,
                accessToken,
                'POST',
                {
                    Comment: 'Device isolated via AVIAN platform',
                    IsolationType: 'Full',
                }
            );

            logger.info('Device isolated', { tenantId, deviceId });
            return result;
        } catch (error) {
            logger.error('Failed to isolate device', error as Error, { tenantId, deviceId });
            throw error;
        }
    }

    /**
     * Unisolate a device (remove network isolation)
     */
    async unisolateDevice(
        tenantId: string,
        deviceId: string
    ): Promise<ActionResult> {
        const accessToken = await this.authenticate(tenantId);
        const endpoint = `${GRAPH_API_BASE}/security/machines/${deviceId}/unisolate`;

        try {
            const result = await this.makeRequest<ActionResult>(
                endpoint,
                accessToken,
                'POST',
                {
                    Comment: 'Device unisolated via AVIAN platform',
                }
            );

            logger.info('Device unisolated', { tenantId, deviceId });
            return result;
        } catch (error) {
            logger.error('Failed to unisolate device', error as Error, { tenantId, deviceId });
            throw error;
        }
    }

    /**
     * Run antivirus scan on a device
     */
    async runAntivirusScan(
        tenantId: string,
        deviceId: string
    ): Promise<ActionResult> {
        const accessToken = await this.authenticate(tenantId);
        const endpoint = `${GRAPH_API_BASE}/security/machines/${deviceId}/runAntiVirusScan`;

        try {
            const result = await this.makeRequest<ActionResult>(
                endpoint,
                accessToken,
                'POST',
                {
                    Comment: 'Antivirus scan initiated via AVIAN platform',
                    ScanType: 'Full',
                }
            );

            logger.info('Antivirus scan initiated', { tenantId, deviceId });
            return result;
        } catch (error) {
            logger.error('Failed to run antivirus scan', error as Error, {
                tenantId,
                deviceId,
            });
            throw error;
        }
    }

    // ============================================================================
    // HTTP Request Helper with Rate Limiting and Error Handling
    // ============================================================================

    /**
     * Make HTTP request to Microsoft Graph API with rate limiting and error handling
     */
    private async makeRequest<T>(
        url: string,
        accessToken: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: unknown,
        retryCount = 0
    ): Promise<T> {
        const headers: HeadersInit = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        const options: RequestInit = {
            method,
            headers,
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);

            // Handle rate limiting (429)
            if (response.status === 429) {
                return this.handleRateLimit(
                    url,
                    accessToken,
                    method,
                    body,
                    response,
                    retryCount
                );
            }

            // Handle authentication errors (401)
            if (response.status === 401) {
                logger.warn('Authentication error, attempting token refresh', { url });

                if (retryCount < MAX_RETRIES) {
                    // Extract tenant ID from credentials and refresh token
                    const newToken = await this.refreshToken(this.credentials.tenantId);
                    return this.makeRequest(url, newToken, method, body, retryCount + 1);
                }

                throw new Error('Authentication failed after token refresh');
            }

            // Handle authorization errors (403)
            if (response.status === 403) {
                const error = await response.json() as GraphAPIError;
                const authzError = new Error(`Authorization error: ${error.error.message}`);
                logger.error('Authorization error', authzError, {
                    url,
                    status: 403,
                    errorCode: error.error.code,
                });
                throw authzError;
            }

            // Handle not found (404)
            if (response.status === 404) {
                logger.warn('Resource not found', { url });
                throw new Error('Resource not found');
            }

            // Handle server errors (500)
            if (response.status >= 500) {
                const serverError = new Error(`Server error: ${response.status}`);
                logger.error('Server error', serverError, { url, status: response.status });

                if (retryCount < MAX_RETRIES) {
                    const delay = this.calculateExponentialBackoff(retryCount);
                    logger.info('Retrying after server error', { url, delay, retryCount });
                    await this.sleep(delay);
                    return this.makeRequest(url, accessToken, method, body, retryCount + 1);
                }

                throw new Error(`Server error: ${response.status}`);
            }

            // Handle other non-OK responses
            if (!response.ok) {
                const error = await response.json() as GraphAPIError;
                const apiError = new Error(`API request failed: ${error.error.message}`);
                logger.error('API request failed', apiError, {
                    url,
                    status: response.status,
                    errorCode: error.error.code,
                });
                throw apiError;
            }

            // Success - parse and return response
            const data = await response.json() as T;
            return data;
        } catch (error) {
            logger.error('Request error', error as Error, { url });
            throw error;
        }
    }

    /**
     * Handle rate limiting with exponential backoff
     */
    private async handleRateLimit<T>(
        url: string,
        accessToken: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        body: unknown,
        response: Response,
        retryCount: number
    ): Promise<T> {
        // Parse Retry-After header
        const retryAfterHeader = response.headers.get('Retry-After');
        let retryAfter = 0;

        if (retryAfterHeader) {
            // Retry-After can be in seconds or HTTP date
            const parsed = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsed)) {
                retryAfter = parsed * 1000; // Convert to milliseconds
            } else {
                // Try parsing as HTTP date
                const retryDate = new Date(retryAfterHeader);
                if (!isNaN(retryDate.getTime())) {
                    retryAfter = retryDate.getTime() - Date.now();
                }
            }
        }

        // If no Retry-After header, use exponential backoff
        if (retryAfter === 0) {
            retryAfter = this.calculateExponentialBackoff(retryCount);
        }

        // Cap at maximum retry delay
        retryAfter = Math.min(retryAfter, MAX_RETRY_DELAY);

        // Log rate limit event
        const rateLimitInfo: RateLimitInfo = {
            retryAfter,
            endpoint: url,
            timestamp: new Date(),
        };

        logger.warn('Rate limit encountered', {
            ...rateLimitInfo,
            retryCount,
        });

        // Check if we should retry
        if (retryCount >= MAX_RETRIES) {
            throw new Error('Max retries exceeded due to rate limiting');
        }

        // Wait and retry
        await this.sleep(retryAfter);
        return this.makeRequest(url, accessToken, method, body, retryCount + 1);
    }

    /**
     * Calculate exponential backoff delay
     */
    private calculateExponentialBackoff(retryCount: number): number {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        return Math.min(delay, MAX_RETRY_DELAY);
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Clear token cache (useful for testing or credential rotation)
     */
    clearTokenCache(): void {
        this.tokenCache.clear();
        logger.info('Token cache cleared');
    }
}

/**
 * Create a Microsoft Graph API client instance
 */
export function createMicrosoftGraphClient(
    credentials: MicrosoftGraphCredentials
): MicrosoftGraphClient {
    return new MicrosoftGraphClient(credentials);
}
