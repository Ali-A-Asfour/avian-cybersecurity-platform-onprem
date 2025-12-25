/**
 * Configurable Threat Detection Rules
 * 
 * This defines what's "important" and should be stored/alerted
 * MSSPs can customize these rules per customer
 */

export interface ThreatRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low';
    shouldStore: boolean;
    shouldAlert: boolean;
    condition: (event: any, context: any) => boolean;
}

export interface ThreatDetectionConfig {
    tenant_id: string;
    rules: ThreatRule[];
    customPorts?: {
        sensitive: number[];      // Ports to always monitor
        allowed: number[];        // Ports to ignore (normal traffic)
    };
    thresholds?: {
        portScanPorts: number;    // How many ports = port scan
        portScanWindow: number;   // Time window in ms
        bruteForceAttempts: number; // How many attempts = brute force
        bruteForceWindow: number;   // Time window in ms
    };
}

/**
 * Default threat detection rules
 * Based on industry best practices and common attack patterns
 */
export const DEFAULT_THREAT_RULES: ThreatRule[] = [

    // ═══════════════════════════════════════════════════════════
    // CRITICAL THREATS (Always store + alert)
    // ═══════════════════════════════════════════════════════════

    {
        id: 'brute-force-ssh',
        name: 'SSH Brute Force Attack',
        description: 'Multiple failed SSH login attempts from same IP',
        enabled: true,
        severity: 'critical',
        shouldStore: true,
        shouldAlert: true,
        condition: (event, context) => {
            return context.bruteForce && event.destination_port === 22;
        }
    },

    {
        id: 'brute-force-rdp',
        name: 'RDP Brute Force Attack',
        description: 'Multiple failed RDP login attempts from same IP',
        enabled: true,
        severity: 'critical',
        shouldStore: true,
        shouldAlert: true,
        condition: (event, context) => {
            return context.bruteForce && event.destination_port === 3389;
        }
    },

    {
        id: 'port-scan',
        name: 'Port Scanning Activity',
        description: 'Single IP scanning multiple ports',
        enabled: true,
        severity: 'high',
        shouldStore: true,
        shouldAlert: true,
        condition: (event, context) => {
            return context.portScan;
        }
    },

    {
        id: 'sql-injection-attempt',
        name: 'SQL Injection Attempt',
        description: 'Blocked attempt to access database ports',
        enabled: true,
        severity: 'high',
        shouldStore: true,
        shouldAlert: true,
        condition: (event, context) => {
            const dbPorts = [1433, 3306, 5432, 27017, 6379, 9200];
            return (event.action === 'deny' || event.action === 'block') &&
                dbPorts.includes(event.destination_port);
        }
    },

    // ═══════════════════════════════════════════════════════════
    // HIGH PRIORITY (Store + maybe alert)
    // ═══════════════════════════════════════════════════════════

    {
        id: 'blocked-ssh',
        name: 'Blocked SSH Access',
        description: 'Blocked SSH connection attempt',
        enabled: true,
        severity: 'medium',
        shouldStore: true,
        shouldAlert: false,
        condition: (event, context) => {
            return (event.action === 'deny' || event.action === 'block') &&
                event.destination_port === 22;
        }
    },

    {
        id: 'blocked-rdp',
        name: 'Blocked RDP Access',
        description: 'Blocked RDP connection attempt',
        enabled: true,
        severity: 'medium',
        shouldStore: true,
        shouldAlert: false,
        condition: (event, context) => {
            return (event.action === 'deny' || event.action === 'block') &&
                event.destination_port === 3389;
        }
    },

    {
        id: 'blocked-smb',
        name: 'Blocked SMB Access',
        description: 'Blocked SMB/file sharing attempt',
        enabled: true,
        severity: 'medium',
        shouldStore: true,
        shouldAlert: false,
        condition: (event, context) => {
            return (event.action === 'deny' || event.action === 'block') &&
                event.destination_port === 445;
        }
    },

    {
        id: 'blocked-telnet',
        name: 'Blocked Telnet Access',
        description: 'Blocked insecure Telnet connection',
        enabled: true,
        severity: 'medium',
        shouldStore: true,
        shouldAlert: false,
        condition: (event, context) => {
            return (event.action === 'deny' || event.action === 'block') &&
                event.destination_port === 23;
        }
    },

    // ═══════════════════════════════════════════════════════════
    // MEDIUM PRIORITY (Store, no alert)
    // ═══════════════════════════════════════════════════════════

    {
        id: 'unusual-port',
        name: 'Unusual Port Access',
        description: 'Traffic to uncommon high ports',
        enabled: true,
        severity: 'low',
        shouldStore: true,
        shouldAlert: false,
        condition: (event, context) => {
            return event.destination_port > 50000;
        }
    },

    {
        id: 'blocked-vpn',
        name: 'Blocked VPN Connection',
        description: 'Blocked VPN protocol attempt',
        enabled: true,
        severity: 'low',
        shouldStore: true,
        shouldAlert: false,
        condition: (event, context) => {
            const vpnPorts = [1194, 1723, 500, 4500]; // OpenVPN, PPTP, IPSec
            return (event.action === 'deny' || event.action === 'block') &&
                vpnPorts.includes(event.destination_port);
        }
    },

    // ═══════════════════════════════════════════════════════════
    // COMPLIANCE (Store for audit trail)
    // ═══════════════════════════════════════════════════════════

    {
        id: 'admin-access',
        name: 'Administrative Access',
        description: 'Any access to admin ports (for compliance)',
        enabled: false, // Disabled by default, enable for HIPAA/PCI-DSS
        severity: 'low',
        shouldStore: true,
        shouldAlert: false,
        condition: (event, context) => {
            const adminPorts = [22, 3389, 5900, 8080, 8443];
            return adminPorts.includes(event.destination_port);
        }
    },

    {
        id: 'external-database-access',
        name: 'External Database Access',
        description: 'Database access from outside network',
        enabled: false, // Enable for healthcare/financial
        severity: 'medium',
        shouldStore: true,
        shouldAlert: true,
        condition: (event, context) => {
            const dbPorts = [1433, 3306, 5432, 27017];
            const isExternal = !event.source_ip.startsWith('192.168.') &&
                !event.source_ip.startsWith('10.') &&
                !event.source_ip.startsWith('172.16.');
            return dbPorts.includes(event.destination_port) && isExternal;
        }
    }
];

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Omit<ThreatDetectionConfig, 'tenant_id'> = {
    rules: DEFAULT_THREAT_RULES,
    customPorts: {
        sensitive: [22, 23, 3389, 445, 1433, 3306, 5432, 27017, 6379, 9200],
        allowed: [80, 443, 53, 123] // HTTP, HTTPS, DNS, NTP
    },
    thresholds: {
        portScanPorts: 10,        // 10+ ports in window = port scan
        portScanWindow: 60000,    // 1 minute
        bruteForceAttempts: 20,   // 20+ attempts in window = brute force
        bruteForceWindow: 300000  // 5 minutes
    }
};

