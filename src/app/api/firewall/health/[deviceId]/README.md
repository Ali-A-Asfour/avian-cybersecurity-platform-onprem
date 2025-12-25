# GET /api/firewall/health/:deviceId

## Overview
Retrieves health snapshots for a specific firewall device with optional date range filtering.

## Requirements
- **Requirement 15.6**: Posture and Health API
- **Requirement 3.1-3.8**: Health Snapshot Collection

## Endpoint
```
GET /api/firewall/health/:deviceId
```

## Authentication
- Requires valid JWT token
- Enforces tenant isolation (users can only access devices from their tenant)
- Super admins can access devices from any tenant

## Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceId | UUID | Yes | Unique identifier of the firewall device |

## Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startDate | ISO 8601 Date | No | null | Filter snapshots >= this date |
| endDate | ISO 8601 Date | No | null | Filter snapshots <= this date |
| limit | Integer | No | 100 | Maximum number of snapshots to return (max: 1000) |

## Request Examples

### Get all recent snapshots (default limit: 100)
```bash
GET /api/firewall/health/550e8400-e29b-41d4-a716-446655440000
```

### Get snapshots from a specific date onwards
```bash
GET /api/firewall/health/550e8400-e29b-41d4-a716-446655440000?startDate=2024-01-01T00:00:00Z
```

### Get snapshots within a date range
```bash
GET /api/firewall/health/550e8400-e29b-41d4-a716-446655440000?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
```

### Get last 10 snapshots
```bash
GET /api/firewall/health/550e8400-e29b-41d4-a716-446655440000?limit=10
```

### Combine filters
```bash
GET /api/firewall/health/550e8400-e29b-41d4-a716-446655440000?startDate=2024-01-15T00:00:00Z&endDate=2024-01-20T23:59:59Z&limit=50
```

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "snapshots": [
      {
        "id": "snapshot-uuid-1",
        "deviceId": "550e8400-e29b-41d4-a716-446655440000",
        "cpuPercent": 45.5,
        "ramPercent": 60.2,
        "uptimeSeconds": 86400,
        "wanStatus": "up",
        "vpnStatus": "up",
        "interfaceStatus": {
          "X0": "up",
          "X1": "up",
          "X2": "down"
        },
        "wifiStatus": "on",
        "haStatus": "active",
        "timestamp": "2024-01-15T12:00:00.000Z"
      },
      {
        "id": "snapshot-uuid-2",
        "deviceId": "550e8400-e29b-41d4-a716-446655440000",
        "cpuPercent": 42.1,
        "ramPercent": 58.7,
        "uptimeSeconds": 82800,
        "wanStatus": "up",
        "vpnStatus": "up",
        "interfaceStatus": {
          "X0": "up",
          "X1": "up",
          "X2": "down"
        },
        "wifiStatus": "on",
        "haStatus": "active",
        "timestamp": "2024-01-15T08:00:00.000Z"
      }
    ],
    "count": 2,
    "filters": {
      "startDate": "2024-01-15T00:00:00.000Z",
      "endDate": "2024-01-20T23:59:59.000Z",
      "limit": 100
    }
  }
}
```

### Empty Result (200 OK)
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "snapshots": [],
    "count": 0,
    "filters": {
      "startDate": null,
      "endDate": null,
      "limit": 100
    }
  }
}
```

## Error Responses

### 400 Bad Request - Invalid Device ID
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ID",
    "message": "Invalid device ID format"
  }
}
```

### 400 Bad Request - Invalid Date Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid startDate format. Must be a valid ISO 8601 date string"
  }
}
```

### 400 Bad Request - Invalid Date Range
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "startDate must be before or equal to endDate"
  }
}
```

### 400 Bad Request - Invalid Limit
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid limit. Must be a positive integer"
  }
}
```

### 400 Bad Request - Limit Too Large
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Limit exceeds maximum allowed value of 1000"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "TENANT_ERROR",
    "message": "Tenant validation failed"
  }
}
```

### 404 Not Found - Device Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Device not found"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve health snapshots"
  }
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database connection not available"
  }
}
```

## Health Snapshot Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique snapshot identifier |
| deviceId | UUID | Device identifier |
| cpuPercent | Float | CPU usage percentage (0-100) |
| ramPercent | Float | RAM usage percentage (0-100) |
| uptimeSeconds | Integer | Device uptime in seconds |
| wanStatus | String | WAN interface status ("up" or "down") |
| vpnStatus | String | VPN tunnel status ("up" or "down") |
| interfaceStatus | Object | Interface status map (e.g., {"X0": "up", "X1": "down"}) |
| wifiStatus | String | WiFi status ("on" or "off") |
| haStatus | String | High Availability status ("active", "standby", "failover", "standalone") |
| timestamp | ISO 8601 Date | Snapshot creation timestamp |

## Business Logic

### Snapshot Frequency
- Health snapshots are created every 4-6 hours by the polling engine
- Snapshots are retained for 90 days (automatic cleanup)

### Date Range Filtering
- If both `startDate` and `endDate` are provided, uses `BETWEEN` query
- If only `startDate` is provided, returns snapshots >= startDate
- If only `endDate` is provided, returns snapshots <= endDate
- If neither is provided, returns all snapshots (up to limit)

### Sorting
- Snapshots are always sorted by timestamp descending (newest first)

### Limit
- Default limit: 100 snapshots
- Maximum limit: 1000 snapshots
- Prevents excessive data transfer and performance issues

### Tenant Isolation
- Regular users can only access devices from their tenant
- Super admins can access devices from any tenant
- Device ownership is validated before returning snapshots

## Use Cases

### Dashboard Health Trends
```javascript
// Get last 7 days of snapshots
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const response = await fetch(
  `/api/firewall/health/${deviceId}?startDate=${sevenDaysAgo.toISOString()}`
);
```

### Historical Analysis
```javascript
// Get snapshots for January 2024
const response = await fetch(
  `/api/firewall/health/${deviceId}?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z`
);
```

### Recent Status Check
```javascript
// Get last 10 snapshots
const response = await fetch(
  `/api/firewall/health/${deviceId}?limit=10`
);
```

## Performance Considerations

- Indexed on `device_id` and `timestamp DESC` for fast queries
- Date range queries use efficient `BETWEEN` or `>=`/`<=` operators
- Limit prevents excessive data transfer
- Snapshots older than 90 days are automatically deleted

## Testing

Run tests with:
```bash
npm test src/app/api/firewall/health/[deviceId]/__tests__/route.test.ts
```

## Related Endpoints

- `GET /api/firewall/devices/:id` - Get device details with latest snapshot
- `GET /api/firewall/posture/:deviceId` - Get latest security posture
- `GET /api/firewall/metrics/:deviceId` - Get daily metrics rollup

## Implementation Notes

- Uses Drizzle ORM for database queries
- Implements proper error handling and validation
- Follows existing API patterns from other firewall endpoints
- Supports super admin cross-tenant access
- Returns BigInt fields as numbers for JSON serialization
