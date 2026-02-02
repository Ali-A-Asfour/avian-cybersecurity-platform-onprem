/**
 * SonicWall Configuration Parser
 * 
 * Parses SonicWall .exp configuration files and extracts:
 * - Firewall rules
 * - NAT policies
 * - Address objects
 * - Service objects
 * - Security feature settings
 * - Admin settings
 * - Interface configurations
 * - VPN configurations
 * - System settings
 * 
 * Requirements: 6.1-6.10
 */

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

/**
 * ConfigParser class for parsing SonicWall .exp configuration files
 */
export class ConfigParser {
    /**
     * Parse a SonicWall configuration file (.exp format)
     * @param configText - The raw configuration file content
     * @returns ParsedConfig object with all extracted configuration data
     */
    parseConfig(configText: string): ParsedConfig {
        const lines = configText.split('\n').map(line => line.trim());

        return {
            rules: this.extractRules(lines),
            natPolicies: this.extractNATPolicies(lines),
            addressObjects: this.extractAddressObjects(lines),
            serviceObjects: this.extractServiceObjects(lines),
            securitySettings: this.extractSecuritySettings(lines),
            adminSettings: this.extractAdminSettings(lines),
            interfaces: this.extractInterfaces(lines),
            vpnConfigs: this.extractVPNConfigs(lines),
            systemSettings: this.extractSystemSettings(lines),
        };
    }

    /**
     * Extract firewall access rules from configuration
     * Requirements: 6.2
     */
    private extractRules(lines: string[]): FirewallRule[] {
        const rules: FirewallRule[] = [];

        // SonicWall .exp format typically has rules in sections like:
        // access-rule from <zone> to <zone> source <addr> destination <addr> service <svc> action <allow|deny>
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match access-rule patterns - be more specific to avoid false matches
            if (line.includes('access-rule') || line.includes('firewall-rule')) {
                const rule = this.parseFirewallRule(line, lines, i);
                if (rule) {
                    rules.push(rule);
                }
            }
        }

