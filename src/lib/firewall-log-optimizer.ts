// import { logger } from '@/lib/logger';

export interface FirewallEvent {
    action: string;
    source_ip: string;
    destination_ip: string;
    source_port: number;
    destination_port: number;
    protocol: string;
}

export interface LogStorageDecision {
    shouldStore: boolean;
    storageLevel: 'hot' | 'warm' | 'cold' | 'skip';
    reason: string;
}

export class FirewallLogOptimizer {
    /**
     * Determines if a firewall log should be stored and where
     * This dramatically reduces storage costs by filtering noise
     */
    static shouldStoreLog(event: FirewallEvent): LogStorageDecision {
        // CRITICAL: Always store denied/blocked traffic (security events)
        if (event.action === 'deny' || event.action === 'drop' || event.action === 'block') {
            return {
                shouldStore: true,
                storageLevel: 'hot',
                reason: 'Security event: blocked traffic'
            };
        }

        // CRITICAL: Store attempts to sensitive ports (potential attacks)
        const sensitivePorts = [
            22,    // SSH
            23,    // Telnet
            3389,  // RDP
            445,   // SMB
            1433,  // SQL Server
            3306,  // MySQL
            5432,  // PostgreSQL
            27017, // MongoDB
            6379,  // Redis
            9200,  // Elasticsearch
        ];

        if (sensitivePorts.includes(event.destination_port)) {
            return {
                shouldStore: true,
                storageLevel: 'hot',
                reason: `Access to sensitive port ${event.destination_port}`
            };
        }

        // SKIP: Normal web browsing (allowed HTTP/HTTPS)
        if (event.action === 'allow' && [80, 443].includes(event.destination_port)) {
            return {
                shouldStore: false,
                storageLevel: 'skip',
                reason: 'Normal web traffic'
            };
        }

        // SKIP: Normal DNS queries (allowed)
        if (event.action === 'allow' && event.destination_port === 53) {
            return {
                shouldStore: false,
                storageLevel: 'skip',
                reason: 'Normal DNS traffic'
            };
        }

        // SKIP: Normal NTP (allowed)
        if (event.action === 'allow' && event.destination_port === 123) {
            return {
                shouldStore: false,
                storageLevel: 'skip',
                reason: 'Normal NTP traffic'
            };
        }

        // STORE: Everything else (unusual traffic patterns)
        return {
            shouldStore: true,
            storageLevel: 'warm',
            reason: 'Unusual traffic pattern'
        };
    }

    /**
     * Aggregates repetitive logs to save storage
     * Example: 1,000 identical "allow" logs → 1 aggregated record
     */
    static aggregateLogs(logs: FirewallEvent[], timeWindow: number = 3600000): Map<string, any> {
        const aggregated = new Map<string, any>();

        for (const log of logs) {
            // Create unique key for aggregation
            const key = `${log.source_ip}:${log.destination_ip}:${log.destination_port}:${log.action}`;

            if (aggregated.has(key)) {
                const existing = aggregated.get(key);
                existing.count++;
                existing.last_seen = new Date();
            } else {
                aggregated.set(key, {
                    source_ip: log.source_ip,
                    destination_ip: log.destination_ip,
                    source_port: log.source_port,
                    destination_port: log.destination_port,
                    protocol: log.protocol,
                    action: log.action,
                    count: 1,
                    first_seen: new Date(),
                    last_seen: new Date()
                });
            }
        }

        return aggregated;
    }

    /**
     * Calculates estimated storage costs
     */
    static estimateStorageCost(logsPerDay: number, retentionDays: number): {
        unoptimized: number;
        optimized: number;
        savings: number;
    } {
        const avgLogSize = 150; // bytes per log entry
        const compressionRatio = 0.2; // 80% compression
        const filteringRatio = 0.15; // Keep only 15% of logs

        // Unoptimized: Store everything in RDS
        const unoptimizedGB = (logsPerDay * avgLogSize * retentionDays) / (1024 ** 3);
        const unoptimizedCost = unoptimizedGB * 0.115; // RDS cost per GB

        // Optimized: Filter + compress + tiered storage
        const filteredLogs = logsPerDay * filteringRatio;
        const compressedSize = filteredLogs * avgLogSize * compressionRatio;

        // Hot storage (30 days in RDS)
        const hotGB = (compressedSize * Math.min(30, retentionDays)) / (1024 ** 3);
        const hotCost = hotGB * 0.115;

        // Warm storage (30-90 days in S3)
        const warmDays = Math.max(0, Math.min(60, retentionDays - 30));
        const warmGB = (compressedSize * warmDays) / (1024 ** 3);
        const warmCost = warmGB * 0.023;

        // Cold storage (90+ days in Glacier)
        const coldDays = Math.max(0, retentionDays - 90);
        const coldGB = (compressedSize * coldDays) / (1024 ** 3);
        const coldCost = coldGB * 0.004;

        const optimizedCost = hotCost + warmCost + coldCost;
        const savings = ((unoptimizedCost - optimizedCost) / unoptimizedCost) * 100;

        return {
            unoptimized: parseFloat(unoptimizedCost.toFixed(2)),
            optimized: parseFloat(optimizedCost.toFixed(2)),
            savings: parseFloat(savings.toFixed(1))
        };
    }
}

// Example usage and cost estimates
if (require.main === module) {
    console.log('Firewall Log Storage Cost Estimates:\n');

    const scenarios = [
        { name: 'Small Business (10 users)', logsPerDay: 5000 },
        { name: 'Medium Business (100 users)', logsPerDay: 100000 },
        { name: 'Enterprise (1,000 users)', logsPerDay: 1000000 },
        { name: 'MSSP (100 customers)', logsPerDay: 10000000 }
    ];

    for (const scenario of scenarios) {
        console.log(`${scenario.name}:`);
        console.log(`  Logs per day: ${scenario.logsPerDay.toLocaleString()}`);

        const cost90 = FirewallLogOptimizer.estimateStorageCost(scenario.logsPerDay, 90);
        console.log(`  90-day retention:`);
        console.log(`    Unoptimized: $${cost90.unoptimized}/month`);
        console.log(`    Optimized: $${cost90.optimized}/month`);
        console.log(`    Savings: ${cost90.savings}%`);

        const cost365 = FirewallLogOptimizer.estimateStorageCost(scenario.logsPerDay, 365);
        console.log(`  1-year retention:`);
        console.log(`    Unoptimized: $${cost365.unoptimized}/month`);
        console.log(`    Optimized: $${cost365.optimized}/month`);
        console.log(`    Savings: ${cost365.savings}%\n`);
    }
}
