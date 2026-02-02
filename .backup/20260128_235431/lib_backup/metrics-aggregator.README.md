# Metrics Aggregator

## Overview

The `MetricsAggregator` creates daily rollup records at midnight UTC with final counter values from SonicWall firewalls. This provides summary metrics for tracking firewall activity trends without storing detailed logs.

## Requirements

Implements Requirements 9.1-9.8:
- **9.1**: Create rollup at midnight UTC
- **9.2**: Use final cumulative counter values (NOT calculated by summing increments)
- **9.3**: Store final counter values (threats_blocked = IPS + GAV + ATP + Botnet)
- **9.4**: Store bandwidth and session data if available
- **9.5**: Insert into firewall_metrics_rollup table
- **9.6**: Associate with device_id and date
- **9.7**: Display daily trends for 7/30/90 days
- **9.8**: Delete rollups older than 365 days

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Metrics Aggregator                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Cron Job (00:00 UTC Daily)                 │    │
│  │  • Runs at midnight UTC                            │    │
│  │  • Processes all active devices                    │    │
│  │  • Creates rollup for previous day                 │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│                   ▼                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │      Get Final Counter Values from Redis           │    │
│  │  • Retrieve last polling state                     │    │
│  │  • Extract final cumulative counters               │    │
│  │  • NOT calculated by summing increments            │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│                   ▼                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Calculate Metrics                          │    │
│  │  • threats_blocked = IPS + GAV + ATP + Botnet     │    │
│  │  • malware_blocked = GAV blocks                   │    │
│  │  • ips_blocked = IPS blocks                       │    │
│  │  • web_filter_hits = Content filter blocks        │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│                   ▼                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │    Store in firewall_metrics_rollup Table          │    │
│  │  • UPSERT (handle duplicate dates)                │    │
│  │  • Unique constraint: (device_id, date)           │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│                   ▼                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Cleanup Old Records                        │    │
│  │  • Delete rollups > 365 days old                  │    │
│  │  • Runs after daily rollup                        │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Starting the Aggregator

```typescript
import { MetricsAggregator } from '@/lib/metrics-aggregator';

const aggregator = new MetricsAggregator();

// Start daily aggregation at midnight UTC
await aggregator.start();

// Check if running
console.log(aggregator.isAggregating()); // true
```

### Stopping the Aggregator

```typescript
// Stop the aggregator
await aggregator.stop();

console.log(aggregator.isAggregating()); // false
```

### Manual Rollup

For testing or backfilling data:

```typescript
// Run rollup for yesterday (default)
await aggregator.manualRollup();

// Run rollup for specific date
const customDate = new Date('2024-01-15');
await aggregator.manualRollup(customDate);
```

### Aggregate Single Device

```typescript
const deviceId = 'device-123';
const yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
yesterday.setUTCHours(0, 0, 0, 0);

const rollup = await aggregator.aggregateDeviceMetrics(deviceId, yesterday);

console.log(rollup);
// {
//   deviceId: 'device-123',
//   date: Date,
//   threatsBlocked: 200,  // IPS + GAV + ATP + Botnet
//   malwareBlocked: 50,   // GAV blocks
//   ipsBlocked: 100,      // IPS blocks
//   blockedConnections: 0,
//   webFilterHits: 15,    // Content filter blocks
//   bandwidthTotalMb: 0,
//   activeSessionsCount: 0
// }
```

## Data Flow

### 1. Polling Engine Stores Counters

The polling engine stores final counter values in Redis:

```typescript
// From polling-engine.ts
await FirewallPollingStateService.storeState(deviceId, {
    deviceId,
    lastPollTime: new Date(),
    lastCounters: {
        ipsBlocks: 100,      // Final cumulative value from SonicWall
        gavBlocks: 50,       // Final cumulative value from SonicWall
        atpVerdicts: 30,     // Final cumulative value from SonicWall
        botnetBlocks: 20,    // Final cumulative value from SonicWall
        // ... other counters
    },
    // ... other state
});
```

