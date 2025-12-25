# GET /api/firewall/config/risks/:deviceId

Retrieve configuration risks for a specific firewall device.

## Requirements

- **Requirement 15.5**: Configuration API - Get configuration risks

## Authentication

- Requires valid JWT token
- Enforces tenant isolation (users can only access devices from their tenant)
- Super admins can access devices from any tenant

## Request

### URL Parameters

- `deviceId` (required): UUID of the firewall device

### Query Parameters

- `severity` (optional): Filter risks by severity level
  - Valid values: `critical`, `high`, `medium`, `low`

### Example Requests

```bash
# Get all risks for a device
GET /api/firewall/config/risks/123e4567-e89b-12d3-a456-426614174000

# Get only critical risks
GET /api/firewall/config/risks/123e4567-e89b-12d3-a456-426614174000?severity=critical

# Get only high severity risks
GET /api/firewall/config/risks/123e4567-e89b-12d3-a456-426614174000?severity=high
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "deviceId": "123e4567-e89b-12d3-a456-426614174000",
    "device": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "model": "TZ-400",
      "firmwareVersion": "7.0.1-5050",
      "serialNumber": "ABC123456",
      "managementIp": "192.168.1.1"
    },
    "riskCounts": {
      "critical": 2,
      "high": 3,
      "medium": 5,
      "low": 1,
      "total": 11
    },
    "risks": [
      {
        "riskId": "risk-uuid-1",
        "riskCategory": "exposure_risk",
        "riskType": "WAN_MANAGEMENT_ENABLED",
        "severity": "critical",
        "description": "WAN management access enabled - exposes admin interface to internet",
        "remediation": "Disable WAN management access and use VPN for remote administration",
        "detectedAt": "2024-01-15T10:30:00Z",
        "snapshotId": "snapshot-uuid-1"
      },
      {
        "riskId": "risk-uuid-2",
        "riskCategory": "security_feature_disabled",
        "riskType": "IPS_DISABLED",
        "severity": "critical",
        "description": "Intrusion Prevention System is disabled",
        "remediation": "Enable IPS to protect against network attacks",
        "detectedAt": "2024-01-15T10:30:00Z",
        "snapshotId": "snapshot-uuid-1"
      }
    ],
    "filters": {
      "severity": null
    }
  },
  "message": "Retrieved 2 risk(s) for device"
}
```

### Error Responses

#### 400 Bad Request - Invalid Input

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Device ID is required and must be a non-empty string"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid severity parameter. Must be one of: critical, high, medium, low"
  }
}
```

#### 401 Unauthorized - Not Authenticated

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 403 Forbidden - Tenant Mismatch

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Cannot access device from another tenant"
  }
}
```

#### 404 Not Found - Device Not Found

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Firewall device not found"
  }
}
```

#### 500 Internal Server Error - Query Failed

```json
{
  "success": false,
  "error": {
    "code": "QUERY_ERROR",
    "message": "Failed to retrieve configuration risks",
    "details": "Database connection error"
  }
}
```

#### 503 Service Unavailable - Database Unavailable

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database connection not available"
  }
}
```

## Risk Categories

Risks are categorized into the following types:

- **exposure_risk**: Risks that expose the firewall to external threats
- **security_feature_disabled**: Security features that are not enabled
- **network_misconfiguration**: Network configuration issues
- **best_practice_violation**: Violations of security best practices
- **license_expired**: Expired or expiring licenses

## Risk Severity Levels

- **critical**: Immediate action required (e.g., WAN management enabled, IPS disabled)
- **high**: High priority issues (e.g., MFA disabled, weak VPN encryption)
- **medium**: Medium priority issues (e.g., DPI-SSL disabled, PSK-only VPN)
- **low**: Low priority issues (e.g., missing rule descriptions, default admin port)

## Usage Examples

### Get All Risks

```typescript
const response = await fetch(
  `/api/firewall/config/risks/${deviceId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
);

const data = await response.json();
console.log(`Total risks: ${data.data.riskCounts.total}`);
console.log(`Critical risks: ${data.data.riskCounts.critical}`);
```

### Get Critical Risks Only

```typescript
const response = await fetch(
  `/api/firewall/config/risks/${deviceId}?severity=critical`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
);

const data = await response.json();
data.data.risks.forEach(risk => {
  console.log(`${risk.riskType}: ${risk.description}`);
  console.log(`Remediation: ${risk.remediation}`);
});
```

### Display Risk Summary

```typescript
const response = await fetch(
  `/api/firewall/config/risks/${deviceId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
);

const data = await response.json();
const { riskCounts } = data.data;

console.log('Risk Summary:');
console.log(`  Critical: ${riskCounts.critical}`);
console.log(`  High: ${riskCounts.high}`);
console.log(`  Medium: ${riskCounts.medium}`);
console.log(`  Low: ${riskCounts.low}`);
console.log(`  Total: ${riskCounts.total}`);
```

## Related Endpoints

- `POST /api/firewall/config/upload` - Upload and analyze configuration file
- `GET /api/firewall/devices/:id` - Get device details
- `GET /api/firewall/posture/:deviceId` - Get security posture

## Implementation Notes

1. **Tenant Isolation**: The endpoint enforces strict tenant isolation. Users can only retrieve risks for devices belonging to their tenant, unless they have the super_admin role.

2. **Severity Filtering**: When a severity filter is applied, only risks matching that severity level are returned. The risk counts still reflect all risks for the device.

3. **Risk Counts**: The endpoint always returns risk counts by severity, even if a filter is applied. This allows clients to display summary statistics regardless of the current filter.

4. **Device Information**: The response includes basic device information (model, firmware, serial number, IP) for context.

5. **Error Handling**: The endpoint gracefully handles errors in counting risks by returning zero counts rather than failing the entire request.

6. **Performance**: Risks are retrieved using indexed queries on device_id and severity for optimal performance.

## Testing

Run the test suite:

```bash
npm test src/app/api/firewall/config/risks/[deviceId]/__tests__/route.test.ts
```

The test suite covers:
- Authentication and authorization
- Input validation
- Device validation
- Risk retrieval with and without filters
- Tenant isolation
- Error handling
- Response format
