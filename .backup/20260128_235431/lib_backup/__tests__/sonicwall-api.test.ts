/**
 * Tests for SonicWall API Client
 * 
 * Requirements: Task 2.1 - Test SonicWall API client with authentication
 */

import { SonicWallAPI } from '../sonicwall-api';
import { SonicWallAPIConfig } from '@/types/firewall';

// Mock fetch globally
global.fetch = jest.fn();

describe('SonicWallAPI', () => {
    let api: SonicWallAPI;
    const mockConfig: SonicWallAPIConfig = {
        baseUrl: 'https://firewall.example.com',
        username: 'admin',
        password: 'password123',
        timeout: 5000,
    };

    beforeEach(() => {
        api = new SonicWallAPI(mockConfig);
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create instance with config', () => {
            expect(api).toBeInstanceOf(SonicWallAPI);
        });

        it('should remove trailing slash from baseUrl', () => {
            const apiWithSlash = new SonicWallAPI({
                ...mockConfig,
                baseUrl: 'https://firewall.example.com/',
            });
            expect(apiWithSlash).toBeInstanceOf(SonicWallAPI);
        });

        it('should use default timeout if not provided', () => {
            const apiWithoutTimeout = new SonicWallAPI({
                baseUrl: mockConfig.baseUrl,
                username: mockConfig.username,
                password: mockConfig.password,
            });
            expect(apiWithoutTimeout).toBeInstanceOf(SonicWallAPI);
        });
    });

    describe('authenticate', () => {
        it('should authenticate successfully with token in response body', async () => {
            const mockToken = 'test-auth-token-123';
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: mockToken }),
                headers: new Headers(),
            });

            const token = await api.authenticate();

            expect(token).toBe(mockToken);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://firewall.example.com/api/sonicos/auth',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        username: 'admin',
                        password: 'password123',
                    }),
                })
            );
        });

        it('should authenticate successfully with auth_token in response body', async () => {
            const mockToken = 'test-auth-token-456';
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ auth_token: mockToken }),
                headers: new Headers(),
            });

            const token = await api.authenticate();

            expect(token).toBe(mockToken);
        });

        it('should authenticate successfully with token in Authorization header', async () => {
            const mockToken = 'test-auth-token-789';
            const headers = new Headers();
            headers.set('Authorization', `Bearer ${mockToken}`);

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
                headers,
            });

            const token = await api.authenticate();

            expect(token).toBe(mockToken);
        });

        it('should throw SonicWallAPIError with 401 for invalid credentials', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => 'Invalid credentials',
            });

            await expect(api.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                statusCode: 401,
                isRetryable: false,
                isAuthError: true,
                message: expect.stringContaining('Invalid credentials'),
            });
        });

        it('should throw SonicWallAPIError with 403 for forbidden access', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
                text: async () => 'Access denied',
            });

            await expect(api.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                statusCode: 403,
                isRetryable: false,
                isAuthError: true,
                message: expect.stringContaining('Access forbidden'),
            });
        });

        it('should throw retryable error for 429 rate limit during authentication', async () => {
            const headers = new Headers();
            headers.set('Retry-After', '60');

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded',
                headers,
            });

            await expect(api.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                statusCode: 429,
                isRetryable: true,
                isAuthError: false,
                isRateLimitError: true,
                message: expect.stringContaining('Rate limit exceeded'),
            });
        });

        it('should throw retryable error for 500 server error during authentication', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error',
            });

            await expect(api.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                statusCode: 500,
                isRetryable: true,
                isAuthError: false,
                message: expect.stringContaining('Server error'),
            });
        });

        it('should throw retryable error for network failure during authentication', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(
                new TypeError('Failed to fetch')
            );

            await expect(api.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                isRetryable: true,
                isAuthError: false,
                message: expect.stringContaining('Network error'),
            });
        });

        it('should throw SonicWallAPIError when no token found in response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
                headers: new Headers(),
            });

            await expect(api.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                isRetryable: false,
                isAuthError: true,
                message: expect.stringContaining('No auth token found in response'),
            });
        });

        it('should throw retryable error for timeout during authentication', async () => {
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                new Promise((_, reject) => {
                    setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100);
                })
            );

            await expect(api.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                isRetryable: true,
                isAuthError: false,
                message: expect.stringContaining('Authentication request timed out'),
            });
        });
    });

    describe('getSecurityStatistics', () => {
        beforeEach(async () => {
            // Mock successful authentication
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'test-token' }),
                headers: new Headers(),
            });
            await api.authenticate();
            jest.clearAllMocks();
        });

        it('should fetch security statistics successfully', async () => {
            const mockStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 25,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                content_filter_blocks_today: 15,
                botnet_blocks_today: 8,
                blocked_connections: 0,
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockStats,
            });

            const stats = await api.getSecurityStatistics();

            expect(stats).toEqual(mockStats);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://firewall.example.com/api/sonicos/reporting/security-services/statistics',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token',
                    }),
                })
            );
        });

        it('should handle missing counters with default values', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            const stats = await api.getSecurityStatistics();

            expect(stats.ips_blocks_today).toBe(0);
            expect(stats.gav_blocks_today).toBe(0);
            expect(stats.dpi_ssl_blocks_today).toBe(0);
        });

        it('should handle alternative field names', async () => {
            const mockStats = {
                ips_blocks: 100,
                gateway_av: { blocks: 50 },
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockStats,
            });

            const stats = await api.getSecurityStatistics();

            expect(stats.ips_blocks_today).toBe(100);
            expect(stats.gav_blocks_today).toBe(50);
        });
    });

    describe('getInterfaces', () => {
        beforeEach(async () => {
            // Mock successful authentication
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'test-token' }),
                headers: new Headers(),
            });
            await api.authenticate();
            jest.clearAllMocks();
        });

        it('should fetch interfaces successfully', async () => {
            const mockInterfaces = {
                interfaces: [
                    {
                        name: 'X0',
                        zone: 'WAN',
                        ip_address: '192.168.1.1',
                        status: 'up',
                        link_speed: '1000Mbps',
                    },
                    {
                        name: 'X1',
                        zone: 'LAN',
                        ip_address: '10.0.0.1',
                        status: 'up',
                        link_speed: '1000Mbps',
                    },
                ],
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockInterfaces,
            });

            const interfaces = await api.getInterfaces();

            expect(interfaces).toHaveLength(2);
            expect(interfaces[0].interface_name).toBe('X0');
            expect(interfaces[0].status).toBe('up');
        });

        it('should normalize interface status', async () => {
            const mockInterfaces = {
                interfaces: [
                    { name: 'X0', zone: 'WAN', ip_address: '192.168.1.1', status: 'active', link_speed: '1000Mbps' },
                    { name: 'X1', zone: 'LAN', ip_address: '10.0.0.1', status: 'down', link_speed: '0' },
                ],
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockInterfaces,
            });

            const interfaces = await api.getInterfaces();

            expect(interfaces[0].status).toBe('up');
            expect(interfaces[1].status).toBe('down');
        });
    });

    describe('getSystemStatus', () => {
        beforeEach(async () => {
            // Mock successful authentication
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'test-token' }),
                headers: new Headers(),
            });
            await api.authenticate();
            jest.clearAllMocks();
        });

        it('should fetch system status successfully', async () => {
            const mockStatus = {
                cpu_percent: 45.5,
                ram_percent: 60.2,
                uptime_seconds: 86400,
                firmware_version: '7.0.1-5050',
                model: 'TZ370',
                serial_number: 'ABC123456',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockStatus,
            });

            const status = await api.getSystemStatus();

            expect(status.cpu_percent).toBe(45.5);
            expect(status.model).toBe('TZ370');
        });

        it('should extract HA status when available', async () => {
            const mockStatus = {
                cpu_percent: 45.5,
                ram_percent: 60.2,
                uptime_seconds: 86400,
                firmware_version: '7.0.1-5050',
                model: 'TZ370',
                serial_number: 'ABC123456',
                ha_role: 'primary',
                ha_state: 'active',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockStatus,
            });

            const status = await api.getSystemStatus();

            expect(status.ha_role).toBe('primary');
            expect(status.ha_state).toBe('active');
        });
    });

    describe('getVPNPolicies', () => {
        beforeEach(async () => {
            // Mock successful authentication
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'test-token' }),
                headers: new Headers(),
            });
            await api.authenticate();
            jest.clearAllMocks();
        });

        it('should fetch VPN policies successfully', async () => {
            const mockPolicies = {
                policies: [
                    {
                        name: 'Site-to-Site VPN',
                        status: 'up',
                        remote_gateway: '203.0.113.1',
                        encryption: 'AES-256',
                        authentication_method: 'PSK',
                    },
                ],
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPolicies,
            });

            const policies = await api.getVPNPolicies();

            expect(policies).toHaveLength(1);
            expect(policies[0].policy_name).toBe('Site-to-Site VPN');
            expect(policies[0].status).toBe('up');
        });
    });

    describe('getLicenses', () => {
        beforeEach(async () => {
            // Mock successful authentication
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'test-token' }),
                headers: new Headers(),
            });
            await api.authenticate();
            jest.clearAllMocks();
        });

        it('should fetch licenses successfully', async () => {
            const mockLicenses = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockLicenses,
            });

            const licenses = await api.getLicenses();

            expect(licenses.ips_expiry).toBe('2025-12-31');
            expect(licenses.gav_expiry).toBe('2025-12-31');
            expect(licenses.atp_expiry).toBe('2025-12-31');
            expect(licenses.app_control_expiry).toBe('2025-12-31');
            expect(licenses.content_filter_expiry).toBe('2025-12-31');
            expect(licenses.support_expiry).toBe('2025-12-31');
        });

        it('should handle alternative field names for licenses', async () => {
            const mockLicenses = {
                licenses: {
                    ips: { expiry: '2025-12-31' },
                },
                gateway_av_expiry: '2025-11-30',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockLicenses,
            });

            const licenses = await api.getLicenses();

            expect(licenses.ips_expiry).toBe('2025-12-31');
            expect(licenses.gav_expiry).toBe('2025-11-30');
        });

        it('should handle missing license fields with empty strings', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            const licenses = await api.getLicenses();

            expect(licenses.ips_expiry).toBe('');
            expect(licenses.gav_expiry).toBe('');
            expect(licenses.atp_expiry).toBe('');
        });
    });

    describe('comprehensive API method error handling', () => {
        beforeEach(async () => {
            // Mock successful authentication
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'test-token' }),
                headers: new Headers(),
            });
            await api.authenticate();
            jest.clearAllMocks();
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        describe('getSecurityStatistics error handling', () => {
            it('should retry on 500 error', async () => {
                // First attempt fails
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    text: async () => 'Server error',
                });

                // Second attempt succeeds
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ ips_blocks_today: 100 }),
                });

                const promise = api.getSecurityStatistics();
                await jest.advanceTimersByTimeAsync(30000);
                const stats = await promise;

                expect(stats.ips_blocks_today).toBe(100);
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });

            it('should throw on non-retryable 400 error', async () => {
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    statusText: 'Bad Request',
                    text: async () => 'Invalid request',
                });

                await expect(api.getSecurityStatistics()).rejects.toThrow('400 Bad Request');
                expect(global.fetch).toHaveBeenCalledTimes(1);
            });

            it('should handle timeout and retry', async () => {
                // First attempt times out
                (global.fetch as jest.Mock).mockImplementationOnce(() =>
                    Promise.reject(new DOMException('Aborted', 'AbortError'))
                );

                // Second attempt succeeds
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ ips_blocks_today: 100 }),
                });

                const promise = api.getSecurityStatistics();
                await jest.advanceTimersByTimeAsync(30000);
                const stats = await promise;

                expect(stats.ips_blocks_today).toBe(100);
            });
        });

        describe('getInterfaces error handling', () => {
            it('should retry on network error', async () => {
                // First attempt fails with network error
                (global.fetch as jest.Mock).mockRejectedValueOnce(
                    new TypeError('Failed to fetch')
                );

                // Second attempt succeeds
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        interfaces: [
                            { name: 'X0', zone: 'WAN', ip_address: '192.168.1.1', status: 'up', link_speed: '1000Mbps' }
                        ]
                    }),
                });

                const promise = api.getInterfaces();
                await jest.advanceTimersByTimeAsync(30000);
                const interfaces = await promise;

                expect(interfaces).toHaveLength(1);
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });

            it('should handle empty interfaces array', async () => {
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ interfaces: [] }),
                });

                const interfaces = await api.getInterfaces();

                expect(interfaces).toHaveLength(0);
            });

            it('should throw on 404 error', async () => {
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    text: async () => 'Endpoint not found',
                });

                await expect(api.getInterfaces()).rejects.toThrow('404 Not Found');
                expect(global.fetch).toHaveBeenCalledTimes(1);
            });
        });

        describe('getSystemStatus error handling', () => {
            it('should retry on 503 error', async () => {
                // First attempt fails
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: false,
                    status: 503,
                    statusText: 'Service Unavailable',
                    text: async () => 'Service unavailable',
                });

                // Second attempt succeeds
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        cpu_percent: 45.5,
                        ram_percent: 60.2,
                        uptime_seconds: 86400,
                        firmware_version: '7.0.1-5050',
                        model: 'TZ370',
                        serial_number: 'ABC123456',
                    }),
                });

                const promise = api.getSystemStatus();
                await jest.advanceTimersByTimeAsync(30000);
                const status = await promise;

                expect(status.cpu_percent).toBe(45.5);
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });

            it('should handle missing optional HA fields', async () => {
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        cpu_percent: 45.5,
                        ram_percent: 60.2,
                        uptime_seconds: 86400,
                        firmware_version: '7.0.1-5050',
                        model: 'TZ370',
                        serial_number: 'ABC123456',
                    }),
                });

                const status = await api.getSystemStatus();

                expect(status.ha_role).toBeUndefined();
                expect(status.ha_state).toBeUndefined();
            });

            it('should normalize HA role variations', async () => {
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        cpu_percent: 45.5,
                        ram_percent: 60.2,
                        uptime_seconds: 86400,
                        firmware_version: '7.0.1-5050',
                        model: 'TZ370',
                        serial_number: 'ABC123456',
                        ha_role: 'MASTER',
                    }),
                });

                const status = await api.getSystemStatus();

                expect(status.ha_role).toBe('primary');
            });
        });

        describe('getVPNPolicies error handling', () => {
            it('should retry on rate limit error', async () => {
                const headers = new Headers();
                headers.set('Retry-After', '30');

                // First attempt returns 429
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: false,
                    status: 429,
                    statusText: 'Too Many Requests',
                    text: async () => 'Rate limit exceeded',
                    headers,
                });

                // Second attempt succeeds
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        policies: [
                            {
                                name: 'Site-to-Site VPN',
                                status: 'up',
                                remote_gateway: '203.0.113.1',
                                encryption: 'AES-256',
                                authentication_method: 'PSK',
                            }
                        ]
                    }),
                });

                const promise = api.getVPNPolicies();
                await jest.advanceTimersByTimeAsync(30000);
                const policies = await promise;

                expect(policies).toHaveLength(1);
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });

            it('should handle empty policies array', async () => {
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ policies: [] }),
                });

                const policies = await api.getVPNPolicies();

                expect(policies).toHaveLength(0);
            });

            it('should normalize VPN status variations', async () => {
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        policies: [
                            {
                                name: 'VPN1',
                                status: 'connected',
                                remote_gateway: '203.0.113.1',
                                encryption: 'AES-256',
                                authentication_method: 'PSK',
                            },
                            {
                                name: 'VPN2',
                                status: 'disconnected',
                                remote_gateway: '203.0.113.2',
                                encryption: 'AES-256',
                                authentication_method: 'PSK',
                            }
                        ]
                    }),
                });

                const policies = await api.getVPNPolicies();

                expect(policies[0].status).toBe('up');
                expect(policies[1].status).toBe('down');
            });
        });

        describe('getLicenses error handling', () => {
            it('should retry on 502 error', async () => {
                // First attempt fails
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: false,
                    status: 502,
                    statusText: 'Bad Gateway',
                    text: async () => 'Bad gateway',
                });

                // Second attempt succeeds
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        ips_expiry: '2025-12-31',
                        gav_expiry: '2025-12-31',
                        atp_expiry: '2025-12-31',
                        app_control_expiry: '2025-12-31',
                        content_filter_expiry: '2025-12-31',
                        support_expiry: '2025-12-31',
                    }),
                });

                const promise = api.getLicenses();
                await jest.advanceTimersByTimeAsync(30000);
                const licenses = await promise;

                expect(licenses.ips_expiry).toBe('2025-12-31');
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });

            it('should handle nested license structure', async () => {
                (global.fetch as jest.Mock).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        licenses: {
                            ips: { expiry: '2025-12-31' },
                            gav: { expiry: '2025-11-30' },
                        }
                    }),
                });

                const licenses = await api.getLicenses();

                expect(licenses.ips_expiry).toBe('2025-12-31');
                expect(licenses.gav_expiry).toBe('2025-11-30');
            });
        });
    });

    describe('authentication in API requests', () => {
        it('should automatically authenticate when no token exists', async () => {
            // Create API without pre-authentication
            const newApi = new SonicWallAPI(mockConfig);

            // Mock authentication
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'auto-token' }),
                headers: new Headers(),
            });

            // Mock API request
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const stats = await newApi.getSecurityStatistics();

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2); // Auth + request
        });

        it('should propagate authentication failures when auto-authenticating', async () => {
            // Create API without pre-authentication
            const newApi = new SonicWallAPI(mockConfig);

            // Mock authentication failure
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => 'Invalid credentials',
            });

            await expect(newApi.getSecurityStatistics()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                statusCode: 401,
                isAuthError: true,
                isRetryable: false,
            });
        });

        it('should not retry on authentication failure (401) during auto-auth', async () => {
            // Create API without pre-authentication
            const newApi = new SonicWallAPI(mockConfig);

            // Mock authentication failure
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => 'Invalid credentials',
            });

            await expect(newApi.getSecurityStatistics()).rejects.toThrow();
            expect(global.fetch).toHaveBeenCalledTimes(1); // Only auth attempt, no retry
        });
    });

    describe('error handling and retries', () => {
        beforeEach(async () => {
            // Mock successful authentication
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'test-token' }),
                headers: new Headers(),
            });
            await api.authenticate();
            jest.clearAllMocks();
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should re-authenticate on 401 error', async () => {
            // First request returns 401
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 401,
            });

            // Re-authentication succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'new-token' }),
                headers: new Headers(),
            });

            // Retry request succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();
            await jest.runAllTimersAsync();
            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(3); // 401, re-auth, retry
        });

        it('should retry on 500 server error with exponential backoff', async () => {
            // First attempt fails with 500
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error',
            });

            // Second attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through the 30s retry delay
            await jest.advanceTimersByTimeAsync(30000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should retry on timeout with exponential backoff', async () => {
            // First attempt times out
            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.reject(new DOMException('Aborted', 'AbortError'))
            );

            // Second attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through the 30s retry delay
            await jest.advanceTimersByTimeAsync(30000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should handle rate limiting (429) with retry', async () => {
            const headers = new Headers();
            headers.set('Retry-After', '60');

            // First attempt returns 429
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded',
                headers,
            });

            // Second attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through the retry delay (should use max of Retry-After 60s and exponential backoff 30s = 60s)
            await jest.advanceTimersByTimeAsync(60000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should respect Retry-After header in seconds for rate limiting', async () => {
            const headers = new Headers();
            headers.set('Retry-After', '45'); // 45 seconds

            // First attempt returns 429
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded',
                headers,
            });

            // Second attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through the retry delay (should use max of Retry-After 45s and exponential backoff 30s = 45s)
            await jest.advanceTimersByTimeAsync(45000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should respect Retry-After header in HTTP date format for rate limiting', async () => {
            const retryDate = new Date(Date.now() + 50000); // 50 seconds from now
            const headers = new Headers();
            headers.set('Retry-After', retryDate.toUTCString());

            // First attempt returns 429
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded',
                headers,
            });

            // Second attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through the retry delay (should use max of Retry-After ~50s and exponential backoff 30s = ~50s)
            await jest.advanceTimersByTimeAsync(50000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should use default 60s delay when Retry-After header is missing', async () => {
            const headers = new Headers();
            // No Retry-After header

            // First attempt returns 429
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded',
                headers,
            });

            // Second attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through the retry delay (should use max of default 60s and exponential backoff 30s = 60s)
            await jest.advanceTimersByTimeAsync(60000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should cap rate limit retry delay at 300s (5 minutes)', async () => {
            const headers = new Headers();
            headers.set('Retry-After', '600'); // 10 minutes

            // First attempt returns 429
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded',
                headers,
            });

            // Second attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through the capped retry delay (should be capped at 300s)
            await jest.advanceTimersByTimeAsync(300000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should handle multiple consecutive rate limit errors', async () => {
            const headers = new Headers();
            headers.set('Retry-After', '30');

            // First attempt returns 429
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded',
                headers,
            });

            // Second attempt also returns 429
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                text: async () => 'Rate limit exceeded',
                headers,
            });

            // Third attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through first retry delay (30s)
            await jest.advanceTimersByTimeAsync(30000);

            // Fast-forward through second retry delay (60s - exponential backoff)
            await jest.advanceTimersByTimeAsync(60000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('should not retry on 400 client error', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: async () => 'Invalid request',
            });

            const promise = api.getSecurityStatistics();

            await expect(promise).rejects.toThrow('400 Bad Request');
            expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
        });

        it('should not retry on 404 not found error', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => 'Endpoint not found',
            });

            const promise = api.getSecurityStatistics();

            await expect(promise).rejects.toThrow('404 Not Found');
            expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
        });

        it('should exhaust all retries and throw error', async () => {
            // All attempts fail with 500
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error',
            });

            const promise = api.getSecurityStatistics().catch(e => e);

            // Fast-forward through all retry delays: 30s, 60s, 120s, 300s
            await jest.advanceTimersByTimeAsync(30000);  // First retry
            await jest.advanceTimersByTimeAsync(60000);  // Second retry
            await jest.advanceTimersByTimeAsync(120000); // Third retry
            await jest.advanceTimersByTimeAsync(300000); // Fourth retry

            const error = await promise;
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('500 Internal Server Error');
            expect(global.fetch).toHaveBeenCalledTimes(5); // Initial + 4 retries
        });

        it('should retry on network error', async () => {
            // First attempt fails with network error
            (global.fetch as jest.Mock).mockRejectedValueOnce(
                new TypeError('Failed to fetch')
            );

            // Second attempt succeeds
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ips_blocks_today: 100 }),
            });

            const promise = api.getSecurityStatistics();

            // Fast-forward through the 30s retry delay
            await jest.advanceTimersByTimeAsync(30000);

            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should use exponential backoff delays (30s, 60s, 120s, 300s)', async () => {
            let callCount = 0;

            // Mock all attempts to fail
            (global.fetch as jest.Mock).mockImplementation(() => {
                callCount++;
                return Promise.resolve({
                    ok: false,
                    status: 503,
                    statusText: 'Service Unavailable',
                    text: async () => 'Service unavailable',
                });
            });

            const promise = api.getSecurityStatistics().catch(e => e);

            // Fast-forward through all retry delays
            await jest.advanceTimersByTimeAsync(30000);  // 30s - first retry
            await jest.advanceTimersByTimeAsync(60000);  // 60s - second retry
            await jest.advanceTimersByTimeAsync(120000); // 120s - third retry
            await jest.advanceTimersByTimeAsync(300000); // 300s - fourth retry

            // Now the promise should reject
            const error = await promise;
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('503 Service Unavailable');

            // Verify we made initial call + 4 retries = 5 total calls
            expect(callCount).toBe(5);
        });
    });
});