### 2. Aggregator Retrieves Final Values

At midnight UTC, the aggregator retrieves the last polling state:

```typescript
const pollingState = await FirewallPollingStateService.getState(deviceId);
const counters = pollingState.lastCounters;

// Use final cumulative values directly (NOT summing increments)
const threatsBlocked = 
    counters.ipsBlocks +      // 100
    counters.gavBlocks +      // 50
    counters.atpVerdicts +    // 30
    counters.botnetBlocks;    // 20
    // = 200
```

### 3. Store in Database

```typescript
await db.insert(firewallMetricsRollup).values({
    deviceId: 'device-123',
    date: '2024-01-15',
    threatsBlocked: 200,
    malwareBlocked: 50,
    ipsBlocked: 100,
    // ... other metrics
});
```

## Important Notes

### Counter Source

**CRITICAL**: All counters come from SonicWall summary/statistics APIs, NOT from logs.

- ✅ Use final cumulative counter values from API
- ✅ Retrieve from Redis polling state
- ❌ Do NOT sum increments from multiple polls
- ❌ Do NOT derive from raw logs

### Counter Reset Behavior

SonicWall counters reset daily at midnight (device local time). The aggregator:

1. Runs at 00:00 UTC
2. Captures final counter values from previous day
3. Stores these as the daily rollup
4. Counters reset on the device
5. Next day's rollup starts from 0

### Duplicate Handling

The database has a unique constraint on `(device_id, date)`. The aggregator uses UPSERT:

```typescript
.onConflictDoUpdate({
    target: [firewallMetricsRollup.deviceId, firewallMetricsRollup.date],
    set: { /* updated values */ }
});
```

This allows re-running rollups for the same date without errors.

### Missing Data

If no polling state exists for a device:

```typescript
if (!pollingState) {
    // Create rollup with zero values
    const rollup = {
        deviceId,
        date,
        threatsBlocked: 0,
        malwareBlocked: 0,
        // ... all zeros
    };
}
```

## Database Schema

```sql
CREATE TABLE firewall_metrics_rollup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES firewall_devices(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    threats_blocked INTEGER DEFAULT 0,
    malware_blocked INTEGER DEFAULT 0,
    ips_blocked INTEGER DEFAULT 0,
    blocked_connections INTEGER DEFAULT 0,
    web_filter_hits INTEGER DEFAULT 0,
    bandwidth_total_mb BIGINT DEFAULT 0,
    active_sessions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(device_id, date)
);

CREATE INDEX idx_metrics_rollup_device ON firewall_metrics_rollup(device_id, date DESC);
CREATE INDEX idx_metrics_rollup_date ON firewall_metrics_rollup(date DESC);
```

## Retention Policy

Rollup records are retained for **365 days**. The cleanup runs automatically after each daily rollup:

```typescript
// Delete records older than 365 days
const cutoffDate = new Date();
cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 365);

await db
    .delete(firewallMetricsRollup)
    .where(lt(firewallMetricsRollup.date, cutoffDate));
```

## Metrics Calculations

### threats_blocked

Sum of all threat-related blocks:

```typescript
threatsBlocked = 
    counters.ipsBlocks +      // IPS blocks
    counters.gavBlocks +      // Gateway AV blocks
    counters.atpVerdicts +    // ATP verdicts
    counters.botnetBlocks;    // Botnet filter blocks
```

### malware_blocked

Gateway Anti-Virus blocks only:

```typescript
malwareBlocked = counters.gavBlocks;
```

### ips_blocked

Intrusion Prevention System blocks only:

```typescript
ipsBlocked = counters.ipsBlocks;
```

### web_filter_hits

Content filter blocks:

```typescript
webFilterHits = counters.contentFilterBlocks;
```

## Error Handling

### Device Processing Errors

If one device fails, processing continues for other devices:

```typescript
for (const device of devices) {
    try {
        await this.aggregateDeviceMetrics(device.id, yesterday);
        successCount++;
    } catch (error) {
        logger.error(`Failed to aggregate metrics for device ${device.id}`, error);
        errorCount++;
        // Continue to next device
    }
}
```

