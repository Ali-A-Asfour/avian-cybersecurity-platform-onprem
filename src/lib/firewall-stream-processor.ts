// import { logger } from '@/lib/logger';
import { FirewallEvent } from '@/lib/firewall-log-optimizer';

/**
 * Real-time firewall log stream processor
 * Analyzes logs in memory and only stores what matters
 * Dramatically reduces storage costs by not storing normal traffic
 */

export interface ThreatDetection {
    type: 'port_scan' | 'brute_force' | 'suspicious_traffic' | 'blocked_threat';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    shouldStore: boolean;
    shouldAlert: boolean;
}

export interface TrafficMetrics {
    tenant_id: string;
    timestamp: Date;
    total_connections: number;
    blocked_connections: number;
    allowed_connections: number;
    unique_source_ips: Set<string>;
    unique_destination_ips: Set<string>;
    top_blocked_ports: Map<number, number>;
    suspicious_activity_count: number;
}

export class FirewallStreamProcessor {
    private metricsCache: Map<string, TrafficMetrics> = new Map();
    private recentEvents: Map<string, any[]> = new Map(); // For pattern detection
    private readonly METRICS_FLUSH_INTERVAL = 60000; // 1 minute
    private readonly PATTERN_WINDOW = 300000; // 5 minutes

    constructor() {
        // Periodically flush metrics to database
        setInterval(() => this.flushMetrics(), this.METRICS_FLUSH_INTERVAL);

        // Clean up old events from memory
        setInterval(() => this.cleanupOldEvents(), this.PATTERN_WINDOW);
    }

    /**
     * Process a firewall log in real-time
     * Returns decision on whether to store it
     */
    async processLog(
        tenantId: string,
        event: FirewallEvent,
        timestamp: Date = new Date()
    ): Promise<{ shouldStore: boolean; threat?: ThreatDetection }> {

        // Update real-time metrics (in memory, not stored)
        this.updateMetrics(tenantId, event, timestamp);

        // Detect threats and suspicious patterns
        const threat = await this.detectThreats(tenantId, event, timestamp);

        // Only store if it's a threat or important event
        if (threat) {
            return { shouldStore: threat.shouldStore, threat };
        }

        // Normal traffic - don't store, just count it
        return { shouldStore: false };
    }

    /**
     * Update in-memory metrics (not stored in database)
     */
    private updateMetrics(tenantId: string, event: FirewallEvent, timestamp: Date): void {
        const key = `${tenantId}:${this.getMetricsBucket(timestamp)}`;

        if (!this.metricsCache.has(key)) {
            this.metricsCache.set(key, {
                tenant_id: tenantId,
                timestamp: this.getMetricsBucket(timestamp),
                total_connections: 0,
                blocked_connections: 0,
                allowed_connections: 0,
                unique_source_ips: new Set(),
                unique_destination_ips: new Set(),
                top_blocked_ports: new Map(),
                suspicious_activity_count: 0
            });
        }

        const metrics = this.metricsCache.get(key)!;
        metrics.total_connections++;

        if (event.action === 'deny' || event.action === 'block') {
            metrics.blocked_connections++;
            const portCount = metrics.top_blocked_ports.get(event.destination_port) || 0;
            metrics.top_blocked_ports.set(event.destination_port, portCount + 1);
        } else {
            metrics.allowed_connections++;
        }

        metrics.unique_source_ips.add(event.source_ip);
        metrics.unique_destination_ips.add(event.destination_ip);
    }

    /**
     * Detect threats and suspicious patterns in real-time
     */
    private async detectThreats(
        tenantId: string,
        event: FirewallEvent,
        timestamp: Date
    ): Promise<ThreatDetection | null> {

        // Track recent events for pattern detection
        const eventKey = `${tenantId}:${event.source_ip}`;
        if (!this.recentEvents.has(eventKey)) {
            this.recentEvents.set(eventKey, []);
        }
        this.recentEvents.get(eventKey)!.push({ event, timestamp });

        // 1. PORT SCAN DETECTION
        const portScan = this.detectPortScan(tenantId, event.source_ip);
        if (portScan) {
            return {
                type: 'port_scan',
                severity: 'high',
                description: `Port scan detected from ${event.source_ip}: ${portScan.portsScanned} ports in ${portScan.timeWindow}ms`,
                shouldStore: true,
                shouldAlert: true
            };
        }

        // 2. BRUTE FORCE DETECTION
        const bruteForce = this.detectBruteForce(tenantId, event);
        if (bruteForce) {
            return {
                type: 'brute_force',
                severity: 'critical',
                description: `Brute force attack detected on port ${event.destination_port} from ${event.source_ip}: ${bruteForce.attempts} attempts`,
                shouldStore: true,
                shouldAlert: true
            };
        }

        // 3. BLOCKED THREAT (Store all blocked traffic to sensitive ports)
        if ((event.action === 'deny' || event.action === 'block') && this.isSensitivePort(event.destination_port)) {
            return {
                type: 'blocked_threat',
                severity: 'medium',
                description: `Blocked access attempt to sensitive port ${event.destination_port} from ${event.source_ip}`,
                shouldStore: true,
                shouldAlert: false
            };
        }

        // 4. SUSPICIOUS TRAFFIC (Unusual patterns)
        if (this.isSuspiciousTraffic(event)) {
            return {
                type: 'suspicious_traffic',
                severity: 'low',
                description: `Suspicious traffic pattern detected: ${event.source_ip} → ${event.destination_ip}:${event.destination_port}`,
                shouldStore: true,
                shouldAlert: false
            };
        }

        // Normal traffic - don't store
        return null;
    }