        return rules;
    }

    /**
     * Parse a single firewall rule from configuration line(s)
     */
    private parseFirewallRule(line: string, lines: string[], index: number): FirewallRule | null {
        try {
            // Extract rule components using regex patterns
            const ruleName = this.extractValue(line, /name\s+"([^"]+)"|name\s+(\S+)/i) || `rule-${index}`;
            const sourceZone = this.extractValue(line, /from\s+(\S+)|source-zone\s+(\S+)/i) || 'any';
            const destinationZone = this.extractValue(line, /to\s+(\S+)|destination-zone\s+(\S+)/i) || 'any';
            const sourceAddress = this.extractValue(line, /source\s+(\S+)|src\s+(\S+)/i) || 'any';
            const destinationAddress = this.extractValue(line, /destination\s+(\S+)|dest\s+(\S+)|dst\s+(\S+)/i) || 'any';
            const service = this.extractValue(line, /service\s+(\S+)|port\s+(\S+)/i) || 'any';
            const action = this.extractValue(line, /action\s+(allow|deny|accept|drop)/i) || 'allow';
            const enabled = !line.includes('disable') && !line.includes('inactive');
            const schedule = this.extractValue(line, /schedule\s+"([^"]+)"|schedule\s+(\S+)/i);
            const comment = this.extractValue(line, /comment\s+"([^"]+)"|description\s+"([^"]+)"/i);

            return {
                ruleName,
                sourceZone,
                destinationZone,
                sourceAddress,
                destinationAddress,
                service,
                action: action.toLowerCase() === 'deny' || action.toLowerCase() === 'drop' ? 'deny' : 'allow',
                enabled,
                schedule,
                comment,
            };
        } catch (error) {
            console.warn(`Failed to parse firewall rule at line ${index}:`, error);
            return null;
        }
    }

    /**
     * Extract NAT policies from configuration
     * Requirements: 6.3
     */
    private extractNATPolicies(lines: string[]): NATPolicy[] {
        const policies: NATPolicy[] = [];

        for (const line of lines) {
            // Match NAT policy patterns
            if (line.includes('nat-policy') || line.includes('nat') && (line.includes('source') || line.includes('destination'))) {
                const policy = this.parseNATPolicy(line);
                if (policy) {
                    policies.push(policy);
                }
            }
        }

        return policies;
    }

    /**
     * Parse a single NAT policy
     */
    private parseNATPolicy(line: string): NATPolicy | null {
        try {
            // Extract values more carefully to avoid matching "any" as default
            const originalSource = this.extractValue(line, /original-source\s+(\S+)|orig-src\s+(\S+)/i);
            const translatedSource = this.extractValue(line, /translated-source\s+(\S+)|trans-src\s+(\S+)/i);
            const originalDestination = this.extractValue(line, /original-destination\s+(\S+)|orig-dst\s+(\S+)/i);
            const translatedDestination = this.extractValue(line, /translated-destination\s+(\S+)|trans-dst\s+(\S+)/i);
            const interfaceName = this.extractValue(line, /interface\s+(\S+)|egress-interface\s+(\S+)/i);

            // Only return if we found at least some NAT information
            if (!originalSource && !translatedSource && !originalDestination && !translatedDestination) {
                return null;
            }

            return {
                originalSource: originalSource || 'any',
                translatedSource: translatedSource || 'any',
                originalDestination: originalDestination || 'any',
                translatedDestination: translatedDestination || 'any',
                interface: interfaceName || 'any',
            };
        } catch (error) {
            console.warn('Failed to parse NAT policy:', error);
            return null;
        }
    }

    /**
     * Extract address objects from configuration
     * Requirements: 6.4
     */
    private extractAddressObjects(lines: string[]): AddressObject[] {
        const objects: AddressObject[] = [];

        for (const line of lines) {
            // Match address object patterns
            if (line.includes('address-object') || line.includes('address') && line.includes('name')) {
                const obj = this.parseAddressObject(line);
                if (obj) {
                    objects.push(obj);
                }
            }
        }

        return objects;
    }

    /**
     * Parse a single address object
     */
    private parseAddressObject(line: string): AddressObject | null {
        try {
            const objectName = this.extractValue(line, /name\s+"([^"]+)"|name\s+(\S+)/i) || 'unknown';
            const ipAddress = this.extractValue(line, /ip\s+(\S+)|address\s+(\S+)|host\s+(\S+)|network\s+(\S+)/i) || '0.0.0.0';
            const zone = this.extractValue(line, /zone\s+(\S+)/i) || 'any';

            return {
                objectName,
                ipAddress,
                zone,
            };
        } catch (error) {
            console.warn('Failed to parse address object:', error);
            return null;
        }
    }

    /**
     * Extract service objects from configuration
     * Requirements: 6.5
     */
    private extractServiceObjects(lines: string[]): ServiceObject[] {
        const objects: ServiceObject[] = [];

        for (const line of lines) {
            // Match service object patterns
            if (line.includes('service-object') || line.includes('service') && line.includes('name')) {
                const obj = this.parseServiceObject(line);
                if (obj) {
                    objects.push(obj);
                }
            }
        }

        return objects;
    }

    /**
     * Parse a single service object
     */
    private parseServiceObject(line: string): ServiceObject | null {
        try {
            const serviceName = this.extractValue(line, /name\s+"([^"]+)"|name\s+(\S+)/i) || 'unknown';
            const protocol = this.extractValue(line, /protocol\s+(\S+)|proto\s+(\S+)/i) || 'tcp';
            const portRange = this.extractValue(line, /port\s+(\S+)|ports\s+(\S+)/i) || 'any';

            return {
                serviceName,
                protocol,
                portRange,
            };
        } catch (error) {
            console.warn('Failed to parse service object:', error);
            return null;
        }
    }

    /**
     * Extract security feature settings from configuration
     * Requirements: 6.6
     */
    private extractSecuritySettings(lines: string[]): SecuritySettings {
        const settings: SecuritySettings = {
            ipsEnabled: false,
            gavEnabled: false,
            antiSpywareEnabled: false,
            appControlEnabled: false,
            contentFilterEnabled: false,
            botnetFilterEnabled: false,
            dpiSslEnabled: false,
            geoIpFilterEnabled: false,
        };

        for (const line of lines) {
            const lowerLine = line.toLowerCase();

            // Skip comment lines
            if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
                continue;
            }

            // Check for IPS
            if (lowerLine.includes('ips') && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.ipsEnabled = true;
            }
            if (lowerLine.includes('ips') && (lowerLine.includes('disable') || lowerLine.includes('off'))) {
                settings.ipsEnabled = false;
            }

            // Check for Gateway Anti-Virus
            if ((lowerLine.includes('gateway-av') || lowerLine.includes('gateway anti-virus') || lowerLine.includes('gav'))
                && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.gavEnabled = true;
            }
            if ((lowerLine.includes('gateway-av') || lowerLine.includes('gav'))
                && (lowerLine.includes('disable') || lowerLine.includes('off'))) {
                settings.gavEnabled = false;
            }

            // Check for Anti-Spyware
            if (lowerLine.includes('anti-spyware') && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.antiSpywareEnabled = true;
            }

            // Check for Application Control
            if ((lowerLine.includes('app-control') || lowerLine.includes('application-control'))
                && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.appControlEnabled = true;
            }
            if ((lowerLine.includes('app-control') || lowerLine.includes('application-control'))
                && (lowerLine.includes('disable') || lowerLine.includes('off'))) {
                settings.appControlEnabled = false;
            }

            // Check for Content Filtering
            if ((lowerLine.includes('content-filter') || lowerLine.includes('web-filter'))
                && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.contentFilterEnabled = true;
            }
            if ((lowerLine.includes('content-filter') || lowerLine.includes('web-filter'))
                && (lowerLine.includes('disable') || lowerLine.includes('off'))) {
                settings.contentFilterEnabled = false;
            }

            // Check for Botnet Filter
            if (lowerLine.includes('botnet') && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.botnetFilterEnabled = true;
            }
            if (lowerLine.includes('botnet') && (lowerLine.includes('disable') || lowerLine.includes('off'))) {
                settings.botnetFilterEnabled = false;
            }

            // Check for DPI-SSL
            if ((lowerLine.includes('dpi-ssl') || lowerLine.includes('ssl-inspection'))
                && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.dpiSslEnabled = true;
            }
            if ((lowerLine.includes('dpi-ssl') || lowerLine.includes('ssl-inspection'))
                && (lowerLine.includes('disable') || lowerLine.includes('off'))) {
                settings.dpiSslEnabled = false;
            }

            // Check for Geo-IP Filter
            if ((lowerLine.includes('geo-ip') || lowerLine.includes('geoip'))
                && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.geoIpFilterEnabled = true;
            }
        }

        return settings;
    }

    /**
     * Extract admin settings from configuration
     * Requirements: 6.7
     */
    private extractAdminSettings(lines: string[]): AdminSettings {
        const settings: AdminSettings = {
            adminUsernames: [],
            mfaEnabled: false,
            wanManagementEnabled: false,
            httpsAdminPort: 443,
            sshEnabled: false,
        };

        for (const line of lines) {
            const lowerLine = line.toLowerCase();

            // Skip comment lines
            if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
                continue;
            }

            // Extract admin usernames
            if (lowerLine.includes('admin') && (lowerLine.includes('user') || lowerLine.includes('username'))) {
                const username = this.extractValue(line, /username\s+"([^"]+)"|username\s+(\S+)|user\s+"([^"]+)"|user\s+(\S+)/i);
                if (username && !settings.adminUsernames.includes(username)) {
                    settings.adminUsernames.push(username);
                }
            }

            // Check for MFA
            if ((lowerLine.includes('mfa') || lowerLine.includes('two-factor') || lowerLine.includes('2fa'))
                && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.mfaEnabled = true;
            }

            // Check for WAN management
            if (lowerLine.includes('wan') && lowerLine.includes('management')
                && (lowerLine.includes('enable') || lowerLine.includes('on') || lowerLine.includes('allow'))) {
                settings.wanManagementEnabled = true;
            }

            // Extract HTTPS admin port
            if (lowerLine.includes('https') && lowerLine.includes('admin') && lowerLine.includes('port')) {
                const port = this.extractValue(line, /port\s+(\d+)/i);
                if (port) {
                    settings.httpsAdminPort = parseInt(port, 10);
                }
            }

            // Check for SSH
            if (lowerLine.includes('ssh') && (lowerLine.includes('enable') || lowerLine.includes('on'))) {
                settings.sshEnabled = true;
            }
        }

        return settings;
    }

    /**
     * Extract interface configurations from configuration
     * Requirements: 6.8
     */
    private extractInterfaces(lines: string[]): InterfaceConfig[] {
        const interfaces: InterfaceConfig[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match interface configuration patterns
            if (line.includes('interface') && (line.includes('X') || line.includes('eth') || /interface\s+\w+\s+zone/i.test(line))) {
                const iface = this.parseInterface(line, lines, i);
                if (iface) {
                    interfaces.push(iface);
                }
            }
        }

        return interfaces;
    }

    /**
     * Parse a single interface configuration
     */
    private parseInterface(line: string, lines: string[], index: number): InterfaceConfig | null {
        try {
            const interfaceName = this.extractValue(line, /interface\s+(\S+)/i) || 'unknown';
            const zone = this.extractValue(line, /zone\s+(\S+)|security-zone\s+(\S+)/i) || 'any';
            const ipAddress = this.extractValue(line, /ip\s+(\S+)|address\s+(\S+)/i) || '0.0.0.0';
            const dhcpServerEnabled = line.toLowerCase().includes('dhcp') &&
                (line.toLowerCase().includes('server') || line.toLowerCase().includes('enable'));

            return {
                interfaceName,
                zone,
                ipAddress,
                dhcpServerEnabled,
            };
        } catch (error) {
            console.warn('Failed to parse interface:', error);
            return null;
        }
    }

    /**
     * Extract VPN configurations from configuration
     * Requirements: 6.9
     */
    private extractVPNConfigs(lines: string[]): VPNConfig[] {
        const configs: VPNConfig[] = [];

        for (const line of lines) {
            // Match VPN configuration patterns
            if (line.includes('vpn') && (line.includes('policy') || line.includes('tunnel'))) {
                const config = this.parseVPNConfig(line);
                if (config) {
                    configs.push(config);
                }
            }
        }

        return configs;
    }

    /**
     * Parse a single VPN configuration
     */
    private parseVPNConfig(line: string): VPNConfig | null {
        try {
            const policyName = this.extractValue(line, /name\s+"([^"]+)"|name\s+(\S+)|policy\s+"([^"]+)"|policy\s+(\S+)/i) || 'unknown';
            const encryption = this.extractValue(line, /encryption\s+(\S+)|cipher\s+(\S+)/i) || 'unknown';
            const authenticationMethod = this.extractValue(line, /auth\s+(\S+)|authentication\s+(\S+)/i) || 'unknown';

            return {
                policyName,
                encryption,
                authenticationMethod,
            };
        } catch (error) {
            console.warn('Failed to parse VPN config:', error);
            return null;
        }
    }

    /**
     * Extract system settings from configuration
     * Requirements: 6.10
     */
    private extractSystemSettings(lines: string[]): SystemSettings {
        const settings: SystemSettings = {
            firmwareVersion: 'unknown',
            hostname: 'unknown',
            timezone: 'UTC',
            ntpServers: [],
            dnsServers: [],
        };

        for (const line of lines) {
            const lowerLine = line.toLowerCase();

            // Extract firmware version
            if (lowerLine.includes('firmware') && lowerLine.includes('version')) {
                const version = this.extractValue(line, /firmware\s+version\s+(\S+)|version\s+(\S+)/i);
                if (version && version !== 'version') {
                    settings.firmwareVersion = version;
                }
            }

            // Extract hostname (prefer hostname over system-name)
            if (lowerLine.includes('hostname') && !lowerLine.includes('system-name')) {
                const hostname = this.extractValue(line, /hostname\s+"([^"]+)"|hostname\s+(\S+)/i);
                if (hostname) {
                    settings.hostname = hostname;
                }
            } else if (lowerLine.includes('system-name') && settings.hostname === 'unknown') {
                const hostname = this.extractValue(line, /system-name\s+"([^"]+)"|system-name\s+(\S+)/i);
                if (hostname) {
                    settings.hostname = hostname;
                }
            }

            // Extract timezone
            if (lowerLine.includes('timezone') || lowerLine.includes('time-zone')) {
                const timezone = this.extractValue(line, /timezone\s+"([^"]+)"|timezone\s+(\S+)|time-zone\s+"([^"]+)"|time-zone\s+(\S+)/i);
                if (timezone) {
                    settings.timezone = timezone;
                }
            }

            // Extract NTP servers
            if (lowerLine.includes('ntp') && lowerLine.includes('server')) {
                const server = this.extractValue(line, /server\s+(\S+)|ntp-server\s+(\S+)/i);
                if (server && !settings.ntpServers.includes(server)) {
                    settings.ntpServers.push(server);
                }
            }

            // Extract DNS servers
            if ((lowerLine.includes('dns') && lowerLine.includes('server')) || lowerLine.includes('nameserver')) {
                const server = this.extractValue(line, /dns-server\s+(\S+)|nameserver\s+(\S+)|dns\s+server\s+(\S+)/i);
                if (server && !settings.dnsServers.includes(server)) {
                    settings.dnsServers.push(server);
                }
            }
        }

        return settings;
    }

    /**
     * Helper method to extract a value from a line using regex
     */
    private extractValue(line: string, pattern: RegExp): string | undefined {
        const match = line.match(pattern);
        if (match) {
            // Return the first non-undefined capture group
            for (let i = 1; i < match.length; i++) {
                if (match[i] !== undefined) {
                    return match[i];
                }
            }
        }
        return undefined;
    }
}

