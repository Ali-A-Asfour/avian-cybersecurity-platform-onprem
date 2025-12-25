# PUT /api/firewall/devices/:id - Update Device

## Overview

This endpoint allows administrators to update firewall device metadata and credentials. It enforces strict tenant isolation and role-based access control.

## Endpoint

```
PUT /api/firewall/devices/:id
```

## Authentication

- **Required**: Yes
- **Roles**: `super_admin`, `tenant_admin`
- **Tenant Isolation**: Yes (except for super_admin)

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Device ID |

### Request Body

All fields are optional, but at least one must be provided:

```typescript
{
  model?: string;                              // Device model (e.g., "TZ-600")
  firmwareVersion?: string;                    // Firmware version (e.g., "7.0.2")
  serialNumber?: string;                       // Serial number (must be unique)
  managementIp?: string;                       // IPv4 or IPv6 address
  apiUsername?: string;                        // API username
  apiPassword?: string;                        // API password (will be encrypted)
  status?: 'active' | 'inactive' | 'offline'; // Device status
}
```

### Example Request

```bash
curl -X PUT https://api.example.com/api/firewall/devices/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "TZ-600",
    "firmwareVersion": "7.1.0",
    "status": "active"
  }'
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "model": "TZ-600",
    "firmwareVersion": "7.1.0",
    "serialNumber": "SN123456",
    "managementIp": "192.168.1.1",
    "apiUsername": "admin",
    "apiPasswordEncrypted": null,
    "uptimeSeconds": 86400,
    "lastSeenAt": "2024-01-01T12:00:00.000Z",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T10:30:00.000Z"
  },
  "message": "Firewall device updated successfully"
}
```

### Error Responses

#### 400 Bad Request - Invalid Input

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid management IP address format"
  }
}
```

**Possible validation errors:**
- Invalid device ID format
- No fields provided for update
- Invalid management IP format
- Invalid status value

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
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Only administrators can update firewall devices"
  }
}
```

**Possible causes:**
- User is not a super_admin or tenant_admin
- Tenant validation failed

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

**Possible causes:**
- Device ID does not exist
- Device belongs to a different tenant (for non-super_admin users)

#### 409 Conflict

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_DEVICE",
    "message": "Device with management IP 192.168.1.2 already exists for this tenant"
  }
}
```

**Possible causes:**
- Management IP conflicts with another device in the same tenant
- Serial number conflicts with another device

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "ENCRYPTION_ERROR",
    "message": "Failed to encrypt API credentials"
  }
}
```

or

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to update firewall device"
  }
}
```

## Validation Rules

### Device ID
- Must be a valid UUID format
- Must exist in the database
- Must belong to user's tenant (unless user is super_admin)

### Management IP
- Must be valid IPv4 format: `xxx.xxx.xxx.xxx`
- Or valid IPv6 format: `xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx`
- Must be unique within the tenant (if changed)

### Serial Number
- Must be unique across all tenants (if changed)

### Status
- Must be one of: `active`, `inactive`, `offline`

### API Password
- Encrypted using AES-256 before storage
- Never returned in API responses

## Security Features

1. **Authentication Required**: All requests must include a valid JWT token
2. **Role-Based Access**: Only super_admin and tenant_admin roles can update devices
3. **Tenant Isolation**: Tenant admins can only update devices in their own tenant
4. **Password Encryption**: API passwords are encrypted using AES-256
5. **Password Protection**: Encrypted passwords are never returned in responses
6. **Input Validation**: All inputs are validated before processing
7. **Duplicate Prevention**: Prevents duplicate management IPs and serial numbers

## Use Cases

### 1. Update Device Model After Hardware Upgrade

```bash
curl -X PUT https://api.example.com/api/firewall/devices/123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "TZ-600"}'
```

### 2. Update Firmware Version After Upgrade

```bash
curl -X PUT https://api.example.com/api/firewall/devices/123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firmwareVersion": "7.1.0"}'
```

### 3. Change Management IP Address

```bash
curl -X PUT https://api.example.com/api/firewall/devices/123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"managementIp": "192.168.1.100"}'
```

### 4. Update API Credentials

```bash
curl -X PUT https://api.example.com/api/firewall/devices/123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUsername": "newadmin",
    "apiPassword": "newpassword123"
  }'
```

### 5. Mark Device as Offline

```bash
curl -X PUT https://api.example.com/api/firewall/devices/123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "offline"}'
```

### 6. Update Multiple Fields

```bash
curl -X PUT https://api.example.com/api/firewall/devices/123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "TZ-600",
    "firmwareVersion": "7.1.0",
    "managementIp": "192.168.1.100",
    "status": "active"
  }'
```

## Implementation Details

### Partial Updates
- Only provided fields are updated
- Omitted fields remain unchanged
- At least one field must be provided

### Timestamp Management
- `updatedAt` is automatically set to current timestamp on every update
- `createdAt` is never modified

### Password Handling
- If `apiPassword` is provided, it is encrypted before storage
- Encryption uses AES-256-GCM via `FirewallEncryption.encryptPassword()`
- Original password is never stored
- Encrypted password is never returned in responses

### Conflict Detection
- Management IP uniqueness is checked within the tenant
- Serial number uniqueness is checked globally
- Updating to the same value (no change) is allowed

### Super Admin Privileges
- Can update devices from any tenant
- Bypasses tenant isolation checks
- Still requires admin role

## Related Endpoints

- `POST /api/firewall/devices` - Register new device
- `GET /api/firewall/devices` - List all devices
- `GET /api/firewall/devices/:id` - Get device details
- `DELETE /api/firewall/devices/:id` - Delete device (not yet implemented)

## Requirements

This endpoint satisfies **Requirement 15.1** from the Firewall Integration specification:
- Device Management API
- Update device metadata and credentials
- Encrypt API password if provided
- Validate input data
- Enforce tenant isolation
- Only Super Admins and Tenant Admins can update devices
