# Migration 0013: Firewall Health Snapshots Table

## Overview
This migration creates the `firewall_health_snapshots` table for storing periodic health snapshots of SonicWall firewall devices.

## Purpose
- Store point-in-time health metrics captured every 4-6 hours
- Track CPU, RAM, uptime, and interface status over time
- Enable historical health trend analysis
- Support 90-day retention policy

## Table Structure

### firewall_health_snapshots
Stores periodic health snapshots with the following fields:

**Core Fields:**
- `id` (uuid): Primary key
- `device_id` (uuid): Foreign key to firewall_devices table
- `timestamp` (timestamp): Snapshot creation time

**Health Metrics:**
- `cpu_percent` (float): CPU usage percentage (0-100)
- `ram_percent` (float): RAM usage percentage (0-100)
- `uptime_seconds` (bigint): Device uptime in seconds

**Status Fields:**
- `wan_status` (varchar): WAN interface status (up/down)
- `vpn_status` (varchar): VPN tunnel status (up/down)
- `interface_status` (jsonb): JSON object mapping interface names to status
- `wifi_status` (varchar): WiFi status (on/off/null)
- `ha_status` (varchar): High Availability status (active/standby/failover/standalone/null)

## Indexes
- `idx_health_snapshots_device`: Composite index on (device_id, timestamp DESC) for efficient device queries
- `idx_health_snapshots_timestamp`: Index on timestamp for time-range queries

## Constraints
- Foreign key to `firewall_devices` with CASCADE delete
- Check constraints for valid status values
- Check constraints for percentage ranges (0-100)
- Check constraint for positive uptime values

## Data Retention
- Snapshots older than 90 days should be automatically deleted
- Snapshot frequency: Every 4-6 hours (not every poll)
- Only create snapshots when new data exists since last successful poll

## Usage Examples

### Insert a health snapshot
```sql
INSERT INTO firewall_health_snapshots (
    device_id,
    cpu_percent,
    ram_percent,
    uptime_seconds,
    wan_status,
    vpn_status,
    interface_status,
    wifi_status,
    ha_status
) VALUES (
    'device-uuid-here',
    45.2,
    67.8,
    864000,
    'up',
    'up',
    '{"X0": "up", "X1": "up", "X2": "down", "X3": "up"}'::jsonb,
    'on',
    'active'
);
```

### Query recent snapshots for a device
```sql
SELECT *
FROM firewall_health_snapshots
WHERE device_id = 'device-uuid-here'
  AND timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;
```

### Query snapshots with high CPU usage
```sql
SELECT 
    fhs.*,
    fd.model,
    fd.serial_number
FROM firewall_health_snapshots fhs
JOIN firewall_devices fd ON fhs.device_id = fd.id
WHERE fhs.cpu_percent > 80
  AND fhs.timestamp >= NOW() - INTERVAL '30 days'
ORDER BY fhs.timestamp DESC;
```

### Delete old snapshots (retention policy)
```sql
DELETE FROM firewall_health_snapshots
WHERE timestamp < NOW() - INTERVAL '90 days';
```

## Interface Status JSON Format
The `interface_status` field stores a JSON object mapping interface names to their status:

```json
{
  "X0": "up",
  "X1": "up",
  "X2": "down",
  "X3": "up",
  "X4": "down"
}
```

## Rollback
To rollback this migration:
```sql
DROP TABLE IF EXISTS firewall_health_snapshots CASCADE;
```

## Dependencies
- Requires migration 0012 (firewall_devices table)
- Requires tenants table from initial schema

## Testing
See `test_0013.sql` for test queries and validation.

## Notes
- Snapshots are created every 4-6 hours, NOT on every API poll (30 seconds)
- This reduces storage usage while maintaining useful historical data
- The polling engine checks if 4-6 hours have elapsed before creating a new snapshot
- Snapshots are only created when new data exists since the last successful poll
