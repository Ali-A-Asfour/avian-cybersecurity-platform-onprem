# EDR Devices API

This directory contains the REST API endpoints for managing and querying EDR (Endpoint Detection and Response) devices from Microsoft Defender and Intune.

## Endpoints

### GET /api/edr/devices

List all EDR devices for the authenticated tenant with support for search, filtering, and pagination.

**Authentication:** Required (JWT Bearer token)

**Query Parameters:**
- `search` (string, optional): Search by device name or primary user
- `os` (string, optional): Filter by operating system (partial match)
- `riskLevel` (string, optional): Filter by risk level (`low`, `medium`, `high`)
- `complianceState` (string, optional): Filter by compliance state (`compliant`, `noncompliant`, `unknown`)
- `lastSeenAfter` (string, optional): Filter devices last seen after this date (ISO 8601 format)
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of results per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "microsoftDeviceId": "string",
      "deviceName": "string",
      "operatingSystem": "string",
      "osVersion": "string",
      "primaryUser": "string",
      "defenderHealthStatus": "string",
      "riskScore": 0-100,
      "exposureLevel": "string",
      "intuneComplianceState": "string",
      "intuneEnrollmentStatus": "string",
      "lastSeenAt": "ISO 8601 date",
      "createdAt": "ISO 8601 date",
      "updatedAt": "ISO 8601 date"
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

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Tenant validation failed
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Database connection not available

**Examples:**

```bash
# List all devices
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/devices

# Search for devices by name
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/devices?search=DESKTOP"

# Filter by risk level
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/devices?riskLevel=high"

# Filter by compliance state
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/devices?complianceState=noncompliant"

# Filter by OS
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/devices?os=Windows%2011"

# Filter by last seen date
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/devices?lastSeenAfter=2024-01-01T00:00:00Z"

# Combine filters with pagination
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/devices?riskLevel=high&complianceState=noncompliant&page=1&limit=20"
```

### GET /api/edr/devices/:id

Get detailed information about a specific EDR device, including related alerts, vulnerabilities, compliance status, and available remote actions.

**Authentication:** Required (JWT Bearer token)

**Path Parameters:**
- `id` (UUID, required): Device ID

**Response:**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "uuid",
      "tenantId": "uuid",
      "microsoftDeviceId": "string",
      "deviceName": "string",
      "operatingSystem": "string",
      "osVersion": "string",
      "primaryUser": "string",
      "defenderHealthStatus": "string",
      "riskScore": 0-100,
      "exposureLevel": "string",
      "intuneComplianceState": "string",
      "intuneEnrollmentStatus": "string",
      "lastSeenAt": "ISO 8601 date",
      "createdAt": "ISO 8601 date",
      "updatedAt": "ISO 8601 date"
    },
    "alerts": [
      {
        "id": "uuid",
        "tenantId": "uuid",
        "deviceId": "uuid",
        "microsoftAlertId": "string",
        "severity": "string",
        "threatType": "string",
        "threatName": "string",
        "status": "string",
        "description": "string",
        "detectedAt": "ISO 8601 date",
        "createdAt": "ISO 8601 date",
        "updatedAt": "ISO 8601 date"
      }
    ],
    "vulnerabilities": [
      {
        "id": "uuid",
        "tenantId": "uuid",
        "cveId": "string",
        "severity": "string",
        "cvssScore": 0.0-10.0,
        "exploitability": "string",
        "description": "string",
        "detectedAt": "ISO 8601 date",
        "createdAt": "ISO 8601 date",
        "updatedAt": "ISO 8601 date"
      }
    ],
    "compliance": {
      "id": "uuid",
      "tenantId": "uuid",
      "deviceId": "uuid",
      "complianceState": "string",
      "failedRules": [],
      "securityBaselineStatus": "string",
      "requiredAppsStatus": [],
      "checkedAt": "ISO 8601 date",
      "createdAt": "ISO 8601 date",
      "updatedAt": "ISO 8601 date"
    },
    "availableActions": [
      {
        "type": "isolate|unisolate|scan",
        "label": "string",
        "description": "string"
      }
    ]
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid device ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Device belongs to another tenant
- `404 Not Found`: Device not found
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Database connection not available

**Examples:**

```bash
# Get device details
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/devices/550e8400-e29b-41d4-a716-446655440000
```

## Tenant Isolation

All endpoints enforce strict tenant isolation:
- Devices are automatically filtered by the authenticated user's tenant ID
- Cross-tenant access attempts return `403 Forbidden`
- Super admins can access devices from any tenant

## Requirements Validation

These endpoints satisfy the following requirements from the design document:

- **Requirement 1.4**: Device data retrieval with tenant filtering
- **Requirement 8.4**: JWT authentication and tenant extraction
- **Requirement 9.4**: Tenant ID filtering in all queries
- **Requirement 9.5**: Cross-tenant access rejection
- **Requirement 13.2**: Search functionality (hostname, user)
- **Requirement 13.3**: Filters (OS, risk level, compliance state, last seen date)
- **Requirement 13.4**: Device detail data completeness (alerts, vulnerabilities, compliance, actions)

## Testing

Run the test suite:

```bash
npm test src/app/api/edr/devices/__tests__/route.test.ts
npm test src/app/api/edr/devices/[id]/__tests__/route.test.ts
```

## Related Files

- Database schema: `database/schemas/edr.ts`
- Type definitions: `src/types/edr.ts`
- Authentication middleware: `src/middleware/auth.middleware.ts`
- Tenant middleware: `src/middleware/tenant.middleware.ts`