/**
 * RiskEngine class for analyzing configuration and detecting security risks
 * Requirements: 6.11-6.33
 */
export class RiskEngine {
    /**
     * Analyze a parsed configuration and detect all security risks
     * @param config - Parsed configuration object
     * @returns Array of detected configuration risks
     */
    analyzeConfig(config: ParsedConfig): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Network misconfiguration risks
        risks.push(...this.detectWANtoLANAnyRules(config.rules));
        risks.push(...this.detectAnyToAnyRules(config.rules));
        risks.push(...this.detectGuestNotIsolated(config.rules));
        risks.push(...this.detectDHCPOnWAN(config.interfaces));

        // Admin configuration risks
        risks.push(...this.detectWANManagementEnabled(config.adminSettings));
        risks.push(...this.detectMFADisabled(config.adminSettings));
        risks.push(...this.detectDefaultAdminUsername(config.adminSettings));
        risks.push(...this.detectDefaultAdminPort(config.adminSettings));
        risks.push(...this.detectSSHOnWAN(config.adminSettings, config.interfaces));

        // Security feature risks
        risks.push(...this.detectIPSDisabled(config.securitySettings));
        risks.push(...this.detectGAVDisabled(config.securitySettings));
        risks.push(...this.detectDPISSLDisabled(config.securitySettings));
        risks.push(...this.detectBotnetFilterDisabled(config.securitySettings));
        risks.push(...this.detectAppControlDisabled(config.securitySettings));
        risks.push(...this.detectContentFilterDisabled(config.securitySettings));

