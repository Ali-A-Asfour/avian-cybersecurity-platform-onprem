/**
 * Comprehensive Test Suite for All 20 Risk Detection Rules
 * 
 * This test file validates that ALL 20 risk detection rules from Requirements 6.14-6.33
 * are properly implemented and working correctly.
 * 
 * Requirements Coverage:
 * 1. OPEN_INBOUND (6.14) - WAN-to-LAN any rule
 * 2. ANY_ANY_RULE (6.15) - Any-to-any rule
 * 3. WAN_MANAGEMENT_ENABLED (6.16) - WAN management enabled
 * 4. ADMIN_NO_MFA (6.17) - MFA disabled
 * 5. DEFAULT_ADMIN_USERNAME (6.18) - Default admin username
 * 6. IPS_DISABLED (6.19) - IPS disabled
 * 7. GAV_DISABLED (6.20) - Gateway Anti-Virus disabled
 * 8. DPI_SSL_DISABLED (6.21) - DPI-SSL disabled
 * 9. BOTNET_FILTER_DISABLED (6.22) - Botnet Filter disabled
 * 10. APP_CONTROL_DISABLED (6.23) - Application Control disabled
 * 11. CONTENT_FILTER_DISABLED (6.24) - Content Filtering disabled
 * 12. RULE_NO_DESCRIPTION (6.25) - Rule missing description
 * 13. SSH_ON_WAN (6.26) - SSH on WAN interface
 * 14. DEFAULT_ADMIN_PORT (6.27) - Default HTTPS admin port
 * 15. VPN_WEAK_ENCRYPTION (6.28) - VPN weak encryption
 * 16. VPN_PSK_ONLY (6.29) - VPN PSK-only authentication
 * 17. GUEST_NOT_ISOLATED (6.30) - Guest zone routing to LAN
 * 18. DHCP_ON_WAN (6.31) - DHCP server on WAN interface
 * 19. OUTDATED_FIRMWARE (6.32) - Firmware older than 6 months
 * 20. NO_NTP (6.33) - NTP not configured
 */

import { RiskEngine } from '../firewall-config-parser';
import {
    ParsedConfig,
    FirewallRule,
    SecuritySettings,
    AdminSettings,
    InterfaceConfig,
    VPNConfig,
    SystemSettings,
    ConfigRisk,
} from '@/types/firewall';

