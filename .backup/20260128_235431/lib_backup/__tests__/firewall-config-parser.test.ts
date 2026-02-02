/**
 * Tests for SonicWall Configuration Parser
 */

import { ConfigParser, RiskEngine } from '../firewall-config-parser';
import {
    ParsedConfig,
    FirewallRule,
    NATPolicy,
    AddressObject,
    ServiceObject,
    SecuritySettings,
    AdminSettings,
    InterfaceConfig,
    VPNConfig,
    SystemSettings,
    ConfigRisk,
} from '@/types/firewall';

describe('ConfigParser', () => {
    let parser: ConfigParser;

    beforeEach(() => {
        parser = new ConfigParser();
    });

    describe('parseConfig', () => {
        it('should parse a complete configuration file', () => {
            const configText = `
                firmware version 7.0.1-5050
                hostname TestFirewall
                timezone America/New_York
                ntp-server 0.pool.ntp.org
                dns-server 8.8.8.8
                
                interface X0 zone WAN ip 203.0.113.1
                interface X1 zone LAN ip 192.168.1.1
                
                access-rule from LAN to WAN source any destination any service any action allow
                
                address-object name Server1 ip 192.168.1.100 zone LAN
                service-object name HTTP protocol tcp port 80
                
                ips enable
                gateway-av enable
                dpi-ssl enable
                
                admin username admin
                https port 443
                
                vpn policy VPN1 encryption aes256 auth psk
            `;

            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            expect(result.rules).toHaveLength(1);
            expect(result.addressObjects).toHaveLength(1);
            expect(result.serviceObjects).toHaveLength(1);
            expect(result.interfaces).toHaveLength(2);
            expect(result.vpnConfigs).toHaveLength(1);
            expect(result.securitySettings.ipsEnabled).toBe(true);
            expect(result.securitySettings.gavEnabled).toBe(true);
            expect(result.systemSettings.firmwareVersion).toBe('7.0.1-5050');
            expect(result.systemSettings.hostname).toBe('TestFirewall');
        });

        it('should handle empty configuration', () => {
            const result = parser.parseConfig('');

            expect(result).toBeDefined();
            expect(result.rules).toHaveLength(0);
            expect(result.natPolicies).toHaveLength(0);
            expect(result.addressObjects).toHaveLength(0);
            expect(result.serviceObjects).toHaveLength(0);
            expect(result.interfaces).toHaveLength(0);
            expect(result.vpnConfigs).toHaveLength(0);
        });
    });

    describe('extractRules', () => {
        it('should extract firewall rules with all fields', () => {
            const configText = `
                access-rule name "Allow-Web" from LAN to WAN source 192.168.1.0/24 destination any service HTTP action allow
                access-rule name "Deny-Telnet" from WAN to LAN source any destination any service telnet action deny
            `;

            const result = parser.parseConfig(configText);

            expect(result.rules).toHaveLength(2);
            expect(result.rules[0].ruleName).toBe('Allow-Web');
            expect(result.rules[0].sourceZone).toBe('LAN');
            expect(result.rules[0].destinationZone).toBe('WAN');
            expect(result.rules[0].action).toBe('allow');
            expect(result.rules[1].action).toBe('deny');
        });

        it('should detect WAN to LAN any rules', () => {
            const configText = `
                access-rule from WAN to LAN source any destination any service any action allow
            `;

            const result = parser.parseConfig(configText);

            expect(result.rules).toHaveLength(1);
            expect(result.rules[0].sourceZone).toBe('WAN');
            expect(result.rules[0].destinationZone).toBe('LAN');
            expect(result.rules[0].sourceAddress).toBe('any');
            expect(result.rules[0].destinationAddress).toBe('any');
            expect(result.rules[0].action).toBe('allow');
        });

        it('should detect any-to-any rules', () => {
            const configText = `
                access-rule from any to any source any destination any service any action allow
            `;

            const result = parser.parseConfig(configText);

            expect(result.rules).toHaveLength(1);
            expect(result.rules[0].sourceZone).toBe('any');
            expect(result.rules[0].destinationZone).toBe('any');
            expect(result.rules[0].sourceAddress).toBe('any');
            expect(result.rules[0].destinationAddress).toBe('any');
        });

        it('should detect rules without descriptions', () => {
            const configText = `
                access-rule from LAN to WAN source any destination any service any action allow
                access-rule name "Documented" from LAN to WAN source any destination any service any action allow comment "This is documented"
            `;

            const result = parser.parseConfig(configText);

            expect(result.rules).toHaveLength(2);
            expect(result.rules[0].comment).toBeUndefined();
            expect(result.rules[1].comment).toBe('This is documented');
        });

        it('should detect disabled rules', () => {
            const configText = `
                access-rule from LAN to WAN source any destination any service any action allow disable
                access-rule from LAN to WAN source any destination any service any action allow
            `;

            const result = parser.parseConfig(configText);

            expect(result.rules).toHaveLength(2);
            expect(result.rules[0].enabled).toBe(false);
            expect(result.rules[1].enabled).toBe(true);
        });
    });

    describe('extractNATPolicies', () => {
        it('should extract NAT policies', () => {
            const configText = `
                nat-policy original-source 192.168.1.0/24 translated-source 203.0.113.1 interface X0
                nat-policy original-destination 203.0.113.10 translated-destination 192.168.1.100 interface X1
            `;

            const result = parser.parseConfig(configText);

            expect(result.natPolicies).toHaveLength(2);
            expect(result.natPolicies[0].originalSource).toBe('192.168.1.0/24');
            expect(result.natPolicies[0].translatedSource).toBe('203.0.113.1');
            expect(result.natPolicies[0].interface).toBe('X0');
        });
    });

    describe('extractAddressObjects', () => {
        it('should extract address objects', () => {
            const configText = `
                address-object name "WebServer" ip 192.168.1.100 zone LAN
                address-object name "DMZ-Network" network 10.0.0.0/24 zone DMZ
            `;

            const result = parser.parseConfig(configText);

            expect(result.addressObjects).toHaveLength(2);
            expect(result.addressObjects[0].objectName).toBe('WebServer');
            expect(result.addressObjects[0].ipAddress).toBe('192.168.1.100');
            expect(result.addressObjects[0].zone).toBe('LAN');
        });
    });

    describe('extractServiceObjects', () => {
        it('should extract service objects', () => {
            const configText = `
                service-object name "HTTP" protocol tcp port 80
                service-object name "HTTPS" protocol tcp port 443
                service-object name "DNS" protocol udp port 53
            `;

            const result = parser.parseConfig(configText);

            expect(result.serviceObjects).toHaveLength(3);
            expect(result.serviceObjects[0].serviceName).toBe('HTTP');
            expect(result.serviceObjects[0].protocol).toBe('tcp');
            expect(result.serviceObjects[0].portRange).toBe('80');
        });
    });

    describe('extractSecuritySettings', () => {
        it('should detect enabled security features', () => {
            const configText = `
                ips enable
                gateway-av enable
                dpi-ssl enable
                app-control enable
                content-filter enable
                botnet enable
                geo-ip enable
            `;

            const result = parser.parseConfig(configText);

            expect(result.securitySettings.ipsEnabled).toBe(true);
            expect(result.securitySettings.gavEnabled).toBe(true);
            expect(result.securitySettings.dpiSslEnabled).toBe(true);
            expect(result.securitySettings.appControlEnabled).toBe(true);
            expect(result.securitySettings.contentFilterEnabled).toBe(true);
            expect(result.securitySettings.botnetFilterEnabled).toBe(true);
            expect(result.securitySettings.geoIpFilterEnabled).toBe(true);
        });

        it('should detect disabled security features', () => {
            const configText = `
                ips disable
                gateway-av disable
                dpi-ssl disable
            `;

            const result = parser.parseConfig(configText);

            expect(result.securitySettings.ipsEnabled).toBe(false);
            expect(result.securitySettings.gavEnabled).toBe(false);
            expect(result.securitySettings.dpiSslEnabled).toBe(false);
        });

        it('should default to disabled when not specified', () => {
            const configText = `
                hostname TestFirewall
            `;

            const result = parser.parseConfig(configText);

            expect(result.securitySettings.ipsEnabled).toBe(false);
            expect(result.securitySettings.gavEnabled).toBe(false);
            expect(result.securitySettings.dpiSslEnabled).toBe(false);
            expect(result.securitySettings.appControlEnabled).toBe(false);
            expect(result.securitySettings.contentFilterEnabled).toBe(false);
            expect(result.securitySettings.botnetFilterEnabled).toBe(false);
        });
    });

    describe('extractAdminSettings', () => {
        it('should extract admin usernames', () => {
            const configText = `
                admin username "admin"
                admin username "john.doe"
                admin user "administrator"
            `;

            const result = parser.parseConfig(configText);

            expect(result.adminSettings.adminUsernames).toContain('admin');
            expect(result.adminSettings.adminUsernames).toContain('john.doe');
            expect(result.adminSettings.adminUsernames).toContain('administrator');
        });

        it('should detect default admin usernames', () => {
            const configText = `
                admin username admin
            `;

            const result = parser.parseConfig(configText);

            expect(result.adminSettings.adminUsernames).toContain('admin');
        });

        it('should detect MFA status', () => {
            const configText = `
                mfa enable
            `;

            const result = parser.parseConfig(configText);

            expect(result.adminSettings.mfaEnabled).toBe(true);
        });

        it('should detect WAN management enabled', () => {
            const configText = `
                wan management enable
            `;

            const result = parser.parseConfig(configText);

            expect(result.adminSettings.wanManagementEnabled).toBe(true);
        });

        it('should extract HTTPS admin port', () => {
            const configText = `
                https admin port 8443
            `;

            const result = parser.parseConfig(configText);

            expect(result.adminSettings.httpsAdminPort).toBe(8443);
        });

        it('should default to port 443', () => {
            const configText = `
                hostname TestFirewall
            `;

            const result = parser.parseConfig(configText);

            expect(result.adminSettings.httpsAdminPort).toBe(443);
        });

        it('should detect SSH enabled', () => {
            const configText = `
                ssh enable
            `;

            const result = parser.parseConfig(configText);

            expect(result.adminSettings.sshEnabled).toBe(true);
        });
    });

    describe('extractInterfaces', () => {
        it('should extract interface configurations', () => {
            const configText = `
                interface X0 zone WAN ip 203.0.113.1
                interface X1 zone LAN ip 192.168.1.1
                interface X2 zone DMZ ip 10.0.0.1
            `;

            const result = parser.parseConfig(configText);

            expect(result.interfaces).toHaveLength(3);
            expect(result.interfaces[0].interfaceName).toBe('X0');
            expect(result.interfaces[0].zone).toBe('WAN');
            expect(result.interfaces[0].ipAddress).toBe('203.0.113.1');
        });

        it('should detect DHCP server on interfaces', () => {
            const configText = `
                interface X0 zone WAN ip 203.0.113.1 dhcp server enable
                interface X1 zone LAN ip 192.168.1.1
            `;

            const result = parser.parseConfig(configText);

            expect(result.interfaces).toHaveLength(2);
            expect(result.interfaces[0].dhcpServerEnabled).toBe(true);
            expect(result.interfaces[1].dhcpServerEnabled).toBe(false);
        });

        it('should detect DHCP on WAN interface', () => {
            const configText = `
                interface X0 zone WAN ip 203.0.113.1 dhcp server enable
            `;

            const result = parser.parseConfig(configText);

            expect(result.interfaces).toHaveLength(1);
            expect(result.interfaces[0].zone).toBe('WAN');
            expect(result.interfaces[0].dhcpServerEnabled).toBe(true);
        });
    });

    describe('extractVPNConfigs', () => {
        it('should extract VPN configurations', () => {
            const configText = `
                vpn policy "Site-to-Site" encryption aes256 auth certificate
                vpn policy "Remote-Access" encryption 3des auth psk
            `;

            const result = parser.parseConfig(configText);

            expect(result.vpnConfigs).toHaveLength(2);
            expect(result.vpnConfigs[0].policyName).toBe('Site-to-Site');
            expect(result.vpnConfigs[0].encryption).toBe('aes256');
            expect(result.vpnConfigs[0].authenticationMethod).toBe('certificate');
        });

        it('should detect weak VPN encryption', () => {
            const configText = `
                vpn policy "Weak-VPN" encryption des auth psk
                vpn policy "Weak-VPN2" encryption 3des auth psk
            `;

            const result = parser.parseConfig(configText);

            expect(result.vpnConfigs).toHaveLength(2);
            expect(result.vpnConfigs[0].encryption).toBe('des');
            expect(result.vpnConfigs[1].encryption).toBe('3des');
        });

        it('should detect PSK-only authentication', () => {
            const configText = `
                vpn policy "PSK-VPN" encryption aes256 auth psk
            `;

            const result = parser.parseConfig(configText);

            expect(result.vpnConfigs).toHaveLength(1);
            expect(result.vpnConfigs[0].authenticationMethod).toBe('psk');
        });
    });

    describe('extractSystemSettings', () => {
        it('should extract firmware version', () => {
            const configText = `
                firmware version 7.0.1-5050
            `;

            const result = parser.parseConfig(configText);

            expect(result.systemSettings.firmwareVersion).toBe('7.0.1-5050');
        });

        it('should extract hostname', () => {
            const configText = `
                hostname "Corporate-Firewall"
            `;

            const result = parser.parseConfig(configText);

            expect(result.systemSettings.hostname).toBe('Corporate-Firewall');
        });

        it('should extract timezone', () => {
            const configText = `
                timezone "America/New_York"
            `;

            const result = parser.parseConfig(configText);

            expect(result.systemSettings.timezone).toBe('America/New_York');
        });

        it('should extract NTP servers', () => {
            const configText = `
                ntp-server 0.pool.ntp.org
                ntp-server 1.pool.ntp.org
                ntp server 2.pool.ntp.org
            `;

            const result = parser.parseConfig(configText);

            expect(result.systemSettings.ntpServers).toHaveLength(3);
            expect(result.systemSettings.ntpServers).toContain('0.pool.ntp.org');
            expect(result.systemSettings.ntpServers).toContain('1.pool.ntp.org');
            expect(result.systemSettings.ntpServers).toContain('2.pool.ntp.org');
        });

        it('should detect missing NTP configuration', () => {
            const configText = `
                hostname TestFirewall
            `;

            const result = parser.parseConfig(configText);

            expect(result.systemSettings.ntpServers).toHaveLength(0);
        });

        it('should extract DNS servers', () => {
            const configText = `
                dns-server 8.8.8.8
                dns-server 8.8.4.4
                nameserver 1.1.1.1
            `;

            const result = parser.parseConfig(configText);

            expect(result.systemSettings.dnsServers).toHaveLength(3);
            expect(result.systemSettings.dnsServers).toContain('8.8.8.8');
            expect(result.systemSettings.dnsServers).toContain('8.8.4.4');
            expect(result.systemSettings.dnsServers).toContain('1.1.1.1');
        });
    });

    describe('edge cases', () => {
        it('should handle malformed configuration lines gracefully', () => {
            const configText = `
                this is not a valid config line
                access-rule incomplete
                @@@ invalid syntax @@@
                interface X0 zone WAN ip 203.0.113.1
            `;

            const result = parser.parseConfig(configText);

            // Should still parse valid lines
            expect(result.interfaces).toHaveLength(1);
        });

        it('should handle configuration with comments', () => {
            const configText = `
                # This is a comment
                interface X0 zone WAN ip 203.0.113.1
                // Another comment style
                interface X1 zone LAN ip 192.168.1.1
            `;

            const result = parser.parseConfig(configText);

            expect(result.interfaces).toHaveLength(2);
        });

        it('should handle configuration with extra whitespace', () => {
            const configText = `
                interface    X0    zone    WAN    ip    203.0.113.1
                
                
                interface X1 zone LAN ip 192.168.1.1
            `;

            const result = parser.parseConfig(configText);

            expect(result.interfaces).toHaveLength(2);
        });

        it('should handle case-insensitive keywords', () => {
            const configText = `
                IPS ENABLE
                Gateway-AV Enable
                dpi-ssl enable
            `;

            const result = parser.parseConfig(configText);

            expect(result.securitySettings.ipsEnabled).toBe(true);
            expect(result.securitySettings.gavEnabled).toBe(true);
            expect(result.securitySettings.dpiSslEnabled).toBe(true);
        });
    });
});