        // VPN configuration risks
        risks.push(...this.detectWeakVPNEncryption(config.vpnConfigs));
        risks.push(...this.detectVPNPSKOnly(config.vpnConfigs));

        // Best practice violations
        risks.push(...this.detectMissingRuleDescriptions(config.rules));
        risks.push(...this.detectOutdatedFirmware(config.systemSettings));
        risks.push(...this.detectMissingNTP(config.systemSettings));

        return risks;
    }

    /**
     * Calculate risk score based on detected risks
     * Base score: 100
     * Deductions: critical=-25, high=-15, medium=-5, low=-1
     * Min: 0, Max: 100
     * Requirements: 6.34-6.36
     */
    calculateRiskScore(risks: ConfigRisk[]): number {
        let score = 100;

        for (const risk of risks) {
            switch (risk.severity) {
                case 'critical':
                    score -= 25;
                    break;
                case 'high':
                    score -= 15;
                    break;
                case 'medium':
                    score -= 5;
                    break;
                case 'low':
                    score -= 1;
                    break;
            }
        }

        // Enforce min/max bounds
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Detect WAN-to-LAN any rules (CRITICAL risk)
     * Requirements: 6.14
     * 
     * WHEN any firewall rule has action "allow" AND source zone is "WAN" AND 
     * destination zone is "LAN" AND destination address is "any", 
     * THE System SHALL create risk: risk_type="OPEN_INBOUND", 
     * category="exposure_risk", severity="critical", 
     * description="Unrestricted WAN to LAN access rule detected"
     */
    detectWANtoLANAnyRules(rules: FirewallRule[]): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        for (const rule of rules) {
            // Check if rule matches the dangerous pattern:
            // - Action is "allow"
            // - Source zone is "WAN" (case-insensitive)
            // - Destination zone is "LAN" (case-insensitive)
            // - Destination address is "any" (case-insensitive)
            const isAllow = rule.action === 'allow';
            const isFromWAN = rule.sourceZone.toLowerCase() === 'wan';
            const isToLAN = rule.destinationZone.toLowerCase() === 'lan';
            const isDestAny = rule.destinationAddress.toLowerCase() === 'any';

            if (isAllow && isFromWAN && isToLAN && isDestAny) {
                risks.push({
                    riskCategory: 'exposure_risk',
                    riskType: 'OPEN_INBOUND',
                    severity: 'critical',
                    description: 'Unrestricted WAN to LAN access rule detected',
                    remediation: 'Restrict the destination address to specific hosts or networks. Never allow unrestricted access from WAN to LAN.',
                });
            }
        }

        return risks;
    }

    /**
     * Detect any-to-any rules (HIGH risk)
     * Requirements: 6.15
     * 
     * WHEN any firewall rule has source address "any" AND destination address "any" 
     * AND action "allow", THE System SHALL create risk: risk_type="ANY_ANY_RULE", 
     * category="network_misconfiguration", severity="high", 
     * description="Overly permissive any-to-any rule detected"
     */
    detectAnyToAnyRules(rules: FirewallRule[]): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        for (const rule of rules) {
            // Check if rule matches the overly permissive pattern:
            // - Action is "allow"
            // - Source address is "any" (case-insensitive)
            // - Destination address is "any" (case-insensitive)
            const isAllow = rule.action === 'allow';
            const isSourceAny = rule.sourceAddress.toLowerCase() === 'any';
            const isDestAny = rule.destinationAddress.toLowerCase() === 'any';

            if (isAllow && isSourceAny && isDestAny) {
                risks.push({
                    riskCategory: 'network_misconfiguration',
                    riskType: 'ANY_ANY_RULE',
                    severity: 'high',
                    description: 'Overly permissive any-to-any rule detected',
                    remediation: 'Replace any-to-any rules with specific source/destination rules. Follow principle of least privilege.',
                });
            }
        }

        return risks;
    }

    /**
     * Detect Guest zone routing to LAN (HIGH risk)
     * Requirements: 6.30
     * 
     * WHEN GUEST zone has route to LAN zone, THE System SHALL create risk: 
     * risk_type="GUEST_NOT_ISOLATED", category="network_misconfiguration", 
     * severity="high", description="Guest network not properly isolated from LAN"
     */
    detectGuestNotIsolated(rules: FirewallRule[]): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        for (const rule of rules) {
            // Check if rule allows traffic from GUEST zone to LAN zone:
            // - Action is "allow"
            // - Source zone is "GUEST" (case-insensitive)
            // - Destination zone is "LAN" (case-insensitive)
            const isAllow = rule.action === 'allow';
            const isFromGuest = rule.sourceZone.toLowerCase() === 'guest';
            const isToLAN = rule.destinationZone.toLowerCase() === 'lan';

            if (isAllow && isFromGuest && isToLAN) {
                risks.push({
                    riskCategory: 'network_misconfiguration',
                    riskType: 'GUEST_NOT_ISOLATED',
                    severity: 'high',
                    description: 'Guest network not properly isolated from LAN',
                    remediation: 'Remove or deny rules that allow Guest zone to access LAN zone. Guest networks should only have internet access.',
                });
            }
        }

        return risks;
    }

    /**
     * Detect DHCP server on WAN interface (CRITICAL risk)
     * Requirements: 6.31
     * 
     * WHEN interface has DHCP server enabled on WAN, THE System SHALL create risk: 
     * risk_type="DHCP_ON_WAN", category="network_misconfiguration", 
     * severity="critical", description="DHCP server enabled on WAN interface"
     */
    detectDHCPOnWAN(interfaces: InterfaceConfig[]): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        for (const iface of interfaces) {
            // Check if interface has DHCP server enabled on WAN zone:
            // - Zone is "WAN" (case-insensitive)
            // - DHCP server is enabled
            const isWAN = iface.zone.toLowerCase() === 'wan';
            const hasDHCP = iface.dhcpServerEnabled === true;

            if (isWAN && hasDHCP) {
                risks.push({
                    riskCategory: 'network_misconfiguration',
                    riskType: 'DHCP_ON_WAN',
                    severity: 'critical',
                    description: 'DHCP server enabled on WAN interface',
                    remediation: 'Disable DHCP server on WAN interface. DHCP should only be enabled on internal networks (LAN, DMZ). Running DHCP on WAN can cause network conflicts and security issues.',
                });
            }
        }

        return risks;
    }

    /**
     * Detect WAN management enabled (CRITICAL risk)
     * Requirements: 6.16
     * 
     * WHEN WAN management is enabled, THE System SHALL create risk: 
     * risk_type="WAN_MANAGEMENT_ENABLED", category="exposure_risk", 
     * severity="critical", description="WAN management access enabled - exposes admin interface to internet"
     */
    detectWANManagementEnabled(adminSettings: AdminSettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if WAN management is enabled
        if (adminSettings.wanManagementEnabled) {
            risks.push({
                riskCategory: 'exposure_risk',
                riskType: 'WAN_MANAGEMENT_ENABLED',
                severity: 'critical',
                description: 'WAN management access enabled - exposes admin interface to internet',
                remediation: 'Disable WAN management access immediately. Admin interfaces should only be accessible from trusted internal networks. Use VPN for remote management instead.',
            });
        }

        return risks;
    }

    /**
     * Detect MFA disabled for admin accounts (HIGH risk)
     * Requirements: 6.17
     * 
     * WHEN admin MFA is disabled, THE System SHALL create risk: 
     * risk_type="ADMIN_NO_MFA", category="best_practice_violation", 
     * severity="high", description="Multi-factor authentication not enabled for admin accounts"
     */
    detectMFADisabled(adminSettings: AdminSettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if MFA is disabled
        if (!adminSettings.mfaEnabled) {
            risks.push({
                riskCategory: 'best_practice_violation',
                riskType: 'ADMIN_NO_MFA',
                severity: 'high',
                description: 'Multi-factor authentication not enabled for admin accounts',
                remediation: 'Enable multi-factor authentication (MFA) for all admin accounts. MFA significantly reduces the risk of unauthorized access even if passwords are compromised.',
            });
        }

        return risks;
    }

    /**
     * Detect default admin username (MEDIUM risk)
     * Requirements: 6.18
     * 
     * WHEN default admin username exists (admin, root, administrator), 
     * THE System SHALL create risk: risk_type="DEFAULT_ADMIN_USERNAME", 
     * category="best_practice_violation", severity="medium", 
     * description="Default admin username detected - should be renamed"
     */
    detectDefaultAdminUsername(adminSettings: AdminSettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // List of default admin usernames to check for (case-insensitive)
        const defaultUsernames = ['admin', 'root', 'administrator'];

        // Check if any admin username matches a default username
        for (const username of adminSettings.adminUsernames) {
            const lowerUsername = username.toLowerCase();
            if (defaultUsernames.includes(lowerUsername)) {
                risks.push({
                    riskCategory: 'best_practice_violation',
                    riskType: 'DEFAULT_ADMIN_USERNAME',
                    severity: 'medium',
                    description: 'Default admin username detected - should be renamed',
                    remediation: `Rename the default admin username "${username}" to a unique, non-obvious username. Default usernames are commonly targeted in brute-force attacks.`,
                });
            }
        }

        return risks;
    }

    /**
     * Detect default HTTPS admin port (LOW risk)
     * Requirements: 6.27
     * 
     * WHEN HTTPS admin port is default (443), THE System SHALL create risk: 
     * risk_type="DEFAULT_ADMIN_PORT", category="best_practice_violation", 
     * severity="low", description="Default HTTPS admin port in use - consider changing"
     */
    detectDefaultAdminPort(adminSettings: AdminSettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if HTTPS admin port is set to default (443)
        if (adminSettings.httpsAdminPort === 443) {
            risks.push({
                riskCategory: 'best_practice_violation',
                riskType: 'DEFAULT_ADMIN_PORT',
                severity: 'low',
                description: 'Default HTTPS admin port in use - consider changing',
                remediation: 'Change the HTTPS admin port from the default 443 to a non-standard port (e.g., 8443, 4443). This provides security through obscurity and reduces automated scanning attacks.',
            });
        }

        return risks;
    }

    /**
     * Detect SSH enabled on WAN interface (HIGH risk)
     * Requirements: 6.26
     * 
     * WHEN SSH is enabled on WAN interface, THE System SHALL create risk: 
     * risk_type="SSH_ON_WAN", category="exposure_risk", severity="high", 
     * description="SSH management enabled on WAN interface"
     */
    detectSSHOnWAN(adminSettings: AdminSettings, interfaces: InterfaceConfig[]): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if SSH is enabled
        if (!adminSettings.sshEnabled) {
            return risks;
        }

        // Check if there's a WAN interface
        const hasWANInterface = interfaces.some(iface =>
            iface.zone.toLowerCase() === 'wan'
        );

        // If SSH is enabled and there's a WAN interface, create a risk
        if (hasWANInterface) {
            risks.push({
                riskCategory: 'exposure_risk',
                riskType: 'SSH_ON_WAN',
                severity: 'high',
                description: 'SSH management enabled on WAN interface',
                remediation: 'Disable SSH management on WAN interface. SSH should only be accessible from trusted internal networks (LAN). Use VPN for remote management access.',
            });
        }

        return risks;
    }

    /**
     * Detect IPS disabled (CRITICAL risk)
     * Requirements: 6.19
     * 
     * WHEN IPS is disabled, THE System SHALL create risk: 
     * risk_type="IPS_DISABLED", category="security_feature_disabled", 
     * severity="critical", description="Intrusion Prevention System is disabled"
     */
    detectIPSDisabled(securitySettings: SecuritySettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if IPS is disabled
        if (!securitySettings.ipsEnabled) {
            risks.push({
                riskCategory: 'security_feature_disabled',
                riskType: 'IPS_DISABLED',
                severity: 'critical',
                description: 'Intrusion Prevention System is disabled',
                remediation: 'Enable Intrusion Prevention System (IPS) to protect against network-based attacks, exploits, and malicious traffic. IPS is a critical security layer that should always be enabled.',
            });
        }

        return risks;
    }

    /**
     * Detect Gateway Anti-Virus disabled (CRITICAL risk)
     * Requirements: 6.20
     * 
     * WHEN Gateway Anti-Virus is disabled, THE System SHALL create risk: 
     * risk_type="GAV_DISABLED", category="security_feature_disabled", 
     * severity="critical", description="Gateway Anti-Virus is disabled"
     */
    detectGAVDisabled(securitySettings: SecuritySettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if Gateway Anti-Virus is disabled
        if (!securitySettings.gavEnabled) {
            risks.push({
                riskCategory: 'security_feature_disabled',
                riskType: 'GAV_DISABLED',
                severity: 'critical',
                description: 'Gateway Anti-Virus is disabled',
                remediation: 'Enable Gateway Anti-Virus (GAV) to protect against viruses, malware, and other malicious content at the network gateway. GAV is a critical security layer that should always be enabled.',
            });
        }

        return risks;
    }

    /**
     * Detect DPI-SSL disabled (MEDIUM risk)
     * Requirements: 6.21
     * 
     * WHEN DPI-SSL is disabled, THE System SHALL create risk: 
     * risk_type="DPI_SSL_DISABLED", category="security_feature_disabled", 
     * severity="medium", description="DPI-SSL is disabled - encrypted traffic not inspected"
     */
    detectDPISSLDisabled(securitySettings: SecuritySettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if DPI-SSL is disabled
        if (!securitySettings.dpiSslEnabled) {
            risks.push({
                riskCategory: 'security_feature_disabled',
                riskType: 'DPI_SSL_DISABLED',
                severity: 'medium',
                description: 'DPI-SSL is disabled - encrypted traffic not inspected',
                remediation: 'Enable DPI-SSL (Deep Packet Inspection for SSL/TLS) to inspect encrypted traffic for threats. Without DPI-SSL, malware and attacks can hide in encrypted connections.',
            });
        }

        return risks;
    }

    /**
     * Detect Botnet Filter disabled (HIGH risk)
     * Requirements: 6.22
     * 
     * WHEN Botnet Filter is disabled, THE System SHALL create risk: 
     * risk_type="BOTNET_FILTER_DISABLED", category="security_feature_disabled", 
     * severity="high", description="Botnet Filter is disabled"
     */
    detectBotnetFilterDisabled(securitySettings: SecuritySettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if Botnet Filter is disabled
        if (!securitySettings.botnetFilterEnabled) {
            risks.push({
                riskCategory: 'security_feature_disabled',
                riskType: 'BOTNET_FILTER_DISABLED',
                severity: 'high',
                description: 'Botnet Filter is disabled',
                remediation: 'Enable Botnet Filter to protect against botnet command-and-control traffic, infected hosts, and malicious domains. Botnet Filter helps prevent compromised devices from communicating with attackers.',
            });
        }

        return risks;
    }

    /**
     * Detect Application Control disabled (MEDIUM risk)
     * Requirements: 6.23
     * 
     * WHEN Application Control is disabled, THE System SHALL create risk: 
     * risk_type="APP_CONTROL_DISABLED", category="security_feature_disabled", 
     * severity="medium", description="Application Control is disabled"
     */
    detectAppControlDisabled(securitySettings: SecuritySettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if Application Control is disabled
        if (!securitySettings.appControlEnabled) {
            risks.push({
                riskCategory: 'security_feature_disabled',
                riskType: 'APP_CONTROL_DISABLED',
                severity: 'medium',
                description: 'Application Control is disabled',
                remediation: 'Enable Application Control to monitor and control application usage on the network. Application Control helps prevent unauthorized applications and enforce acceptable use policies.',
            });
        }

        return risks;
    }

    /**
     * Detect Content Filtering disabled (MEDIUM risk)
     * Requirements: 6.24
     * 
     * WHEN Content Filtering is disabled, THE System SHALL create risk: 
     * risk_type="CONTENT_FILTER_DISABLED", category="security_feature_disabled", 
     * severity="medium", description="Content Filtering is disabled"
     */
    detectContentFilterDisabled(securitySettings: SecuritySettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if Content Filtering is disabled
        if (!securitySettings.contentFilterEnabled) {
            risks.push({
                riskCategory: 'security_feature_disabled',
                riskType: 'CONTENT_FILTER_DISABLED',
                severity: 'medium',
                description: 'Content Filtering is disabled',
                remediation: 'Enable Content Filtering to block access to malicious, inappropriate, or policy-violating websites. Content Filtering helps enforce acceptable use policies and protects against web-based threats.',
            });
        }

        return risks;
    }

    /**
     * Detect missing rule descriptions (LOW risk)
     * Requirements: 6.25
     * 
     * WHEN any firewall rule has no description/comment, THE System SHALL create risk: 
     * risk_type="RULE_NO_DESCRIPTION", category="best_practice_violation", 
     * severity="low", description="Firewall rule missing description"
     */
    detectMissingRuleDescriptions(rules: FirewallRule[]): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        for (const rule of rules) {
            // Check if rule has no comment/description
            // A rule is considered to have no description if:
            // - comment is undefined, null, or empty string (after trimming)
            if (!rule.comment || rule.comment.trim() === '') {
                risks.push({
                    riskCategory: 'best_practice_violation',
                    riskType: 'RULE_NO_DESCRIPTION',
                    severity: 'low',
                    description: 'Firewall rule missing description',
                    remediation: `Add a description to firewall rule "${rule.ruleName}" to document its purpose and business justification. Rule descriptions improve maintainability and help with security audits.`,
                });
            }
        }

        return risks;
    }

    /**
     * Detect weak VPN encryption (HIGH risk)
     * Requirements: 6.28
     * 
     * WHEN VPN uses weak encryption (DES, 3DES), THE System SHALL create risk: 
     * risk_type="VPN_WEAK_ENCRYPTION", category="security_feature_disabled", 
     * severity="high", description="VPN using weak encryption algorithm"
     */
    detectWeakVPNEncryption(vpnConfigs: VPNConfig[]): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // List of weak encryption algorithms (case-insensitive)
        const weakEncryption = ['des', '3des'];

        for (const vpn of vpnConfigs) {
            // Check if VPN uses weak encryption
            const encryption = vpn.encryption.toLowerCase();

            if (weakEncryption.includes(encryption)) {
                risks.push({
                    riskCategory: 'security_feature_disabled',
                    riskType: 'VPN_WEAK_ENCRYPTION',
                    severity: 'high',
                    description: 'VPN using weak encryption algorithm',
                    remediation: `VPN policy "${vpn.policyName}" uses weak encryption algorithm "${vpn.encryption}". Upgrade to strong encryption algorithms like AES-256 or AES-128. DES and 3DES are considered cryptographically weak and vulnerable to attacks.`,
                });
            }
        }

        return risks;
    }

    /**
     * Detect VPN using PSK-only authentication (MEDIUM risk)
     * Requirements: 6.29
     * 
     * WHEN VPN uses pre-shared key authentication only, THE System SHALL create risk: 
     * risk_type="VPN_PSK_ONLY", category="best_practice_violation", 
     * severity="medium", description="VPN using PSK only - consider certificate-based authentication"
     */
    detectVPNPSKOnly(vpnConfigs: VPNConfig[]): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // List of PSK-only authentication methods (case-insensitive)
        // Common PSK authentication method identifiers in SonicWall configs
        const pskAuthMethods = ['psk', 'pre-shared-key', 'preshared', 'shared-key', 'shared-secret'];

        for (const vpn of vpnConfigs) {
            // Check if VPN uses PSK-only authentication
            const authMethod = vpn.authenticationMethod.toLowerCase();

            // Check if the authentication method matches any PSK-only pattern
            const isPSKOnly = pskAuthMethods.some(method => authMethod.includes(method));

            // Exclude certificate-based authentication methods
            const isCertBased = authMethod.includes('cert') ||
                authMethod.includes('certificate') ||
                authMethod.includes('rsa') ||
                authMethod.includes('x509');

            if (isPSKOnly && !isCertBased) {
                risks.push({
                    riskCategory: 'best_practice_violation',
                    riskType: 'VPN_PSK_ONLY',
                    severity: 'medium',
                    description: 'VPN using PSK only - consider certificate-based authentication',
                    remediation: `VPN policy "${vpn.policyName}" uses pre-shared key (PSK) authentication only. Consider upgrading to certificate-based authentication for improved security. Certificate-based authentication is more secure and scalable than PSK.`,
                });
            }
        }

        return risks;
    }

    /**
     * Detect outdated firmware (MEDIUM risk)
     * Requirements: 6.32
     * 
     * WHEN firmware version is more than 6 months old, THE System SHALL create risk: 
     * risk_type="OUTDATED_FIRMWARE", category="best_practice_violation", 
     * severity="medium", description="Firmware version outdated - update recommended"
     * 
     * Note: This implementation extracts date information from firmware version strings
     * that contain date patterns (e.g., "7.0.1-5050-2023-06-15" or "SonicOS 7.0.1 (Jun 2023)").
     * If no date is found, it checks against a list of known old firmware versions.
     * For production use, this should be enhanced with a firmware version database
     * that maps version strings to release dates.
     */
    detectOutdatedFirmware(systemSettings: SystemSettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // If firmware version is unknown, we can't determine if it's outdated
        if (!systemSettings.firmwareVersion ||
            systemSettings.firmwareVersion === 'unknown' ||
            systemSettings.firmwareVersion.trim() === '') {
            return risks;
        }

        const firmwareVersion = systemSettings.firmwareVersion;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Try to extract date from firmware version string
        const firmwareDate = this.extractFirmwareDateFromVersion(firmwareVersion);

        if (firmwareDate) {
            // If we found a date in the firmware version, check if it's older than 6 months
            if (firmwareDate < sixMonthsAgo) {
                const monthsOld = Math.floor(
                    (Date.now() - firmwareDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
                );
                risks.push({
                    riskCategory: 'best_practice_violation',
                    riskType: 'OUTDATED_FIRMWARE',
                    severity: 'medium',
                    description: 'Firmware version outdated - update recommended',
                    remediation: `Firmware version "${firmwareVersion}" is approximately ${monthsOld} months old. Update to the latest firmware version to ensure security patches and bug fixes are applied. Outdated firmware may contain known vulnerabilities.`,
                });
            }
        } else {
            // If no date found, check against known old firmware versions
            // This is a simplified approach - in production, use a firmware version database
            const isOldVersion = this.isKnownOldFirmwareVersion(firmwareVersion);

            if (isOldVersion) {
                risks.push({
                    riskCategory: 'best_practice_violation',
                    riskType: 'OUTDATED_FIRMWARE',
                    severity: 'medium',
                    description: 'Firmware version outdated - update recommended',
                    remediation: `Firmware version "${firmwareVersion}" is recognized as an older version. Update to the latest firmware version to ensure security patches and bug fixes are applied. Outdated firmware may contain known vulnerabilities.`,
                });
            }
        }

        return risks;
    }

    /**
     * Extract date from firmware version string
     * Supports various date formats commonly found in firmware versions:
     * - ISO format: 2023-06-15, 2023/06/15
     * - Month-Year: Jun 2023, June 2023, 06-2023
     * - Build dates: 20230615, 230615
     * 
     * @param version - Firmware version string
     * @returns Date object if date found, null otherwise
     */
    private extractFirmwareDateFromVersion(version: string): Date | null {
        // Pattern 1: ISO date format (YYYY-MM-DD or YYYY/MM/DD)
        const isoDatePattern = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
        const isoMatch = version.match(isoDatePattern);
        if (isoMatch) {
            const year = parseInt(isoMatch[1], 10);
            const month = parseInt(isoMatch[2], 10) - 1; // JS months are 0-indexed
            const day = parseInt(isoMatch[3], 10);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        // Pattern 2: Month name and year (e.g., "Jun 2023", "June 2023")
        const monthYearPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i;
        const monthYearMatch = version.match(monthYearPattern);
        if (monthYearMatch) {
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const monthIndex = monthNames.indexOf(monthYearMatch[1].toLowerCase().substring(0, 3));
            const year = parseInt(monthYearMatch[2], 10);
            if (monthIndex !== -1) {
                const date = new Date(year, monthIndex, 1);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }

        // Pattern 3: Numeric month-year (e.g., "06-2023", "06/2023")
        const numericMonthYearPattern = /(\d{1,2})[-/](\d{4})/;
        const numericMonthYearMatch = version.match(numericMonthYearPattern);
        if (numericMonthYearMatch) {
            const month = parseInt(numericMonthYearMatch[1], 10) - 1;
            const year = parseInt(numericMonthYearMatch[2], 10);
            if (month >= 0 && month <= 11) {
                const date = new Date(year, month, 1);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }

        // Pattern 4: Build date format (YYYYMMDD or YYMMDD)
        const buildDatePattern = /(\d{6,8})/;
        const buildDateMatch = version.match(buildDatePattern);
        if (buildDateMatch) {
            const dateStr = buildDateMatch[1];
            let year: number, month: number, day: number;

            if (dateStr.length === 8) {
                // YYYYMMDD
                year = parseInt(dateStr.substring(0, 4), 10);
                month = parseInt(dateStr.substring(4, 6), 10) - 1;
                day = parseInt(dateStr.substring(6, 8), 10);
            } else if (dateStr.length === 6) {
                // YYMMDD - assume 20YY for years
                year = 2000 + parseInt(dateStr.substring(0, 2), 10);
                month = parseInt(dateStr.substring(2, 4), 10) - 1;
                day = parseInt(dateStr.substring(4, 6), 10);
            } else {
                return null;
            }

            // Validate date components
            if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }

        return null;
    }

    /**
     * Check if firmware version is a known old version
     * This is a simplified approach for versions without embedded dates.
     * In production, this should query a firmware version database.
     * 
     * @param version - Firmware version string
     * @returns true if version is known to be old, false otherwise
     */
    private isKnownOldFirmwareVersion(version: string): boolean {
        const versionLower = version.toLowerCase();

        // Known old SonicWall firmware versions (examples - expand as needed)
        // These are versions known to be older than 6 months
        const oldVersionPatterns = [
            /^6\.[0-4]\./,  // SonicOS 6.0-6.4 (older versions)
            /^5\./,         // SonicOS 5.x (very old)
            /^4\./,         // SonicOS 4.x (very old)
            /^3\./,         // SonicOS 3.x (very old)
        ];

        // Check if version matches any old version pattern
        for (const pattern of oldVersionPatterns) {
            if (pattern.test(versionLower)) {
                return true;
            }
        }

        // If version contains "old", "legacy", "deprecated", consider it old
        if (versionLower.includes('old') ||
            versionLower.includes('legacy') ||
            versionLower.includes('deprecated')) {
            return true;
        }

        return false;
    }

    /**
     * Detect missing NTP configuration (LOW risk)
     * Requirements: 6.33
     * 
     * WHEN NTP is not configured, THE System SHALL create risk: 
     * risk_type="NO_NTP", category="best_practice_violation", 
     * severity="low", description="NTP not configured - time synchronization required for accurate logging"
     */
    detectMissingNTP(systemSettings: SystemSettings): ConfigRisk[] {
        const risks: ConfigRisk[] = [];

        // Check if NTP servers array is empty or undefined
        if (!systemSettings.ntpServers || systemSettings.ntpServers.length === 0) {
            risks.push({
                riskCategory: 'best_practice_violation',
                riskType: 'NO_NTP',
                severity: 'low',
                description: 'NTP not configured - time synchronization required for accurate logging',
                remediation: 'Configure NTP (Network Time Protocol) servers to ensure accurate time synchronization. Accurate timestamps are critical for logging, security event correlation, and compliance requirements.',
            });
        }

        return risks;
    }
}

/**
 * Create a new ConfigParser instance
 */
export function createConfigParser(): ConfigParser {
    return new ConfigParser();
}

/**
 * Create a new RiskEngine instance
 */
export function createRiskEngine(): RiskEngine {
    return new RiskEngine();
}
