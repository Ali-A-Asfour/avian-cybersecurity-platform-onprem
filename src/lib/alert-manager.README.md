# Alert Manager

## Overview

The Alert Manager is responsible for managing firewall alerts in the AVIAN platform. It provides functionality for creating, deduplicating, acknowledging, and querying alerts with built-in alert storm detection.

## Features

### 1. Alert Creation (Requirement 12.1)
- Creates alerts from API polling or email sources
- Stores alert metadata including severity, type, and message
- Associates alerts with tenants and devices
- Supports alerts without device association (for email alerts)

### 2. Alert Deduplication (Requirement 12.1, 12.2)
- Prevents duplicate alerts within a 2-minute window
- Uses Redis for fast deduplication checks
- Deduplication key based on: tenant_id + device_id + alert_type + severity
- Automatic cleanup via Redis TTL

### 3. Alert Storm Detection (Requirement 12.7)
- Monitors alert frequency per device
- Triggers when > 10 alerts in 5 minutes
- Creates meta-alert "alert_storm_detected"
- Suppresses further alerts for 15 minutes
- Prevents duplicate storm alerts

### 4. Alert Acknowledgment (Requirement 12.5)
- Allows users to acknowledge alerts
- Tracks who acknowledged and when
- Updates alert status in database

### 5. Alert Filtering and Querying (Requirement 12.3, 12.4)
- Filter by tenant (always enforced)
- Filter by device
- Filter by severity (single or multiple)
- Filter by acknowledged status
- Filter by date range
- Pagination support (limit/offset)
- Sorted by timestamp descending

## Usage

### Creating an Alert

```typescript
import { AlertManager, CreateAlertInput } from '@/lib/alert-manager';

const input: CreateAlertInput = {
    tenantId: 'tenant-uuid',
    deviceId: 'device-uuid',
    alertType: 'wan_down',
    severity: 'critical',
    message: 'WAN interface X1 is down',
    source: 'api',
    metadata: {
        interface: 'X1',
        previousStatus: 'up',
        newStatus: 'down',
    },
};

const alertId = await AlertManager.createAlert(input);
// Returns alert ID or null if duplicate/suppressed
```

### Acknowledging an Alert

```typescript
await AlertManager.acknowledgeAlert(alertId, userId);
```

### Querying Alerts

```typescript
import { AlertFilters } from '@/lib/alert-manager';

const filters: AlertFilters = {
    tenantId: 'tenant-uuid',
    deviceId: 'device-uuid', // Optional
    severity: ['critical', 'high'], // Optional, single or array
    acknowledged: false, // Optional
    startDate: new Date('2024-01-01'), // Optional
    endDate: new Date('2024-12-31'), // Optional
    limit: 50, // Optional
    offset: 0, // Optional
};

const alerts = await AlertManager.getAlerts(filters);
```

### Checking for Alert Storm

```typescript
// Called automatically after creating alerts
const isStorm = await AlertManager.checkAlertStorm(deviceId);
// Returns true if storm detected and meta-alert created
```

## Alert Types

Common alert types:
- `wan_down` - WAN interface down
- `vpn_down` - VPN tunnel down
- `ips_counter_increase` - IPS blocks increased
- `gav_counter_increase` - Gateway AV blocks increased
- `license_expiring` - License expiring within 30 days
- `license_expired` - License expired
- `feature_disabled` - Security feature disabled
- `cpu_high` - CPU usage > 80%
- `ram_high` - RAM usage > 90%
- `alert_storm_detected` - Alert storm meta-alert

## Alert Severities

- `critical` - Immediate action required
- `high` - Important, needs attention soon
- `medium` - Moderate priority
- `low` - Informational
- `info` - General information

## Alert Sources

- `api` - Generated from API polling
- `email` - Parsed from email alerts

## Deduplication Logic

Alerts are considered duplicates if they have:
- Same tenant_id
- Same device_id (or both null)
- Same alert_type
- Same severity
- Created within 2 minutes of each other

The deduplication window is configurable via `DEDUP_WINDOW_SECONDS` (default: 120 seconds).

## Alert Storm Detection

Alert storm is triggered when:
1. More than 10 alerts created for same device in 5 minutes
2. Creates a meta-alert with type `alert_storm_detected`
3. Suppresses further alerts for that device for 15 minutes
4. Does not create duplicate storm alerts during suppression

Configuration:
- `STORM_THRESHOLD` = 10 alerts
- `STORM_WINDOW_SECONDS` = 300 seconds (5 minutes)
- `STORM_SUPPRESSION_SECONDS` = 900 seconds (15 minutes)

## Redis Keys

The Alert Manager uses the following Redis key patterns:

- `alert:dedup:{hash}` - Deduplication tracking (TTL: 2 minutes)
- `alert:storm:{deviceId}` - Alert count per device (TTL: 5 minutes)
- `alert:suppress:{deviceId}` - Storm suppression flag (TTL: 15 minutes)

## Error Handling

The Alert Manager implements graceful degradation:
- If Redis is unavailable, deduplication is skipped (fail open)
- If Redis is unavailable, storm detection is skipped (fail open)
- Database errors are logged and re-thrown
- All operations are logged for debugging

## Testing

Comprehensive unit tests are available in `src/lib/__tests__/alert-manager.test.ts`:
- Alert creation with and without device
- Deduplication logic
- Alert storm detection
- Acknowledgment
- Filtering and querying
- Error handling

Run tests:
```bash
npm test -- src/lib/__tests__/alert-manager.test.ts
```

## Integration with Polling Engine

The Alert Manager is designed to be called from the Polling Engine:

```typescript
import { AlertManager } from '@/lib/alert-manager';

// In polling engine, when counter increases
if (newCounters.ipsBlocks > lastCounters.ipsBlocks) {
    await AlertManager.createAlert({
        tenantId: device.tenantId,
        deviceId: device.id,
        alertType: 'ips_counter_increase',
        severity: 'info',
        message: `IPS blocks increased from ${lastCounters.ipsBlocks} to ${newCounters.ipsBlocks}`,
        source: 'api',
        metadata: {
            previousValue: lastCounters.ipsBlocks,
            newValue: newCounters.ipsBlocks,
            counterName: 'ips_blocks',
        },
    });
}
```

## Database Schema

Alerts are stored in the `firewall_alerts` table:

```sql
CREATE TABLE firewall_alerts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    device_id UUID, -- Nullable for email alerts
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(20) NOT NULL,
    metadata JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Performance Considerations

- Redis operations are fast (< 1ms typically)
- Database queries use indexes on tenant_id, device_id, severity, acknowledged, created_at
- Pagination prevents large result sets
- Alert retention is 90 days (automatic cleanup)

## Future Enhancements

Potential improvements for future versions:
- Alert routing rules
- Custom alert thresholds per tenant
- Alert escalation policies
- Webhook notifications
- Email notifications
- SMS notifications
- Alert grouping and correlation
- Machine learning for anomaly detection
