# DELETE /api/firewall/devices/:id - Delete Firewall Device

## Overview
Deletes a firewall device and all associated data through database cascading deletes.

**Requirements:** 15.1 - Device Management API

## Endpoint
```
DELETE /api/firewall/devices/:id
```

## Authentication
- Requires valid JWT token
- Only **Super Admins** and **Tenant Admins** can delete devices
- Analysts and viewers cannot delete devices

## Authorization
- **Tenant Admins**: Can only delete devices belonging to their tenant
- **Super Admins**: Can delete devices from any tenant

## Request

### Path Parameters
- `id` (string, required): UUID of the firewall device to delete

### Headers
```
Authorization: Bearer <jwt_token>
```

### Example Request
```bash
curl -X DELETE \
  http://localhost:3000/api/firewall/devices/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer eyJhbGc..."
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Firewall device deleted successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "serialNumber": "C0EAE4D2E3F1",
    "managementIp": "192.168.1.1"
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid UUID
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

#### 403 Forbidden - Insufficient Permissions
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Only administrators can delete firewall devices"
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
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Device not found"
  }
}
```

#### 500 Internal Server Error - Delete Failed
```json
{
  "success": false,
  "error": {
    "code": "DELETE_FAILED",
    "message": "Failed to delete device"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete firewall device"
  }
}
```

## Cascading Deletes

When a device is deleted, the following related records are automatically deleted through database CASCADE constraints:

1. **firewall_health_snapshots** - All health snapshots for the device
2. **firewall_security_posture** - All security posture records
3. **firewall_licenses** - All license records
4. **firewall_config_risks** - All configuration risk records
5. **firewall_metrics_rollup** - All daily metrics rollup records
6. **firewall_alerts** - Alerts with device_id set to this device (device_id is nullable, so alerts without device match are preserved)

This ensures complete cleanup of all device-related data.

## Tenant Isolation

### Tenant Admin Behavior
- Can only delete devices where `device.tenantId === user.tenant_id`
- Attempting to delete a device from another tenant returns 404 (device not found)
- This prevents information leakage about devices in other tenants

### Super Admin Behavior
- Can delete devices from any tenant
- No tenant filtering is applied to the query
- Full cross-tenant access for administrative purposes

## Validation Rules

1. **UUID Format**: Device ID must be a valid UUID format
2. **Device Existence**: Device must exist in the database
3. **Tenant Match**: Device must belong to user's tenant (unless super admin)
4. **Role Check**: User must be tenant_admin or super_admin

## Implementation Notes

### Polling Engine Consideration
When a device is deleted, the polling engine should automatically stop polling it on the next cycle since the device will no longer exist in the database. No explicit "stop polling" call is needed.

### Redis Cleanup
Consider implementing cleanup of Redis keys related to the deleted device:
- Polling state keys
- Alert deduplication keys
- Alert storm suppression keys

This can be done asynchronously or as part of a cleanup job.

### Audit Logging
Device deletion should be logged in the audit log with:
- User who performed the deletion
- Device details (serial number, management IP)
- Timestamp
- Tenant ID

## Security Considerations

1. **Irreversible Operation**: Device deletion is permanent and cannot be undone
2. **Data Loss**: All historical data (snapshots, metrics, alerts) is deleted
3. **Authorization**: Only admins can delete devices to prevent accidental data loss
4. **Tenant Isolation**: Strict enforcement prevents cross-tenant deletions

## Testing

Comprehensive test coverage includes:
- Authentication and authorization checks
- UUID validation
- Device existence validation
- Tenant isolation enforcement
- Successful deletion flow
- Error handling for database failures
- Cascading delete verification
- Super admin cross-tenant access

## Usage Examples

### Delete Device (Tenant Admin)
```typescript
const response = await fetch('/api/firewall/devices/660e8400-e29b-41d4-a716-446655440001', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const data = await response.json();
if (data.success) {
  console.log('Device deleted:', data.data.serialNumber);
}
```

### Delete Device (Super Admin)
```typescript
// Super admin can delete devices from any tenant
const response = await fetch('/api/firewall/devices/660e8400-e29b-41d4-a716-446655440001', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${superAdminToken}`,
  },
});

const data = await response.json();
if (data.success) {
  console.log('Device deleted from tenant:', data.data.id);
}
```

## Related Endpoints
- `POST /api/firewall/devices` - Register new device
- `GET /api/firewall/devices` - List all devices
- `GET /api/firewall/devices/:id` - Get device details
- `PUT /api/firewall/devices/:id` - Update device

## Future Enhancements

1. **Soft Delete**: Implement soft delete with `deleted_at` timestamp instead of hard delete
2. **Deletion Confirmation**: Require confirmation token for critical devices
3. **Backup Before Delete**: Automatically backup device data before deletion
4. **Restore Capability**: Allow restoration of recently deleted devices
5. **Batch Delete**: Support deleting multiple devices in one request