describe('Comprehensive Risk Detection - All 20 Rules', () => {
    let riskEngine: RiskEngine;

    beforeEach(() => {
        riskEngine = new RiskEngine();
    });

    /**
     * Helper function to create a safe baseline configuration
     * This configuration should have ZERO risks
     */
    function createSafeConfig(): ParsedConfig {
        return {
            rules: [
                {
                    ruleName: 'safe-outbound-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: '8.8.8.8',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                    comment: 'Allow LAN to access Google DNS via HTTPS',
                },
            ],
            natPolicies: [],
            addressObjects: [],
            serviceObjects: [],
            securitySettings: {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            },
            adminSettings: {
                adminUsernames: ['customadmin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 8443,
                sshEnabled: false,
            },
            interfaces: [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: false,
                },
                {
                    interfaceName: 'X1',
                    zone: 'LAN',
                    ipAddress: '192.168.1.1',
                    dhcpServerEnabled: true,
                },
            ],
            vpnConfigs: [
                {
                    policyName: 'Secure-VPN',
                    encryption: 'aes256',
                    authenticationMethod: 'certificate',
                },
            ],
            systemSettings: {
                firmwareVersion: '7.0.1-5050',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: ['0.pool.ntp.org', '1.pool.ntp.org'],
                dnsServers: ['8.8.8.8', '8.8.4.4'],
            },
        };
    }

    describe('Baseline: Safe Configuration', () => {
        it('should detect ZERO risks in a properly configured firewall', () => {
            const config = createSafeConfig();
            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(0);
        });
    });

    describe('Rule 1: OPEN_INBOUND (Requirement 6.14) - CRITICAL', () => {
        it('should detect WAN-to-LAN any rule as CRITICAL risk', () => {
            const config = createSafeConfig();
            config.rules = [
                {
                    ruleName: 'dangerous-wan-to-lan',
                    sourceZone: 'WAN',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.analyzeConfig(config);

            const openInboundRisk = risks.find(r => r.riskType === 'OPEN_INBOUND');
            expect(openInboundRisk).toBeDefined();
            expect(openInboundRisk?.severity).toBe('critical');
            expect(openInboundRisk?.riskCategory).toBe('exposure_risk');
            expect(openInboundRisk?.description).toContain('Unrestricted WAN to LAN');
        });
    });

    describe('Rule 2: ANY_ANY_RULE (Requirement 6.15) - HIGH', () => {
        it('should detect any-to-any rule as HIGH risk', () => {
            const config = createSafeConfig();
            config.rules = [
                {
                    ruleName: 'overly-permissive',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.analyzeConfig(config);

            const anyAnyRisk = risks.find(r => r.riskType === 'ANY_ANY_RULE');
            expect(anyAnyRisk).toBeDefined();
            expect(anyAnyRisk?.severity).toBe('high');
            expect(anyAnyRisk?.riskCategory).toBe('network_misconfiguration');
            expect(anyAnyRisk?.description).toContain('any-to-any');
        });
    });

    describe('Rule 3: WAN_MANAGEMENT_ENABLED (Requirement 6.16) - CRITICAL', () => {
        it('should detect WAN management enabled as CRITICAL risk', () => {
            const config = createSafeConfig();
            config.adminSettings.wanManagementEnabled = true;

            const risks = riskEngine.analyzeConfig(config);

            const wanMgmtRisk = risks.find(r => r.riskType === 'WAN_MANAGEMENT_ENABLED');
            expect(wanMgmtRisk).toBeDefined();
            expect(wanMgmtRisk?.severity).toBe('critical');
            expect(wanMgmtRisk?.riskCategory).toBe('exposure_risk');
            expect(wanMgmtRisk?.description).toContain('WAN management');
            expect(wanMgmtRisk?.description).toContain('admin interface');
        });
    });

    describe('Rule 4: ADMIN_NO_MFA (Requirement 6.17) - HIGH', () => {
        it('should detect MFA disabled as HIGH risk', () => {
            const config = createSafeConfig();
            config.adminSettings.mfaEnabled = false;

            const risks = riskEngine.analyzeConfig(config);

            const mfaRisk = risks.find(r => r.riskType === 'ADMIN_NO_MFA');
            expect(mfaRisk).toBeDefined();
            expect(mfaRisk?.severity).toBe('high');
            expect(mfaRisk?.riskCategory).toBe('best_practice_violation');
            expect(mfaRisk?.description).toContain('Multi-factor authentication');
        });
    });

    describe('Rule 5: DEFAULT_ADMIN_USERNAME (Requirement 6.18) - MEDIUM', () => {
        it('should detect default admin username as MEDIUM risk', () => {
            const config = createSafeConfig();
            config.adminSettings.adminUsernames = ['admin'];

            const risks = riskEngine.analyzeConfig(config);

            const usernameRisk = risks.find(r => r.riskType === 'DEFAULT_ADMIN_USERNAME');
            expect(usernameRisk).toBeDefined();
            expect(usernameRisk?.severity).toBe('medium');
            expect(usernameRisk?.riskCategory).toBe('best_practice_violation');
            expect(usernameRisk?.description).toContain('Default admin username');
        });

        it('should detect "root" as default username', () => {
            const config = createSafeConfig();
            config.adminSettings.adminUsernames = ['root'];

            const risks = riskEngine.analyzeConfig(config);

            const usernameRisk = risks.find(r => r.riskType === 'DEFAULT_ADMIN_USERNAME');
            expect(usernameRisk).toBeDefined();
            expect(usernameRisk?.severity).toBe('medium');
        });

        it('should detect "administrator" as default username', () => {
            const config = createSafeConfig();
            config.adminSettings.adminUsernames = ['administrator'];

            const risks = riskEngine.analyzeConfig(config);

            const usernameRisk = risks.find(r => r.riskType === 'DEFAULT_ADMIN_USERNAME');
            expect(usernameRisk).toBeDefined();
            expect(usernameRisk?.severity).toBe('medium');
        });
    });

    describe('Rule 6: IPS_DISABLED (Requirement 6.19) - CRITICAL', () => {
        it('should detect IPS disabled as CRITICAL risk', () => {
            const config = createSafeConfig();
            config.securitySettings.ipsEnabled = false;

            const risks = riskEngine.analyzeConfig(config);

            const ipsRisk = risks.find(r => r.riskType === 'IPS_DISABLED');
            expect(ipsRisk).toBeDefined();
            expect(ipsRisk?.severity).toBe('critical');
            expect(ipsRisk?.riskCategory).toBe('security_feature_disabled');
            expect(ipsRisk?.description).toContain('Intrusion Prevention System');
        });
    });

    describe('Rule 7: GAV_DISABLED (Requirement 6.20) - CRITICAL', () => {
        it('should detect Gateway Anti-Virus disabled as CRITICAL risk', () => {
            const config = createSafeConfig();
            config.securitySettings.gavEnabled = false;

            const risks = riskEngine.analyzeConfig(config);

            const gavRisk = risks.find(r => r.riskType === 'GAV_DISABLED');
            expect(gavRisk).toBeDefined();
            expect(gavRisk?.severity).toBe('critical');
            expect(gavRisk?.riskCategory).toBe('security_feature_disabled');
            expect(gavRisk?.description).toContain('Gateway Anti-Virus');
        });
    });

    describe('Rule 8: DPI_SSL_DISABLED (Requirement 6.21) - MEDIUM', () => {
        it('should detect DPI-SSL disabled as MEDIUM risk', () => {
            const config = createSafeConfig();
            config.securitySettings.dpiSslEnabled = false;

            const risks = riskEngine.analyzeConfig(config);

            const dpiRisk = risks.find(r => r.riskType === 'DPI_SSL_DISABLED');
            expect(dpiRisk).toBeDefined();
            expect(dpiRisk?.severity).toBe('medium');
            expect(dpiRisk?.riskCategory).toBe('security_feature_disabled');
            expect(dpiRisk?.description).toContain('DPI-SSL');
            expect(dpiRisk?.description).toContain('encrypted traffic');
        });
    });

    describe('Rule 9: BOTNET_FILTER_DISABLED (Requirement 6.22) - HIGH', () => {
        it('should detect Botnet Filter disabled as HIGH risk', () => {
            const config = createSafeConfig();
            config.securitySettings.botnetFilterEnabled = false;

            const risks = riskEngine.analyzeConfig(config);

            const botnetRisk = risks.find(r => r.riskType === 'BOTNET_FILTER_DISABLED');
            expect(botnetRisk).toBeDefined();
            expect(botnetRisk?.severity).toBe('high');
            expect(botnetRisk?.riskCategory).toBe('security_feature_disabled');
            expect(botnetRisk?.description).toContain('Botnet Filter');
        });
    });

    describe('Rule 10: APP_CONTROL_DISABLED (Requirement 6.23) - MEDIUM', () => {
        it('should detect Application Control disabled as MEDIUM risk', () => {
            const config = createSafeConfig();
            config.securitySettings.appControlEnabled = false;

            const risks = riskEngine.analyzeConfig(config);

            const appControlRisk = risks.find(r => r.riskType === 'APP_CONTROL_DISABLED');
            expect(appControlRisk).toBeDefined();
            expect(appControlRisk?.severity).toBe('medium');
            expect(appControlRisk?.riskCategory).toBe('security_feature_disabled');
            expect(appControlRisk?.description).toContain('Application Control');
        });
    });

    describe('Rule 11: CONTENT_FILTER_DISABLED (Requirement 6.24) - MEDIUM', () => {
        it('should detect Content Filtering disabled as MEDIUM risk', () => {
            const config = createSafeConfig();
            config.securitySettings.contentFilterEnabled = false;

            const risks = riskEngine.analyzeConfig(config);

            const contentFilterRisk = risks.find(r => r.riskType === 'CONTENT_FILTER_DISABLED');
            expect(contentFilterRisk).toBeDefined();
            expect(contentFilterRisk?.severity).toBe('medium');
            expect(contentFilterRisk?.riskCategory).toBe('security_feature_disabled');
            expect(contentFilterRisk?.description).toContain('Content Filtering');
        });
    });

    describe('Rule 12: RULE_NO_DESCRIPTION (Requirement 6.25) - LOW', () => {
        it('should detect rule missing description as LOW risk', () => {
            const config = createSafeConfig();
            config.rules = [
                {
                    ruleName: 'undocumented-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: '8.8.8.8',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                    // No comment field
                },
            ];

            const risks = riskEngine.analyzeConfig(config);

            const ruleDescRisk = risks.find(r => r.riskType === 'RULE_NO_DESCRIPTION');
            expect(ruleDescRisk).toBeDefined();
            expect(ruleDescRisk?.severity).toBe('low');
            expect(ruleDescRisk?.riskCategory).toBe('best_practice_violation');
            expect(ruleDescRisk?.description).toContain('missing description');
        });
    });

    describe('Rule 13: SSH_ON_WAN (Requirement 6.26) - HIGH', () => {
        it('should detect SSH on WAN interface as HIGH risk', () => {
            const config = createSafeConfig();
            config.adminSettings.sshEnabled = true;
            // SSH is enabled and we have a WAN interface

            const risks = riskEngine.analyzeConfig(config);

            const sshRisk = risks.find(r => r.riskType === 'SSH_ON_WAN');
            expect(sshRisk).toBeDefined();
            expect(sshRisk?.severity).toBe('high');
            expect(sshRisk?.riskCategory).toBe('exposure_risk');
            expect(sshRisk?.description).toContain('SSH');
            expect(sshRisk?.description).toContain('WAN');
        });
    });

    describe('Rule 14: DEFAULT_ADMIN_PORT (Requirement 6.27) - LOW', () => {
        it('should detect default HTTPS admin port 443 as LOW risk', () => {
            const config = createSafeConfig();
            config.adminSettings.httpsAdminPort = 443;

            const risks = riskEngine.analyzeConfig(config);

            const portRisk = risks.find(r => r.riskType === 'DEFAULT_ADMIN_PORT');
            expect(portRisk).toBeDefined();
            expect(portRisk?.severity).toBe('low');
            expect(portRisk?.riskCategory).toBe('best_practice_violation');
            expect(portRisk?.description).toContain('Default HTTPS admin port');
        });
    });

    describe('Rule 15: VPN_WEAK_ENCRYPTION (Requirement 6.28) - HIGH', () => {
        it('should detect VPN using DES encryption as HIGH risk', () => {
            const config = createSafeConfig();
            config.vpnConfigs = [
                {
                    policyName: 'Weak-VPN',
                    encryption: 'des',
                    authenticationMethod: 'psk',
                },
            ];

            const risks = riskEngine.analyzeConfig(config);

            const vpnEncRisk = risks.find(r => r.riskType === 'VPN_WEAK_ENCRYPTION');
            expect(vpnEncRisk).toBeDefined();
            expect(vpnEncRisk?.severity).toBe('high');
            expect(vpnEncRisk?.riskCategory).toBe('security_feature_disabled');
            expect(vpnEncRisk?.description).toContain('weak encryption');
        });

        it('should detect VPN using 3DES encryption as HIGH risk', () => {
            const config = createSafeConfig();
            config.vpnConfigs = [
                {
                    policyName: 'Weak-VPN-3DES',
                    encryption: '3des',
                    authenticationMethod: 'certificate',
                },
            ];

            const risks = riskEngine.analyzeConfig(config);

            const vpnEncRisk = risks.find(r => r.riskType === 'VPN_WEAK_ENCRYPTION');
            expect(vpnEncRisk).toBeDefined();
            expect(vpnEncRisk?.severity).toBe('high');
        });
    });

    describe('Rule 16: VPN_PSK_ONLY (Requirement 6.29) - MEDIUM', () => {
        it('should detect VPN using PSK-only authentication as MEDIUM risk', () => {
            const config = createSafeConfig();
            config.vpnConfigs = [
                {
                    policyName: 'PSK-VPN',
                    encryption: 'aes256',
                    authenticationMethod: 'psk',
                },
            ];

            const risks = riskEngine.analyzeConfig(config);

            const vpnPskRisk = risks.find(r => r.riskType === 'VPN_PSK_ONLY');
            expect(vpnPskRisk).toBeDefined();
            expect(vpnPskRisk?.severity).toBe('medium');
            expect(vpnPskRisk?.riskCategory).toBe('best_practice_violation');
            expect(vpnPskRisk?.description).toContain('PSK');
        });
    });

    describe('Rule 17: GUEST_NOT_ISOLATED (Requirement 6.30) - HIGH', () => {
        it('should detect Guest zone routing to LAN as HIGH risk', () => {
            const config = createSafeConfig();
            config.rules = [
                {
                    ruleName: 'guest-to-lan',
                    sourceZone: 'GUEST',
                    destinationZone: 'LAN',
                    sourceAddress: '10.0.0.0/24',
                    destinationAddress: '192.168.1.0/24',
                    service: 'HTTP',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.analyzeConfig(config);

            const guestRisk = risks.find(r => r.riskType === 'GUEST_NOT_ISOLATED');
            expect(guestRisk).toBeDefined();
            expect(guestRisk?.severity).toBe('high');
            expect(guestRisk?.riskCategory).toBe('network_misconfiguration');
            expect(guestRisk?.description).toContain('Guest');
            expect(guestRisk?.description).toContain('isolated');
        });
    });

    describe('Rule 18: DHCP_ON_WAN (Requirement 6.31) - CRITICAL', () => {
        it('should detect DHCP server on WAN interface as CRITICAL risk', () => {
            const config = createSafeConfig();
            config.interfaces = [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: true, // DHCP on WAN - CRITICAL!
                },
                {
                    interfaceName: 'X1',
                    zone: 'LAN',
                    ipAddress: '192.168.1.1',
                    dhcpServerEnabled: true,
                },
            ];

            const risks = riskEngine.analyzeConfig(config);

            const dhcpRisk = risks.find(r => r.riskType === 'DHCP_ON_WAN');
            expect(dhcpRisk).toBeDefined();
            expect(dhcpRisk?.severity).toBe('critical');
            expect(dhcpRisk?.riskCategory).toBe('network_misconfiguration');
            expect(dhcpRisk?.description).toContain('DHCP');
            expect(dhcpRisk?.description).toContain('WAN');
        });
    });

    describe('Rule 19: OUTDATED_FIRMWARE (Requirement 6.32) - MEDIUM', () => {
        it('should detect firmware older than 6 months as MEDIUM risk', () => {
            const config = createSafeConfig();
            // Create a date that's 7 months old
            const sevenMonthsAgo = new Date();
            sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
            const oldDate = sevenMonthsAgo.toISOString().split('T')[0];
            config.systemSettings.firmwareVersion = `7.0.0-5000 (${oldDate})`;

            const risks = riskEngine.analyzeConfig(config);

            const firmwareRisk = risks.find(r => r.riskType === 'OUTDATED_FIRMWARE');
            expect(firmwareRisk).toBeDefined();
            expect(firmwareRisk?.severity).toBe('medium');
            expect(firmwareRisk?.riskCategory).toBe('best_practice_violation');
            expect(firmwareRisk?.description).toContain('Firmware');
            expect(firmwareRisk?.description).toContain('outdated');
        });

        it('should NOT detect risk for recent firmware', () => {
            const config = createSafeConfig();
            // Use current date
            const today = new Date().toISOString().split('T')[0];
            config.systemSettings.firmwareVersion = `7.0.1-5050 (${today})`;

            const risks = riskEngine.analyzeConfig(config);

            const firmwareRisk = risks.find(r => r.riskType === 'OUTDATED_FIRMWARE');
            expect(firmwareRisk).toBeUndefined();
        });
    });

    describe('Rule 20: NO_NTP (Requirement 6.33) - LOW', () => {
        it('should detect missing NTP configuration as LOW risk', () => {
            const config = createSafeConfig();
            config.systemSettings.ntpServers = [];

            const risks = riskEngine.analyzeConfig(config);

            const ntpRisk = risks.find(r => r.riskType === 'NO_NTP');
            expect(ntpRisk).toBeDefined();
            expect(ntpRisk?.severity).toBe('low');
            expect(ntpRisk?.riskCategory).toBe('best_practice_violation');
            expect(ntpRisk?.description).toContain('NTP');
            expect(ntpRisk?.description).toContain('time synchronization');
        });
    });

    describe('Integration: Multiple Risks', () => {
        it('should detect all 20 risk types when all are present', () => {
            const config: ParsedConfig = {
                rules: [
                    // Rule 1: OPEN_INBOUND
                    {
                        ruleName: 'wan-to-lan-any',
                        sourceZone: 'WAN',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                        // Rule 12: RULE_NO_DESCRIPTION (no comment)
                    },
                    // Rule 2: ANY_ANY_RULE
                    {
                        ruleName: 'any-to-any',
                        sourceZone: 'DMZ',
                        destinationZone: 'WAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                        // Rule 12: RULE_NO_DESCRIPTION (no comment)
                    },
                    // Rule 17: GUEST_NOT_ISOLATED
                    {
                        ruleName: 'guest-to-lan',
                        sourceZone: 'GUEST',
                        destinationZone: 'LAN',
                        sourceAddress: '10.0.0.0/24',
                        destinationAddress: '192.168.1.0/24',
                        service: 'HTTP',
                        action: 'allow',
                        enabled: true,
                        // Rule 12: RULE_NO_DESCRIPTION (no comment)
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                // Rules 6-11: Security features disabled
                securitySettings: {
                    ipsEnabled: false,           // Rule 6: IPS_DISABLED
                    gavEnabled: false,           // Rule 7: GAV_DISABLED
                    antiSpywareEnabled: false,
                    appControlEnabled: false,    // Rule 10: APP_CONTROL_DISABLED
                    contentFilterEnabled: false, // Rule 11: CONTENT_FILTER_DISABLED
                    botnetFilterEnabled: false,  // Rule 9: BOTNET_FILTER_DISABLED
                    dpiSslEnabled: false,        // Rule 8: DPI_SSL_DISABLED
                    geoIpFilterEnabled: false,
                },
                // Rules 3-5, 13-14: Admin configuration risks
                adminSettings: {
                    adminUsernames: ['admin'],   // Rule 5: DEFAULT_ADMIN_USERNAME
                    mfaEnabled: false,           // Rule 4: ADMIN_NO_MFA
                    wanManagementEnabled: true,  // Rule 3: WAN_MANAGEMENT_ENABLED
                    httpsAdminPort: 443,         // Rule 14: DEFAULT_ADMIN_PORT
                    sshEnabled: true,            // Rule 13: SSH_ON_WAN
                },
                // Rule 18: DHCP_ON_WAN
                interfaces: [
                    {
                        interfaceName: 'X0',
                        zone: 'WAN',
                        ipAddress: '203.0.113.1',
                        dhcpServerEnabled: true, // Rule 18: DHCP_ON_WAN
                    },
                ],
                // Rules 15-16: VPN configuration risks
                vpnConfigs: [
                    {
                        policyName: 'Weak-VPN',
                        encryption: 'des',       // Rule 15: VPN_WEAK_ENCRYPTION
                        authenticationMethod: 'psk', // Rule 16: VPN_PSK_ONLY
                    },
                ],
                // Rules 19-20: System configuration risks
                systemSettings: {
                    firmwareVersion: '6.5.0-1000 (2020-01-01)', // Rule 19: OUTDATED_FIRMWARE
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: [],              // Rule 20: NO_NTP
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            // Verify all 20 risk types are detected
            const riskTypes = new Set(risks.map(r => r.riskType));

            expect(riskTypes.has('OPEN_INBOUND')).toBe(true);           // Rule 1
            expect(riskTypes.has('ANY_ANY_RULE')).toBe(true);           // Rule 2
            expect(riskTypes.has('WAN_MANAGEMENT_ENABLED')).toBe(true); // Rule 3
            expect(riskTypes.has('ADMIN_NO_MFA')).toBe(true);           // Rule 4
            expect(riskTypes.has('DEFAULT_ADMIN_USERNAME')).toBe(true); // Rule 5
            expect(riskTypes.has('IPS_DISABLED')).toBe(true);           // Rule 6
            expect(riskTypes.has('GAV_DISABLED')).toBe(true);           // Rule 7
            expect(riskTypes.has('DPI_SSL_DISABLED')).toBe(true);       // Rule 8
            expect(riskTypes.has('BOTNET_FILTER_DISABLED')).toBe(true); // Rule 9
            expect(riskTypes.has('APP_CONTROL_DISABLED')).toBe(true);   // Rule 10
            expect(riskTypes.has('CONTENT_FILTER_DISABLED')).toBe(true);// Rule 11
            expect(riskTypes.has('RULE_NO_DESCRIPTION')).toBe(true);    // Rule 12
            expect(riskTypes.has('SSH_ON_WAN')).toBe(true);             // Rule 13
            expect(riskTypes.has('DEFAULT_ADMIN_PORT')).toBe(true);     // Rule 14
            expect(riskTypes.has('VPN_WEAK_ENCRYPTION')).toBe(true);    // Rule 15
            expect(riskTypes.has('VPN_PSK_ONLY')).toBe(true);           // Rule 16
            expect(riskTypes.has('GUEST_NOT_ISOLATED')).toBe(true);     // Rule 17
            expect(riskTypes.has('DHCP_ON_WAN')).toBe(true);            // Rule 18
            expect(riskTypes.has('OUTDATED_FIRMWARE')).toBe(true);      // Rule 19
            expect(riskTypes.has('NO_NTP')).toBe(true);                 // Rule 20

            // Verify we have exactly 20 unique risk types
            expect(riskTypes.size).toBe(20);

            // Verify severity levels are correct
            expect(risks.find(r => r.riskType === 'OPEN_INBOUND')?.severity).toBe('critical');
            expect(risks.find(r => r.riskType === 'WAN_MANAGEMENT_ENABLED')?.severity).toBe('critical');
            expect(risks.find(r => r.riskType === 'IPS_DISABLED')?.severity).toBe('critical');
            expect(risks.find(r => r.riskType === 'GAV_DISABLED')?.severity).toBe('critical');
            expect(risks.find(r => r.riskType === 'DHCP_ON_WAN')?.severity).toBe('critical');

            expect(risks.find(r => r.riskType === 'ANY_ANY_RULE')?.severity).toBe('high');
            expect(risks.find(r => r.riskType === 'ADMIN_NO_MFA')?.severity).toBe('high');
            expect(risks.find(r => r.riskType === 'BOTNET_FILTER_DISABLED')?.severity).toBe('high');
            expect(risks.find(r => r.riskType === 'SSH_ON_WAN')?.severity).toBe('high');
            expect(risks.find(r => r.riskType === 'VPN_WEAK_ENCRYPTION')?.severity).toBe('high');
            expect(risks.find(r => r.riskType === 'GUEST_NOT_ISOLATED')?.severity).toBe('high');

            expect(risks.find(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')?.severity).toBe('medium');
            expect(risks.find(r => r.riskType === 'DPI_SSL_DISABLED')?.severity).toBe('medium');
            expect(risks.find(r => r.riskType === 'APP_CONTROL_DISABLED')?.severity).toBe('medium');
            expect(risks.find(r => r.riskType === 'CONTENT_FILTER_DISABLED')?.severity).toBe('medium');
            expect(risks.find(r => r.riskType === 'VPN_PSK_ONLY')?.severity).toBe('medium');
            expect(risks.find(r => r.riskType === 'OUTDATED_FIRMWARE')?.severity).toBe('medium');

            expect(risks.find(r => r.riskType === 'RULE_NO_DESCRIPTION')?.severity).toBe('low');
            expect(risks.find(r => r.riskType === 'DEFAULT_ADMIN_PORT')?.severity).toBe('low');
            expect(risks.find(r => r.riskType === 'NO_NTP')?.severity).toBe('low');
        });
    });
});
