/**
 * Risk Severity Verification Test
 * 
 * This test verifies that all risk detection rules in the ConfigParser
 * match the severity levels specified in Requirements 6.14-6.33
 * 
 * Task: 4.7 - Verify risk severity assignments
 */

import { describe, it, expect } from '@jest/globals';
import { ConfigParser, RiskEngine } from '../firewall-config-parser';
import type {
    ParsedConfig,
    FirewallRule,
    AdminSettings,
    SecuritySettings,
    InterfaceConfig,
    VPNConfig,
    SystemSettings,
} from '@/types/firewall';

describe('Risk Severity Verification', () => {
    const riskEngine = new RiskEngine();

    /**
     * Expected severity levels from Requirements 6.14-6.33
     */
    const expectedSeverities = {
        // Network misconfiguration risks
        OPEN_INBOUND: 'critical',              // Req 6.14
        ANY_ANY_RULE: 'high',                  // Req 6.15
        GUEST_NOT_ISOLATED: 'high',            // Req 6.30
        DHCP_ON_WAN: 'critical',               // Req 6.31

        // Exposure risks
        WAN_MANAGEMENT_ENABLED: 'critical',    // Req 6.16
        SSH_ON_WAN: 'high',                    // Req 6.26

        // Security feature disabled risks
        IPS_DISABLED: 'critical',              // Req 6.19
        GAV_DISABLED: 'critical',              // Req 6.20
        DPI_SSL_DISABLED: 'medium',            // Req 6.21
        BOTNET_FILTER_DISABLED: 'high',        // Req 6.22
        APP_CONTROL_DISABLED: 'medium',        // Req 6.23
        CONTENT_FILTER_DISABLED: 'medium',     // Req 6.24
        VPN_WEAK_ENCRYPTION: 'high',           // Req 6.28

        // Best practice violations
        ADMIN_NO_MFA: 'high',                  // Req 6.17
        DEFAULT_ADMIN_USERNAME: 'medium',      // Req 6.18
        DEFAULT_ADMIN_PORT: 'low',             // Req 6.27
        RULE_NO_DESCRIPTION: 'low',            // Req 6.25
        VPN_PSK_ONLY: 'medium',                // Req 6.29
        OUTDATED_FIRMWARE: 'medium',           // Req 6.32
        NO_NTP: 'low',                         // Req 6.33
    };

    describe('Network Misconfiguration Risks', () => {
        it('should assign CRITICAL severity to OPEN_INBOUND (WAN-to-LAN any rules)', () => {
            const rules: FirewallRule[] = [{
                ruleName: 'test-rule',
                sourceZone: 'WAN',
                destinationZone: 'LAN',
                sourceAddress: '192.168.1.1',
                destinationAddress: 'any',
                service: 'any',
                action: 'allow',
                enabled: true,
            }];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OPEN_INBOUND');
            expect(risks[0].severity).toBe(expectedSeverities.OPEN_INBOUND);
        });

        it('should assign HIGH severity to ANY_ANY_RULE', () => {
            const rules: FirewallRule[] = [{
                ruleName: 'test-rule',
                sourceZone: 'LAN',
                destinationZone: 'WAN',
                sourceAddress: 'any',
                destinationAddress: 'any',
                service: 'any',
                action: 'allow',
                enabled: true,
            }];

            const risks = riskEngine.detectAnyToAnyRules(rules);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('ANY_ANY_RULE');
            expect(risks[0].severity).toBe(expectedSeverities.ANY_ANY_RULE);
        });

        it('should assign HIGH severity to GUEST_NOT_ISOLATED', () => {
            const rules: FirewallRule[] = [{
                ruleName: 'test-rule',
                sourceZone: 'GUEST',
                destinationZone: 'LAN',
                sourceAddress: 'any',
                destinationAddress: 'any',
                service: 'any',
                action: 'allow',
                enabled: true,
            }];

            const risks = riskEngine.detectGuestNotIsolated(rules);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GUEST_NOT_ISOLATED');
            expect(risks[0].severity).toBe(expectedSeverities.GUEST_NOT_ISOLATED);
        });

        it('should assign CRITICAL severity to DHCP_ON_WAN', () => {
            const interfaces: InterfaceConfig[] = [{
                interfaceName: 'X1',
                zone: 'WAN',
                ipAddress: '1.2.3.4',
                dhcpServerEnabled: true,
            }];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DHCP_ON_WAN');
            expect(risks[0].severity).toBe(expectedSeverities.DHCP_ON_WAN);
        });
    });

    describe('Exposure Risks', () => {
        it('should assign CRITICAL severity to WAN_MANAGEMENT_ENABLED', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: false,
                wanManagementEnabled: true,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectWANManagementEnabled(adminSettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('WAN_MANAGEMENT_ENABLED');
            expect(risks[0].severity).toBe(expectedSeverities.WAN_MANAGEMENT_ENABLED);
        });

        it('should assign HIGH severity to SSH_ON_WAN', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: false,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const interfaces: InterfaceConfig[] = [{
                interfaceName: 'X1',
                zone: 'WAN',
                ipAddress: '1.2.3.4',
                dhcpServerEnabled: false,
            }];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('SSH_ON_WAN');
            expect(risks[0].severity).toBe(expectedSeverities.SSH_ON_WAN);
        });
    });

    describe('Security Feature Disabled Risks', () => {
        it('should assign CRITICAL severity to IPS_DISABLED', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: false,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectIPSDisabled(securitySettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('IPS_DISABLED');
            expect(risks[0].severity).toBe(expectedSeverities.IPS_DISABLED);
        });

        it('should assign CRITICAL severity to GAV_DISABLED', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: false,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectGAVDisabled(securitySettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GAV_DISABLED');
            expect(risks[0].severity).toBe(expectedSeverities.GAV_DISABLED);
        });

        it('should assign MEDIUM severity to DPI_SSL_DISABLED', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: false,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectDPISSLDisabled(securitySettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DPI_SSL_DISABLED');
            expect(risks[0].severity).toBe(expectedSeverities.DPI_SSL_DISABLED);
        });

        it('should assign HIGH severity to BOTNET_FILTER_DISABLED', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: false,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectBotnetFilterDisabled(securitySettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('BOTNET_FILTER_DISABLED');
            expect(risks[0].severity).toBe(expectedSeverities.BOTNET_FILTER_DISABLED);
        });

        it('should assign MEDIUM severity to APP_CONTROL_DISABLED', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: false,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectAppControlDisabled(securitySettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('APP_CONTROL_DISABLED');
            expect(risks[0].severity).toBe(expectedSeverities.APP_CONTROL_DISABLED);
        });

        it('should assign MEDIUM severity to CONTENT_FILTER_DISABLED', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: false,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectContentFilterDisabled(securitySettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('CONTENT_FILTER_DISABLED');
            expect(risks[0].severity).toBe(expectedSeverities.CONTENT_FILTER_DISABLED);
        });

        it('should assign HIGH severity to VPN_WEAK_ENCRYPTION', () => {
            const vpnConfigs: VPNConfig[] = [{
                policyName: 'test-vpn',
                encryption: 'DES',
                authenticationMethod: 'psk',
            }];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_WEAK_ENCRYPTION');
            expect(risks[0].severity).toBe(expectedSeverities.VPN_WEAK_ENCRYPTION);
        });
    });

    describe('Best Practice Violations', () => {
        it('should assign HIGH severity to ADMIN_NO_MFA', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: false,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectMFADisabled(adminSettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('ADMIN_NO_MFA');
            expect(risks[0].severity).toBe(expectedSeverities.ADMIN_NO_MFA);
        });

        it('should assign MEDIUM severity to DEFAULT_ADMIN_USERNAME', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminUsername(adminSettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DEFAULT_ADMIN_USERNAME');
            expect(risks[0].severity).toBe(expectedSeverities.DEFAULT_ADMIN_USERNAME);
        });

        it('should assign LOW severity to DEFAULT_ADMIN_PORT', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['customadmin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminPort(adminSettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DEFAULT_ADMIN_PORT');
            expect(risks[0].severity).toBe(expectedSeverities.DEFAULT_ADMIN_PORT);
        });

        it('should assign LOW severity to RULE_NO_DESCRIPTION', () => {
            const rules: FirewallRule[] = [{
                ruleName: 'test-rule',
                sourceZone: 'LAN',
                destinationZone: 'WAN',
                sourceAddress: '192.168.1.1',
                destinationAddress: '8.8.8.8',
                service: 'https',
                action: 'allow',
                enabled: true,
                comment: undefined, // No description
            }];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('RULE_NO_DESCRIPTION');
            expect(risks[0].severity).toBe(expectedSeverities.RULE_NO_DESCRIPTION);
        });

        it('should assign MEDIUM severity to VPN_PSK_ONLY', () => {
            const vpnConfigs: VPNConfig[] = [{
                policyName: 'test-vpn',
                encryption: 'AES-256',
                authenticationMethod: 'psk',
            }];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_PSK_ONLY');
            expect(risks[0].severity).toBe(expectedSeverities.VPN_PSK_ONLY);
        });

        it('should assign MEDIUM severity to OUTDATED_FIRMWARE', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '6.5.4.7-112n-2020-01-15', // Old date
                hostname: 'test-firewall',
                timezone: 'UTC',
                ntpServers: ['pool.ntp.org'],
                dnsServers: ['8.8.8.8'],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OUTDATED_FIRMWARE');
            expect(risks[0].severity).toBe(expectedSeverities.OUTDATED_FIRMWARE);
        });

        it('should assign LOW severity to NO_NTP', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '7.0.1',
                hostname: 'test-firewall',
                timezone: 'UTC',
                ntpServers: [], // No NTP servers
                dnsServers: ['8.8.8.8'],
            };

            const risks = riskEngine.detectMissingNTP(systemSettings);
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('NO_NTP');
            expect(risks[0].severity).toBe(expectedSeverities.NO_NTP);
        });
    });

    describe('Comprehensive Severity Verification', () => {
        it('should verify all 20 risk types have correct severity assignments', () => {
            // Create a config with all possible risks
            const config: ParsedConfig = {
                rules: [
                    // OPEN_INBOUND - critical
                    {
                        ruleName: 'wan-to-lan-any',
                        sourceZone: 'WAN',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                    // ANY_ANY_RULE - high
                    {
                        ruleName: 'any-to-any',
                        sourceZone: 'LAN',
                        destinationZone: 'WAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                    // GUEST_NOT_ISOLATED - high
                    {
                        ruleName: 'guest-to-lan',
                        sourceZone: 'GUEST',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                    // RULE_NO_DESCRIPTION - low
                    {
                        ruleName: 'no-description',
                        sourceZone: 'LAN',
                        destinationZone: 'WAN',
                        sourceAddress: '192.168.1.1',
                        destinationAddress: '8.8.8.8',
                        service: 'https',
                        action: 'allow',
                        enabled: true,
                        comment: undefined,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: false,        // IPS_DISABLED - critical
                    gavEnabled: false,        // GAV_DISABLED - critical
                    antiSpywareEnabled: true,
                    appControlEnabled: false, // APP_CONTROL_DISABLED - medium
                    contentFilterEnabled: false, // CONTENT_FILTER_DISABLED - medium
                    botnetFilterEnabled: false,  // BOTNET_FILTER_DISABLED - high
                    dpiSslEnabled: false,     // DPI_SSL_DISABLED - medium
                    geoIpFilterEnabled: true,
                },
                adminSettings: {
                    adminUsernames: ['admin'], // DEFAULT_ADMIN_USERNAME - medium
                    mfaEnabled: false,         // ADMIN_NO_MFA - high
                    wanManagementEnabled: true, // WAN_MANAGEMENT_ENABLED - critical
                    httpsAdminPort: 443,       // DEFAULT_ADMIN_PORT - low
                    sshEnabled: true,          // SSH_ON_WAN - high (if WAN interface exists)
                },
                interfaces: [
                    {
                        interfaceName: 'X1',
                        zone: 'WAN',
                        ipAddress: '1.2.3.4',
                        dhcpServerEnabled: true, // DHCP_ON_WAN - critical
                    },
                ],
                vpnConfigs: [
                    {
                        policyName: 'weak-vpn',
                        encryption: 'DES',       // VPN_WEAK_ENCRYPTION - high
                        authenticationMethod: 'psk', // VPN_PSK_ONLY - medium
                    },
                ],
                systemSettings: {
                    firmwareVersion: '6.5.4.7-112n-2020-01-15', // OUTDATED_FIRMWARE - medium
                    hostname: 'test-firewall',
                    timezone: 'UTC',
                    ntpServers: [],            // NO_NTP - low
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            // Verify we detected all expected risk types
            const detectedRiskTypes = new Set(risks.map(r => r.riskType));
            const expectedRiskTypes = Object.keys(expectedSeverities);

            // Check that all expected risk types are detected
            for (const expectedType of expectedRiskTypes) {
                expect(detectedRiskTypes.has(expectedType)).toBe(true);
            }

            // Verify each risk has the correct severity
            for (const risk of risks) {
                const expectedSeverity = expectedSeverities[risk.riskType as keyof typeof expectedSeverities];
                expect(risk.severity).toBe(expectedSeverity);
            }

            // Verify risk score calculation
            const score = riskEngine.calculateRiskScore(risks);

            // Calculate expected score:
            // Base: 100
            // Critical (4): OPEN_INBOUND, WAN_MANAGEMENT_ENABLED, IPS_DISABLED, GAV_DISABLED, DHCP_ON_WAN = 5 * -25 = -125
            // High (5): ANY_ANY_RULE, GUEST_NOT_ISOLATED, SSH_ON_WAN, BOTNET_FILTER_DISABLED, ADMIN_NO_MFA, VPN_WEAK_ENCRYPTION = 6 * -15 = -90
            // Medium (6): DPI_SSL_DISABLED, APP_CONTROL_DISABLED, CONTENT_FILTER_DISABLED, DEFAULT_ADMIN_USERNAME, VPN_PSK_ONLY, OUTDATED_FIRMWARE = 6 * -5 = -30
            // Low (3): DEFAULT_ADMIN_PORT, RULE_NO_DESCRIPTION, NO_NTP = 3 * -1 = -3
            // Total: 100 - 125 - 90 - 30 - 3 = -148, clamped to 0
            expect(score).toBe(0);
        });
    });

    describe('Risk Category Verification', () => {
        it('should verify all risks have correct category assignments', () => {
            const expectedCategories = {
                // Network misconfiguration
                OPEN_INBOUND: 'exposure_risk',
                ANY_ANY_RULE: 'network_misconfiguration',
                GUEST_NOT_ISOLATED: 'network_misconfiguration',
                DHCP_ON_WAN: 'network_misconfiguration',

                // Exposure risks
                WAN_MANAGEMENT_ENABLED: 'exposure_risk',
                SSH_ON_WAN: 'exposure_risk',

                // Security feature disabled
                IPS_DISABLED: 'security_feature_disabled',
                GAV_DISABLED: 'security_feature_disabled',
                DPI_SSL_DISABLED: 'security_feature_disabled',
                BOTNET_FILTER_DISABLED: 'security_feature_disabled',
                APP_CONTROL_DISABLED: 'security_feature_disabled',
                CONTENT_FILTER_DISABLED: 'security_feature_disabled',
                VPN_WEAK_ENCRYPTION: 'security_feature_disabled',

                // Best practice violations
                ADMIN_NO_MFA: 'best_practice_violation',
                DEFAULT_ADMIN_USERNAME: 'best_practice_violation',
                DEFAULT_ADMIN_PORT: 'best_practice_violation',
                RULE_NO_DESCRIPTION: 'best_practice_violation',
                VPN_PSK_ONLY: 'best_practice_violation',
                OUTDATED_FIRMWARE: 'best_practice_violation',
                NO_NTP: 'best_practice_violation',
            };

            // Create a config with all possible risks
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'wan-to-lan-any',
                        sourceZone: 'WAN',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                    {
                        ruleName: 'any-to-any',
                        sourceZone: 'LAN',
                        destinationZone: 'WAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                    {
                        ruleName: 'guest-to-lan',
                        sourceZone: 'GUEST',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                    {
                        ruleName: 'no-description',
                        sourceZone: 'LAN',
                        destinationZone: 'WAN',
                        sourceAddress: '192.168.1.1',
                        destinationAddress: '8.8.8.8',
                        service: 'https',
                        action: 'allow',
                        enabled: true,
                        comment: undefined,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: false,
                    gavEnabled: false,
                    antiSpywareEnabled: true,
                    appControlEnabled: false,
                    contentFilterEnabled: false,
                    botnetFilterEnabled: false,
                    dpiSslEnabled: false,
                    geoIpFilterEnabled: true,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: false,
                    wanManagementEnabled: true,
                    httpsAdminPort: 443,
                    sshEnabled: true,
                },
                interfaces: [
                    {
                        interfaceName: 'X1',
                        zone: 'WAN',
                        ipAddress: '1.2.3.4',
                        dhcpServerEnabled: true,
                    },
                ],
                vpnConfigs: [
                    {
                        policyName: 'weak-vpn',
                        encryption: 'DES',
                        authenticationMethod: 'psk',
                    },
                ],
                systemSettings: {
                    firmwareVersion: '6.5.4.7-112n-2020-01-15',
                    hostname: 'test-firewall',
                    timezone: 'UTC',
                    ntpServers: [],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            // Verify each risk has the correct category
            for (const risk of risks) {
                const expectedCategory = expectedCategories[risk.riskType as keyof typeof expectedCategories];
                expect(risk.riskCategory).toBe(expectedCategory);
            }
        });
    });
});
