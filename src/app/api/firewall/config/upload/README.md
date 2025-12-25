# POST /api/firewall/config/upload

Upload and analyze a SonicWall firewall configuration file.

## Requirements

- **Requirements:** 15.4 - Configuration API
- **Authentication:** Required (JWT token)
- **Authorization:** Super Admin or Tenant Admin only
- **Tenant Isolation:** Enforced (users can only upload configs for devices in their tenant)

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Body
```json
{
  "deviceId": "uuid",
  "configText": "string",
  "snapshotId": "uuid (optional)"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceId` | string (UUID) | Yes | ID of the firewall device |
| `configText` | string | Yes | Raw configuration file content (.exp format) |
| `snapshotId` | string (UUID) | No | Optional snapshot ID for tracking config versions |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "deviceId": "device-123",
    "snapshotId": "snapshot-123",
    "riskScore": 45,
    "riskCounts": {
      "critical": 3,
      "high": 2,
      "medium": 5,
      "low": 8,
      "total": 18
    },
    "risks": [
      {
        "riskId": "risk-123",
        "riskCategory": "exposure_risk",
        "riskType": "WAN_MANAGEMENT_ENABLED",
        "severity": "critical",
        "description": "WAN management access enabled - exposes admin interface to internet",
        "remediation": "Disable WAN management access immediately...",
        "detectedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "parsedConfig": {
      "rulesCount": 25,
      "natPoliciesCount": 5,
      "addressObjectsCount": 10,
      "serviceObjectsCount": 8,
      "vpnConfigsCount": 3,
      "interfacesCount": 4,
      "securitySettings": {
        "ipsEnabled": true,
        "gavEnabled": true,
        "antiSpywareEnabled": false,
        "appControlEnabled": true,
        "contentFilterEnabled": false,
        "botnetFilterEnabled": true,
        "dpiSslEnabled": false,
        "geoIpFilterEnabled": false
      },
      "adminSettings": {
        "adminUsernames": ["admin"],
        "mfaEnabled": false,
        "wanManagementEnabled": true,
        "httpsAdminPort": 443,
        "sshEnabled": true
      },
      "systemSettings": {
        "firmwareVersion": "7.0.1-5050",
        "hostname": "firewall-01",
        "timezone": "America/New_York",
        "ntpServers": ["pool.ntp.org"],
        "dnsServers": ["8.8.8.8", "8.8.4.4"]
      }
    }
  },
  "message": "Configuration uploaded and analyzed successfully"
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

#### 400 Bad Request - Parse Error
```json
{
  "success": false,
  "error": {
    "code": "PARSE_ERROR",
    "message": "Failed to parse configuration file. Please ensure the file is in valid SonicWall .exp format",
    "details": "Unexpected token at line 42"
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
    "message": "Only administrators can upload firewall configurations"
  }
}
```

#### 403 Forbidden - Wrong Tenant
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Cannot access device from another tenant"
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Firewall device not found"
  }
}
```

#### 500 Internal Server Error - Analysis Error
```json
{
  "success": false,
  "error": {
    "code": "ANALYSIS_ERROR",
    "message": "Failed to analyze configuration for risks",
    "details": "Risk engine error details"
  }
}
```

#### 500 Internal Server Error - Storage Error
```json
{
  "success": false,
  "error": {
    "code": "STORAGE_ERROR",
    "message": "Failed to store configuration risks",
    "details": "Database error details"
  }
}
```

#### 503 Service Unavailable
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database connection not available"
  }
}
```

## Workflow

1. **Authentication & Authorization**
   - Verify JWT token
   - Validate tenant membership
   - Check user role (must be Super Admin or Tenant Admin)

2. **Input Validation**
   - Validate deviceId is provided and non-empty
   - Validate configText is provided and non-empty
   - Validate snapshotId format if provided

3. **Device Verification**
   - Check device exists in database
   - Enforce tenant isolation (unless Super Admin)

4. **Configuration Parsing**
   - Parse configuration using ConfigParser
   - Extract rules, NAT policies, objects, settings
   - Handle parsing errors gracefully

5. **Risk Detection**
   - Analyze parsed config using RiskEngine
   - Detect all 30+ risk types
   - Calculate risk score (0-100)

6. **Risk Storage**
   - Delete old risks for the device
   - Store new detected risks
   - Associate with snapshotId if provided

7. **Response**
   - Return risk summary with counts
   - Include parsed config summary
   - Provide risk score and detailed risk list

## Risk Detection

The endpoint detects 30+ risk types across 4 categories:

### Exposure Risks (Critical/High)
- WAN_MANAGEMENT_ENABLED
- OPEN_INBOUND (WAN to LAN any rules)
- SSH_ON_WAN
- DHCP_ON_WAN

### Security Feature Disabled (Critical/High/Medium)
- IPS_DISABLED
- GAV_DISABLED
- BOTNET_FILTER_DISABLED
- DPI_SSL_DISABLED
- APP_CONTROL_DISABLED
- CONTENT_FILTER_DISABLED
- VPN_WEAK_ENCRYPTION

### Network Misconfiguration (High/Medium)
- ANY_ANY_RULE
- GUEST_NOT_ISOLATED

### Best Practice Violations (High/Medium/Low)
- ADMIN_NO_MFA
- DEFAULT_ADMIN_USERNAME
- DEFAULT_ADMIN_PORT
- VPN_PSK_ONLY
- RULE_NO_DESCRIPTION
- OUTDATED_FIRMWARE
- NO_NTP

## Risk Scoring

- **Base Score:** 100
- **Deductions:**
  - Critical: -25 points
  - High: -15 points
  - Medium: -5 points
  - Low: -1 point
- **Range:** 0-100 (lower is worse)

## Example Usage

### cURL
```bash
curl -X POST https://api.example.com/api/firewall/config/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-123",
    "configText": "# SonicWall Configuration\nhostname test-firewall\n...",
    "snapshotId": "snapshot-123"
  }'
```

### JavaScript/TypeScript
```typescript
const response = await fetch('/api/firewall/config/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deviceId: 'device-123',
    configText: configFileContent,
    snapshotId: 'snapshot-123', // optional
  }),
});

const data = await response.json();

if (data.success) {
  console.log('Risk Score:', data.data.riskScore);
  console.log('Critical Risks:', data.data.riskCounts.critical);
  console.log('Total Risks:', data.data.riskCounts.total);
} else {
  console.error('Error:', data.error.message);
}
```

## Notes

- Configuration files must be in SonicWall .exp format
- Old risks are automatically deleted when new config is uploaded
- Risk detection follows the official Firewall Risk Rules + Severity Matrix
- Tenant isolation is strictly enforced (except for Super Admins)
- Configuration parsing is fault-tolerant and will extract as much data as possible
- Risk score calculation follows the formula: 100 - (critical×25 + high×15 + medium×5 + low×1)

## Related Endpoints

- `GET /api/firewall/config/risks/:deviceId` - Get configuration risks for a device
- `GET /api/firewall/devices/:id` - Get device details
- `POST /api/firewall/devices` - Register a new device

## Testing

Run tests with:
```bash
npm test src/app/api/firewall/config/upload/__tests__/route.test.ts
```

## Implementation Details

- **Parser:** `ConfigParser` class from `@/lib/firewall-config-parser`
- **Risk Engine:** `RiskEngine` class from `@/lib/firewall-config-parser`
- **Risk Storage:** Functions from `@/lib/firewall-risk-storage`
- **Database:** Drizzle ORM with PostgreSQL
- **Tables:** `firewall_devices`, `firewall_config_risks`