### Cleanup Errors

Cleanup failures don't stop the rollup process:

```typescript
try {
    await this.cleanupOldMetrics();
} catch (error) {
    logger.error('Failed to cleanup old metrics', error);
    // Don't throw - cleanup failure shouldn't stop rollup
}
```

## Testing

Run tests:

```bash
npm test -- src/lib/__tests__/metrics-aggregator.test.ts
```

Test coverage includes:
- ✅ Start/stop functionality
- ✅ Daily rollup processing
- ✅ Metrics calculation (threats_blocked formula)
- ✅ Missing polling state handling
- ✅ Null counter values
- ✅ Error handling (device failures)
- ✅ Manual rollup
- ✅ Requirements validation (9.2, 9.3)

## Integration

### With Polling Engine

The polling engine stores counter values that the aggregator uses:

```typescript
// polling-engine.ts
await FirewallPollingStateService.storeState(deviceId, {
    lastCounters: {
        ipsBlocks: stats.ips_blocks_today || 0,
        gavBlocks: stats.gav_blocks_today || 0,
        // ... other counters
    }
});

// metrics-aggregator.ts (runs at midnight)
const state = await FirewallPollingStateService.getState(deviceId);
const rollup = {
    threatsBlocked: 
        state.lastCounters.ipsBlocks +
        state.lastCounters.gavBlocks +
        // ...
};
```

### With Dashboard

Dashboard queries rollup data for trends:

```typescript
// Get last 30 days of metrics
const metrics = await db
    .select()
    .from(firewallMetricsRollup)
    .where(
        and(
            eq(firewallMetricsRollup.deviceId, deviceId),
            gte(firewallMetricsRollup.date, thirtyDaysAgo)
        )
    )
    .orderBy(desc(firewallMetricsRollup.date));
```

## Storage Efficiency

Per device per year:
- **365 rollup records** × ~100 bytes = **~36 KB/year**
- Minimal storage compared to log-based approaches
- Efficient queries with date indexes

## Monitoring

Log messages to monitor:

```
INFO: Starting metrics aggregator
INFO: Running daily metrics rollup
INFO: Processing metrics rollup for 10 devices
INFO: Daily metrics rollup completed (success: 10, errors: 0)
INFO: Cleaned up old metrics rollup records (deleted: 5)
```

## Troubleshooting

### No Rollup Records Created

Check:
1. Is aggregator running? `aggregator.isAggregating()`
2. Are devices active? Check `firewall_devices.status = 'active'`
3. Is Redis available? Check polling state storage
4. Check logs for errors

### Incorrect Calculations

Verify:
1. Polling engine is storing counters correctly
2. Counter values are final cumulative values (not increments)
3. Formula: `threats_blocked = IPS + GAV + ATP + Botnet`

### Duplicate Date Errors

Should not occur due to UPSERT, but if it does:
1. Check unique constraint exists: `(device_id, date)`
2. Verify `onConflictDoUpdate` is working
3. Check database migration applied correctly

## Future Enhancements

Potential improvements (post-MVP):

1. **Bandwidth Tracking**: Add bandwidth metrics when available from API
2. **Active Sessions**: Track average active sessions per day
3. **Blocked Connections**: Add total denied connections count
4. **Hourly Rollups**: Add hourly granularity for detailed analysis
5. **Trend Analysis**: Calculate week-over-week, month-over-month changes
6. **Alerting**: Alert on unusual metric patterns (spikes, drops)
7. **Export**: Export rollup data to CSV/JSON for reporting

## Related Files

- `src/lib/metrics-aggregator.ts` - Main implementation
- `src/lib/__tests__/metrics-aggregator.test.ts` - Test suite
- `src/lib/polling-engine.ts` - Stores counter values
- `src/lib/firewall-polling-state.ts` - Redis state management
- `database/schemas/firewall.ts` - Database schema
- `database/migrations/0017_firewall_metrics_rollup.sql` - Migration
