/**
 * SonicWall API Client
 * 
 * Provides methods to interact with SonicWall firewall devices via their REST API.
 * Supports authentication, security statistics, system health, interfaces, VPN, and licenses.
 * 
 * Requirements: 2.1-2.12, 7.1-7.21
 */

import { logger } from '@/lib/logger';
import {
    SonicWallAPIConfig,
    SecurityStats,
    SystemHealth,
    InterfaceStatus,
    VPNPolicy,
    LicenseInfo,
} from '@/types/firewall';

/**
 * Custom error class for SonicWall API errors
 */
export class SonicWallAPIError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public isRetryable: boolean = false,
        public isAuthError: boolean = false,
        public isRateLimitError: boolean = false
    ) {
        super(message);
        this.name = 'SonicWallAPIError';
    }
}

/**
 * SonicWall API Client
 * 
 * Handles authentication and API calls to SonicWall devices.
 * Implements exponential backoff retry logic and request timeouts.
 * 
 * Retry Strategy (Requirements 2.6, 2.7):
 * - Exponential backoff: 30s, 60s, 120s, 300s max
 * - Automatic retry on network errors, timeouts, and 5xx errors
 * - No retry on authentication errors (401, 403) or client errors (400, 404)
 * - Rate limit handling with backoff
 */
export class SonicWallAPI {
    private baseUrl: string;
    private username: string;
    private password: string;
    private authToken?: string;
    private timeout: number;
    private retryDelays: number[] = [30000, 60000, 120000, 300000]; // 30s, 60s, 120s, 300s

    /**
     * Create a new SonicWall API client
     * 
     * @param config - Configuration object with baseUrl, username, password, and optional timeout
     */
    constructor(config: SonicWallAPIConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.username = config.username;
        this.password = config.password;
        this.authToken = config.authToken;
        this.timeout = config.timeout || 30000; // Default 30 seconds
    }

