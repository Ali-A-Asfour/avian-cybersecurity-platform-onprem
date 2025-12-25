# GET /api/firewall/posture/:deviceId

Get the latest security posture snapshot for a firewall device.

## Requirements

**Requirement 15.6**: Posture and Health API
- Retrieve latest security posture snapshot for a device
- Include all security feature states (IPS, GAV, DPI-SSL, ATP, Botnet, AppControl, ContentFilter)
- Include daily block counts for each security feature
- Include license status for each feature
- Enforce tenant isolation
- Return 404 if device not found or belongs to different tenant
- Return 404 if no posture data exists for device

## Endpoint

```
GET /api/firewall/posture/:deviceId
```

## Authentication

Requires valid JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceId | UUID | Yes | Unique identifier of the firewall device |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "posture-uuid",
    "deviceId": "device-uuid",
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
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid Device ID Format
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ID",
    "message": "Invalid device ID format"
  }
}
```

#### 401 Unauthorized - Authentication Required
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

#### 404 Not Found - Device Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Device not found"
  }
}
```

#### 404 Not Found - No Posture Data
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No security posture data found for this device"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve security posture"
  }
}
```

#### 503 Service Unavailable - Database Error
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database connection not available"
  }
}
```

## Response Fields

### Security Posture Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier of the posture record |
| deviceId | UUID | Device identifier |
| ipsEnabled | boolean | Whether IPS is enabled |
| ipsLicenseStatus | string | IPS license status (active, expiring, expired) |
| ipsDailyBlocks | number | Number of IPS blocks today |
| gavEnabled | boolean | Whether Gateway Anti-Virus is enabled |
| gavLicenseStatus | string | GAV license status |
| gavDailyBlocks | number | Number of GAV blocks today |
| dpiSslEnabled | boolean | Whether DPI-SSL is enabled |
| dpiSslCertificateStatus | string | DPI-SSL certificate status (valid, expiring, expired) |
| dpiSslDailyBlocks | number | Number of DPI-SSL blocks today |
| atpEnabled | boolean | Whether ATP is enabled |
| atpLicenseStatus | string | ATP license status |
| atpDailyVerdicts | number | Number of ATP verdicts today |
| botnetFilterEnabled | boolean | Whether Botnet Filter is enabled |
| botnetDailyBlocks | number | Number of Botnet blocks today |
| appControlEnabled | boolean | Whether Application Control is enabled |
| appControlLicenseStatus | string | Application Control license status |
| appControlDailyBlocks | number | Number of Application Control blocks today |
| contentFilterEnabled | boolean | Whether Content Filtering is enabled |
| contentFilterLicenseStatus | string | Content Filter license status |
| contentFilterDailyBlocks | number | Number of Content Filter blocks today |
| timestamp | ISO 8601 | Timestamp when posture was captured |

## Tenant Isolation

- Regular users can only access devices belonging to their tenant
- Super admins can access devices from any tenant
- Device ownership is validated before returning posture data
- Returns 404 if device belongs to different tenant (for security)

## Usage Examples

### cURL

```bash
# Get latest security posture
curl -X GET \
  http://localhost:3000/api/firewall/posture/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript/TypeScript

```typescript
async function getSecurityPosture(deviceId: string, token: string) {
  const response = await fetch(
    `http://localhost:3000/api/firewall/posture/${deviceId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  const data = await response.json();
  return data.data;
}

// Usage
try {
  const posture = await getSecurityPosture('device-uuid', 'jwt-token');
  console.log('IPS Enabled:', posture.ipsEnabled);
  console.log('IPS Blocks Today:', posture.ipsDailyBlocks);
  console.log('GAV Enabled:', posture.gavEnabled);
  console.log('GAV Blocks Today:', posture.gavDailyBlocks);
} catch (error) {
  console.error('Failed to get security posture:', error);
}
```

### React Hook

```typescript
import { useState, useEffect } from 'react';

function useSecurityPosture(deviceId: string) {
  const [posture, setPosture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPosture() {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(
          `/api/firewall/posture/${deviceId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch security posture');
        }

        const data = await response.json();
        setPosture(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPosture();
  }, [deviceId]);

  return { posture, loading, error };
}

// Usage in component
function SecurityPosturePanel({ deviceId }) {
  const { posture, loading, error } = useSecurityPosture(deviceId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!posture) return <div>No posture data available</div>;

  return (
    <div>
      <h2>Security Posture</h2>
      <div>
        <h3>IPS</h3>
        <p>Enabled: {posture.ipsEnabled ? 'Yes' : 'No'}</p>
        <p>License: {posture.ipsLicenseStatus}</p>
        <p>Blocks Today: {posture.ipsDailyBlocks}</p>
      </div>
      <div>
        <h3>Gateway Anti-Virus</h3>
        <p>Enabled: {posture.gavEnabled ? 'Yes' : 'No'}</p>
        <p>License: {posture.gavLicenseStatus}</p>
        <p>Blocks Today: {posture.gavDailyBlocks}</p>
      </div>
      {/* More security features... */}
    </div>
  );
}
```

## Related Endpoints

- `GET /api/firewall/devices/:id` - Get device details with latest snapshot
- `GET /api/firewall/health/:deviceId` - Get health snapshots with date range
- `GET /api/firewall/licenses/:deviceId` - Get license status
- `GET /api/firewall/config/risks/:deviceId` - Get configuration risks

## Implementation Notes

1. **Latest Posture Only**: Returns the most recent security posture snapshot
2. **Ordering**: Posture records are ordered by timestamp descending
3. **Tenant Validation**: Device ownership is validated before querying posture
4. **Super Admin Access**: Super admins can access devices from any tenant
5. **No Posture Data**: Returns 404 if device has no posture records yet
6. **Performance**: Uses indexed queries on device_id and timestamp

## Testing

Run tests with:
```bash
npm test src/app/api/firewall/posture/[deviceId]/__tests__/route.test.ts
```

Test coverage includes:
- Authentication and authorization
- Input validation (UUID format)
- Device validation and tenant isolation
- Posture data retrieval
- Error handling
- Super admin access
- Missing posture data scenarios
