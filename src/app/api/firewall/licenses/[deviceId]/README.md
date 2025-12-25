# GET /api/firewall/licenses/:deviceId

## Overview
Retrieves the latest license information for a specific firewall device, including expiry dates, days remaining, and license status for all security features.

## Requirements
- **Requirement 15.6**: Posture and Health API - Retrieve license status
- **Requirement 5**: License Management - Track license expiration and generate alerts

## Endpoint
```
GET /api/firewall/licenses/:deviceId
```

## Authentication
- Requires valid JWT token
- Enforces tenant isolation (users can only access devices in their tenant)
- Super admins can access devices from any tenant

## Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deviceId | UUID | Yes | Unique identifier of the firewall device |

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "111e2222-e33b-44d3-a456-426614174222",
    "deviceId": "123e4567-e89b-12d3-a456-426614174000",
    "ipsExpiry": "2024-12-31",
    "ipsDaysRemaining": 45,
    "ipsStatus": "active",
    "gavExpiry": "2024-11-15",
    "gavDaysRemaining": 10,
    "gavStatus": "expiring",
    "atpExpiry": "2025-06-30",
    "atpDaysRemaining": 180,
    "atpStatus": "active",
    "appControlExpiry": "2024-10-01",
    "appControlDaysRemaining": -30,
    "appControlStatus": "expired",
    "contentFilterExpiry": "2025-03-15",
    "contentFilterDaysRemaining": 120,
    "contentFilterStatus": "active",
    "supportExpiry": "2024-12-31",
    "supportDaysRemaining": 45,
    "supportStatus": "active",
    "licenseWarnings": [
      "GAV expiring in 10 days",
      "App Control expired"
    ],
    "timestamp": "2024-11-05T10:30:00.000Z"
  }
}
```

### License Status Values
- `"active"`: License has more than 30 days remaining
- `"expiring"`: License has 30 days or less remaining
- `"expired"`: License expiry date has passed
- `null`: No expiry date available for this license

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

#### 404 Not Found - No License Data
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No license data found for this device"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve license information"
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

## Features

### Days Remaining Calculation
The endpoint automatically calculates the number of days remaining for each license:
- Positive values: Days until expiry
- Negative values: Days since expiry
- `null`: No expiry date available

### License Status Determination
License status is automatically determined based on days remaining:
- **Active**: More than 30 days remaining
- **Expiring**: 30 days or less remaining (warning threshold)
- **Expired**: Expiry date has passed
- **Null**: No expiry date available

### Tenant Isolation
- Regular users can only access devices belonging to their tenant
- Super admins can access devices from any tenant
- Device ownership is verified before returning license data

### Latest License Data
The endpoint returns the most recent license record based on timestamp, ensuring users always see the current license status.

## Usage Examples

### cURL
```bash
# Get license information for a device
curl -X GET \
  'http://localhost:3000/api/firewall/licenses/123e4567-e89b-12d3-a456-426614174000' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### JavaScript/TypeScript
```typescript
async function getLicenseStatus(deviceId: string): Promise<LicenseResponse> {
  const response = await fetch(
    `/api/firewall/licenses/${deviceId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch license status');
  }

  return response.json();
}

// Usage
const licenseData = await getLicenseStatus('123e4567-e89b-12d3-a456-426614174000');
console.log(`IPS License: ${licenseData.data.ipsStatus} (${licenseData.data.ipsDaysRemaining} days)`);
```

### React Component
```typescript
import { useEffect, useState } from 'react';

function LicenseStatusPanel({ deviceId }: { deviceId: string }) {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLicense() {
      try {
        const response = await fetch(`/api/firewall/licenses/${deviceId}`);
        const data = await response.json();
        setLicense(data.data);
      } catch (error) {
        console.error('Failed to fetch license:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLicense();
  }, [deviceId]);

  if (loading) return <div>Loading...</div>;
  if (!license) return <div>No license data available</div>;

  return (
    <div>
      <h3>License Status</h3>
      <div>
        <span>IPS: {license.ipsStatus}</span>
        <span>({license.ipsDaysRemaining} days)</span>
      </div>
      <div>
        <span>GAV: {license.gavStatus}</span>
        <span>({license.gavDaysRemaining} days)</span>
      </div>
      {license.licenseWarnings.length > 0 && (
        <div className="warnings">
          {license.licenseWarnings.map((warning, i) => (
            <div key={i}>{warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Database Schema
The endpoint queries the `firewall_licenses` table:

```sql
CREATE TABLE firewall_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES firewall_devices(id) ON DELETE CASCADE,
    ips_expiry DATE,
    gav_expiry DATE,
    atp_expiry DATE,
    app_control_expiry DATE,
    content_filter_expiry DATE,
    support_expiry DATE,
    license_warnings JSONB DEFAULT '[]',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Related Endpoints
- `GET /api/firewall/devices/:id` - Get device details with latest snapshot
- `GET /api/firewall/posture/:deviceId` - Get security posture
- `GET /api/firewall/health/:deviceId` - Get health snapshots

## Testing
Comprehensive tests are available in `__tests__/route.test.ts`:
- Success cases with valid device and license data
- Days remaining calculation accuracy
- License status determination logic
- Null expiry date handling
- Authentication and authorization
- Tenant isolation enforcement
- Super admin access
- Error handling for all edge cases

Run tests:
```bash
npm test -- src/app/api/firewall/licenses/[deviceId]/__tests__/route.test.ts
```

## Implementation Notes

### Performance
- Uses indexed queries on `device_id` and `timestamp`
- Returns only the latest license record
- Efficient date calculations performed in-memory

### Security
- JWT authentication required
- Tenant isolation enforced at database query level
- UUID validation prevents injection attacks
- Super admin role check for cross-tenant access

### Data Freshness
- Returns the most recent license record by timestamp
- License data is updated by the polling engine
- Warnings array provides human-readable status messages

## Future Enhancements
- Add query parameter for historical license data
- Support for license renewal notifications
- Bulk license status queries for multiple devices
- License compliance reporting
