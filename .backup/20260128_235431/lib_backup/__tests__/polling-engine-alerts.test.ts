/**
 * Tests for Polling Engine Alert Creation
 * 
 * Task 5.5: Test alert creation from polling engine
 * 
 * Tests the following alert generation scenarios:
 * - Counter increase alerts (IPS, GAV, ATP)
 * - Status change alerts (WAN, VPN)
 * - Health metric alerts (CPU, RAM)
 */

import { PollingEngine } from '../polling-engine';
import { FirewallPollingStateService } from '@/lib/firewall-polling-state';
import { FirewallEncryption } from '@/lib/firewall-encryption';
import { SonicWallAPI } from '@/lib/sonicwall-api';
import { connectRedis } from '@/lib/redis';
import type { SecurityStats, SystemHealth, InterfaceStatus, VPNPolicy, LicenseInfo } from '@/types/firewall';

// Mock database
jest.mock('@/lib/database', () => ({
    db: {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'alert-1' }]),
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        query: {
            firewallDevices: {
                findFirst: jest.fn(),
            },
        },
    },
}));

// Mock other dependencies
jest.mock('@/lib/firewall-polling-state');
jest.mock('@/lib/firewall-encryption');
jest.mock('@/lib/sonicwall-api');
jest.mock('@/lib/redis');
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('PollingEngine - Alert Creation', () => {
    let engine: PollingEngine;
    let mockRedis: any;
    let mockDb: any;

    const mockDevice = {
        deviceId: 'test-device-1',
        tenantId: 'test-tenant-1',
        model: 'TZ370',
        firmwareVersion: '7.0.1',
        serialNumber: 'TEST123',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPasswordEncrypted: 'encrypted-password',
        status: 'active',
    };

    // Helper function to setup mock API with test data
    const setupMockApi = (
        stats: SecurityStats,
        systemStatus: SystemHealth,
        interfaces: InterfaceStatus[],
        vpnPolicies: VPNPolicy[],
        licenses: LicenseInfo
    ) => {
        const mockApiInstance = {
            getSecurityStatistics: jest.fn().mockResolvedValue(stats),
            getInterfaces: jest.fn().mockResolvedValue(interfaces),
            getSystemStatus: jest.fn().mockResolvedValue(systemStatus),
            getVPNPolicies: jest.fn().mockResolvedValue(vpnPolicies),
            getLicenses: jest.fn().mockResolvedValue(licenses),
        };
        (SonicWallAPI as jest.Mock).mockImplementation(() => mockApiInstance);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        engine = new PollingEngine(30000);

        // Get the mocked db from the module
        mockDb = require('@/lib/database').db;
        mockDb.query.firewallDevices.findFirst.mockResolvedValue(mockDevice);

        // Setup mock Redis
        mockRedis = {
            get: jest.fn().mockResolvedValue(null),
            setEx: jest.fn().mockResolvedValue('OK'),
            exists: jest.fn().mockResolvedValue(0),
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn().mockResolvedValue(1),
        };
        (connectRedis as jest.Mock).mockResolvedValue(mockRedis);

        // Mock encryption
        (FirewallEncryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');

        // Mock SonicWall API - create a mock instance that will be returned
        (SonicWallAPI as jest.Mock).mockImplementation(() => ({
            getSecurityStatistics: jest.fn(),
            getInterfaces: jest.fn(),
            getSystemStatus: jest.fn(),
            getVPNPolicies: jest.fn(),
            getLicenses: jest.fn(),
        }));
    });

    afterEach(async () => {
        if (engine.isPolling()) {
            await engine.stop();
        }
    });

    describe('Counter Increase Alerts', () => {
        it('should create alert when IPS counter increases', async () => {
            // Setup previous state with lower counter
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            // Setup API responses with increased counter
            const mockStats: SecurityStats = {
                ips_blocks_today: 150, // Increased from 100
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            const mockSystemStatus: SystemHealth = {
                cpu_percent: 50,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                {
                    interface_name: 'X0',
                    zone: 'WAN',
                    ip_address: '1.2.3.4',
                    status: 'up',
                    link_speed: '1000',
                },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                {
                    policy_name: 'VPN1',
                    status: 'up',
                    remote_gateway: '5.6.7.8',
                    encryption: 'AES256',
                    authentication_method: 'PSK',
                },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            // Setup mock API to return our test data
            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            // Poll device
            await engine.pollDevice(mockDevice);

            // Verify alert was created
            expect(mockDb.insert).toHaveBeenCalled();
            expect(mockDb.values).toHaveBeenCalled();

            // Get the alert data that was inserted
            const alertCalls = mockDb.values.mock.calls;
            const alertData = alertCalls.find((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) => alert.alertType === 'ips_counter_increase')
            );

            expect(alertData).toBeDefined();
            const ipsAlert = alertData[0].find((alert: any) => alert.alertType === 'ips_counter_increase');
            expect(ipsAlert).toMatchObject({
                tenantId: mockDevice.tenantId,
                deviceId: mockDevice.deviceId,
                alertType: 'ips_counter_increase',
                severity: 'info',
                source: 'api',
            });
            expect(ipsAlert.metadata).toMatchObject({
                previous: 100,
                current: 150,
                delta: 50,
            });
        });

        it('should create alert when GAV counter increases', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 75, // Increased from 50
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            const mockSystemStatus: SystemHealth = {
                cpu_percent: 50,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            const alertCalls = mockDb.values.mock.calls;
            const alertData = alertCalls.find((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) => alert.alertType === 'gav_counter_increase')
            );

            expect(alertData).toBeDefined();
            const gavAlert = alertData[0].find((alert: any) => alert.alertType === 'gav_counter_increase');
            expect(gavAlert).toMatchObject({
                tenantId: mockDevice.tenantId,
                deviceId: mockDevice.deviceId,
                alertType: 'gav_counter_increase',
                severity: 'info',
                source: 'api',
            });
            expect(gavAlert.metadata).toMatchObject({
                previous: 50,
                current: 75,
                delta: 25,
            });
        });

        it('should create alert when ATP counter increases', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 25, // Increased from 10
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            const mockSystemStatus: SystemHealth = {
                cpu_percent: 50,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            const alertCalls = mockDb.values.mock.calls;
            const alertData = alertCalls.find((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) => alert.alertType === 'atp_counter_increase')
            );

            expect(alertData).toBeDefined();
            const atpAlert = alertData[0].find((alert: any) => alert.alertType === 'atp_counter_increase');
            expect(atpAlert).toMatchObject({
                tenantId: mockDevice.tenantId,
                deviceId: mockDevice.deviceId,
                alertType: 'atp_counter_increase',
                severity: 'info',
                source: 'api',
            });
            expect(atpAlert.metadata).toMatchObject({
                previous: 10,
                current: 25,
                delta: 15,
            });
        });

        it('should not create alert when counters do not increase', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            // Same counters as previous state
            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            const mockSystemStatus: SystemHealth = {
                cpu_percent: 50,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            // Check that no counter increase alerts were created
            const alertCalls = mockDb.values.mock.calls;
            const counterAlerts = alertCalls.filter((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) =>
                    alert.alertType.includes('counter_increase')
                )
            );

            expect(counterAlerts.length).toBe(0);
        });
    });

    describe('Status Change Alerts', () => {
        it('should create critical alert when WAN goes down', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const, // Was up
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            const mockSystemStatus: SystemHealth = {
                cpu_percent: 50,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            // WAN interface is now down
            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'down', link_speed: '0' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            const alertCalls = mockDb.values.mock.calls;
            const alertData = alertCalls.find((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) => alert.alertType === 'wan_status_change')
            );

            expect(alertData).toBeDefined();
            const wanAlert = alertData[0].find((alert: any) => alert.alertType === 'wan_status_change');
            expect(wanAlert).toMatchObject({
                tenantId: mockDevice.tenantId,
                deviceId: mockDevice.deviceId,
                alertType: 'wan_status_change',
                severity: 'critical', // Critical when WAN goes down
                source: 'api',
            });
            expect(wanAlert.metadata).toMatchObject({
                previous: 'up',
                current: 'down',
            });
        });

        it('should create info alert when WAN comes back up', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'down' as const, // Was down
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            const mockSystemStatus: SystemHealth = {
                cpu_percent: 50,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            // WAN interface is now up
            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            const alertCalls = mockDb.values.mock.calls;
            const alertData = alertCalls.find((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) => alert.alertType === 'wan_status_change')
            );

            expect(alertData).toBeDefined();
            const wanAlert = alertData[0].find((alert: any) => alert.alertType === 'wan_status_change');
            expect(wanAlert).toMatchObject({
                tenantId: mockDevice.tenantId,
                deviceId: mockDevice.deviceId,
                alertType: 'wan_status_change',
                severity: 'info', // Info when WAN comes back up
                source: 'api',
            });
            expect(wanAlert.metadata).toMatchObject({
                previous: 'down',
                current: 'up',
            });
        });

        it('should create high alert when VPN goes down', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const, // Was up
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            const mockSystemStatus: SystemHealth = {
                cpu_percent: 50,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            // VPN is now down
            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'down', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            const alertCalls = mockDb.values.mock.calls;
            const alertData = alertCalls.find((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) => alert.alertType === 'vpn_status_change')
            );

            expect(alertData).toBeDefined();
            const vpnAlert = alertData[0].find((alert: any) => alert.alertType === 'vpn_status_change');
            expect(vpnAlert).toMatchObject({
                tenantId: mockDevice.tenantId,
                deviceId: mockDevice.deviceId,
                alertType: 'vpn_status_change',
                severity: 'high', // High when VPN goes down
                source: 'api',
            });
            expect(vpnAlert.metadata).toMatchObject({
                previous: 'up',
                current: 'down',
            });
        });
    });

    describe('Health Metric Alerts', () => {
        it('should create warning alert when CPU exceeds 80%', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            // CPU is now at 85%
            const mockSystemStatus: SystemHealth = {
                cpu_percent: 85,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            const alertCalls = mockDb.values.mock.calls;
            const alertData = alertCalls.find((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) => alert.alertType === 'high_cpu')
            );

            expect(alertData).toBeDefined();
            const cpuAlert = alertData[0].find((alert: any) => alert.alertType === 'high_cpu');
            expect(cpuAlert).toMatchObject({
                tenantId: mockDevice.tenantId,
                deviceId: mockDevice.deviceId,
                alertType: 'high_cpu',
                severity: 'warning',
                source: 'api',
            });
            expect(cpuAlert.metadata).toMatchObject({
                cpuPercent: 85,
                threshold: 80,
            });
        });

        it('should create warning alert when RAM exceeds 90%', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            // RAM is now at 95%
            const mockSystemStatus: SystemHealth = {
                cpu_percent: 50,
                ram_percent: 95,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            const alertCalls = mockDb.values.mock.calls;
            const alertData = alertCalls.find((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) => alert.alertType === 'high_ram')
            );

            expect(alertData).toBeDefined();
            const ramAlert = alertData[0].find((alert: any) => alert.alertType === 'high_ram');
            expect(ramAlert).toMatchObject({
                tenantId: mockDevice.tenantId,
                deviceId: mockDevice.deviceId,
                alertType: 'high_ram',
                severity: 'warning',
                source: 'api',
            });
            expect(ramAlert.metadata).toMatchObject({
                ramPercent: 95,
                threshold: 90,
            });
        });

        it('should not create alert when CPU is below threshold', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            // CPU at 75% (below 80% threshold)
            const mockSystemStatus: SystemHealth = {
                cpu_percent: 75,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            await engine.pollDevice(mockDevice);

            // Check that no health metric alerts were created
            const alertCalls = mockDb.values.mock.calls;
            const healthAlerts = alertCalls.filter((call: any) =>
                Array.isArray(call[0]) && call[0].some((alert: any) =>
                    alert.alertType === 'high_cpu' || alert.alertType === 'high_ram'
                )
            );

            expect(healthAlerts.length).toBe(0);
        });
    });

    describe('Alert Deduplication', () => {
        it('should deduplicate health metric alerts within 2 minutes', async () => {
            const previousState = {
                deviceId: mockDevice.deviceId,
                lastPollTime: new Date(),
                lastCounters: {
                    ipsBlocks: 100,
                    gavBlocks: 50,
                    dpiSslBlocks: 20,
                    atpVerdicts: 10,
                    appControlBlocks: 5,
                    botnetBlocks: 3,
                    contentFilterBlocks: 2,
                },
                lastStatus: {
                    wanStatus: 'up' as const,
                    vpnStatus: 'up' as const,
                    cpuPercent: 50,
                    ramPercent: 60,
                },
                lastSecurityFeatures: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    dpiSslEnabled: true,
                    atpEnabled: true,
                    botnetEnabled: true,
                    appControlEnabled: true,
                },
            };
            (FirewallPollingStateService.getState as jest.Mock).mockResolvedValue(previousState);
            (FirewallPollingStateService.shouldCreateSnapshot as jest.Mock).mockResolvedValue(false);
            (FirewallPollingStateService.storeState as jest.Mock).mockResolvedValue(undefined);

            const mockStats: SecurityStats = {
                ips_blocks_today: 100,
                gav_blocks_today: 50,
                dpi_ssl_blocks_today: 20,
                atp_verdicts_today: 10,
                app_control_blocks_today: 5,
                botnet_blocks_today: 3,
                content_filter_blocks_today: 2,
            };

            const mockSystemStatus: SystemHealth = {
                cpu_percent: 85,
                ram_percent: 60,
                uptime_seconds: 86400,
                firmware_version: '7.0.1',
                model: 'TZ370',
                serial_number: 'TEST123',
            };

            const mockInterfaces: InterfaceStatus[] = [
                { interface_name: 'X0', zone: 'WAN', ip_address: '1.2.3.4', status: 'up', link_speed: '1000' },
            ];

            const mockVpnPolicies: VPNPolicy[] = [
                { policy_name: 'VPN1', status: 'up', remote_gateway: '5.6.7.8', encryption: 'AES256', authentication_method: 'PSK' },
            ];

            const mockLicenses: LicenseInfo = {
                ips_expiry: '2025-12-31',
                gav_expiry: '2025-12-31',
                atp_expiry: '2025-12-31',
                app_control_expiry: '2025-12-31',
                content_filter_expiry: '2025-12-31',
                support_expiry: '2025-12-31',
            };

            setupMockApi(mockStats, mockSystemStatus, mockInterfaces, mockVpnPolicies, mockLicenses);

            // First poll - should create alert
            await engine.pollDevice(mockDevice);

            // Simulate Redis returning existing alert data for second poll
            mockRedis.get.mockResolvedValue(JSON.stringify({ cpuPercent: 85 }));

            // Second poll - should skip duplicate alert
            await engine.pollDevice(mockDevice);

            // Verify setEx was called to record the alert
            expect(mockRedis.setEx).toHaveBeenCalled();
        });
    });
});
