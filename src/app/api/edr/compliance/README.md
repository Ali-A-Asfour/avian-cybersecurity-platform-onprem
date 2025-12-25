# EDR Compliance API Endpoints

This directory contains REST API endpoints for managing and querying device compliance data from Microsoft Intune.

## Endpoints

### GET /api/edr/compliance

List compliance records for the authenticated tenant with optional filtering.

**Requirements:** 4.4, 9.4, 16.2, 16.3, 16.4

**Authentication:** Required (JWT)

**Query Parameters:**
- `state` (optional): Filter by compliance state
  - Valid values: `compliant`, `noncompliant`, `unknown`
- `deviceId` (optional): Filter by specific device UUID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "deviceId": "uuid",
      "complianceState": "noncompliant",
      "failedRules": [
        {
          "ruleName": "Password Policy",
          "state": "failed"
        }
      ],
      "securityBaselineStatus": "noncompliant",
      "requiredAppsStatus": [
        {
          "appName": "Antivirus",
          "installed": false
        }
      ],
      "checkedAt": "2024-01-01T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Tenant validation failed
- `500 Internal Server Error`: Database or server error

**Examples:**

Get all compliance records:
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/compliance
```

Get non-compliant devices:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/compliance?state=noncompliant"
```

Get compliance for specific device:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/compliance?deviceId=123e4567-e89b-12d3-a456-426614174001"
```

---

### GET /api/edr/compliance/summary

Get compliance summary counts for the authenticated tenant.

**Requirements:** 4.4, 9.4, 16.1

**Authentication:** Required (JWT)

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "compliant": 10,
    "nonCompliant": 5,
    "unknown": 2,
    "total": 17
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Tenant validation failed
- `500 Internal Server Error`: Database or server error

**Examples:**

Get compliance summary:
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/compliance/summary
```

---

## Data Models

### Compliance Record

```typescript
interface ComplianceRecord {
  id: string;                    // UUID
  tenantId: string;              // UUID
  deviceId: string;              // UUID
  complianceState: string;       // 'compliant' | 'noncompliant' | 'unknown'
  failedRules: Array<{           // JSONB - failed policy rules
    ruleName: string;
    state: string;
  }> | null;
  securityBaselineStatus: string | null;
  requiredAppsStatus: Array<{    // JSONB - required app installation status
    appName: string;
    installed: boolean;
  }> | null;
  checkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Compliance Summary

```typescript
interface ComplianceSummary {
  compliant: number;      // Count of compliant devices
  nonCompliant: number;   // Count of non-compliant devices
  unknown: number;        // Count of devices with unknown state
  total: number;          // Total device count
}
```

---

## Security

### Tenant Isolation

All endpoints enforce strict tenant isolation:
- Queries are automatically filtered by the authenticated user's tenant ID
- Cross-tenant access attempts return 403 Forbidden
- Device IDs are validated to ensure they belong to the authenticated tenant

### Input Validation

- Compliance state values are validated against allowed values
- Device IDs are validated as proper UUIDs
- Invalid parameters return 400 Bad Request with descriptive error messages

---

## Testing

Run tests:
```bash
npm test src/app/api/edr/compliance
```

Run specific test file:
```bash
npm test src/app/api/edr/compliance/__tests__/route.test.ts
npm test src/app/api/edr/compliance/summary/__tests__/route.test.ts
```

---

## Implementation Notes

### Failed Rules Format

The `failedRules` field is stored as JSONB and contains an array of policy violations:
```json
[
  {
    "ruleName": "Password Policy",
    "state": "failed"
  },
  {
    "ruleName": "Encryption Required",
    "state": "failed"
  }
]
```

### Required Apps Status Format

The `requiredAppsStatus` field is stored as JSONB and contains app installation status:
```json
[
  {
    "appName": "Microsoft Defender",
    "installed": true
  },
  {
    "appName": "Company VPN",
    "installed": false
  }
]
```

### Compliance States

- `compliant`: Device meets all policy requirements
- `noncompliant`: Device fails one or more policy requirements
- `unknown`: Compliance state cannot be determined

---

## Related Endpoints

- `GET /api/edr/devices` - List all devices with compliance status
- `GET /api/edr/devices/:id` - Get device details including compliance
- `GET /api/edr/posture` - Get overall security posture (includes compliance metrics)

---

## Database Schema

Table: `edr_compliance`

```sql
CREATE TABLE edr_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES edr_devices(id) ON DELETE CASCADE,
  compliance_state VARCHAR(50) NOT NULL,
  failed_rules JSONB,
  security_baseline_status VARCHAR(50),
  required_apps_status JSONB,
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, device_id)
);
```

Indexes:
- `idx_edr_compliance_tenant` on `tenant_id`
- `idx_edr_compliance_device` on `device_id`
- `idx_edr_compliance_state` on `compliance_state`
