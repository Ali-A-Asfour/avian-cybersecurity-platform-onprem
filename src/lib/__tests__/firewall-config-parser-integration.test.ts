/**
 * Integration tests for ConfigParser using sample .exp files
 */

import { ConfigParser } from '../firewall-config-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('ConfigParser Integration Tests', () => {
    describe('Sample SonicWall Configuration', () => {
        let configText: string;
        let parsedConfig: any;

        beforeAll(() => {
            const parser = new ConfigParser();
            const filePath = path.join(__dirname, 'fixtures', 'sample-sonicwall-config.exp');
            configText = fs.readFileSync(filePath, 'utf-8');
            parsedConfig = parser.parseConfig(configText);
        });

        it('should parse system settings correctly', () => {
            expect(parsedConfig.systemSettings.firmwareVersion).toBe('7.0.1-5050');
            expect(parsedConfig.systemSettings.hostname).toBe('Corporate-Firewall-01');
            expect(parsedConfig.systemSettings.timezone).toBe('America/New_York');
            expect(parsedConfig.systemSettings.ntpServers).toHaveLength(3);
            expect(parsedConfig.systemSettings.dnsServers).toHaveLength(3);
        });

        it('should parse interfaces correctly', () => {
            expect(parsedConfig.interfaces.length).toBeGreaterThanOrEqual(4);

            const wanInterface = parsedConfig.interfaces.find((i: any) => i.zone === 'WAN');
            expect(wanInterface).toBeDefined();
            expect(wanInterface.interfaceName).toBe('X0');
            expect(wanInterface.ipAddress).toBe('203.0.113.1');

            const guestInterface = parsedConfig.interfaces.find((i: any) => i.zone === 'GUEST');
            expect(guestInterface).toBeDefined();
            expect(guestInterface.dhcpServerEnabled).toBe(true);
        });

        it('should parse security settings correctly', () => {
            expect(parsedConfig.securitySettings.ipsEnabled).toBe(true);
            expect(parsedConfig.securitySettings.gavEnabled).toBe(true);
            expect(parsedConfig.securitySettings.dpiSslEnabled).toBe(true);
            expect(parsedConfig.securitySettings.appControlEnabled).toBe(true);
            expect(parsedConfig.securitySettings.contentFilterEnabled).toBe(true);
            expect(parsedConfig.securitySettings.botnetFilterEnabled).toBe(true);
            expect(parsedConfig.securitySettings.geoIpFilterEnabled).toBe(true);
        });

        it('should parse admin settings correctly', () => {
            expect(parsedConfig.adminSettings.adminUsernames).toContain('admin');
            expect(parsedConfig.adminSettings.adminUsernames).toContain('john.doe');
            expect(parsedConfig.adminSettings.adminUsernames).toContain('security-admin');
            expect(parsedConfig.adminSettings.mfaEnabled).toBe(true);
            expect(parsedConfig.adminSettings.httpsAdminPort).toBe(8443);
            expect(parsedConfig.adminSettings.sshEnabled).toBe(true);
            expect(parsedConfig.adminSettings.wanManagementEnabled).toBe(false); // Commented out in config
        });

        it('should parse firewall rules correctly', () => {
            expect(parsedConfig.rules.length).toBeGreaterThanOrEqual(5);

            const webRule = parsedConfig.rules.find((r: any) => r.ruleName === 'Allow-Outbound-Web');
            expect(webRule).toBeDefined();
            expect(webRule.sourceZone).toBe('LAN');
            expect(webRule.destinationZone).toBe('WAN');
            expect(webRule.action).toBe('allow');
            expect(webRule.comment).toBe('Allow web browsing');

            const disabledRule = parsedConfig.rules.find((r: any) => r.ruleName === 'Disabled-Rule');
            expect(disabledRule).toBeDefined();
            expect(disabledRule.enabled).toBe(false);

            const noDescRule = parsedConfig.rules.find((r: any) => r.ruleName === 'No-Description-Rule');
            expect(noDescRule).toBeDefined();
            expect(noDescRule.comment).toBeUndefined();
        });

        it('should parse NAT policies correctly', () => {
            expect(parsedConfig.natPolicies.length).toBeGreaterThanOrEqual(3);

            const natPolicy = parsedConfig.natPolicies[0];
            expect(natPolicy.originalSource).toBe('192.168.1.0/24');
            expect(natPolicy.translatedSource).toBe('203.0.113.1');
            expect(natPolicy.interface).toBe('X0');
        });

        it('should parse address objects correctly', () => {
            expect(parsedConfig.addressObjects.length).toBeGreaterThanOrEqual(4);

            const webServer = parsedConfig.addressObjects.find((a: any) => a.objectName === 'WebServer');
            expect(webServer).toBeDefined();
            expect(webServer.ipAddress).toBe('192.168.1.100');
            expect(webServer.zone).toBe('LAN');
        });

        it('should parse service objects correctly', () => {
            expect(parsedConfig.serviceObjects.length).toBeGreaterThanOrEqual(5);

            const httpService = parsedConfig.serviceObjects.find((s: any) => s.serviceName === 'HTTP');
            expect(httpService).toBeDefined();
            expect(httpService.protocol).toBe('tcp');
            expect(httpService.portRange).toBe('80');
        });

        it('should parse VPN configurations correctly', () => {
            expect(parsedConfig.vpnConfigs.length).toBeGreaterThanOrEqual(3);

            const siteToSite = parsedConfig.vpnConfigs.find((v: any) => v.policyName === 'Site-to-Site-HQ');
            expect(siteToSite).toBeDefined();
            expect(siteToSite.encryption).toBe('aes256');
            expect(siteToSite.authenticationMethod).toBe('certificate');

            const remoteAccess = parsedConfig.vpnConfigs.find((v: any) => v.policyName === 'Remote-Access-VPN');
            expect(remoteAccess).toBeDefined();
            expect(remoteAccess.authenticationMethod).toBe('psk');
        });
    });

    describe('Risky SonicWall Configuration', () => {
        let configText: string;
        let parsedConfig: any;

        beforeAll(() => {
            const parser = new ConfigParser();
            const filePath = path.join(__dirname, 'fixtures', 'risky-sonicwall-config.exp');
            configText = fs.readFileSync(filePath, 'utf-8');
            parsedConfig = parser.parseConfig(configText);
        });

        it('should detect outdated firmware', () => {
            expect(parsedConfig.systemSettings.firmwareVersion).toBe('6.5.0-1000');
            // Firmware version check would be done by RiskEngine
        });

        it('should detect missing NTP configuration', () => {
            expect(parsedConfig.systemSettings.ntpServers).toHaveLength(0);
        });

        it('should detect disabled security features', () => {
            expect(parsedConfig.securitySettings.ipsEnabled).toBe(false);
            expect(parsedConfig.securitySettings.gavEnabled).toBe(false);
            expect(parsedConfig.securitySettings.dpiSslEnabled).toBe(false);
            expect(parsedConfig.securitySettings.appControlEnabled).toBe(false);
            expect(parsedConfig.securitySettings.contentFilterEnabled).toBe(false);
            expect(parsedConfig.securitySettings.botnetFilterEnabled).toBe(false);
        });

        it('should detect default admin usernames', () => {
            expect(parsedConfig.adminSettings.adminUsernames).toContain('admin');
            expect(parsedConfig.adminSettings.adminUsernames).toContain('root');
            expect(parsedConfig.adminSettings.adminUsernames).toContain('administrator');
        });

        it('should detect missing MFA', () => {
            expect(parsedConfig.adminSettings.mfaEnabled).toBe(false);
        });

        it('should detect WAN management enabled', () => {
            expect(parsedConfig.adminSettings.wanManagementEnabled).toBe(true);
        });

        it('should detect default HTTPS admin port', () => {
            expect(parsedConfig.adminSettings.httpsAdminPort).toBe(443);
        });

        it('should detect SSH enabled on WAN interface', () => {
            expect(parsedConfig.adminSettings.sshEnabled).toBe(true);
            const wanInterface = parsedConfig.interfaces.find((i: any) => i.zone === 'WAN');
            expect(wanInterface).toBeDefined();
            // This combination should trigger SSH_ON_WAN risk in RiskEngine
        });

        it('should detect DHCP on WAN interface', () => {
            const wanInterface = parsedConfig.interfaces.find((i: any) => i.zone === 'WAN');
            expect(wanInterface).toBeDefined();
            expect(wanInterface.dhcpServerEnabled).toBe(true);
        });

        it('should detect dangerous WAN-to-LAN rule', () => {
            const dangerousRule = parsedConfig.rules.find((r: any) =>
                r.sourceZone === 'WAN' &&
                r.destinationZone === 'LAN' &&
                r.sourceAddress === 'any' &&
                r.destinationAddress === 'any'
            );
            expect(dangerousRule).toBeDefined();
            expect(dangerousRule.ruleName).toBe('CRITICAL-WAN-TO-LAN');
        });

        it('should detect any-to-any rule', () => {
            const anyToAnyRule = parsedConfig.rules.find((r: any) =>
                r.sourceZone === 'any' &&
                r.destinationZone === 'any' &&
                r.sourceAddress === 'any' &&
                r.destinationAddress === 'any'
            );
            expect(anyToAnyRule).toBeDefined();
            expect(anyToAnyRule.ruleName).toBe('HIGH-ANY-TO-ANY');
        });

        it('should detect guest-to-LAN routing', () => {
            const guestToLanRule = parsedConfig.rules.find((r: any) =>
                r.sourceZone === 'GUEST' &&
                r.destinationZone === 'LAN'
            );
            expect(guestToLanRule).toBeDefined();
        });

        it('should detect rules without descriptions', () => {
            const rulesWithoutDesc = parsedConfig.rules.filter((r: any) => !r.comment);
            expect(rulesWithoutDesc.length).toBeGreaterThan(0);
        });

        it('should detect weak VPN encryption', () => {
            const weakVpn1 = parsedConfig.vpnConfigs.find((v: any) => v.policyName === 'Weak-VPN-1');
            expect(weakVpn1).toBeDefined();
            expect(weakVpn1.encryption).toBe('des');

            const weakVpn2 = parsedConfig.vpnConfigs.find((v: any) => v.policyName === 'Weak-VPN-2');
            expect(weakVpn2).toBeDefined();
            expect(weakVpn2.encryption).toBe('3des');
        });

        it('should detect PSK-only VPN authentication', () => {
            const pskVpns = parsedConfig.vpnConfigs.filter((v: any) => v.authenticationMethod === 'psk');
            expect(pskVpns.length).toBeGreaterThan(0);
        });
    });
});
