# GET /api/firewall/metrics/:deviceId

Get daily metrics rollup records for a firewall device.

## Requirements
- **Requirement 15.9**: Metrics API
- **Requirement 9.1-9.7**: Daily Metrics Rollup

## Endpoint
```
GET /api/firewall/metrics/:deviceId
```

## Authentication
- Requires valid JWT token
- Enforces tenant isolation (users can only access devices in their tenant)
- Super admins can access devices from any tenant

## Path Parameters
- `deviceId` (string, required): UUID of the firewall device

## Query Parameters
- `startDate` (string, optional): ISO 8601 date string - filter metrics >= this date (YYYY-MM-DD format)
- `endDate` (string, optional): ISO 8601 date string - filter metrics <= this date (YYYY-MM-DD format)
- `limit` (number, optional): Limit number of results (default: 90, max: 365)

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "metrics": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "deviceId": "550e8400-e29b-41d4-a716-446655440000",
        "date": "2024-01-15",
        "threatsBlocked": 1250,
        "malwareBlocked": 450,
        "ipsBlocked": 600,
        "blockedConnections": 3200,
        "webFilterHits": 850,
        "bandwidthTotalMb": 15000,
        "activeSessionsCount": 125,
        "createdAt": "2024-01-16T00:05:00.000Z"
      }
    ],
    "count": 1,
    "filters": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31",
      "limit": 90
    }
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid Device ID
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ID",
    "message": "Invalid device ID format"
  }
}
```

#### 400 Bad Request - Invalid Date Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid startDate format. Must be a valid ISO 8601 date string"
  }
}
```

#### 400 Bad Request - Invalid Date Range
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "startDate must be before or equal to endDate"
  }
}
```

#### 400 Bad Request - Invalid Limit
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid limit. Must be a positive integer"
  }
}
```

#### 400 Bad Request - Limit Exceeds Maximum
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Limit exceeds maximum allowed value of 365"
  }
}
```

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

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Device not found"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve metrics"
  }
}
```

#### 503 Service Unavailable
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database connection not available"
  }
}
```

## Usage Examples

### Get Last 7 Days of Metrics
```bash
curl -X GET \
  'https://api.example.com/api/firewall/metrics/550e8400-e29b-41d4-a716-446655440000?limit=7' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Get Metrics for Specific Date Range
```bash
curl -X GET \
  'https://api.example.com/api/firewall/metrics/550e8400-e29b-41d4-a716-446655440000?startDate=2024-01-01&endDate=2024-01-31' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Get Last 30 Days with Limit
```bash
curl -X GET \
  'https://api.example.com/api/firewall/metrics/550e8400-e29b-41d4-a716-446655440000?limit=30' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Data Model

### Metrics Rollup Fields
- `id`: Unique identifier for the rollup record
- `deviceId`: Reference to the firewall device
- `date`: Date of the metrics (YYYY-MM-DD format)
- `threatsBlocked`: Total threats blocked (sum of IPS + GAV + ATP + Botnet)
- `malwareBlocked`: Malware blocked by Gateway Anti-Virus
- `ipsBlocked`: Intrusions blocked by IPS
- `blockedConnections`: Total denied connections
- `webFilterHits`: Content filter blocks
- `bandwidthTotalMb`: Total bandwidth in megabytes (if available)
- `activeSessionsCount`: Active sessions count (average or final value)
- `createdAt`: Timestamp when the rollup was created

## Business Logic

### Date Range Filtering
- Dates are compared using YYYY-MM-DD format (date only, no time)
- `startDate` is inclusive (>=)
- `endDate` is inclusive (<=)
- If both are provided, uses BETWEEN operator for efficiency
- If only one is provided, uses >= or <= operator

### Sorting
- Results are sorted by date descending (newest first)
- This allows clients to easily display recent metrics first

### Limit
- Default limit: 90 days (matches typical dashboard view)
- Maximum limit: 365 days (matches retention policy)
- Prevents excessive data transfer and query load

### Tenant Isolation
- Regular users can only access devices in their tenant
- Super admins can access devices from any tenant
- Device ownership is verified before returning metrics

## Performance Considerations

### Indexes
- `idx_metrics_rollup_device` on (device_id, date DESC) - optimizes device + date queries
- `idx_metrics_rollup_date` on (date DESC) - optimizes date-based queries
- Unique constraint on (device_id, date) - prevents duplicate entries

### Query Optimization
- Uses indexed columns for filtering (device_id, date)
- Limit prevents unbounded result sets
- Date comparison uses efficient operators (BETWEEN, >=, <=)

### Caching Strategy
- Consider caching metrics with 5-minute TTL (as per design doc)
- Cache key: `metrics:${deviceId}:${startDate}:${endDate}:${limit}`
- Invalidate cache when new rollup is created

## Related Endpoints
- `GET /api/firewall/devices/:id` - Get device details
- `GET /api/firewall/health/:deviceId` - Get health snapshots
- `GET /api/firewall/posture/:deviceId` - Get security posture
- `GET /api/firewall/alerts` - Get alerts

## Testing
See `__tests__/route.test.ts` for comprehensive test coverage including:
- Authentication and authorization
- Tenant isolation
- Date range filtering
- Limit validation
- Error handling
- Super admin access