    /**
     * Authenticate with SonicWall API and obtain auth token
     * 
     * Requirements: 2.6 - Handle authentication failures with proper error classification
     * 
     * @returns Auth token string
     * @throws SonicWallAPIError if authentication fails
     */
    async authenticate(): Promise<string> {
        try {
            logger.info('Authenticating with SonicWall API', {
                baseUrl: this.baseUrl,
                username: this.username,
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            try {
                const response = await fetch(`${this.baseUrl}/api/sonicos/auth`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        username: this.username,
                        password: this.password,
                    }),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');

                    // Classify authentication failures by status code
                    if (response.status === 401) {
                        // Invalid credentials - not retryable
                        throw new SonicWallAPIError(
                            `Authentication failed: Invalid credentials for user '${this.username}'`,
                            401,
                            false, // Not retryable
                            true   // Is auth error
                        );
                    } else if (response.status === 403) {
                        // Forbidden - account may be locked or insufficient permissions
                        throw new SonicWallAPIError(
                            `Authentication failed: Access forbidden for user '${this.username}'. Account may be locked or lacks permissions.`,
                            403,
                            false, // Not retryable
                            true   // Is auth error
                        );
                    } else if (response.status === 429) {
                        // Rate limited - retryable
                        const retryAfter = response.headers.get('Retry-After');
                        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
                        throw new SonicWallAPIError(
                            `Authentication failed: Rate limit exceeded. Retry after ${delay}ms`,
                            429,
                            true,  // Retryable
                            false, // Not an auth error (rate limit)
                            true   // Is rate limit error
                        );
                    } else if (response.status >= 500) {
                        // Server error - retryable
                        throw new SonicWallAPIError(
                            `Authentication failed: Server error (${response.status}) - ${errorText}`,
                            response.status,
                            true,  // Retryable
                            false  // Not an auth error (server issue)
                        );
                    } else {
                        // Other client errors - not retryable
                        throw new SonicWallAPIError(
                            `Authentication failed: ${response.status} ${response.statusText} - ${errorText}`,
                            response.status,
                            false, // Not retryable
                            true   // Treat as auth error
                        );
                    }
                }

                const data = await response.json();

                // SonicWall typically returns the token in the response body or headers
                // Check response body first
                if (data.token) {
                    this.authToken = data.token;
                } else if (data.auth_token) {
                    this.authToken = data.auth_token;
                } else {
                    // Check Authorization header
                    const authHeader = response.headers.get('Authorization');
                    if (authHeader) {
                        this.authToken = authHeader.replace('Bearer ', '');
                    } else {
                        throw new SonicWallAPIError(
                            'Authentication failed: No auth token found in response',
                            undefined,
                            false, // Not retryable (API contract issue)
                            true   // Is auth error
                        );
                    }
                }

                logger.info('Successfully authenticated with SonicWall API', {
                    baseUrl: this.baseUrl,
                });

                return this.authToken!;
            } catch (error) {
                clearTimeout(timeoutId);

                // Handle timeout
                if (error instanceof Error && error.name === 'AbortError') {
                    throw new SonicWallAPIError(
                        `Authentication request timed out after ${this.timeout}ms`,
                        undefined,
                        true,  // Retryable (network issue)
                        false  // Not an auth error (timeout)
                    );
                }

                // Re-throw SonicWallAPIError as-is
                if (error instanceof SonicWallAPIError) {
                    throw error;
                }

                // Handle network errors
                if (error instanceof TypeError && error.message.includes('fetch')) {
                    throw new SonicWallAPIError(
                        `Authentication failed: Network error - ${error.message}`,
                        undefined,
                        true,  // Retryable (network issue)
                        false  // Not an auth error (network issue)
                    );
                }

                // Wrap other errors
                throw new SonicWallAPIError(
                    `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
                    undefined,
                    false, // Unknown error, don't retry
                    true   // Treat as auth error
                );
            }
        } catch (error) {
            // Log the error with appropriate context
            if (error instanceof SonicWallAPIError) {
                logger.error(
                    'SonicWall authentication failed',
                    error,
                    {
                        baseUrl: this.baseUrl,
                        username: this.username,
                        statusCode: error.statusCode,
                        isRetryable: error.isRetryable,
                        isAuthError: error.isAuthError,
                        isRateLimitError: error.isRateLimitError,
                    }
                );
            } else {
                logger.error(
                    'SonicWall authentication failed',
                    error instanceof Error ? error : undefined,
                    { baseUrl: this.baseUrl, username: this.username }
                );
            }
            throw error;
        }
    }

    /**
     * Execute a function with exponential backoff retry logic
     * 
     * Requirements: 2.6 - Exponential backoff (30s, 60s, 120s, 300s max)
     * Requirements: 2.6 - Handle API rate limiting with Retry-After header
     * 
     * @param fn - Function to execute
     * @param context - Context string for logging
     * @returns Result of function execution
     * @throws SonicWallAPIError if all retries fail
     */
    private async withRetry<T>(
        fn: () => Promise<T>,
        context: string
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Check if error is retryable
                const isRetryable = this.isRetryableError(error);

                // Log the error
                logger.warn(`${context} failed (attempt ${attempt + 1}/${this.retryDelays.length + 1})`, {
                    error: lastError.message,
                    isRetryable,
                    baseUrl: this.baseUrl,
                });

                // If not retryable or last attempt, throw immediately
                if (!isRetryable || attempt >= this.retryDelays.length) {
                    throw this.wrapError(error, context);
                }

                // Calculate delay - use Retry-After for rate limit errors, otherwise use exponential backoff
                let delay = this.retryDelays[attempt];

                // For rate limit errors, respect the Retry-After header if available
                if (error instanceof SonicWallAPIError && error.isRateLimitError) {
                    const retryAfterMatch = error.message.match(/Retry after (\d+)ms/);
                    if (retryAfterMatch) {
                        const retryAfterDelay = parseInt(retryAfterMatch[1], 10);
                        // Use the larger of Retry-After or our exponential backoff, capped at 300s
                        delay = Math.min(Math.max(retryAfterDelay, delay), 300000);
                        logger.info(`Rate limit detected, using Retry-After delay: ${delay}ms`, {
                            baseUrl: this.baseUrl,
                            context,
                        });
                    }
                }

                logger.info(`Retrying ${context} in ${delay}ms`, {
                    baseUrl: this.baseUrl,
                });
                await this.sleep(delay);
            }
        }

        // Should never reach here, but TypeScript needs this
        throw this.wrapError(lastError!, context);
    }

    /**
     * Determine if an error is retryable
     * 
     * @param error - Error to check
     * @returns True if error should be retried
     */
    private isRetryableError(error: any): boolean {
        // Network errors are retryable
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return true;
        }

        // Timeout errors are retryable
        if (error instanceof Error && error.name === 'AbortError') {
            return true;
        }

        // SonicWallAPIError with retryable flag
        if (error instanceof SonicWallAPIError) {
            return error.isRetryable;
        }

        // Check for specific error messages
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

        // Network-related errors
        if (
            errorMessage.includes('network') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('econnrefused') ||
            errorMessage.includes('enotfound') ||
            errorMessage.includes('etimedout')
        ) {
            return true;
        }

        // Server errors (5xx) are retryable
        if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504')) {
            return true;
        }

        // Rate limit errors are retryable
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            return true;
        }

        // Authentication errors are NOT retryable (will be handled separately)
        if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('unauthorized')) {
            return false;
        }

        // Client errors (4xx except 429) are NOT retryable
        if (errorMessage.includes('400') || errorMessage.includes('404')) {
            return false;
        }

        // Default to not retryable
        return false;
    }

    /**
     * Wrap an error in a SonicWallAPIError
     * 
     * @param error - Original error
     * @param context - Context string
     * @returns SonicWallAPIError
     */
    private wrapError(error: any, context: string): SonicWallAPIError {
        if (error instanceof SonicWallAPIError) {
            return error;
        }

        const message = error instanceof Error ? error.message : String(error);
        const fullMessage = `${context}: ${message}`;

        // Extract status code if present
        const statusMatch = message.match(/\b(\d{3})\b/);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

        // Determine error type
        const isAuthError = statusCode === 401 || statusCode === 403 || message.toLowerCase().includes('unauthorized');
        const isRateLimitError = statusCode === 429 || message.toLowerCase().includes('rate limit');
        const isRetryable = this.isRetryableError(error);

        return new SonicWallAPIError(fullMessage, statusCode, isRetryable, isAuthError, isRateLimitError);
    }

    /**
     * Sleep for a specified duration
     * 
     * @param ms - Milliseconds to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Make an authenticated API request
     * 
     * @param endpoint - API endpoint path (without base URL)
     * @param options - Fetch options
     * @returns Response data
     * @throws SonicWallAPIError if request fails
     */
    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        // Ensure we have an auth token
        if (!this.authToken) {
            await this.authenticate();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const url = `${this.baseUrl}${endpoint}`;

            const response = await fetch(url, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Handle rate limiting (429)
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                // Retry-After can be in seconds (integer) or HTTP date format
                let delay = 60000; // Default 60s

                if (retryAfter) {
                    // Try parsing as integer (seconds)
                    const seconds = parseInt(retryAfter, 10);
                    if (!isNaN(seconds)) {
                        delay = seconds * 1000;
                    } else {
                        // Try parsing as HTTP date
                        const retryDate = new Date(retryAfter);
                        if (!isNaN(retryDate.getTime())) {
                            delay = Math.max(0, retryDate.getTime() - Date.now());
                        }
                    }
                }

                logger.warn('Rate limit exceeded', {
                    endpoint,
                    retryAfter: delay,
                    retryAfterHeader: retryAfter,
                    baseUrl: this.baseUrl,
                });

                throw new SonicWallAPIError(
                    `Rate limit exceeded. Retry after ${delay}ms`,
                    429,
                    true,
                    false,
                    true
                );
            }

            // If unauthorized, try to re-authenticate once
            if (response.status === 401) {
                logger.warn('Auth token expired, re-authenticating', {
                    endpoint,
                    baseUrl: this.baseUrl,
                });

                await this.authenticate();

                // Retry the request with new token
                const retryResponse = await fetch(url, {
                    ...options,
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...options.headers,
                    },
                });

                if (!retryResponse.ok) {
                    const errorText = await retryResponse.text().catch(() => 'Unknown error');
                    throw new SonicWallAPIError(
                        `API request failed after re-auth: ${retryResponse.status} ${retryResponse.statusText} - ${errorText}`,
                        retryResponse.status,
                        false,
                        true
                    );
                }

                return await retryResponse.json();
            }

            // Handle other HTTP errors
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                const isServerError = response.status >= 500;

                throw new SonicWallAPIError(
                    `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
                    response.status,
                    isServerError, // Server errors are retryable
                    false
                );
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            // Handle timeout
            if (error instanceof Error && error.name === 'AbortError') {
                throw new SonicWallAPIError(
                    `API request timed out after ${this.timeout}ms: ${endpoint}`,
                    undefined,
                    true // Timeouts are retryable
                );
            }

            // Re-throw SonicWallAPIError as-is
            if (error instanceof SonicWallAPIError) {
                throw error;
            }

            // Wrap other errors
            throw new SonicWallAPIError(
                `API request failed: ${error instanceof Error ? error.message : String(error)}`,
                undefined,
                true // Network errors are retryable
            );
        }
    }

    /**
     * Get security statistics from SonicWall
     * 
     * Retrieves daily block counts for IPS, GAV, DPI-SSL, ATP, etc.
     * Implements automatic retry with exponential backoff.
     * 
     * Requirements: 7.1, 7.6, 2.6
     * 
     * @returns Security statistics object
     * @throws SonicWallAPIError if request fails after all retries
     */
    async getSecurityStatistics(): Promise<SecurityStats> {
        return this.withRetry(async () => {
            logger.debug('Fetching security statistics', {
                baseUrl: this.baseUrl,
            });

            const data = await this.makeRequest<any>(
                '/api/sonicos/reporting/security-services/statistics'
            );

            // Extract counters from response
            // SonicWall API structure may vary, so we handle multiple possible formats
            const stats: SecurityStats = {
                ips_blocks_today: this.extractCounter(data, ['ips_blocks_today', 'ips_blocks', 'ips.blocks']),
                gav_blocks_today: this.extractCounter(data, ['gav_blocks_today', 'gav_blocks', 'gateway_av.blocks']),
                dpi_ssl_blocks_today: this.extractCounter(data, ['dpi_ssl_blocks_today', 'dpi_ssl_blocks', 'dpi_ssl.blocks']),
                atp_verdicts_today: this.extractCounter(data, ['atp_verdicts_today', 'atp_verdicts', 'atp.verdicts']),
                app_control_blocks_today: this.extractCounter(data, ['app_control_blocks_today', 'app_control_blocks', 'app_control.blocks']),
                content_filter_blocks_today: this.extractCounter(data, ['content_filter_blocks_today', 'content_filter_blocks', 'content_filter.blocks']),
                botnet_blocks_today: this.extractCounter(data, ['botnet_blocks_today', 'botnet_blocks', 'botnet.blocks']),
                blocked_connections: this.extractCounter(data, ['blocked_connections', 'denied_connections', 'connections_blocked', 'connections.blocked']),
            };

            // Extract optional bandwidth data if available
            const bandwidth = this.extractCounter(data, ['bandwidth_total_mb', 'bandwidth_mb', 'bandwidth.total_mb', 'total_bandwidth_mb']);
            if (bandwidth > 0) {
                stats.bandwidth_total_mb = bandwidth;
            }

            logger.debug('Successfully fetched security statistics', {
                baseUrl: this.baseUrl,
                stats,
            });

            return stats;
        }, 'Get security statistics');
    }

    /**
     * Get interface status from SonicWall
     * 
     * Retrieves status for all network interfaces.
     * Implements automatic retry with exponential backoff.
     * 
     * Requirements: 7.2, 7.7, 2.6
     * 
     * @returns Array of interface status objects
     * @throws SonicWallAPIError if request fails after all retries
     */
    async getInterfaces(): Promise<InterfaceStatus[]> {
        return this.withRetry(async () => {
            logger.debug('Fetching interface status', {
                baseUrl: this.baseUrl,
            });

            const data = await this.makeRequest<any>('/api/sonicos/interfaces');

            // Extract interfaces from response
            const interfaces = data.interfaces || data.data || data || [];

            const result: InterfaceStatus[] = interfaces.map((iface: any) => ({
                interface_name: iface.name || iface.interface_name || iface.interface || 'unknown',
                zone: iface.zone || iface.security_zone || 'unknown',
                ip_address: iface.ip || iface.ip_address || iface.ipv4 || '0.0.0.0',
                status: this.normalizeStatus(iface.status || iface.link_status),
                link_speed: iface.link_speed || iface.speed || 'unknown',
            }));

            logger.debug('Successfully fetched interface status', {
                baseUrl: this.baseUrl,
                interfaceCount: result.length,
            });

            return result;
        }, 'Get interface status');
    }

    /**
     * Get system status from SonicWall
     * 
     * Retrieves CPU, RAM, uptime, firmware version, model, serial number, and HA status.
     * Implements automatic retry with exponential backoff.
     * 
     * Requirements: 7.3, 7.8, 7.18-7.21, 2.6
     * 
     * @returns System health object
     * @throws SonicWallAPIError if request fails after all retries
     */
    async getSystemStatus(): Promise<SystemHealth> {
        return this.withRetry(async () => {
            logger.debug('Fetching system status', {
                baseUrl: this.baseUrl,
            });

            const data = await this.makeRequest<any>('/api/sonicos/system/status');

            // Extract system health from response
            const health: SystemHealth = {
                cpu_percent: this.extractNumber(data, ['cpu_percent', 'cpu', 'cpu_usage']),
                ram_percent: this.extractNumber(data, ['ram_percent', 'memory_percent', 'memory', 'ram']),
                uptime_seconds: this.extractNumber(data, ['uptime_seconds', 'uptime', 'system_uptime']),
                firmware_version: this.extractString(data, ['firmware_version', 'firmware', 'version']),
                model: this.extractString(data, ['model', 'device_model', 'product']),
                serial_number: this.extractString(data, ['serial_number', 'serial', 'sn']),
            };

            // Extract HA status if available
            const haRole = this.extractString(data, ['ha_role', 'ha.role', 'high_availability.role']);
            if (haRole) {
                if (haRole.toLowerCase().includes('primary') || haRole.toLowerCase().includes('master')) {
                    health.ha_role = 'primary';
                } else if (haRole.toLowerCase().includes('secondary') || haRole.toLowerCase().includes('backup')) {
                    health.ha_role = 'secondary';
                }
            }

            const haState = this.extractString(data, ['ha_state', 'ha.state', 'high_availability.state']);
            if (haState) {
                if (haState.toLowerCase().includes('active')) {
                    health.ha_state = 'active';
                } else if (haState.toLowerCase().includes('standby')) {
                    health.ha_state = 'standby';
                } else if (haState.toLowerCase().includes('failover')) {
                    health.ha_state = 'failover';
                }
            }

            // Extract optional bandwidth data if available
            const bandwidth = this.extractNumber(data, ['bandwidth_total_mb', 'bandwidth_mb', 'bandwidth.total_mb', 'total_bandwidth_mb']);
            if (bandwidth > 0) {
                health.bandwidth_total_mb = bandwidth;
            }

            // Extract optional active sessions count if available
            const activeSessions = this.extractNumber(data, ['active_sessions_count', 'active_sessions', 'sessions.active', 'current_sessions']);
            if (activeSessions > 0) {
                health.active_sessions_count = activeSessions;
            }

            logger.debug('Successfully fetched system status', {
                baseUrl: this.baseUrl,
                health,
            });

            return health;
        }, 'Get system status');
    }

    /**
     * Get VPN policies from SonicWall
     * 
     * Retrieves status for all VPN tunnels.
     * Implements automatic retry with exponential backoff.
     * 
     * Requirements: 7.4, 7.9, 2.6
     * 
     * @returns Array of VPN policy objects
     * @throws SonicWallAPIError if request fails after all retries
     */
    async getVPNPolicies(): Promise<VPNPolicy[]> {
        return this.withRetry(async () => {
            logger.debug('Fetching VPN policies', {
                baseUrl: this.baseUrl,
            });

            const data = await this.makeRequest<any>('/api/sonicos/vpn/policies');

            // Extract VPN policies from response
            const policies = data.policies || data.vpn_policies || data.data || data || [];

            const result: VPNPolicy[] = policies.map((policy: any) => ({
                policy_name: policy.name || policy.policy_name || 'unknown',
                status: this.normalizeStatus(policy.status || policy.tunnel_status),
                remote_gateway: policy.remote_gateway || policy.peer || policy.remote_ip || 'unknown',
                encryption: policy.encryption || policy.encryption_algorithm || 'unknown',
                authentication_method: policy.authentication || policy.auth_method || policy.authentication_method || 'unknown',
            }));

            logger.debug('Successfully fetched VPN policies', {
                baseUrl: this.baseUrl,
                policyCount: result.length,
            });

            return result;
        }, 'Get VPN policies');
    }

    /**
     * Get license information from SonicWall
     * 
     * Retrieves expiry dates for all licenses.
     * Implements automatic retry with exponential backoff.
     * 
     * Requirements: 7.5, 7.10, 2.6
     * 
     * @returns License information object
     * @throws SonicWallAPIError if request fails after all retries
     */
    async getLicenses(): Promise<LicenseInfo> {
        return this.withRetry(async () => {
            logger.debug('Fetching license information', {
                baseUrl: this.baseUrl,
            });

            const data = await this.makeRequest<any>('/api/sonicos/licenses');

            // Extract license information from response
            const licenses: LicenseInfo = {
                ips_expiry: this.extractString(data, ['ips_expiry', 'ips.expiry', 'licenses.ips.expiry']),
                gav_expiry: this.extractString(data, ['gav_expiry', 'gateway_av_expiry', 'licenses.gav.expiry']),
                atp_expiry: this.extractString(data, ['atp_expiry', 'licenses.atp.expiry']),
                app_control_expiry: this.extractString(data, ['app_control_expiry', 'licenses.app_control.expiry']),
                content_filter_expiry: this.extractString(data, ['content_filter_expiry', 'licenses.content_filter.expiry']),
                support_expiry: this.extractString(data, ['support_expiry', 'licenses.support.expiry']),
            };

            logger.debug('Successfully fetched license information', {
                baseUrl: this.baseUrl,
                licenses,
            });

            return licenses;
        }, 'Get license information');
    }

    /**
     * Extract a counter value from nested object using multiple possible keys
     * 
     * @param obj - Object to search
     * @param keys - Array of possible key paths
     * @returns Counter value or 0 if not found
     */
    private extractCounter(obj: any, keys: string[]): number {
        for (const key of keys) {
            const value = this.getNestedValue(obj, key);
            if (value !== undefined && value !== null) {
                const num = typeof value === 'number' ? value : parseInt(String(value), 10);
                if (!isNaN(num)) {
                    return num;
                }
            }
        }
        return 0;
    }

    /**
     * Extract a number value from nested object using multiple possible keys
     * 
     * @param obj - Object to search
     * @param keys - Array of possible key paths
     * @returns Number value or 0 if not found
     */
    private extractNumber(obj: any, keys: string[]): number {
        return this.extractCounter(obj, keys);
    }

    /**
     * Extract a string value from nested object using multiple possible keys
     * 
     * @param obj - Object to search
     * @param keys - Array of possible key paths
     * @returns String value or empty string if not found
     */
    private extractString(obj: any, keys: string[]): string {
        for (const key of keys) {
            const value = this.getNestedValue(obj, key);
            if (value !== undefined && value !== null) {
                return String(value);
            }
        }
        return '';
    }

    /**
     * Get nested value from object using dot notation
     * 
     * @param obj - Object to search
     * @param path - Dot-separated path (e.g., 'licenses.ips.expiry')
     * @returns Value at path or undefined
     */
    private getNestedValue(obj: any, path: string): any {
        const keys = path.split('.');
        let current = obj;

        for (const key of keys) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[key];
        }

        return current;
    }

    /**
     * Normalize status string to 'up' or 'down'
     * 
     * @param status - Status string from API
     * @returns Normalized status
     */
    private normalizeStatus(status: any): 'up' | 'down' {
        if (!status) return 'down';

        const statusStr = String(status).toLowerCase();

        // Check for 'down' states first (including 'disconnect' before 'connected')
        if (statusStr.includes('down') || statusStr.includes('disconnect') || statusStr.includes('offline') || statusStr.includes('inactive')) {
            return 'down';
        }

        // Then check for 'up' states
        if (statusStr.includes('up') || statusStr.includes('active') || statusStr.includes('online') || statusStr.includes('connected')) {
            return 'up';
        }

        return 'down';
    }
}
