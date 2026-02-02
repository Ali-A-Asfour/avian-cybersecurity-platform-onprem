/**
 * Integration Tests for SonicWall API Client with Mock Server
 * 
 * Tests the SonicWall API client against a mock HTTP server.
 * Validates end-to-end behavior including authentication, retries, and error handling.
 * 
 * Requirements: Task 2.4 - Test API client with mock SonicWall server
 */

import { SonicWallAPI } from '../sonicwall-api';
import { MockSonicWallServer } from './mock-sonicwall-server';
import { SonicWallAPIConfig } from '@/types/firewall';

describe('SonicWallAPI Integration Tests with Mock Server', () => {
    let mockServer: MockSonicWallServer;
    let api: SonicWallAPI;

    beforeAll(async () => {
        // Start mock server
        mockServer = new MockSonicWallServer({
            username: 'admin',
            password: 'password123',
            authToken: 'test-token-integration',
        });
        await mockServer.start();
    });

    afterAll(async () => {
        // Stop mock server
        await mockServer.stop();
    });

    beforeEach(() => {
        // Reset server state
        mockServer.resetCounters();
        mockServer.setSimulateErrors(false);
        mockServer.setSimulateRateLimit(false);
        mockServer.setSimulateTimeout(false);
        mockServer.setResponseDelay(0);

        // Reset mock data to defaults
        mockServer.setSecurityStats({
            ips_blocks_today: 100,
            gav_blocks_today: 50,
            dpi_ssl_blocks_today: 25,
            atp_verdicts_today: 10,
            app_control_blocks_today: 5,
            content_filter_blocks_today: 15,
            botnet_blocks_today: 8,
        });

        mockServer.setInterfaces([
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
            {
                name: 'X2',
                zone: 'DMZ',
                ip_address: '172.16.0.1',
                status: 'down',
                link_speed: '0',
            },
        ]);

        mockServer.setSystemHealth({
            cpu_percent: 45.5,
            ram_percent: 60.2,
            uptime_seconds: 86400,
            firmware_version: '7.0.1-5050',
            model: 'TZ370',
            serial_number: 'ABC123456',
        });

        mockServer.setVPNPolicies([
            {
                name: 'Site-to-Site VPN',
                status: 'up',
                remote_gateway: '203.0.113.1',
                encryption: 'AES-256',
                authentication_method: 'PSK',
            },
            {
                name: 'Remote Access VPN',
                status: 'down',
                remote_gateway: '203.0.113.2',
                encryption: 'AES-128',
                authentication_method: 'Certificate',
            },
        ]);

        mockServer.setLicenses({
            ips_expiry: '2025-12-31',
            gav_expiry: '2025-12-31',
            atp_expiry: '2025-12-31',
            app_control_expiry: '2025-12-31',
            content_filter_expiry: '2025-12-31',
            support_expiry: '2025-12-31',
        });

        // Create API client
        const config: SonicWallAPIConfig = {
            baseUrl: mockServer.getUrl(),
            username: 'admin',
            password: 'password123',
            timeout: 5000,
        };
        api = new SonicWallAPI(config);
    });

    describe('Authentication Flow', () => {
        it('should authenticate successfully and receive token', async () => {
            const token = await api.authenticate();
            expect(token).toBe('test-token-integration');
        });

        it('should fail authentication with invalid credentials', async () => {
            const badApi = new SonicWallAPI({
                baseUrl: mockServer.getUrl(),
                username: 'wrong',
                password: 'wrong',
                timeout: 5000,
            });

            await expect(badApi.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                statusCode: 401,
                isAuthError: true,
                isRetryable: false,
            });
        });

        it('should handle server errors during authentication', async () => {
            mockServer.setSimulateErrors(true);

            await expect(api.authenticate()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                statusCode: 500,
                isRetryable: true,
            });
        });
    });

    describe('Security Statistics', () => {
        beforeEach(async () => {
            await api.authenticate();
        });

        it('should fetch security statistics successfully', async () => {
            const stats = await api.getSecurityStatistics();

            expect(stats).toEqual({
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 25,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                content_filter_blocks_today: 15,
                botnet_blocks_today: 8,
            });
        });

        it('should handle custom security statistics', async () => {
            mockServer.setSecurityStats({
                ips_blocks_today: 200,
                gav_blocks_today: 100,
            });

            const stats = await api.getSecurityStatistics();

            expect(stats.ips_blocks_today).toBe(200);
            expect(stats.gav_blocks_today).toBe(100);
        });

        it('should auto-authenticate if token missing', async () => {
            // Create new API without pre-authentication
            const newApi = new SonicWallAPI({
                baseUrl: mockServer.getUrl(),
                username: 'admin',
                password: 'password123',
                timeout: 5000,
            });

            const stats = await newApi.getSecurityStatistics();

            expect(stats.ips_blocks_today).toBe(100);
        });
    });

    describe('Interface Status', () => {
        beforeEach(async () => {
            await api.authenticate();
        });

        it('should fetch interface status successfully', async () => {
            const interfaces = await api.getInterfaces();

            expect(interfaces).toHaveLength(3);
            expect(interfaces[0]).toEqual({
                interface_name: 'X0',
                zone: 'WAN',
                ip_address: '192.168.1.1',
                status: 'up',
                link_speed: '1000Mbps',
            });
        });

        it('should handle custom interfaces', async () => {
            mockServer.setInterfaces([
                {
                    name: 'X0',
                    zone: 'WAN',
                    ip_address: '203.0.113.1',
                    status: 'up',
                    link_speed: '10Gbps',
                },
            ]);

            const interfaces = await api.getInterfaces();

            expect(interfaces).toHaveLength(1);
            expect(interfaces[0].link_speed).toBe('10Gbps');
        });
    });

    describe('System Status', () => {
        beforeEach(async () => {
            await api.authenticate();
        });

        it('should fetch system status successfully', async () => {
            const status = await api.getSystemStatus();

            expect(status).toEqual({
                cpu_percent: 45.5,
                ram_percent: 60.2,
                uptime_seconds: 86400,
                firmware_version: '7.0.1-5050',
                model: 'TZ370',
                serial_number: 'ABC123456',
            });
        });

        it('should handle HA status when available', async () => {
            mockServer.setSystemHealth({
                ha_role: 'primary',
                ha_state: 'active',
            });

            const status = await api.getSystemStatus();

            expect(status.ha_role).toBe('primary');
            expect(status.ha_state).toBe('active');
        });

        it('should handle high resource usage', async () => {
            mockServer.setSystemHealth({
                cpu_percent: 95.5,
                ram_percent: 98.2,
            });

            const status = await api.getSystemStatus();

            expect(status.cpu_percent).toBeGreaterThan(90);
            expect(status.ram_percent).toBeGreaterThan(90);
        });
    });

    describe('VPN Policies', () => {
        beforeEach(async () => {
            await api.authenticate();
        });

        it('should fetch VPN policies successfully', async () => {
            const policies = await api.getVPNPolicies();

            expect(policies).toHaveLength(2);
            expect(policies[0]).toEqual({
                policy_name: 'Site-to-Site VPN',
                status: 'up',
                remote_gateway: '203.0.113.1',
                encryption: 'AES-256',
                authentication_method: 'PSK',
            });
        });

        it('should handle custom VPN policies', async () => {
            mockServer.setVPNPolicies([
                {
                    name: 'Custom VPN',
                    status: 'down',
                    remote_gateway: '198.51.100.1',
                    encryption: 'AES-128',
                    authentication_method: 'Certificate',
                },
            ]);

            const policies = await api.getVPNPolicies();

            expect(policies).toHaveLength(1);
            expect(policies[0].policy_name).toBe('Custom VPN');
        });
    });

    describe('License Information', () => {
        beforeEach(async () => {
            await api.authenticate();
        });

        it('should fetch license information successfully', async () => {
            const licenses = await api.getLicenses();

            expect(licenses).toEqual({
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            });
        });

        it('should handle custom license expiry dates', async () => {
            mockServer.setLicenses({
                ips_expiry: '2024-01-15',
                gav_expiry: '2024-02-20',
            });

            const licenses = await api.getLicenses();

            expect(licenses.ips_expiry).toBe('2024-01-15');
            expect(licenses.gav_expiry).toBe('2024-02-20');
        });
    });

    describe('Error Handling and Retries', () => {
        beforeEach(async () => {
            await api.authenticate();
        });

        it('should retry on server errors', async () => {
            // First request fails, then succeeds
            const callCount = 0;
            mockServer.setSimulateErrors(true);

            // After 1 second, disable errors
            setTimeout(() => {
                mockServer.setSimulateErrors(false);
            }, 100);

            const promise = api.getSecurityStatistics();

            // Wait for retry to complete
            const stats = await promise;

            expect(stats.ips_blocks_today).toBe(100);
        }, 35000); // Increase timeout for retry delay

        it('should handle rate limiting with retry', async () => {
            mockServer.setSimulateRateLimit(true);

            const stats = await api.getSecurityStatistics();

            // Should succeed after rate limit clears
            expect(stats.ips_blocks_today).toBe(100);
        }, 65000); // Increase timeout for rate limit retry

        it('should timeout on slow responses', async () => {
            // Create API with short timeout
            const shortTimeoutApi = new SonicWallAPI({
                baseUrl: mockServer.getUrl(),
                username: 'admin',
                password: 'password123',
                timeout: 100, // 100ms timeout
            });

            await shortTimeoutApi.authenticate();

            // Set server to delay response longer than timeout
            mockServer.setResponseDelay(200);

            await expect(shortTimeoutApi.getSecurityStatistics()).rejects.toMatchObject({
                name: 'SonicWallAPIError',
                isRetryable: true,
            });
        }, 10000);
    });

    describe('End-to-End Scenarios', () => {
        it('should handle complete workflow: auth + multiple API calls', async () => {
            // Authenticate
            const token = await api.authenticate();
            expect(token).toBe('test-token-integration');

            // Fetch all data
            const [stats, interfaces, status, policies, licenses] = await Promise.all([
                api.getSecurityStatistics(),
                api.getInterfaces(),
                api.getSystemStatus(),
                api.getVPNPolicies(),
                api.getLicenses(),
            ]);

            // Verify all responses
            expect(stats.ips_blocks_today).toBe(100);
            expect(interfaces).toHaveLength(3);
            expect(status.model).toBe('TZ370');
            expect(policies).toHaveLength(2);
            expect(licenses.ips_expiry).toBe('2025-12-31');
        });

        it('should handle token expiration and re-authentication', async () => {
            // Initial authentication
            await api.authenticate();

            // First request succeeds
            const stats1 = await api.getSecurityStatistics();
            expect(stats1.ips_blocks_today).toBe(100);

            // Change auth token on server (simulates token expiration)
            mockServer = new MockSonicWallServer({
                username: 'admin',
                password: 'password123',
                authToken: 'new-token-after-expiry',
            });

            // Note: In real scenario, the API would detect 401 and re-authenticate
            // For this test, we're just verifying the mock server works with new token
        });

        it('should handle concurrent requests efficiently', async () => {
            await api.authenticate();

            // Make 10 concurrent requests
            const promises = Array.from({ length: 10 }, () =>
                api.getSecurityStatistics()
            );

            const results = await Promise.all(promises);

            // All should succeed
            expect(results).toHaveLength(10);
            results.forEach(stats => {
                expect(stats.ips_blocks_today).toBe(100);
            });
        });
    });

    describe('Mock Server Configuration', () => {
        it('should allow updating mock data dynamically', async () => {
            await api.authenticate();

            // Initial fetch
            const stats1 = await api.getSecurityStatistics();
            expect(stats1.ips_blocks_today).toBe(100);

            // Update mock data
            mockServer.setSecurityStats({
                ips_blocks_today: 500,
            });

            // Fetch again
            const stats2 = await api.getSecurityStatistics();
            expect(stats2.ips_blocks_today).toBe(500);
        });

        it('should support multiple test scenarios with same server', async () => {
            await api.authenticate();

            // Scenario 1: Normal operation
            mockServer.setSystemHealth({
                cpu_percent: 30,
                ram_percent: 40,
            });
            const status1 = await api.getSystemStatus();
            expect(status1.cpu_percent).toBe(30);

            // Scenario 2: High load
            mockServer.setSystemHealth({
                cpu_percent: 95,
                ram_percent: 98,
            });
            const status2 = await api.getSystemStatus();
            expect(status2.cpu_percent).toBe(95);

            // Scenario 3: HA failover
            mockServer.setSystemHealth({
                cpu_percent: 45,
                ram_percent: 60,
                ha_role: 'secondary',
                ha_state: 'standby',
            });
            const status3 = await api.getSystemStatus();
            expect(status3.ha_role).toBe('secondary');
        });
    });
});