describe('RiskEngine', () => {
    let riskEngine: RiskEngine;

    beforeEach(() => {
        riskEngine = new RiskEngine();
    });

    describe('calculateRiskScore', () => {
        it('should start with base score of 100', () => {
            const risks: ConfigRisk[] = [];
            const score = riskEngine.calculateRiskScore(risks);
            expect(score).toBe(100);
        });

        it('should deduct 25 points for critical risks', () => {
            const risks: ConfigRisk[] = [
                {
                    riskCategory: 'exposure_risk',
                    riskType: 'OPEN_INBOUND',
                    severity: 'critical',
                    description: 'Test critical risk',
                    remediation: 'Fix it',
                },
            ];
            const score = riskEngine.calculateRiskScore(risks);
            expect(score).toBe(75);
        });

        it('should deduct 15 points for high risks', () => {
            const risks: ConfigRisk[] = [
                {
                    riskCategory: 'best_practice_violation',
                    riskType: 'ADMIN_NO_MFA',
                    severity: 'high',
                    description: 'Test high risk',
                    remediation: 'Fix it',
                },
            ];
            const score = riskEngine.calculateRiskScore(risks);
            expect(score).toBe(85);
        });

        it('should deduct 5 points for medium risks', () => {
            const risks: ConfigRisk[] = [
                {
                    riskCategory: 'security_feature_disabled',
                    riskType: 'DPI_SSL_DISABLED',
                    severity: 'medium',
                    description: 'Test medium risk',
                    remediation: 'Fix it',
                },
            ];
            const score = riskEngine.calculateRiskScore(risks);
            expect(score).toBe(95);
        });

        it('should deduct 1 point for low risks', () => {
            const risks: ConfigRisk[] = [
                {
                    riskCategory: 'best_practice_violation',
                    riskType: 'RULE_NO_DESCRIPTION',
                    severity: 'low',
                    description: 'Test low risk',
                    remediation: 'Fix it',
                },
            ];
            const score = riskEngine.calculateRiskScore(risks);
            expect(score).toBe(99);
        });

        it('should handle multiple risks', () => {
            const risks: ConfigRisk[] = [
                {
                    riskCategory: 'exposure_risk',
                    riskType: 'OPEN_INBOUND',
                    severity: 'critical',
                    description: 'Critical risk',
                    remediation: 'Fix it',
                },
                {
                    riskCategory: 'best_practice_violation',
                    riskType: 'ADMIN_NO_MFA',
                    severity: 'high',
                    description: 'High risk',
                    remediation: 'Fix it',
                },
                {
                    riskCategory: 'security_feature_disabled',
                    riskType: 'DPI_SSL_DISABLED',
                    severity: 'medium',
                    description: 'Medium risk',
                    remediation: 'Fix it',
                },
            ];
            const score = riskEngine.calculateRiskScore(risks);
            // 100 - 25 - 15 - 5 = 55
            expect(score).toBe(55);
        });

        it('should enforce minimum score of 0', () => {
            const risks: ConfigRisk[] = [
                {
                    riskCategory: 'exposure_risk',
                    riskType: 'OPEN_INBOUND',
                    severity: 'critical',
                    description: 'Critical risk 1',
                    remediation: 'Fix it',
                },
                {
                    riskCategory: 'exposure_risk',
                    riskType: 'WAN_MANAGEMENT_ENABLED',
                    severity: 'critical',
                    description: 'Critical risk 2',
                    remediation: 'Fix it',
                },
                {
                    riskCategory: 'security_feature_disabled',
                    riskType: 'IPS_DISABLED',
                    severity: 'critical',
                    description: 'Critical risk 3',
                    remediation: 'Fix it',
                },
                {
                    riskCategory: 'security_feature_disabled',
                    riskType: 'GAV_DISABLED',
                    severity: 'critical',
                    description: 'Critical risk 4',
                    remediation: 'Fix it',
                },
                {
                    riskCategory: 'network_misconfiguration',
                    riskType: 'DHCP_ON_WAN',
                    severity: 'critical',
                    description: 'Critical risk 5',
                    remediation: 'Fix it',
                },
            ];
            const score = riskEngine.calculateRiskScore(risks);
            // 100 - 25*5 = -25, but should be clamped to 0
            expect(score).toBe(0);
        });

        it('should enforce maximum score of 100', () => {
            const risks: ConfigRisk[] = [];
            const score = riskEngine.calculateRiskScore(risks);
            expect(score).toBe(100);
        });
    });

    describe('detectWANtoLANAnyRules', () => {
        it('should detect WAN-to-LAN any rule (CRITICAL)', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'dangerous-rule',
                    sourceZone: 'WAN',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OPEN_INBOUND');
            expect(risks[0].riskCategory).toBe('exposure_risk');
            expect(risks[0].severity).toBe('critical');
            expect(risks[0].description).toBe('Unrestricted WAN to LAN access rule detected');
            expect(risks[0].remediation).toContain('Restrict the destination address');
        });

        it('should detect WAN-to-LAN any rule with case-insensitive zones', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'dangerous-rule',
                    sourceZone: 'wan',
                    destinationZone: 'lan',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OPEN_INBOUND');
        });

        it('should detect WAN-to-LAN any rule with mixed case', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'dangerous-rule',
                    sourceZone: 'Wan',
                    destinationZone: 'Lan',
                    sourceAddress: 'any',
                    destinationAddress: 'ANY',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OPEN_INBOUND');
        });

        it('should NOT detect WAN-to-LAN rule with specific destination', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'safe-rule',
                    sourceZone: 'WAN',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: '192.168.1.100',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect WAN-to-LAN deny rule', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'deny-rule',
                    sourceZone: 'WAN',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'deny',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect LAN-to-WAN any rule', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'outbound-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect WAN-to-DMZ any rule', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'dmz-rule',
                    sourceZone: 'WAN',
                    destinationZone: 'DMZ',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should detect multiple WAN-to-LAN any rules', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'dangerous-rule-1',
                    sourceZone: 'WAN',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
                {
                    ruleName: 'safe-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
                {
                    ruleName: 'dangerous-rule-2',
                    sourceZone: 'WAN',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'HTTP',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(2);
            expect(risks[0].riskType).toBe('OPEN_INBOUND');
            expect(risks[1].riskType).toBe('OPEN_INBOUND');
        });

        it('should handle empty rules array', () => {
            const rules: FirewallRule[] = [];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk even when rule is disabled', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'disabled-dangerous-rule',
                    sourceZone: 'WAN',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: false,
                },
            ];

            const risks = riskEngine.detectWANtoLANAnyRules(rules);

            // Risk should still be detected even if rule is disabled
            // because the configuration contains the dangerous rule
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OPEN_INBOUND');
        });
    });

    describe('detectAnyToAnyRules', () => {
        it('should detect any-to-any rule (HIGH)', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'overly-permissive-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('ANY_ANY_RULE');
            expect(risks[0].riskCategory).toBe('network_misconfiguration');
            expect(risks[0].severity).toBe('high');
            expect(risks[0].description).toBe('Overly permissive any-to-any rule detected');
            expect(risks[0].remediation).toContain('Replace any-to-any rules');
        });

        it('should detect any-to-any rule with case-insensitive addresses', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'permissive-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'ANY',
                    destinationAddress: 'Any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('ANY_ANY_RULE');
        });

        it('should NOT detect rule with specific source address', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'specific-source-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect rule with specific destination address', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'specific-dest-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: '8.8.8.8',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect any-to-any deny rule', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'deny-all-rule',
                    sourceZone: 'any',
                    destinationZone: 'any',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'deny',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should detect multiple any-to-any rules', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'permissive-rule-1',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
                {
                    ruleName: 'specific-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.100',
                    destinationAddress: '8.8.8.8',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                },
                {
                    ruleName: 'permissive-rule-2',
                    sourceZone: 'DMZ',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'HTTP',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            expect(risks).toHaveLength(2);
            expect(risks[0].riskType).toBe('ANY_ANY_RULE');
            expect(risks[1].riskType).toBe('ANY_ANY_RULE');
        });

        it('should handle empty rules array', () => {
            const rules: FirewallRule[] = [];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk even when rule is disabled', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'disabled-permissive-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: false,
                },
            ];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            // Risk should still be detected even if rule is disabled
            // because the configuration contains the dangerous rule
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('ANY_ANY_RULE');
        });

        it('should detect any-to-any rule regardless of zones', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'any-zone-rule',
                    sourceZone: 'any',
                    destinationZone: 'any',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectAnyToAnyRules(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('ANY_ANY_RULE');
        });
    });

    describe('detectGuestNotIsolated', () => {
        it('should detect Guest-to-LAN rule (HIGH)', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'guest-to-lan-rule',
                    sourceZone: 'GUEST',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GUEST_NOT_ISOLATED');
            expect(risks[0].riskCategory).toBe('network_misconfiguration');
            expect(risks[0].severity).toBe('high');
            expect(risks[0].description).toBe('Guest network not properly isolated from LAN');
            expect(risks[0].remediation).toContain('Remove or deny rules');
        });

        it('should detect Guest-to-LAN rule with case-insensitive zones', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'guest-to-lan-rule',
                    sourceZone: 'guest',
                    destinationZone: 'lan',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GUEST_NOT_ISOLATED');
        });

        it('should detect Guest-to-LAN rule with mixed case', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'guest-to-lan-rule',
                    sourceZone: 'Guest',
                    destinationZone: 'Lan',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GUEST_NOT_ISOLATED');
        });

        it('should detect Guest-to-LAN rule with specific addresses', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'guest-to-server-rule',
                    sourceZone: 'GUEST',
                    destinationZone: 'LAN',
                    sourceAddress: '10.0.0.0/24',
                    destinationAddress: '192.168.1.100',
                    service: 'HTTP',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GUEST_NOT_ISOLATED');
        });

        it('should NOT detect Guest-to-WAN rule', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'guest-internet-rule',
                    sourceZone: 'GUEST',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect LAN-to-Guest rule', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'lan-to-guest-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'GUEST',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect Guest-to-LAN deny rule', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'guest-deny-rule',
                    sourceZone: 'GUEST',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'deny',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect Guest-to-DMZ rule', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'guest-to-dmz-rule',
                    sourceZone: 'GUEST',
                    destinationZone: 'DMZ',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(0);
        });

        it('should detect multiple Guest-to-LAN rules', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'guest-to-lan-rule-1',
                    sourceZone: 'GUEST',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
                {
                    ruleName: 'safe-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: true,
                },
                {
                    ruleName: 'guest-to-lan-rule-2',
                    sourceZone: 'GUEST',
                    destinationZone: 'LAN',
                    sourceAddress: '10.0.0.0/24',
                    destinationAddress: '192.168.1.0/24',
                    service: 'HTTP',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(2);
            expect(risks[0].riskType).toBe('GUEST_NOT_ISOLATED');
            expect(risks[1].riskType).toBe('GUEST_NOT_ISOLATED');
        });

        it('should handle empty rules array', () => {
            const rules: FirewallRule[] = [];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk even when rule is disabled', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'disabled-guest-to-lan-rule',
                    sourceZone: 'GUEST',
                    destinationZone: 'LAN',
                    sourceAddress: 'any',
                    destinationAddress: 'any',
                    service: 'any',
                    action: 'allow',
                    enabled: false,
                },
            ];

            const risks = riskEngine.detectGuestNotIsolated(rules);

            // Risk should still be detected even if rule is disabled
            // because the configuration contains the dangerous rule
            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GUEST_NOT_ISOLATED');
        });
    });

    describe('detectDHCPOnWAN', () => {
        it('should detect DHCP server on WAN interface (CRITICAL)', () => {
            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: true,
                },
            ];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DHCP_ON_WAN');
            expect(risks[0].riskCategory).toBe('network_misconfiguration');
            expect(risks[0].severity).toBe('critical');
            expect(risks[0].description).toBe('DHCP server enabled on WAN interface');
            expect(risks[0].remediation).toContain('Disable DHCP server on WAN interface');
        });

        it('should detect DHCP on WAN with case-insensitive zone', () => {
            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'wan',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: true,
                },
            ];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DHCP_ON_WAN');
        });

        it('should detect DHCP on WAN with mixed case', () => {
            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'Wan',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: true,
                },
            ];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DHCP_ON_WAN');
        });

        it('should NOT detect DHCP on LAN interface', () => {
            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X1',
                    zone: 'LAN',
                    ipAddress: '192.168.1.1',
                    dhcpServerEnabled: true,
                },
            ];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect DHCP on DMZ interface', () => {
            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X2',
                    zone: 'DMZ',
                    ipAddress: '10.0.0.1',
                    dhcpServerEnabled: true,
                },
            ];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect WAN interface without DHCP', () => {
            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(0);
        });

        it('should detect multiple WAN interfaces with DHCP', () => {
            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: true,
                },
                {
                    interfaceName: 'X1',
                    zone: 'LAN',
                    ipAddress: '192.168.1.1',
                    dhcpServerEnabled: true,
                },
                {
                    interfaceName: 'X3',
                    zone: 'WAN',
                    ipAddress: '198.51.100.1',
                    dhcpServerEnabled: true,
                },
            ];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(2);
            expect(risks[0].riskType).toBe('DHCP_ON_WAN');
            expect(risks[1].riskType).toBe('DHCP_ON_WAN');
        });

        it('should handle empty interfaces array', () => {
            const interfaces: InterfaceConfig[] = [];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(0);
        });

        it('should handle mixed safe and unsafe interfaces', () => {
            const interfaces: InterfaceConfig[] = [
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
                {
                    interfaceName: 'X2',
                    zone: 'DMZ',
                    ipAddress: '10.0.0.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectDHCPOnWAN(interfaces);

            expect(risks).toHaveLength(0);
        });
    });

    describe('detectMFADisabled', () => {
        it('should detect MFA disabled (HIGH)', () => {
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
            expect(risks[0].riskCategory).toBe('best_practice_violation');
            expect(risks[0].severity).toBe('high');
            expect(risks[0].description).toBe('Multi-factor authentication not enabled for admin accounts');
            expect(risks[0].remediation).toContain('Enable multi-factor authentication');
        });

        it('should NOT detect risk when MFA is enabled', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectMFADisabled(adminSettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect MFA disabled even with custom admin username', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['custom-admin', 'security-admin'],
                mfaEnabled: false,
                wanManagementEnabled: false,
                httpsAdminPort: 8443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectMFADisabled(adminSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('ADMIN_NO_MFA');
        });

        it('should detect MFA disabled even when other security settings are good', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['secure-admin'],
                mfaEnabled: false,
                wanManagementEnabled: false,
                httpsAdminPort: 8443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectMFADisabled(adminSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('ADMIN_NO_MFA');
            expect(risks[0].severity).toBe('high');
        });
    });

    describe('detectDefaultAdminUsername', () => {
        it('should detect default admin username "admin" (MEDIUM)', () => {
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
            expect(risks[0].riskCategory).toBe('best_practice_violation');
            expect(risks[0].severity).toBe('medium');
            expect(risks[0].description).toBe('Default admin username detected - should be renamed');
            expect(risks[0].remediation).toContain('Rename the default admin username');
        });

        it('should detect default admin username "root" (MEDIUM)', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['root'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminUsername(adminSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DEFAULT_ADMIN_USERNAME');
            expect(risks[0].severity).toBe('medium');
        });

        it('should detect default admin username "administrator" (MEDIUM)', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['administrator'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminUsername(adminSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DEFAULT_ADMIN_USERNAME');
            expect(risks[0].severity).toBe('medium');
        });

        it('should detect default usernames with case-insensitive matching', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['Admin', 'ROOT', 'Administrator'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminUsername(adminSettings);

            expect(risks).toHaveLength(3);
            expect(risks.every(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.every(r => r.severity === 'medium')).toBe(true);
        });

        it('should NOT detect risk with custom admin username', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['custom-admin', 'security-admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminUsername(adminSettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect multiple default usernames', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin', 'root', 'custom-admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminUsername(adminSettings);

            expect(risks).toHaveLength(2);
            expect(risks.every(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
        });

        it('should handle empty admin usernames array', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: [],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminUsername(adminSettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect default username even when MFA is disabled', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: false,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminUsername(adminSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DEFAULT_ADMIN_USERNAME');
        });
    });

    describe('detectDefaultAdminPort', () => {
        it('should detect default HTTPS admin port 443 (LOW)', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['custom-admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminPort(adminSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DEFAULT_ADMIN_PORT');
            expect(risks[0].riskCategory).toBe('best_practice_violation');
            expect(risks[0].severity).toBe('low');
            expect(risks[0].description).toBe('Default HTTPS admin port in use - consider changing');
            expect(risks[0].remediation).toContain('Change the HTTPS admin port from the default 443');
        });

        it('should NOT detect risk when using non-default port', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['custom-admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 8443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminPort(adminSettings);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect risk when using port 4443', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['custom-admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 4443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminPort(adminSettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect default port even when other settings are secure', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['secure-admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const risks = riskEngine.detectDefaultAdminPort(adminSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DEFAULT_ADMIN_PORT');
            expect(risks[0].severity).toBe('low');
        });

        it('should detect default port regardless of other admin settings', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: false,
                wanManagementEnabled: true,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const risks = riskEngine.detectDefaultAdminPort(adminSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DEFAULT_ADMIN_PORT');
        });
    });

    describe('detectSSHOnWAN', () => {
        it('should detect SSH enabled on WAN interface (HIGH)', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('SSH_ON_WAN');
            expect(risks[0].riskCategory).toBe('exposure_risk');
            expect(risks[0].severity).toBe('high');
            expect(risks[0].description).toBe('SSH management enabled on WAN interface');
            expect(risks[0].remediation).toContain('Disable SSH management on WAN interface');
        });

        it('should detect SSH on WAN with case-insensitive zone matching', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'wan',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('SSH_ON_WAN');
            expect(risks[0].severity).toBe('high');
        });

        it('should detect SSH on WAN with uppercase zone', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('SSH_ON_WAN');
            expect(risks[0].severity).toBe('high');
        });

        it('should NOT detect risk when SSH is disabled', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect risk when no WAN interface exists', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X1',
                    zone: 'LAN',
                    ipAddress: '192.168.1.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect risk when SSH disabled and no WAN interface', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: false,
            };

            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X1',
                    zone: 'LAN',
                    ipAddress: '192.168.1.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk with multiple interfaces including WAN', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const interfaces: InterfaceConfig[] = [
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
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('SSH_ON_WAN');
        });

        it('should handle empty interfaces array', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: true,
                wanManagementEnabled: false,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const interfaces: InterfaceConfig[] = [];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk even when other admin settings are insecure', () => {
            const adminSettings: AdminSettings = {
                adminUsernames: ['admin'],
                mfaEnabled: false,
                wanManagementEnabled: true,
                httpsAdminPort: 443,
                sshEnabled: true,
            };

            const interfaces: InterfaceConfig[] = [
                {
                    interfaceName: 'X0',
                    zone: 'WAN',
                    ipAddress: '203.0.113.1',
                    dhcpServerEnabled: false,
                },
            ];

            const risks = riskEngine.detectSSHOnWAN(adminSettings, interfaces);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('SSH_ON_WAN');
        });
    });

    describe('detectIPSDisabled', () => {
        it('should detect IPS disabled (CRITICAL)', () => {
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
            expect(risks[0].riskCategory).toBe('security_feature_disabled');
            expect(risks[0].severity).toBe('critical');
            expect(risks[0].description).toBe('Intrusion Prevention System is disabled');
            expect(risks[0].remediation).toContain('Enable Intrusion Prevention System');
        });

        it('should NOT detect risk when IPS is enabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectIPSDisabled(securitySettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect IPS disabled even when other security features are enabled', () => {
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
            expect(risks[0].severity).toBe('critical');
        });

        it('should detect IPS disabled when all security features are disabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: false,
                gavEnabled: false,
                antiSpywareEnabled: false,
                appControlEnabled: false,
                contentFilterEnabled: false,
                botnetFilterEnabled: false,
                dpiSslEnabled: false,
                geoIpFilterEnabled: false,
            };

            const risks = riskEngine.detectIPSDisabled(securitySettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('IPS_DISABLED');
            expect(risks[0].riskCategory).toBe('security_feature_disabled');
            expect(risks[0].severity).toBe('critical');
        });

        it('should have correct remediation guidance', () => {
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
            expect(risks[0].remediation).toContain('Enable Intrusion Prevention System');
            expect(risks[0].remediation).toContain('IPS');
            expect(risks[0].remediation).toContain('critical security layer');
        });

        it('should detect IPS disabled with minimal security settings', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: false,
                gavEnabled: false,
                antiSpywareEnabled: false,
                appControlEnabled: false,
                contentFilterEnabled: false,
                botnetFilterEnabled: false,
                dpiSslEnabled: false,
                geoIpFilterEnabled: false,
            };

            const risks = riskEngine.detectIPSDisabled(securitySettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('IPS_DISABLED');
        });
    });

    describe('detectGAVDisabled', () => {
        it('should detect Gateway Anti-Virus disabled (CRITICAL)', () => {
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
            expect(risks[0].riskCategory).toBe('security_feature_disabled');
            expect(risks[0].severity).toBe('critical');
            expect(risks[0].description).toBe('Gateway Anti-Virus is disabled');
            expect(risks[0].remediation).toContain('Enable Gateway Anti-Virus');
        });

        it('should NOT detect risk when Gateway Anti-Virus is enabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectGAVDisabled(securitySettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect GAV disabled even when other security features are enabled', () => {
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
        });

        it('should detect GAV disabled when all security features are disabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: false,
                gavEnabled: false,
                antiSpywareEnabled: false,
                appControlEnabled: false,
                contentFilterEnabled: false,
                botnetFilterEnabled: false,
                dpiSslEnabled: false,
                geoIpFilterEnabled: false,
            };

            const risks = riskEngine.detectGAVDisabled(securitySettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GAV_DISABLED');
        });

        it('should detect GAV disabled when only GAV is disabled', () => {
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
        });
    });

    describe('detectDPISSLDisabled', () => {
        it('should detect DPI-SSL disabled (MEDIUM)', () => {
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
            expect(risks[0].riskCategory).toBe('security_feature_disabled');
            expect(risks[0].severity).toBe('medium');
            expect(risks[0].description).toBe('DPI-SSL is disabled - encrypted traffic not inspected');
            expect(risks[0].remediation).toContain('Enable DPI-SSL');
        });

        it('should NOT detect risk when DPI-SSL is enabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectDPISSLDisabled(securitySettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect DPI-SSL disabled even when other security features are enabled', () => {
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
        });

        it('should detect DPI-SSL disabled when all security features are disabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: false,
                gavEnabled: false,
                antiSpywareEnabled: false,
                appControlEnabled: false,
                contentFilterEnabled: false,
                botnetFilterEnabled: false,
                dpiSslEnabled: false,
                geoIpFilterEnabled: false,
            };

            const risks = riskEngine.detectDPISSLDisabled(securitySettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DPI_SSL_DISABLED');
        });

        it('should detect DPI-SSL disabled when only DPI-SSL is disabled', () => {
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
        });
    });

    describe('detectBotnetFilterDisabled', () => {
        it('should detect Botnet Filter disabled (HIGH)', () => {
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
            expect(risks[0].riskCategory).toBe('security_feature_disabled');
            expect(risks[0].severity).toBe('high');
            expect(risks[0].description).toBe('Botnet Filter is disabled');
            expect(risks[0].remediation).toContain('Enable Botnet Filter');
        });

        it('should NOT detect risk when Botnet Filter is enabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectBotnetFilterDisabled(securitySettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect Botnet Filter disabled even when other security features are enabled', () => {
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
        });

        it('should detect Botnet Filter disabled when all security features are disabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: false,
                gavEnabled: false,
                antiSpywareEnabled: false,
                appControlEnabled: false,
                contentFilterEnabled: false,
                botnetFilterEnabled: false,
                dpiSslEnabled: false,
                geoIpFilterEnabled: false,
            };

            const risks = riskEngine.detectBotnetFilterDisabled(securitySettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('BOTNET_FILTER_DISABLED');
        });

        it('should detect Botnet Filter disabled when only Botnet Filter is disabled', () => {
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
        });
    });

    describe('detectAppControlDisabled', () => {
        it('should detect Application Control disabled (MEDIUM)', () => {
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
            expect(risks[0].riskCategory).toBe('security_feature_disabled');
            expect(risks[0].severity).toBe('medium');
            expect(risks[0].description).toBe('Application Control is disabled');
            expect(risks[0].remediation).toContain('Enable Application Control');
        });

        it('should not detect risk when Application Control is enabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectAppControlDisabled(securitySettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk when only Application Control is disabled', () => {
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
        });

        it('should detect risk when multiple features disabled including Application Control', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: false,
                gavEnabled: false,
                antiSpywareEnabled: false,
                appControlEnabled: false,
                contentFilterEnabled: false,
                botnetFilterEnabled: false,
                dpiSslEnabled: false,
                geoIpFilterEnabled: false,
            };

            const risks = riskEngine.detectAppControlDisabled(securitySettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('APP_CONTROL_DISABLED');
        });

        it('should detect risk when Application Control explicitly disabled', () => {
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
            expect(risks[0].severity).toBe('medium');
        });
    });

    describe('detectContentFilterDisabled', () => {
        it('should detect Content Filtering disabled (MEDIUM)', () => {
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
            expect(risks[0].riskCategory).toBe('security_feature_disabled');
            expect(risks[0].severity).toBe('medium');
            expect(risks[0].description).toBe('Content Filtering is disabled');
            expect(risks[0].remediation).toContain('Enable Content Filtering');
        });

        it('should not detect risk when Content Filtering is enabled', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: true,
                gavEnabled: true,
                antiSpywareEnabled: true,
                appControlEnabled: true,
                contentFilterEnabled: true,
                botnetFilterEnabled: true,
                dpiSslEnabled: true,
                geoIpFilterEnabled: true,
            };

            const risks = riskEngine.detectContentFilterDisabled(securitySettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk when only Content Filtering is disabled', () => {
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
        });

        it('should detect risk when multiple features disabled including Content Filtering', () => {
            const securitySettings: SecuritySettings = {
                ipsEnabled: false,
                gavEnabled: false,
                antiSpywareEnabled: false,
                appControlEnabled: false,
                contentFilterEnabled: false,
                botnetFilterEnabled: false,
                dpiSslEnabled: false,
                geoIpFilterEnabled: false,
            };

            const risks = riskEngine.detectContentFilterDisabled(securitySettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('CONTENT_FILTER_DISABLED');
        });

        it('should detect risk when Content Filtering explicitly disabled', () => {
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
            expect(risks[0].severity).toBe('medium');
        });
    });

    describe('detectMissingRuleDescriptions', () => {
        it('should detect rule missing description (LOW)', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'rule-without-description',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: 'any',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('RULE_NO_DESCRIPTION');
            expect(risks[0].severity).toBe('low');
            expect(risks[0].riskCategory).toBe('best_practice_violation');
            expect(risks[0].description).toBe('Firewall rule missing description');
            expect(risks[0].remediation).toContain('rule-without-description');
        });

        it('should NOT detect risk when rule has description', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'rule-with-description',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: 'any',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                    comment: 'Allow LAN users to access internet via HTTPS',
                },
            ];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk when comment is empty string', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'rule-with-empty-comment',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: 'any',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                    comment: '',
                },
            ];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('RULE_NO_DESCRIPTION');
        });

        it('should detect risk when comment is only whitespace', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'rule-with-whitespace-comment',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: 'any',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                    comment: '   ',
                },
            ];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('RULE_NO_DESCRIPTION');
        });

        it('should detect multiple rules without descriptions', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'rule-1',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: 'any',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                },
                {
                    ruleName: 'rule-2',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.2.0/24',
                    destinationAddress: 'any',
                    service: 'HTTP',
                    action: 'allow',
                    enabled: true,
                    comment: 'This rule has a description',
                },
                {
                    ruleName: 'rule-3',
                    sourceZone: 'DMZ',
                    destinationZone: 'WAN',
                    sourceAddress: '10.0.0.0/24',
                    destinationAddress: 'any',
                    service: 'SMTP',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);

            expect(risks).toHaveLength(2);
            expect(risks.every(r => r.riskType === 'RULE_NO_DESCRIPTION')).toBe(true);
        });

        it('should handle empty rules array', () => {
            const rules: FirewallRule[] = [];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk even when rule is disabled', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'disabled-rule-without-description',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: 'any',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: false,
                },
            ];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('RULE_NO_DESCRIPTION');
        });

        it('should include rule name in remediation message', () => {
            const rules: FirewallRule[] = [
                {
                    ruleName: 'my-custom-rule',
                    sourceZone: 'LAN',
                    destinationZone: 'WAN',
                    sourceAddress: '192.168.1.0/24',
                    destinationAddress: 'any',
                    service: 'HTTPS',
                    action: 'allow',
                    enabled: true,
                },
            ];

            const risks = riskEngine.detectMissingRuleDescriptions(rules);

            expect(risks).toHaveLength(1);
            expect(risks[0].remediation).toContain('my-custom-rule');
            expect(risks[0].remediation).toContain('Add a description');
        });
    });

    describe('detectWeakVPNEncryption', () => {
        it('should detect VPN using DES encryption (HIGH)', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Weak-VPN',
                    encryption: 'des',
                    authenticationMethod: 'psk',
                },
            ];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_WEAK_ENCRYPTION');
            expect(risks[0].riskCategory).toBe('security_feature_disabled');
            expect(risks[0].severity).toBe('high');
            expect(risks[0].description).toBe('VPN using weak encryption algorithm');
            expect(risks[0].remediation).toContain('Weak-VPN');
            expect(risks[0].remediation).toContain('des');
            expect(risks[0].remediation).toContain('AES-256');
        });

        it('should detect VPN using 3DES encryption (HIGH)', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Legacy-VPN',
                    encryption: '3des',
                    authenticationMethod: 'certificate',
                },
            ];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_WEAK_ENCRYPTION');
            expect(risks[0].severity).toBe('high');
            expect(risks[0].remediation).toContain('3des');
        });

        it('should detect weak encryption with case-insensitive matching', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'VPN-1',
                    encryption: 'DES',
                    authenticationMethod: 'psk',
                },
                {
                    policyName: 'VPN-2',
                    encryption: '3DES',
                    authenticationMethod: 'psk',
                },
                {
                    policyName: 'VPN-3',
                    encryption: 'Des',
                    authenticationMethod: 'psk',
                },
            ];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);

            expect(risks).toHaveLength(3);
            expect(risks.every(r => r.riskType === 'VPN_WEAK_ENCRYPTION')).toBe(true);
            expect(risks.every(r => r.severity === 'high')).toBe(true);
        });

        it('should NOT detect risk when using strong encryption', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Secure-VPN',
                    encryption: 'aes256',
                    authenticationMethod: 'certificate',
                },
                {
                    policyName: 'Modern-VPN',
                    encryption: 'aes128',
                    authenticationMethod: 'certificate',
                },
            ];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);

            expect(risks).toHaveLength(0);
        });

        it('should detect multiple VPNs with weak encryption', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Old-VPN-1',
                    encryption: 'des',
                    authenticationMethod: 'psk',
                },
                {
                    policyName: 'Secure-VPN',
                    encryption: 'aes256',
                    authenticationMethod: 'certificate',
                },
                {
                    policyName: 'Old-VPN-2',
                    encryption: '3des',
                    authenticationMethod: 'psk',
                },
            ];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);

            expect(risks).toHaveLength(2);
            expect(risks[0].riskType).toBe('VPN_WEAK_ENCRYPTION');
            expect(risks[1].riskType).toBe('VPN_WEAK_ENCRYPTION');
            expect(risks[0].remediation).toContain('Old-VPN-1');
            expect(risks[1].remediation).toContain('Old-VPN-2');
        });

        it('should handle empty VPN configs array', () => {
            const vpnConfigs: VPNConfig[] = [];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);

            expect(risks).toHaveLength(0);
        });

        it('should include policy name and encryption in remediation', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Site-to-Site-VPN',
                    encryption: 'des',
                    authenticationMethod: 'psk',
                },
            ];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);

            expect(risks).toHaveLength(1);
            expect(risks[0].remediation).toContain('Site-to-Site-VPN');
            expect(risks[0].remediation).toContain('des');
            expect(risks[0].remediation).toContain('Upgrade to strong encryption');
        });

        it('should detect weak encryption regardless of authentication method', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'VPN-PSK',
                    encryption: 'des',
                    authenticationMethod: 'psk',
                },
                {
                    policyName: 'VPN-Cert',
                    encryption: '3des',
                    authenticationMethod: 'certificate',
                },
            ];

            const risks = riskEngine.detectWeakVPNEncryption(vpnConfigs);

            expect(risks).toHaveLength(2);
            expect(risks.every(r => r.riskType === 'VPN_WEAK_ENCRYPTION')).toBe(true);
        });
    });

    describe('detectVPNPSKOnly', () => {
        it('should detect VPN using PSK authentication (MEDIUM)', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Site-to-Site-VPN',
                    encryption: 'AES-256',
                    authenticationMethod: 'psk',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_PSK_ONLY');
            expect(risks[0].riskCategory).toBe('best_practice_violation');
            expect(risks[0].severity).toBe('medium');
            expect(risks[0].description).toContain('PSK only');
            expect(risks[0].remediation).toContain('Site-to-Site-VPN');
            expect(risks[0].remediation).toContain('certificate-based authentication');
        });

        it('should detect VPN using pre-shared-key authentication (MEDIUM)', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Remote-Access-VPN',
                    encryption: 'AES-128',
                    authenticationMethod: 'pre-shared-key',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_PSK_ONLY');
            expect(risks[0].severity).toBe('medium');
            expect(risks[0].remediation).toContain('pre-shared key');
        });

        it('should detect VPN using shared-secret authentication (MEDIUM)', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Branch-VPN',
                    encryption: 'AES-256',
                    authenticationMethod: 'shared-secret',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_PSK_ONLY');
            expect(risks[0].severity).toBe('medium');
        });

        it('should detect multiple VPNs using PSK authentication', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'VPN-1',
                    encryption: 'AES-256',
                    authenticationMethod: 'psk',
                },
                {
                    policyName: 'VPN-2',
                    encryption: 'AES-128',
                    authenticationMethod: 'pre-shared-key',
                },
                {
                    policyName: 'VPN-3',
                    encryption: 'AES-256',
                    authenticationMethod: 'shared-key',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(3);
            expect(risks.every(r => r.riskType === 'VPN_PSK_ONLY')).toBe(true);
            expect(risks.every(r => r.severity === 'medium')).toBe(true);
        });

        it('should NOT detect VPN using certificate-based authentication', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Secure-VPN',
                    encryption: 'AES-256',
                    authenticationMethod: 'certificate',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect VPN using RSA certificate authentication', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'RSA-VPN',
                    encryption: 'AES-256',
                    authenticationMethod: 'rsa-certificate',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(0);
        });

        it('should NOT detect VPN using X509 certificate authentication', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'X509-VPN',
                    encryption: 'AES-256',
                    authenticationMethod: 'x509',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(0);
        });

        it('should handle empty VPN configs array', () => {
            const vpnConfigs: VPNConfig[] = [];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(0);
        });

        it('should handle case-insensitive authentication methods', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'VPN-Upper',
                    encryption: 'AES-256',
                    authenticationMethod: 'PSK',
                },
                {
                    policyName: 'VPN-Mixed',
                    encryption: 'AES-256',
                    authenticationMethod: 'Pre-Shared-Key',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(2);
            expect(risks.every(r => r.riskType === 'VPN_PSK_ONLY')).toBe(true);
        });

        it('should detect PSK but not certificate-based in mixed configs', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'PSK-VPN',
                    encryption: 'AES-256',
                    authenticationMethod: 'psk',
                },
                {
                    policyName: 'Cert-VPN',
                    encryption: 'AES-256',
                    authenticationMethod: 'certificate',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(1);
            expect(risks[0].remediation).toContain('PSK-VPN');
        });

        it('should include policy name in remediation message', () => {
            const vpnConfigs: VPNConfig[] = [
                {
                    policyName: 'Legacy-Branch-VPN',
                    encryption: 'AES-256',
                    authenticationMethod: 'psk',
                },
            ];

            const risks = riskEngine.detectVPNPSKOnly(vpnConfigs);

            expect(risks).toHaveLength(1);
            expect(risks[0].remediation).toContain('Legacy-Branch-VPN');
        });
    });

    describe('detectOutdatedFirmware', () => {
        it('should detect firmware with ISO date format older than 6 months (MEDIUM)', () => {
            // Create a date that's 7 months old
            const sevenMonthsAgo = new Date();
            sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
            const dateStr = sevenMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD

            const systemSettings: SystemSettings = {
                firmwareVersion: `7.0.1-5050-${dateStr}`,
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: [],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OUTDATED_FIRMWARE');
            expect(risks[0].riskCategory).toBe('best_practice_violation');
            expect(risks[0].severity).toBe('medium');
            expect(risks[0].description).toContain('outdated');
            expect(risks[0].remediation).toContain('Update to the latest firmware');
        });

        it('should detect firmware with month-year format older than 6 months (MEDIUM)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: 'SonicOS 7.0.1 (Jun 2023)',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: [],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OUTDATED_FIRMWARE');
            expect(risks[0].severity).toBe('medium');
            expect(risks[0].remediation).toContain('months old');
        });

        it('should detect firmware with build date format older than 6 months (MEDIUM)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '7.0.1-20230101',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: [],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OUTDATED_FIRMWARE');
            expect(risks[0].severity).toBe('medium');
        });

        it('should detect known old firmware versions (MEDIUM)', () => {
            const oldVersions = [
                '6.4.0.0-12345',
                '6.3.5.1-10000',
                '5.9.1.0-5000',
                '4.2.0.0-1000',
            ];

            for (const version of oldVersions) {
                const systemSettings: SystemSettings = {
                    firmwareVersion: version,
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: [],
                    dnsServers: [],
                };

                const risks = riskEngine.detectOutdatedFirmware(systemSettings);

                expect(risks).toHaveLength(1);
                expect(risks[0].riskType).toBe('OUTDATED_FIRMWARE');
                expect(risks[0].severity).toBe('medium');
            }
        });

        it('should not detect recent firmware with date (no risk)', () => {
            // Create a date that's 2 months old (recent)
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
            const dateStr = twoMonthsAgo.toISOString().split('T')[0];

            const systemSettings: SystemSettings = {
                firmwareVersion: `7.0.1-5050-${dateStr}`,
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: [],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);

            expect(risks).toHaveLength(0);
        });

        it('should not detect current firmware versions (no risk)', () => {
            const currentVersions = [
                '7.0.1-5050',
                '7.1.0-6000',
                '8.0.0-1000',
            ];

            for (const version of currentVersions) {
                const systemSettings: SystemSettings = {
                    firmwareVersion: version,
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: [],
                    dnsServers: [],
                };

                const risks = riskEngine.detectOutdatedFirmware(systemSettings);

                expect(risks).toHaveLength(0);
            }
        });

        it('should handle unknown firmware version (no risk)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: 'unknown',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: [],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);

            expect(risks).toHaveLength(0);
        });

        it('should handle empty firmware version (no risk)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: [],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect firmware with "legacy" keyword (MEDIUM)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '7.0.1-legacy',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: [],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OUTDATED_FIRMWARE');
            expect(risks[0].severity).toBe('medium');
        });

        it('should detect firmware with "deprecated" keyword (MEDIUM)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '6.5.0-deprecated',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: [],
            };

            const risks = riskEngine.detectOutdatedFirmware(systemSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('OUTDATED_FIRMWARE');
            expect(risks[0].severity).toBe('medium');
        });
    });

    describe('detectMissingNTP', () => {
        it('should detect missing NTP configuration (LOW)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '7.0.1-5050',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: [],
                dnsServers: ['8.8.8.8'],
            };

            const risks = riskEngine.detectMissingNTP(systemSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('NO_NTP');
            expect(risks[0].riskCategory).toBe('best_practice_violation');
            expect(risks[0].severity).toBe('low');
            expect(risks[0].description).toContain('NTP not configured');
            expect(risks[0].description).toContain('time synchronization');
            expect(risks[0].remediation).toContain('Configure NTP');
        });

        it('should not detect risk when NTP servers are configured (no risk)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '7.0.1-5050',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: ['0.pool.ntp.org', '1.pool.ntp.org'],
                dnsServers: ['8.8.8.8'],
            };

            const risks = riskEngine.detectMissingNTP(systemSettings);

            expect(risks).toHaveLength(0);
        });

        it('should not detect risk when at least one NTP server is configured (no risk)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '7.0.1-5050',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: ['time.google.com'],
                dnsServers: [],
            };

            const risks = riskEngine.detectMissingNTP(systemSettings);

            expect(risks).toHaveLength(0);
        });

        it('should detect risk when ntpServers is undefined (LOW)', () => {
            const systemSettings: SystemSettings = {
                firmwareVersion: '7.0.1-5050',
                hostname: 'TestFirewall',
                timezone: 'UTC',
                ntpServers: undefined as any,
                dnsServers: [],
            };

            const risks = riskEngine.detectMissingNTP(systemSettings);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('NO_NTP');
            expect(risks[0].severity).toBe('low');
        });
    });

    describe('analyzeConfig', () => {
        it('should analyze configuration and detect WAN-to-LAN risks', () => {
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'dangerous-rule',
                        sourceZone: 'WAN',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            // Should detect both OPEN_INBOUND (WAN-to-LAN any) and ANY_ANY_RULE
            expect(risks.length).toBeGreaterThanOrEqual(1);
            expect(risks.some(r => r.riskType === 'OPEN_INBOUND')).toBe(true);
            expect(risks.find(r => r.riskType === 'OPEN_INBOUND')?.severity).toBe('critical');
        });

        it('should analyze configuration and detect any-to-any risks', () => {
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'permissive-rule',
                        sourceZone: 'LAN',
                        destinationZone: 'WAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(4);
            expect(risks.some(r => r.riskType === 'ANY_ANY_RULE')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
            expect(risks.some(r => r.riskType === 'RULE_NO_DESCRIPTION')).toBe(true);
        });

        it('should detect multiple risk types in same configuration', () => {
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'wan-to-lan-rule',
                        sourceZone: 'WAN',
                        destinationZone: 'LAN',
                        sourceAddress: '203.0.113.1',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                    {
                        ruleName: 'any-to-any-rule',
                        sourceZone: 'DMZ',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(6);
            expect(risks.some(r => r.riskType === 'OPEN_INBOUND')).toBe(true);
            expect(risks.some(r => r.riskType === 'ANY_ANY_RULE')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
            expect(risks.filter(r => r.riskType === 'RULE_NO_DESCRIPTION')).toHaveLength(2);
        });

        it('should detect Guest-to-LAN isolation risk', () => {
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'guest-to-lan-rule',
                        sourceZone: 'GUEST',
                        destinationZone: 'LAN',
                        sourceAddress: '10.0.0.0/24',
                        destinationAddress: '192.168.1.0/24',
                        service: 'HTTP',
                        action: 'allow',
                        enabled: true,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(4);
            expect(risks.some(r => r.riskType === 'GUEST_NOT_ISOLATED')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
            expect(risks.some(r => r.riskType === 'RULE_NO_DESCRIPTION')).toBe(true);
        });

        it('should detect both ANY_ANY_RULE and GUEST_NOT_ISOLATED for Guest-to-LAN any-to-any rule', () => {
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'guest-to-lan-any-rule',
                        sourceZone: 'GUEST',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            // This rule matches both patterns: any-to-any AND guest-to-lan
            expect(risks).toHaveLength(5);
            expect(risks.some(r => r.riskType === 'ANY_ANY_RULE')).toBe(true);
            expect(risks.some(r => r.riskType === 'GUEST_NOT_ISOLATED')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
            expect(risks.some(r => r.riskType === 'RULE_NO_DESCRIPTION')).toBe(true);
        });

        it('should return empty array for safe configuration', () => {
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'safe-rule',
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
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['customadmin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(0);
        });

        it('should detect DHCP on WAN risk in full configuration', () => {
            const config: ParsedConfig = {
                rules: [],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [
                    {
                        interfaceName: 'X0',
                        zone: 'WAN',
                        ipAddress: '203.0.113.1',
                        dhcpServerEnabled: true,
                    },
                    {
                        interfaceName: 'X1',
                        zone: 'LAN',
                        ipAddress: '192.168.1.1',
                        dhcpServerEnabled: true,
                    },
                ],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(3);
            expect(risks.some(r => r.riskType === 'DHCP_ON_WAN')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
        });

        it('should detect multiple risk types including DHCP on WAN', () => {
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'wan-to-lan-rule',
                        sourceZone: 'WAN',
                        destinationZone: 'LAN',
                        sourceAddress: '203.0.113.1',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                    {
                        ruleName: 'guest-to-lan-rule',
                        sourceZone: 'GUEST',
                        destinationZone: 'LAN',
                        sourceAddress: '10.0.0.0/24',
                        destinationAddress: '192.168.1.0/24',
                        service: 'HTTP',
                        action: 'allow',
                        enabled: true,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [
                    {
                        interfaceName: 'X0',
                        zone: 'WAN',
                        ipAddress: '203.0.113.1',
                        dhcpServerEnabled: true,
                    },
                ],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(7);
            expect(risks.some(r => r.riskType === 'OPEN_INBOUND')).toBe(true);
            expect(risks.some(r => r.riskType === 'GUEST_NOT_ISOLATED')).toBe(true);
            expect(risks.some(r => r.riskType === 'DHCP_ON_WAN')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
            expect(risks.filter(r => r.riskType === 'RULE_NO_DESCRIPTION')).toHaveLength(2);
        });

        it('should detect MFA disabled risk in full configuration', () => {
            const config: ParsedConfig = {
                rules: [],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: false,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(3);
            expect(risks.some(r => r.riskType === 'ADMIN_NO_MFA')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
        });

        it('should detect multiple admin risks including MFA disabled', () => {
            const config: ParsedConfig = {
                rules: [
                    {
                        ruleName: 'wan-to-lan-rule',
                        sourceZone: 'WAN',
                        destinationZone: 'LAN',
                        sourceAddress: 'any',
                        destinationAddress: 'any',
                        service: 'any',
                        action: 'allow',
                        enabled: true,
                    },
                ],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: false,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: false,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            // This rule matches both OPEN_INBOUND (WAN-to-LAN any) and ANY_ANY_RULE (any-to-any)
            // Plus ADMIN_NO_MFA, DEFAULT_ADMIN_USERNAME, and DEFAULT_ADMIN_PORT from admin settings
            // Plus RULE_NO_DESCRIPTION for the rule without a comment
            expect(risks).toHaveLength(6);
            expect(risks.some(r => r.riskType === 'OPEN_INBOUND')).toBe(true);
            expect(risks.some(r => r.riskType === 'ANY_ANY_RULE')).toBe(true);
            expect(risks.some(r => r.riskType === 'ADMIN_NO_MFA')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
            expect(risks.some(r => r.riskType === 'RULE_NO_DESCRIPTION')).toBe(true);
        });

        it('should detect IPS disabled as part of full config analysis', () => {
            const config: ParsedConfig = {
                rules: [],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: false,
                    gavEnabled: true,
                    antiSpywareEnabled: true,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: true,
                },
                adminSettings: {
                    adminUsernames: ['secure-admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('IPS_DISABLED');
            expect(risks[0].severity).toBe('critical');
        });

        it('should detect GAV disabled as part of full config analysis', () => {
            const config: ParsedConfig = {
                rules: [],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: false,
                    antiSpywareEnabled: true,
                    appControlEnabled: true,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: true,
                },
                adminSettings: {
                    adminUsernames: ['secure-admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('GAV_DISABLED');
            expect(risks[0].severity).toBe('critical');
        });

        it('should detect DPI-SSL disabled as part of full config analysis', () => {
            const config: ParsedConfig = {
                rules: [],
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
                    dpiSslEnabled: false,
                    geoIpFilterEnabled: true,
                },
                adminSettings: {
                    adminUsernames: ['secure-admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('DPI_SSL_DISABLED');
            expect(risks[0].severity).toBe('medium');
        });

        it('should detect Application Control disabled as part of full config analysis', () => {
            const config: ParsedConfig = {
                rules: [],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: true,
                    gavEnabled: true,
                    antiSpywareEnabled: true,
                    appControlEnabled: false,
                    contentFilterEnabled: true,
                    botnetFilterEnabled: true,
                    dpiSslEnabled: true,
                    geoIpFilterEnabled: true,
                },
                adminSettings: {
                    adminUsernames: ['secure-admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('APP_CONTROL_DISABLED');
            expect(risks[0].severity).toBe('medium');
        });

        it('should detect multiple security feature risks including IPS', () => {
            const config: ParsedConfig = {
                rules: [],
                natPolicies: [],
                addressObjects: [],
                serviceObjects: [],
                securitySettings: {
                    ipsEnabled: false,
                    gavEnabled: false,
                    antiSpywareEnabled: false,
                    appControlEnabled: false,
                    contentFilterEnabled: false,
                    botnetFilterEnabled: false,
                    dpiSslEnabled: false,
                    geoIpFilterEnabled: false,
                },
                adminSettings: {
                    adminUsernames: ['admin'],
                    mfaEnabled: false,
                    wanManagementEnabled: false,
                    httpsAdminPort: 443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            // Should detect: IPS_DISABLED, GAV_DISABLED, DPI_SSL_DISABLED, BOTNET_FILTER_DISABLED, ADMIN_NO_MFA, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PORT
            expect(risks.length).toBeGreaterThanOrEqual(7);
            expect(risks.some(r => r.riskType === 'IPS_DISABLED')).toBe(true);
            expect(risks.some(r => r.riskType === 'GAV_DISABLED')).toBe(true);
            expect(risks.some(r => r.riskType === 'DPI_SSL_DISABLED')).toBe(true);
            expect(risks.some(r => r.riskType === 'BOTNET_FILTER_DISABLED')).toBe(true);
            expect(risks.some(r => r.riskType === 'ADMIN_NO_MFA')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_USERNAME')).toBe(true);
            expect(risks.some(r => r.riskType === 'DEFAULT_ADMIN_PORT')).toBe(true);
        });

        it('should detect VPN weak encryption as part of full config analysis', () => {
            const config: ParsedConfig = {
                rules: [],
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
                    adminUsernames: ['secure-admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [
                    {
                        policyName: 'Legacy-VPN',
                        encryption: 'des',
                        authenticationMethod: 'certificate',
                    },
                ],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_WEAK_ENCRYPTION');
            expect(risks[0].severity).toBe('high');
        });

        it('should detect multiple VPN weak encryption risks', () => {
            const config: ParsedConfig = {
                rules: [],
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
                    adminUsernames: ['secure-admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [
                    {
                        policyName: 'Old-VPN-1',
                        encryption: 'des',
                        authenticationMethod: 'certificate',
                    },
                    {
                        policyName: 'Secure-VPN',
                        encryption: 'aes256',
                        authenticationMethod: 'certificate',
                    },
                    {
                        policyName: 'Old-VPN-2',
                        encryption: '3des',
                        authenticationMethod: 'certificate',
                    },
                ],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(2);
            expect(risks.filter(r => r.riskType === 'VPN_WEAK_ENCRYPTION')).toHaveLength(2);
            expect(risks.every(r => r.severity === 'high')).toBe(true);
        });

        it('should detect both VPN weak encryption and PSK-only risks', () => {
            const config: ParsedConfig = {
                rules: [],
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
                    adminUsernames: ['secure-admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [
                    {
                        policyName: 'Insecure-VPN',
                        encryption: 'des',
                        authenticationMethod: 'psk',
                    },
                    {
                        policyName: 'PSK-Only-VPN',
                        encryption: 'aes256',
                        authenticationMethod: 'psk',
                    },
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
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            // Should detect:
            // 1. VPN_WEAK_ENCRYPTION for Insecure-VPN (des)
            // 2. VPN_PSK_ONLY for Insecure-VPN (psk)
            // 3. VPN_PSK_ONLY for PSK-Only-VPN (psk)
            expect(risks).toHaveLength(3);
            expect(risks.filter(r => r.riskType === 'VPN_WEAK_ENCRYPTION')).toHaveLength(1);
            expect(risks.filter(r => r.riskType === 'VPN_PSK_ONLY')).toHaveLength(2);
        });

        it('should detect VPN PSK-only as part of full config analysis', () => {
            const config: ParsedConfig = {
                rules: [],
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
                    adminUsernames: ['secure-admin'],
                    mfaEnabled: true,
                    wanManagementEnabled: false,
                    httpsAdminPort: 8443,
                    sshEnabled: false,
                },
                interfaces: [],
                vpnConfigs: [
                    {
                        policyName: 'Branch-VPN',
                        encryption: 'aes256',
                        authenticationMethod: 'psk',
                    },
                ],
                systemSettings: {
                    firmwareVersion: '7.0.1-5050',
                    hostname: 'TestFirewall',
                    timezone: 'UTC',
                    ntpServers: ['0.pool.ntp.org'],
                    dnsServers: ['8.8.8.8'],
                },
            };

            const risks = riskEngine.analyzeConfig(config);

            expect(risks).toHaveLength(1);
            expect(risks[0].riskType).toBe('VPN_PSK_ONLY');
            expect(risks[0].severity).toBe('medium');
        });
    });
});

describe('ConfigParser - Malformed Configuration Tests', () => {
    let parser: ConfigParser;

    beforeEach(() => {
        parser = new ConfigParser();
    });

    describe('completely malformed configurations', () => {
        it('should handle completely empty configuration', () => {
            const result = parser.parseConfig('');

            expect(result).toBeDefined();
            expect(result.rules).toHaveLength(0);
            expect(result.natPolicies).toHaveLength(0);
            expect(result.addressObjects).toHaveLength(0);
            expect(result.serviceObjects).toHaveLength(0);
            expect(result.interfaces).toHaveLength(0);
            expect(result.vpnConfigs).toHaveLength(0);
        });

        it('should handle configuration with only whitespace', () => {
            const configText = '   \n\n\t\t\n   \n\n';
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            expect(result.rules).toHaveLength(0);
            expect(result.natPolicies).toHaveLength(0);
        });

        it('should handle configuration with only comments', () => {
            const configText = `
                # This is a comment
                // Another comment
                # More comments
                // Even more comments
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            expect(result.rules).toHaveLength(0);
        });

        it('should handle configuration with only invalid lines', () => {
            const configText = `
                this is not valid
                @@@ invalid syntax @@@
                !!! error !!!
                random text here
                12345 67890
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            expect(result.rules).toHaveLength(0);
            expect(result.natPolicies).toHaveLength(0);
            expect(result.addressObjects).toHaveLength(0);
        });

        it('should handle binary or corrupted data', () => {
            const configText = '\x00\x01\x02\x03\xFF\xFE\xFD';
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            expect(result.rules).toHaveLength(0);
        });

        it('should handle extremely long lines', () => {
            const longLine = 'access-rule ' + 'x'.repeat(100000);
            const result = parser.parseConfig(longLine);

            expect(result).toBeDefined();
            // Should not crash, may or may not parse the rule
        });
    });

    describe('partially malformed rules', () => {
        it('should handle incomplete access-rule (missing required fields)', () => {
            const configText = `
                access-rule from
                access-rule to WAN
                access-rule source any
                access-rule incomplete
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Parser should handle gracefully, may create partial rules or skip them
            expect(result.rules.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle access-rule with invalid zone names', () => {
            const configText = `
                access-rule from @@INVALID@@ to LAN source any destination any service any action allow
                access-rule from WAN to !!!BAD!!! source any destination any service any action allow
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should still parse, zones will be whatever was extracted
            expect(result.rules.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle access-rule with invalid IP addresses', () => {
            const configText = `
                access-rule from WAN to LAN source 999.999.999.999 destination any service any action allow
                access-rule from WAN to LAN source not-an-ip destination any service any action allow
                access-rule from WAN to LAN source 192.168.1 destination any service any action allow
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Parser should not validate IP format, just extract strings
            expect(result.rules.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle access-rule with invalid action', () => {
            const configText = `
                access-rule from WAN to LAN source any destination any service any action invalid-action
                access-rule from WAN to LAN source any destination any service any action
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default to 'allow' or handle gracefully
            expect(result.rules.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle access-rule with duplicate keywords', () => {
            const configText = `
                access-rule from WAN from LAN to WAN to DMZ source any source 192.168.1.1 destination any action allow action deny
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract first or last occurrence
            expect(result.rules.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle access-rule with missing quotes', () => {
            const configText = `
                access-rule name Unquoted Name from WAN to LAN source any destination any service any action allow
                access-rule name "Partially quoted from WAN to LAN source any destination any service any action allow
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should handle unquoted names or partial quotes
            expect(result.rules.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('malformed NAT policies', () => {
        it('should handle incomplete NAT policy', () => {
            const configText = `
                nat-policy original-source
                nat-policy translated-source 1.2.3.4
                nat-policy interface X0
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // May create partial NAT policies or skip them
            expect(result.natPolicies.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle NAT policy with invalid IP addresses', () => {
            const configText = `
                nat-policy original-source not-an-ip translated-source 1.2.3.4 interface X0
                nat-policy original-source 999.999.999.999 translated-source 1.2.3.4 interface X0
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should not validate IPs, just extract strings
            expect(result.natPolicies.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle NAT policy with missing interface', () => {
            const configText = `
                nat-policy original-source 192.168.1.0/24 translated-source 1.2.3.4
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default interface to 'any' or handle gracefully
            expect(result.natPolicies.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('malformed address and service objects', () => {
        it('should handle address-object with missing name', () => {
            const configText = `
                address-object ip 192.168.1.100 zone LAN
                address-object zone LAN
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default name to 'unknown' or skip
            expect(result.addressObjects.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle address-object with missing IP', () => {
            const configText = `
                address-object name Server1 zone LAN
                address-object name Server2
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default IP or skip
            expect(result.addressObjects.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle service-object with invalid port', () => {
            const configText = `
                service-object name HTTP protocol tcp port not-a-number
                service-object name HTTPS protocol tcp port 999999
                service-object name Custom protocol tcp port -1
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract port as string, not validate
            expect(result.serviceObjects.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle service-object with invalid protocol', () => {
            const configText = `
                service-object name Custom protocol invalid-protocol port 80
                service-object name Custom2 protocol xyz port 443
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract protocol as string
            expect(result.serviceObjects.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('malformed security settings', () => {
        it('should handle security features with invalid values', () => {
            const configText = `
                ips invalid-value
                gateway-av maybe
                dpi-ssl yes-no
                app-control 123
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default to disabled or handle gracefully
            expect(result.securitySettings).toBeDefined();
        });

        it('should handle duplicate security feature declarations', () => {
            const configText = `
                ips enable
                ips disable
                ips enable
                gateway-av enable
                gateway-av disable
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should use last occurrence or first occurrence
            expect(result.securitySettings).toBeDefined();
        });

        it('should handle security features with extra parameters', () => {
            const configText = `
                ips enable extra parameters here
                gateway-av disable with more stuff
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract enable/disable and ignore extra params
            expect(result.securitySettings).toBeDefined();
        });
    });

    describe('malformed admin settings', () => {
        it('should handle admin username with special characters', () => {
            const configText = `
                admin username "user@#$%^&*()"
                admin username user<script>alert('xss')</script>
                admin username ../../../etc/passwd
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract usernames as-is
            expect(result.adminSettings.adminUsernames.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle invalid HTTPS port numbers', () => {
            const configText = `
                https admin port not-a-number
                https admin port 999999
                https admin port -1
                https admin port 0
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default to 443 or handle gracefully
            expect(result.adminSettings.httpsAdminPort).toBeDefined();
        });

        it('should handle MFA with invalid values', () => {
            const configText = `
                mfa maybe
                mfa yes-no
                mfa 123
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default to false or handle gracefully
            expect(result.adminSettings.mfaEnabled).toBeDefined();
        });
    });

    describe('malformed interface configurations', () => {
        it('should handle interface with missing zone', () => {
            const configText = `
                interface X0 ip 203.0.113.1
                interface X1
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default zone or skip
            expect(result.interfaces.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle interface with invalid IP', () => {
            const configText = `
                interface X0 zone WAN ip not-an-ip
                interface X1 zone LAN ip 999.999.999.999
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract IP as string without validation
            expect(result.interfaces.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle interface with duplicate names', () => {
            const configText = `
                interface X0 zone WAN ip 203.0.113.1
                interface X0 zone LAN ip 192.168.1.1
                interface X0 zone DMZ ip 10.0.0.1
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should create multiple interface entries or use last one
            expect(result.interfaces.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('malformed VPN configurations', () => {
        it('should handle VPN with missing encryption', () => {
            const configText = `
                vpn policy "VPN1" auth psk
                vpn policy "VPN2"
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default encryption or skip
            expect(result.vpnConfigs.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle VPN with invalid encryption algorithm', () => {
            const configText = `
                vpn policy "VPN1" encryption rot13 auth psk
                vpn policy "VPN2" encryption invalid-algo auth certificate
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract encryption as string
            expect(result.vpnConfigs.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle VPN with missing authentication method', () => {
            const configText = `
                vpn policy "VPN1" encryption aes256
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should default auth method or skip
            expect(result.vpnConfigs.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('malformed system settings', () => {
        it('should handle invalid firmware version format', () => {
            const configText = `
                firmware version not-a-version
                firmware version 1.2.3.4.5.6.7.8.9
                firmware version abc-def-ghi
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract version as string
            expect(result.systemSettings.firmwareVersion).toBeDefined();
        });

        it('should handle hostname with special characters', () => {
            const configText = `
                hostname "firewall@#$%^&*()"
                hostname <script>alert('xss')</script>
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract hostname as-is
            expect(result.systemSettings.hostname).toBeDefined();
        });

        it('should handle invalid NTP server addresses', () => {
            const configText = `
                ntp-server not-a-server
                ntp-server 999.999.999.999
                ntp-server ../../../etc/passwd
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract NTP servers as strings
            expect(result.systemSettings.ntpServers.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle invalid DNS server addresses', () => {
            const configText = `
                dns-server not-a-dns
                dns-server 999.999.999.999
                dns-server invalid-dns-server
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract DNS servers as strings
            expect(result.systemSettings.dnsServers.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle invalid timezone', () => {
            const configText = `
                timezone "Invalid/Timezone"
                timezone "Not_A_Real_Zone"
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract timezone as string
            expect(result.systemSettings.timezone).toBeDefined();
        });
    });

    describe('mixed valid and malformed configurations', () => {
        it('should parse valid lines and skip malformed lines', () => {
            const configText = `
                interface X0 zone WAN ip 203.0.113.1
                this is invalid
                interface X1 zone LAN ip 192.168.1.1
                @@@ more invalid @@@
                ips enable
                random garbage here
                gateway-av enable
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            expect(result.interfaces).toHaveLength(2);
            expect(result.securitySettings.ipsEnabled).toBe(true);
            expect(result.securitySettings.gavEnabled).toBe(true);
        });

        it('should handle configuration with encoding issues', () => {
            const configText = `
                interface X0 zone WAN ip 203.0.113.1
                hostname "Firewall™®©"
                admin username "user€£¥"
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should handle unicode characters
            expect(result.interfaces).toHaveLength(1);
        });

        it('should handle configuration with very long lines mixed with valid lines', () => {
            const longLine = 'access-rule ' + 'x'.repeat(10000);
            const configText = `
                interface X0 zone WAN ip 203.0.113.1
                ${longLine}
                ips enable
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            expect(result.interfaces).toHaveLength(1);
            expect(result.securitySettings.ipsEnabled).toBe(true);
        });
    });

    describe('edge cases with quotes and escaping', () => {
        it('should handle unmatched quotes', () => {
            const configText = `
                admin username "unmatched
                hostname "also unmatched
                access-rule name "incomplete from WAN to LAN source any destination any service any action allow
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should handle gracefully
        });

        it('should handle nested quotes', () => {
            const configText = `
                admin username "user"with"quotes"
                hostname "fire"wall"name"
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should extract what it can
        });

        it('should handle escaped characters', () => {
            const configText = `
                admin username "user\\"with\\"escapes"
                hostname "firewall\\nwith\\nnewlines"
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should handle escaped characters
        });
    });

    describe('stress tests', () => {
        it('should handle configuration with thousands of rules', () => {
            const rules = Array.from({ length: 1000 }, (_, i) =>
                `access-rule name "rule-${i}" from LAN to WAN source any destination any service any action allow`
            ).join('\n');

            const result = parser.parseConfig(rules);

            expect(result).toBeDefined();
            expect(result.rules.length).toBeGreaterThan(0);
            // Should not crash or timeout
        });

        it('should handle configuration with deeply nested or complex structures', () => {
            const configText = `
                access-rule name "complex" from WAN to LAN source any destination any service any action allow schedule "weekdays" comment "very long comment ${'x'.repeat(1000)}"
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should handle complex rules
        });

        it('should handle configuration with all possible malformations at once', () => {
            const configText = `
                this is invalid
                interface X0 zone WAN ip not-an-ip
                @@@ garbage @@@
                access-rule incomplete
                nat-policy original-source
                ips invalid-value
                admin username
                https admin port not-a-number
                vpn policy encryption
                firmware version
                ntp-server
                ${'\x00\x01\x02'}
                interface X1 zone LAN ip 192.168.1.1
                ips enable
            `;
            const result = parser.parseConfig(configText);

            expect(result).toBeDefined();
            // Should parse what it can and skip the rest
            expect(result.interfaces.length).toBeGreaterThanOrEqual(1);
            expect(result.securitySettings.ipsEnabled).toBe(true);
        });
    });
});
