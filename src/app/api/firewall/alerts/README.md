# GET /api/firewall/alerts - List Alerts

## Overview
Retrieves a list of firewall alerts with filtering and pagination support. Alerts are automatically filtered by the authenticated user's tenant to ensure tenant isolation.

## Requirements
- **Requirement 15.7**: Provide GET /api/firewall/alerts endpoint with filtering by device_id, severity, acknowledged status
- **Requirement 12.3**: Filter alerts by tenant_id, device_id, severity, acknowledged status, date range
- **Requirement 12.4**: Sort alerts by timestamp descending (newest first)
- **Requirement 17.1-17.4**: Enforce tenant-based access control

## Authentication
Requires valid JWT token with tenant_id claim.

## Request

### Method
```
GET /api/firewall/alerts
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `deviceId` | string | No | Filter by device ID | `?deviceId=abc-123` |
| `severity` | string | No | Filter by severity (comma-separated for multiple) | `?severity=critical` or `?severity=critical,high` |
| `acknowledged` | boolean | No | Filter by acknowledged status | `?acknowledged=false` |
| `startDate` | string | No | Filter by start date (ISO 8601) | `?startDate=2024-01-01T00:00:00Z` |
| `endDate` | string | No | Filter by end date (ISO 8601) | `?endDate=2024-01-31T23:59:59Z` |
| `limit` | number | No | Number of results (1-100, default: 50) | `?limit=20` |
| `offset` | number | No | Number of results to skip (default: 0) | `?offset=0` |

### Valid Severity Values
- `critical`
- `high`
- `medium`
- `low`
- `info`

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-123",
      "tenantId": "tenant-456",
      "deviceId": "device-789",
      "alertType": "wan_down",
      "severity": "critical",
      "message": "WAN interface status changed from up to down",
      "source": "api",
      "metadata": {
        "previous_status": "up",
        "new_status": "down"
      },
      "acknowledged": false,
      "acknowledgedBy": null,
      "acknowledgedAt": null,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "filters": {
      "deviceId": null,
      "severity": null,
      "acknowledged": null,
      "startDate": null,
      "endDate": null
    }
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "TENANT_ERROR",
    "message": "Tenant validation failed"
  }
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid severity: invalid. Must be one of: critical, high, medium, low, info"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve alerts"
  }
}
```

## Examples

### Get all alerts for tenant
```bash
curl -X GET "https://api.example.com/api/firewall/alerts" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get alerts for specific device
```bash
curl -X GET "https://api.example.com/api/firewall/alerts?deviceId=device-789" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get critical alerts only
```bash
curl -X GET "https://api.example.com/api/firewall/alerts?severity=critical" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get critical and high severity alerts
```bash
curl -X GET "https://api.example.com/api/firewall/alerts?severity=critical,high" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get unacknowledged alerts
```bash
curl -X GET "https://api.example.com/api/firewall/alerts?acknowledged=false" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get alerts from last 7 days
```bash
curl -X GET "https://api.example.com/api/firewall/alerts?startDate=2024-01-08T00:00:00Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get alerts with pagination
```bash
curl -X GET "https://api.example.com/api/firewall/alerts?limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Combined filters
```bash
curl -X GET "https://api.example.com/api/firewall/alerts?deviceId=device-789&severity=critical&acknowledged=false&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Features

### Tenant Isolation
- Alerts are automatically filtered by the authenticated user's tenant_id
- Users can only see alerts for their own tenant
- Cross-tenant access is prevented

### Sorting
- Alerts are sorted by timestamp in descending order (newest first)
- This ensures the most recent alerts appear at the top

### Pagination
- Default limit: 50 alerts
- Maximum limit: 100 alerts
- Use `limit` and `offset` for pagination

### Multiple Severity Filtering
- Single severity: `?severity=critical`
- Multiple severities: `?severity=critical,high`
- Comma-separated values are supported

### Date Range Filtering
- Filter by start date: `?startDate=2024-01-01T00:00:00Z`
- Filter by end date: `?endDate=2024-01-31T23:59:59Z`
- Both dates are inclusive
- Dates must be in ISO 8601 format

## Implementation Details

### Alert Manager Integration
This endpoint uses the `AlertManager.getAlerts()` method which:
- Enforces tenant isolation at the database level
- Applies all filters using Drizzle ORM
- Sorts results by timestamp descending
- Supports pagination

### Performance Considerations
- Database indexes on `tenant_id`, `device_id`, `severity`, `acknowledged`, and `created_at`
- Efficient query construction using Drizzle ORM
- Pagination prevents large result sets

### Security
- JWT authentication required
- Tenant validation enforced
- Row-level security through tenant filtering
- No cross-tenant data leakage

## Related Endpoints
- `PUT /api/firewall/alerts/:id/acknowledge` - Acknowledge an alert
- `GET /api/firewall/devices` - List devices
- `GET /api/firewall/devices/:id` - Get device details

## Testing
See `__tests__/route.test.ts` for comprehensive test coverage including:
- Authentication and authorization
- Tenant isolation
- Filter validation
- Pagination
- Date range filtering
- Multiple severity filtering
- Error handling
