# PUT /api/firewall/alerts/:id/acknowledge

Acknowledge a firewall alert.

## Requirements

- **Requirement 15.8**: Alert Management API - Acknowledge alert endpoint
- **Requirement 12.5**: Alert acknowledgment functionality

## Endpoint

```
PUT /api/firewall/alerts/:id/acknowledge
```

## Authentication

Requires valid JWT token with tenant context.

## Path Parameters

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| id        | UUID   | Yes      | Alert ID    |

## Request

No request body required.

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Alert acknowledged successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "deviceId": "789e0123-e89b-12d3-a456-426614174000",
    "alertType": "wan_down",
    "severity": "critical",
    "message": "WAN interface is down",
    "source": "api",
    "metadata": {},
    "acknowledged": true,
    "acknowledgedBy": "456e7890-e89b-12d3-a456-426614174000",
    "acknowledgedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid Alert ID Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid alert ID format"
  }
}
```

#### 400 Bad Request - Already Acknowledged

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_ACKNOWLEDGED",
    "message": "Alert has already been acknowledged"
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

#### 403 Forbidden

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
    "message": "Alert not found or access denied"
  }
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to acknowledge alert"
  }
}
```

## Behavior

1. **Authentication**: Validates user authentication via JWT token
2. **Tenant Validation**: Ensures user has access to their tenant
3. **Alert ID Validation**: Validates UUID format
4. **Alert Lookup**: Finds alert by ID and tenant ID (enforces tenant isolation)
5. **Already Acknowledged Check**: Returns 400 if alert is already acknowledged
6. **Acknowledgment**: Updates alert with:
   - `acknowledged = true`
   - `acknowledgedBy = user.id`
   - `acknowledgedAt = current timestamp`
7. **Response**: Returns updated alert data

## Tenant Isolation

- Users can ONLY acknowledge alerts belonging to their tenant
- Attempting to acknowledge alerts from other tenants returns 404 (not 403 to avoid information leakage)
- Alert lookup includes tenant ID filter

## Example Usage

### cURL

```bash
curl -X PUT \
  https://api.example.com/api/firewall/alerts/550e8400-e29b-41d4-a716-446655440000/acknowledge \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'
```

### JavaScript (fetch)

```javascript
const response = await fetch(
  '/api/firewall/alerts/550e8400-e29b-41d4-a716-446655440000/acknowledge',
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
);

const data = await response.json();

if (data.success) {
  console.log('Alert acknowledged:', data.data);
} else {
  console.error('Error:', data.error.message);
}
```

### TypeScript (with types)

```typescript
import type { FirewallAlert } from '@/types/firewall';

interface AcknowledgeAlertResponse {
  success: boolean;
  message?: string;
  data?: FirewallAlert;
  error?: {
    code: string;
    message: string;
  };
}

async function acknowledgeAlert(alertId: string): Promise<FirewallAlert> {
  const response = await fetch(
    `/api/firewall/alerts/${alertId}/acknowledge`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data: AcknowledgeAlertResponse = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error?.message || 'Failed to acknowledge alert');
  }

  return data.data;
}
```

## Security Considerations

1. **Authentication Required**: All requests must include valid JWT token
2. **Tenant Isolation**: Users can only acknowledge alerts from their own tenant
3. **Idempotency**: Attempting to acknowledge an already-acknowledged alert returns 400
4. **Audit Trail**: Acknowledgment records user ID and timestamp for audit purposes
5. **Information Leakage Prevention**: Returns 404 (not 403) for cross-tenant access attempts

## Database Updates

The endpoint updates the `firewall_alerts` table:

```sql
UPDATE firewall_alerts
SET 
  acknowledged = true,
  acknowledged_by = :userId,
  acknowledged_at = NOW()
WHERE 
  id = :alertId
  AND tenant_id = :tenantId
  AND acknowledged = false;
```

## Related Endpoints

- `GET /api/firewall/alerts` - List alerts with filtering
- `GET /api/firewall/alerts/:id` - Get alert details (not yet implemented)

## Testing

Run tests with:

```bash
npm test src/app/api/firewall/alerts/[id]/acknowledge/__tests__/route.test.ts
```

Test coverage includes:
- Successful acknowledgment
- Authentication failures
- Tenant validation failures
- Invalid alert ID format
- Non-existent alerts
- Cross-tenant access attempts
- Already acknowledged alerts
- Error handling
- Tenant isolation enforcement
- Correct field updates
