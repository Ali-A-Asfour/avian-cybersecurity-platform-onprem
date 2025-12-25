# GET /api/firewall/devices/:id - Get Device Details

## Overview
Retrieves detailed information about a specific firewall device, including its latest health snapshot and security posture.

## Requirements
- **Requirement 15.3**: Device Management API - Get device details + latest snapshot
- **Design Section**: API Layer - Device Management

## Authentication
- Requires valid JWT token
- Enforces tenant isolation (users can only access devices in their tenant)
- Super admins can access devices from any tenant

## Request

### Method
`GET`

### URL Parameters
- `id` (required): UUID of the firewall device

### Headers
```
Authorization: Bearer <jwt_token>
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "model": "TZ600",
      "firmwareVersion": "7.0.1-5050",
      "serialNumber": "TEST-SERIAL-001",
      "managementIp": "192.168.1.1",
      "apiUsername": "admin",
      "apiPasswordEncrypted": null,
      "uptimeSeconds": 86400,
      "lastSeenAt": "2025-12-08T22:00:00.000Z",
      "status": "active",
      "createdAt": "2025-12-08T20:00:00.000Z",
      "updatedAt": "2025-12-08T22:00:00.000Z"
    },
    "health": {
      "id": "123e4567-e89b-12d3-a456-426614174003",
      "deviceId": "123e4567-e89b-12d3-a456-426614174002",
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
      "haStatus": "standalone",
      "timestamp": "2025-12-08T22:00:00.000Z"
    },
    "posture": {
      "id": "123e4567-e89b-12d3-a456-426614174004",
      "deviceId": "123e4567-e89b-12d3-a456-426614174002",
      "ipsEnabled": true,
      "ipsLicenseStatus": "active",
      "ipsDailyBlocks": 150,
      "gavEnabled": true,
      "gavLicenseStatus": "active",
      "gavDailyBlocks": 25,
      "dpiSslEnabled": true,
      "dpiSslCertificateStatus": "valid",
      "dpiSslDailyBlocks": 10,
      "atpEnabled": true,
      "atpLicenseStatus": "active",
      "atpDailyVerdicts": 5,
      "botnetFilterEnabled": true,
      "botnetDailyBlocks": 8,
      "appControlEnabled": true,
      "appControlLicenseStatus": "active",
      "appControlDailyBlocks": 12,
      "contentFilterEnabled": true,
      "contentFilterLicenseStatus": "active",
      "contentFilterDailyBlocks": 20,
      "timestamp": "2025-12-08T22:00:00.000Z"
    }
  }
}
```

### Success Response - No Snapshots (200 OK)
If the device exists but has no health snapshots or security posture records:
```json
{
  "success": true,
  "data": {
    "device": { ... },
    "health": null,
    "posture": null
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid ID Format
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ID",
    "message": "Invalid device ID format"
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

#### 403 Forbidden - Tenant Validation Failed
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
Returned when:
- Device does not exist
- Device belongs to a different tenant (non-super admin users)

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
    "message": "Failed to retrieve device details"
  }
}
```

## Implementation Details

### Data Retrieval
1. Validates device ID is a valid UUID format
2. Queries device from `firewall_devices` table with tenant filtering
3. Queries latest health snapshot from `firewall_health_snapshots` (ordered by timestamp DESC)
4. Queries latest security posture from `firewall_security_posture` (ordered by timestamp DESC)

### Security
- **Tenant Isolation**: Regular users can only access devices in their tenant
- **Super Admin Access**: Super admins can access devices from any tenant
- **Password Protection**: API password is never returned in responses (always null)

### Performance
- Uses indexed queries on device_id and timestamp
- Limits queries to 1 result for latest snapshots
- Efficient DESC ordering for timestamp-based queries

## Usage Examples

### cURL
```bash
# Get device details
curl -X GET \
  http://localhost:3000/api/firewall/devices/123e4567-e89b-12d3-a456-426614174002 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### JavaScript/TypeScript
```typescript
const response = await fetch(
  `http://localhost:3000/api/firewall/devices/${deviceId}`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
);

const data = await response.json();

if (data.success) {
  console.log('Device:', data.data.device);
  console.log('Health:', data.data.health);
  console.log('Posture:', data.data.posture);
}
```

## Testing
Comprehensive test suite located at:
`src/app/api/firewall/devices/[id]/__tests__/route.test.ts`

Tests cover:
- ✅ Successful device retrieval with health and posture
- ✅ Device retrieval without snapshots
- ✅ Authentication failures
- ✅ Tenant validation failures
- ✅ Invalid UUID format handling
- ✅ Device not found scenarios
- ✅ Super admin cross-tenant access

Run tests:
```bash
npm test -- src/app/api/firewall/devices/\[id\]/__tests__/route.test.ts
```

## Related Endpoints
- `POST /api/firewall/devices` - Register new device
- `GET /api/firewall/devices` - List all devices
- `PUT /api/firewall/devices/:id` - Update device (not yet implemented)
- `DELETE /api/firewall/devices/:id` - Delete device (not yet implemented)

## Database Tables
- `firewall_devices` - Device metadata
- `firewall_health_snapshots` - Health snapshots (4-6 hour frequency)
- `firewall_security_posture` - Security feature status and daily counters

## Next Steps
- Implement PUT endpoint for device updates
- Implement DELETE endpoint for device removal
- Add caching layer for frequently accessed devices
- Add pagination for health snapshot history