/**
 * Industry-specific configurations
 */
export const INDUSTRY_CONFIGS = {

    // Healthcare (HIPAA)
    healthcare: {
        ...DEFAULT_CONFIG,
        rules: DEFAULT_THREAT_RULES.map(rule => {
            // Enable all compliance rules for healthcare
            if (rule.id === 'admin-access' || rule.id === 'external-database-access') {
                return { ...rule, enabled: true };
            }
            return rule;
        }),
        thresholds: {
            portScanPorts: 5,         // More sensitive
            portScanWindow: 60000,
            bruteForceAttempts: 10,   // More sensitive
            bruteForceWindow: 300000
        }
    },

    // Financial (PCI-DSS)
    financial: {
        ...DEFAULT_CONFIG,
        rules: DEFAULT_THREAT_RULES.map(rule => {
            // Enable all rules and increase severity
            return {
                ...rule,
                enabled: true,
                severity: rule.severity === 'low' ? 'medium' : rule.severity
            };
        }),
        thresholds: {
            portScanPorts: 5,
            portScanWindow: 60000,
            bruteForceAttempts: 10,
            bruteForceWindow: 300000
        }
    },

    // General Business (Relaxed)
    general: {
        ...DEFAULT_CONFIG,
        thresholds: {
            portScanPorts: 20,        // Less sensitive
            portScanWindow: 120000,   // 2 minutes
            bruteForceAttempts: 50,   // Less sensitive
            bruteForceWindow: 600000  // 10 minutes
        }
    },

    // Tech Company (Very Relaxed)
    tech: {
        ...DEFAULT_CONFIG,
        rules: DEFAULT_THREAT_RULES.filter(rule =>
            // Only critical threats
            rule.severity === 'critical' || rule.severity === 'high'
        ),
        thresholds: {
            portScanPorts: 50,
            portScanWindow: 300000,
            bruteForceAttempts: 100,
            bruteForceWindow: 600000
        }
    }
};

/**
 * Rule evaluation engine
 */
export class ThreatRuleEngine {
    private config: ThreatDetectionConfig;

    constructor(config: ThreatDetectionConfig) {
        this.config = config;
    }

    /**
     * Evaluate all rules against an event
     * Returns matched rules
     */
    evaluateEvent(event: any, context: any): ThreatRule[] {
        const matchedRules: ThreatRule[] = [];

        for (const rule of this.config.rules) {
            if (!rule.enabled) continue;

            try {
                if (rule.condition(event, context)) {
                    matchedRules.push(rule);
                }
            } catch {
                console.error(`Error evaluating rule ${rule.id}:`, error);
            }
        }

        return matchedRules;
    }

    /**
     * Determine if event should be stored
     */
    shouldStore(event: any, context: any): boolean {
        const matchedRules = this.evaluateEvent(event, context);
        return matchedRules.some(rule => rule.shouldStore);
    }

    /**
     * Determine if event should trigger alert
     */
    shouldAlert(event: any, context: any): boolean {
        const matchedRules = this.evaluateEvent(event, context);
        return matchedRules.some(rule => rule.shouldAlert);
    }

    /**
     * Get highest severity from matched rules
     */
    getSeverity(event: any, context: any): 'critical' | 'high' | 'medium' | 'low' | null {
        const matchedRules = this.evaluateEvent(event, context);
        if (matchedRules.length === 0) return null;

        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const highestSeverity = matchedRules.reduce((highest, rule) => {
            return severityOrder[rule.severity] > severityOrder[highest.severity] ? rule : highest;
        });

        return highestSeverity.severity;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ThreatDetectionConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Add custom rule
     */
    addRule(rule: ThreatRule): void {
        this.config.rules.push(rule);
    }

    /**
     * Remove rule
     */
    removeRule(ruleId: string): void {
        this.config.rules = this.config.rules.filter(r => r.id !== ruleId);
    }

    /**
     * Enable/disable rule
     */
    toggleRule(ruleId: string, enabled: boolean): void {
        const rule = this.config.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
        }
    }
}

/**
 * Example: Create custom rule
 */
export function createCustomRule(
    id: string,
    name: string,
    description: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    shouldStore: boolean,
    shouldAlert: boolean,
    condition: (event: any, context: any) => boolean
): ThreatRule {
    return {
        id,
        name,
        description,
        enabled: true,
        severity,
        shouldStore,
        shouldAlert,
        condition
    };
}
