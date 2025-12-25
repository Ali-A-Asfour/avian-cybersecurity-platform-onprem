# EDR Vulnerabilities API

This directory contains REST API endpoints for managing and querying EDR vulnerabilities from Microsoft Defender.

## Endpoints

### GET /api/edr/vulnerabilities

List all vulnerabilities for the authenticated tenant with filtering and pagination support.

**Requirements:** 3.4, 9.4, 15.2, 15.4

**Authentication:** Required (JWT)

**Query Parameters:**
- `severity` (optional): Filter by severity level
  - Valid values: `low`, `medium`, `high`, `critical`
- `exploitability` (optional): Filter by exploitability status
  - Valid values: `unproven`, `proof_of_concept`, `functional`, `high`
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of results per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "cveId": "CVE-2024-1234",
      "severity": "critical",
      "cvssScore": 9.8,
      "exploitability": "high",
      "description": "Critical vulnerability description",
      "affectedDeviceCount": 5,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
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

**Features:**
- Automatic tenant isolation (only returns vulnerabilities for authenticated tenant)
- Includes affected device count for each vulnerability
- Results ordered by CVSS score (descending)
- Pagination support
- Multiple filter combinations

**Example Requests:**

```bash
# Get all vulnerabilities
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/vulnerabilities

# Filter by critical severity
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/vulnerabilities?severity=critical"

# Filter by high exploitability
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/vulnerabilities?exploitability=high"

# Combined filters with pagination
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/edr/vulnerabilities?severity=critical&exploitability=high&page=1&limit=20"
```

**Error Responses:**

- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Tenant validation failed
- `500 Internal Server Error`: Server error occurred
- `503 Service Unavailable`: Database connection not available

---

### GET /api/edr/vulnerabilities/:cveId/devices

Get all devices affected by a specific vulnerability.

**Requirements:** 3.4, 9.4, 15.4

**Authentication:** Required (JWT)

**Path Parameters:**
- `cveId`: CVE identifier (format: CVE-YYYY-NNNNN)
  - Year must be 4 digits
  - Number must be 4-7 digits
  - Case insensitive

**Response:**
```json
{
  "success": true,
  "data": {
    "vulnerability": {
      "id": "uuid",
      "cveId": "CVE-2024-1234",
      "severity": "critical",
      "cvssScore": 9.8,
      "exploitability": "high",
      "description": "Critical vulnerability description"
    },
    "devices": [
      {
        "id": "uuid",
        "tenantId": "uuid",
        "microsoftDeviceId": "device-id",
        "deviceName": "DESKTOP-001",
        "operatingSystem": "Windows 11",
        "osVersion": "22H2",
        "primaryUser": "user@example.com",
        "defenderHealthStatus": "active",
        "riskScore": 75,
        "exposureLevel": "high",
        "intuneComplianceState": "noncompliant",
        "intuneEnrollmentStatus": "enrolled",
        "lastSeenAt": "2024-01-01T00:00:00Z",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
        "vulnerabilityDetectedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "meta": {
      "total": 5
    }
  }
}
```

**Features:**
- Automatic tenant isolation (only returns devices for authenticated tenant)
- Includes full device details for each affected device
- Includes vulnerability detection timestamp for each device
- Returns vulnerability details along with affected devices
- Validates CVE ID format

**Example Requests:**

```bash
# Get devices affected by CVE-2024-1234
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/vulnerabilities/CVE-2024-1234/devices

# Case insensitive CVE ID
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/edr/vulnerabilities/cve-2024-1234/devices
```

**Error Responses:**

- `400 Bad Request`: Invalid CVE ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Tenant validation failed
- `404 Not Found`: Vulnerability not found for this tenant
- `500 Internal Server Error`: Server error occurred
- `503 Service Unavailable`: Database connection not available

---

## Data Models

### Vulnerability

```typescript
interface Vulnerability {
  id: string;
  tenantId: string;
  cveId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cvssScore: number | null;
  exploitability: 'unproven' | 'proof_of_concept' | 'functional' | 'high';
  description: string;
  affectedDeviceCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Device (in vulnerability context)

```typescript
interface AffectedDevice {
  id: string;
  tenantId: string;
  microsoftDeviceId: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  primaryUser: string;
  defenderHealthStatus: string;
  riskScore: number;
  exposureLevel: string;
  intuneComplianceState: string;
  intuneEnrollmentStatus: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  vulnerabilityDetectedAt: Date;
}
```

---

## Security

### Tenant Isolation

All endpoints enforce strict tenant isolation:
- Vulnerabilities are filtered by the authenticated user's tenant ID
- Cross-tenant access attempts return 404 (not 403) to prevent information disclosure
- Device associations respect tenant boundaries

### Authentication

All endpoints require valid JWT authentication:
- Token must be provided in Authorization header
- Token must contain valid tenant_id claim
- Expired or invalid tokens return 401

### Input Validation

All inputs are validated:
- CVE ID format validation (CVE-YYYY-NNNNN)
- Severity and exploitability enum validation
- Pagination parameter range validation
- SQL injection prevention via parameterized queries

---

## Database Schema

### edr_vulnerabilities

```sql
CREATE TABLE edr_vulnerabilities (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cve_id VARCHAR(50) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  cvss_score DECIMAL(3,1),
  exploitability VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(tenant_id, cve_id)
);
```

### edr_device_vulnerabilities

```sql
CREATE TABLE edr_device_vulnerabilities (
  device_id UUID NOT NULL REFERENCES edr_devices(id),
  vulnerability_id UUID NOT NULL REFERENCES edr_vulnerabilities(id),
  detected_at TIMESTAMP NOT NULL,
  PRIMARY KEY (device_id, vulnerability_id)
);
```

---

## Testing

Run tests with:

```bash
npm test src/app/api/edr/vulnerabilities
```

Test coverage includes:
- Authentication and authorization
- CVE ID format validation
- Severity filtering
- Exploitability filtering
- Combined filtering
- Pagination
- Tenant isolation
- Affected device count accuracy
- Response format validation
- Error handling

---

## Related Endpoints

- `GET /api/edr/devices` - List all EDR devices
- `GET /api/edr/devices/:id` - Get device details (includes vulnerabilities)
- `GET /api/edr/alerts` - List all EDR alerts
- `GET /api/edr/compliance` - List compliance status

---

## Implementation Notes

### Performance Considerations

- Vulnerabilities are ordered by CVSS score (descending) for prioritization
- Affected device counts are calculated via efficient GROUP BY query
- Indexes on tenant_id, severity, and cvss_score optimize filtering
- Pagination prevents large result sets

### Data Source

Vulnerability data is retrieved from Microsoft Defender for Endpoint via the polling worker:
- Polling worker fetches vulnerabilities from Microsoft Graph API
- Data is normalized and stored in PostgreSQL
- Device-vulnerability associations are maintained in junction table
- Updates occur on configurable schedule (default: 15 minutes)

### Future Enhancements

- Vulnerability trend analysis
- Patch availability information
- Remediation recommendations
- Export to CSV/PDF
- Vulnerability age tracking
- CVSS v3 vector string support
