# Firewall Device Management API

## Overview
REST API endpoints for managing SonicWall firewall devices in the AVIAN platform.

## Endpoints

### POST /api/firewall/devices
Register a new firewall device.

**Authentication:** Required (JWT Bearer token)  
**Authorization:** Super Admin or Tenant Admin only  
**Tenant Isolation:** Enforced

#### Request Body
```json
{
  "tenantId": "uuid",           // Optional: defaults to user's tenant (Super Admin can specify)
  "model": "TZ-400",            // Optional: firewall model
  "firmwareVersion": "7.0.1",   // Optional: firmware version
  "serialNumber": "SN123456",   // Optional: device serial number
  "managementIp": "192.168.1.1", // Required: management IP address
  "apiUsername": "admin",       // Required: SonicWall API username
  "apiPassword": "password"     // Required: SonicWall API password (will be encrypted)
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "model": "TZ-400",
    "firmwareVersion": "7.0.1",
    "serialNumber": "SN123456",
    "managementIp": "192.168.1.1",
    "apiUsername": "admin",
    "apiPasswordEncrypted": null,  // Never returned
    "uptimeSeconds": 0,
    "lastSeenAt": null,
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "message": "Firewall device registered successfully"
}
```

#### Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**403 Forbidden**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Only administrators can register firewall devices"
  }
}
```

**400 Bad Request**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Management IP is required"
  }
}
```

**409 Conflict**
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_DEVICE",
    "message": "Device with serial number SN123456 already exists"
  }
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": {
    "code": "ENCRYPTION_ERROR",
    "message": "Failed to encrypt API credentials"
  }
}
```

---

### GET /api/firewall/devices
List all firewall devices for the authenticated user's tenant.

**Authentication:** Required (JWT Bearer token)  
**Authorization:** All authenticated users  
**Tenant Isolation:** Enforced

#### Query Parameters
- `status` (optional): Filter by device status (`active`, `inactive`, `offline`)
- `limit` (optional): Number of results to return (default: 50)
- `offset` (optional): Number of results to skip (default: 0)

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "model": "TZ-400",
      "firmwareVersion": "7.0.1",
      "serialNumber": "SN123456",
      "managementIp": "192.168.1.1",
      "apiUsername": "admin",
      "apiPasswordEncrypted": null,
      "uptimeSeconds": 3600,
      "lastSeenAt": "2024-01-01T12:00:00Z",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

---

## Usage Examples

### cURL Examples

#### Register a Device
```bash
curl -X POST http://localhost:3000/api/firewall/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "TZ-400",
    "firmwareVersion": "7.0.1-5050",
    "serialNumber": "SN123456789",
    "managementIp": "192.168.1.1",
    "apiUsername": "admin",
    "apiPassword": "securePassword123"
  }'
```

#### List Devices
```bash
curl -X GET "http://localhost:3000/api/firewall/devices?status=active&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript/TypeScript Example

```typescript
import { RegisterDeviceRequest, FirewallDevice } from '@/types/firewall';

async function registerFirewall(
  token: string,
  deviceData: RegisterDeviceRequest
): Promise<FirewallDevice> {
  const response = await fetch('/api/firewall/devices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deviceData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  const result = await response.json();
  return result.data;
}

// Usage
const device = await registerFirewall(jwtToken, {
  model: 'TZ-400',
  firmwareVersion: '7.0.1-5050',
  serialNumber: 'SN123456789',
  managementIp: '192.168.1.1',
  apiUsername: 'admin',
  apiPassword: 'securePassword123',
});

console.log('Device registered:', device.id);
```

### React Hook Example

```typescript
import { useState } from 'react';
import { RegisterDeviceRequest, FirewallDevice } from '@/types/firewall';

export function useRegisterDevice() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerDevice = async (
    deviceData: RegisterDeviceRequest
  ): Promise<FirewallDevice | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/firewall/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deviceData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }

      const result = await response.json();
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { registerDevice, loading, error };
}
```

## Security Considerations

### Credential Encryption
- API passwords are encrypted using AES-256 before storage
- Encryption key is stored in `FIREWALL_ENCRYPTION_KEY` environment variable
- Encrypted passwords are NEVER returned in API responses
- Decryption only occurs during API polling operations

### Tenant Isolation
- All devices are associated with a specific tenant
- Users can only access devices within their tenant
- Super Admins can access devices across all tenants
- Tenant ID is validated against JWT token claims

### Authentication & Authorization
- All endpoints require valid JWT authentication
- Device registration requires Super Admin or Tenant Admin role
- Device listing is available to all authenticated users
- Role-based access control is enforced at the middleware level

### Input Validation
- Management IP address format is validated (IPv4/IPv6)
- Required fields are enforced
- Duplicate serial numbers are prevented
- Duplicate management IPs per tenant are prevented

## Integration with Polling Engine

Once a device is registered:
1. The Polling Engine (Task 3.1) will automatically detect the new device
2. Polling will begin at the configured interval (default: 30 seconds)
3. Health snapshots will be created every 4-6 hours
4. Security posture will be tracked and updated
5. Alerts will be generated for counter changes and status changes

## Database Schema

Devices are stored in the `firewall_devices` table:

```sql
CREATE TABLE firewall_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model VARCHAR(100),
    firmware_version VARCHAR(50),
    serial_number VARCHAR(100) UNIQUE,
    management_ip VARCHAR(45) NOT NULL,
    api_username VARCHAR(255),
    api_password_encrypted TEXT,
    uptime_seconds BIGINT DEFAULT 0,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Environment Variables

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `FIREWALL_ENCRYPTION_KEY`: 256-bit encryption key (64 hex characters)
- `JWT_SECRET`: Secret for JWT token validation

Generate encryption key:
```bash
npm run generate-firewall-key
```

## Testing

Run tests:
```bash
npm test -- src/app/api/firewall/devices/__tests__/route.test.ts
```

Test coverage includes:
- Authentication and authorization
- Input validation
- Duplicate detection
- Credential encryption
- Success scenarios

## Related Documentation

- [Firewall Integration Design](/.kiro/specs/firewall-integration/design.md)
- [Firewall Integration Requirements](/.kiro/specs/firewall-integration/requirements.md)
- [Firewall Encryption Utility](/src/lib/firewall-encryption.README.md)
- [Polling Engine](/src/lib/polling-engine.ts)

## Status

- ✅ POST /api/firewall/devices - Register device (COMPLETE)
- ✅ GET /api/firewall/devices - List devices (COMPLETE)
- ⏳ GET /api/firewall/devices/:id - Get device details (TODO)
- ⏳ PUT /api/firewall/devices/:id - Update device (TODO)
- ⏳ DELETE /api/firewall/devices/:id - Delete device (TODO)