    /**
     * Detect port scanning (multiple ports from same IP in short time)
     */
    private detectPortScan(tenantId: string, sourceIp: string): { portsScanned: number; timeWindow: number } | null {
        const eventKey = `${tenantId}:${sourceIp}`;
        const events = this.recentEvents.get(eventKey) || [];

        if (events.length < 10) return null;

        const recentEvents = events.filter(e =>
            Date.now() - e.timestamp.getTime() < 60000 // Last 1 minute
        );

        const uniquePorts = new Set(recentEvents.map(e => e.event.destination_port));

        // If same IP tried 10+ different ports in 1 minute = port scan
        if (uniquePorts.size >= 10) {
            const timeWindow = recentEvents[recentEvents.length - 1].timestamp.getTime() - recentEvents[0].timestamp.getTime();
            return { portsScanned: uniquePorts.size, timeWindow };
        }

        return null;
    }

    /**
     * Detect brute force attacks (repeated attempts to same port)
     */
    private detectBruteForce(tenantId: string, event: FirewallEvent): { attempts: number } | null {
        const eventKey = `${tenantId}:${event.source_ip}`;
        const events = this.recentEvents.get(eventKey) || [];

        const recentAttempts = events.filter(e =>
            Date.now() - e.timestamp.getTime() < 300000 && // Last 5 minutes
            e.event.destination_port === event.destination_port &&
            (e.event.action === 'deny' || e.event.action === 'block')
        );

        // If same IP tried same port 20+ times in 5 minutes = brute force
        if (recentAttempts.length >= 20) {
            return { attempts: recentAttempts.length };
        }

        return null;
    }

    /**
     * Check if port is sensitive (SSH, RDP, databases, etc.)
     */
    private isSensitivePort(port: number): boolean {
        const sensitivePorts = [
            22, 23, 3389, 445, 1433, 3306, 5432, 27017, 6379, 9200,
            5900, 5901, 8080, 8443, 9090, 10000
        ];
        return sensitivePorts.includes(port);
    }

    /**
     * Detect suspicious traffic patterns
     */
    private isSuspiciousTraffic(event: FirewallEvent): boolean {
        // Traffic to unusual high ports
        if (event.destination_port > 50000) return true;

        // Traffic from private IPs to private IPs (potential lateral movement)
        if (this.isPrivateIP(event.source_ip) && this.isPrivateIP(event.destination_ip)) {
            return false; // Actually normal for internal networks
        }

        return false;
    }

    /**
     * Check if IP is private
     */
    private isPrivateIP(_ip: string): boolean {
        return ip.startsWith('10.') ||
            ip.startsWith('172.16.') ||
            ip.startsWith('192.168.');
    }

    /**
     * Get metrics bucket (round to nearest minute)
     */
    private getMetricsBucket(timestamp: Date): Date {
        const bucket = new Date(timestamp);
        bucket.setSeconds(0, 0);
        return bucket;
    }

    /**
     * Flush aggregated metrics to database (only summaries, not individual logs)
     */
    private async flushMetrics(): Promise<void> {
        try {
            for (const [key, metrics] of this.metricsCache.entries()) {
                // Store only the aggregated metrics, not individual logs
                await this.storeMetrics({
                    tenant_id: metrics.tenant_id,
                    timestamp: metrics.timestamp,
                    total_connections: metrics.total_connections,
                    blocked_connections: metrics.blocked_connections,
                    allowed_connections: metrics.allowed_connections,
                    unique_source_ips: metrics.unique_source_ips.size,
                    unique_destination_ips: metrics.unique_destination_ips.size,
                    top_blocked_ports: Array.from(metrics.top_blocked_ports.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([port, count]) => ({ port, count })),
                    suspicious_activity_count: metrics.suspicious_activity_count
                });
            }

            // Clear cache after flushing
            this.metricsCache.clear();

            logger.info('Flushed firewall metrics', {
                metricsCount: this.metricsCache.size
            });
        } catch (error) {
            logger.error('Failed to flush firewall metrics', { error });
        }
    }

    /**
     * Store aggregated metrics (much smaller than individual logs)
     */
    private async storeMetrics(metrics: any): Promise<void> {
        // TODO: Store in database
        // This is just a summary, not individual logs
        // Example: 100,000 logs → 1 metrics record per minute
        logger.debug('Storing firewall metrics', { metrics });
    }

    /**
     * Clean up old events from memory
     */
    private cleanupOldEvents(): void {
        const cutoff = Date.now() - this.PATTERN_WINDOW;

        for (const [key, events] of this.recentEvents.entries()) {
            const recentEvents = events.filter(e => e.timestamp.getTime() > cutoff);

            if (recentEvents.length === 0) {
                this.recentEvents.delete(key);
            } else {
                this.recentEvents.set(key, recentEvents);
            }
        }
    }

    /**
     * Get current metrics for a tenant (for real-time dashboard)
     */
    getRealtimeMetrics(_tenantId: string): any {
        const metrics = Array.from(this.metricsCache.values())
            .filter(m => m.tenant_id === tenantId);

        return {
            total_connections: metrics.reduce((sum, m) => sum + m.total_connections, 0),
            blocked_connections: metrics.reduce((sum, m) => sum + m.blocked_connections, 0),
            allowed_connections: metrics.reduce((sum, m) => sum + m.allowed_connections, 0),
            unique_source_ips: new Set(metrics.flatMap(m => Array.from(m.unique_source_ips))).size,
            suspicious_activity_count: metrics.reduce((sum, m) => sum + m.suspicious_activity_count, 0)
        };
    }
}

// Singleton instance
export const firewallStreamProcessor = new FirewallStreamProcessor();
