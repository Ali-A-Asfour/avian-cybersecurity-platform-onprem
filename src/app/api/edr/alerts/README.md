# EDR Alerts API

## Overview

REST API endpoints for managing and querying EDR (Endpoint Detection and Response) alerts from Microsoft Defender for Endpoint. These endpoints provide access to security alerts with comprehensive filtering, pagination, and tenant isolation.

## Requirements

- **2.4**: Alert filtering by severity, device, status, and date range
- **9.4**: Tenant isolation for all queries
- **14.2**: Alert list with filters
- **14.5**: Alert detail retrieval

## Endpoints

### GET /api/edr/alerts

List all EDR alerts for the authenticated tenant with filtering and pagination support.

#### Authentication

- Requires valid JWT token
- Automatically filters by authenticated user's tenant

#### Query Parameters

| Parameter | Type | Required | Description | Valid Values |
|-----------|------|----------|-------------|--------------|
| `severity` | string | No | Filter by alert severity | `informational`, `low`, `medium`, `high` |
| `deviceId` | UUID | No | Filter by device ID | Valid UUID |
| `status` | string | No | Filter by alert status | `new`, `in_progress`, `resolved`, `dismissed` |
| `startDate` | ISO 8601 | No | Filter alerts detected after this date | ISO 8601 datetime |
| `endDate` | ISO 8601 | No | Filter alerts detected before this date | ISO 8601 datetime |
| `page` | integer | No | Page number (default: 1) | Positive integer |
| `limit` | integer | No | Results per page (default: 50) | 1-100 |

#### Response Format

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "deviceId": "uuid",
      "microsoftAlertId": "string",
      "severity": "high",
      "threatType": "malware",
      "threatName": "Trojan.Generic",
      "status": "new",
      "description": "Malware detected on device",
      "detectedAt": "2024-01-15T10:00:00Z",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "totalPages": 2
  }
}
```

#### Example Requests

```bash
# Get all alerts
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/alerts

# Get high severity alerts
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/alerts?severity=high"

# Get alerts for specific device
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/alerts?deviceId=123e4567-e89b-12d3-a456-426614174000"

# Get new alerts from last 7 days
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/alerts?status=new&startDate=2024-01-08T00:00:00Z"

# Get alerts with pagination
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/alerts?page=2&limit=25"

# Complex filter: high severity, new status, date range
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/alerts?severity=high&status=new&startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z"
```

#### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Severity must be one of: informational, low, medium, high"
  }
}
```

**401 Unauthorized** - Missing or invalid authentication
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**403 Forbidden** - Tenant validation failed
```json
{
  "success": false,
  "error": {
    "code": "TENANT_ERROR",
    "message": "Tenant validation failed"
  }
}
```

**500 Internal Server Error** - Server error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve EDR alerts"
  }
}
```

**503 Service Unavailable** - Database unavailable
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database connection not available"
  }
}
```

---

### GET /api/edr/alerts/:id

Retrieve detailed information about a specific alert, including associated device information.

#### Authentication

- Requires valid JWT token
- Enforces tenant isolation (can only access alerts from own tenant)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Alert ID |

#### Response Format

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "deviceId": "uuid",
    "microsoftAlertId": "string",
    "severity": "high",
    "threatType": "malware",
    "threatName": "Trojan.Generic",
    "status": "new",
    "description": "Malware detected on device",
    "detectedAt": "2024-01-15T10:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "device": {
      "id": "uuid",
      "deviceName": "DESKTOP-TEST",
      "operatingSystem": "Windows 11",
      "osVersion": "22H2",
      "primaryUser": "test@example.com",
      "riskScore": 75,
      "lastSeenAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Example Requests

```bash
# Get alert details
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/alerts/123e4567-e89b-12d3-a456-426614174000
```

#### Error Responses

**400 Bad Request** - Invalid alert ID format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Alert ID must be a valid UUID"
  }
}
```

**404 Not Found** - Alert not found or belongs to different tenant
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Alert not found"
  }
}
```

## Data Model

### Alert Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique alert identifier |
| `tenantId` | UUID | Tenant identifier |
| `deviceId` | UUID | Associated device identifier |
| `microsoftAlertId` | string | Microsoft Defender alert ID |
| `severity` | string | Alert severity level |
| `threatType` | string | Type of threat detected |
| `threatName` | string | Name of the threat |
| `status` | string | Current alert status |
| `description` | text | Detailed alert description |
| `detectedAt` | timestamp | When the alert was detected |
| `createdAt` | timestamp | When the record was created |
| `updatedAt` | timestamp | When the record was last updated |

### Device Object (in alert detail)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Device identifier |
| `deviceName` | string | Device hostname |
| `operatingSystem` | string | Operating system |
| `osVersion` | string | OS version |
| `primaryUser` | string | Primary user email |
| `riskScore` | integer | Device risk score (0-100) |
| `lastSeenAt` | timestamp | Last seen timestamp |

## Security

### Tenant Isolation

All queries automatically filter by the authenticated user's tenant ID. Users cannot access alerts from other tenants.

### Authentication

All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Input Validation

- All UUIDs are validated for correct format
- Date parameters must be valid ISO 8601 format
- Enum parameters (severity, status) are validated against allowed values
- Pagination parameters are validated for reasonable ranges

## Performance

### Indexes

The following database indexes optimize query performance:
- `idx_edr_alerts_tenant` - Tenant filtering
- `idx_edr_alerts_device` - Device filtering
- `idx_edr_alerts_severity` - Severity filtering
- `idx_edr_alerts_status` - Status filtering
- `idx_edr_alerts_detected` - Date range filtering and sorting

### Pagination

- Default limit: 50 alerts per page
- Maximum limit: 100 alerts per page
- Results are sorted by detection date (newest first)

## Testing

Run tests with:
```bash
npm test src/app/api/edr/alerts/__tests__
```

Test coverage includes:
- Authentication and authorization
- Input validation
- Alert listing with filters
- Pagination
- Tenant isolation
- Error handling
- Alert detail retrieval

## Related Endpoints

- `GET /api/edr/devices` - List devices
- `GET /api/edr/devices/:id` - Device details
- `GET /api/edr/vulnerabilities` - List vulnerabilities
- `GET /api/edr/compliance` - Compliance status

## Future Enhancements

- Alert acknowledgment endpoint
- Alert status update endpoint
- Bulk alert operations
- Alert export functionality
- Real-time alert notifications via WebSocket
