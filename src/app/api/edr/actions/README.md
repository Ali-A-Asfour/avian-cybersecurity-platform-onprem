# EDR Remote Actions API

## Overview

This API provides endpoints for executing remote actions on EDR devices and retrieving action history with audit logging.

## Requirements

- **5.1**: User permission validation for target device's tenant
- **5.2**: Remote action execution via Microsoft Graph API
- **5.3**: Action logging with user attribution
- **9.4**: Tenant isolation enforcement
- **10.1**: Audit logging for all remote actions
- **10.3**: Audit log filtering by device, user, and date range
- **10.5**: Date range filtering support

## Endpoints

### POST /api/edr/actions

Execute a remote action on a device.

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "deviceId": "uuid",
  "actionType": "isolate" | "unisolate" | "scan" | "resolve_alert"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "deviceId": "uuid",
    "userId": "uuid",
    "actionType": "isolate",
    "status": "completed",
    "resultMessage": "Action completed successfully",
    "initiatedAt": "2024-01-01T10:00:00Z",
    "completedAt": "2024-01-01T10:01:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input (missing fields, invalid UUID, invalid action type)
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Device not found or access denied (cross-tenant access attempt)
- `500 Internal Server Error`: Action execution failed

**Action Types**:
- `isolate`: Network isolate the device
- `unisolate`: Remove network isolation
- `scan`: Run full antivirus scan
- `resolve_alert`: Mark alert as resolved (not yet implemented)

**Security**:
- Validates user has permission for target device's tenant (Requirement 5.1)
- Rejects cross-tenant action attempts with 403 (Requirement 9.4)
- Logs all actions with user attribution (Requirement 5.3, 10.1)

### GET /api/edr/actions

Retrieve action history with filtering.

**Authentication**: Required (JWT)

**Query Parameters**:
- `deviceId` (optional): Filter by device UUID
- `userId` (optional): Filter by user UUID
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "deviceId": "uuid",
      "userId": "uuid",
      "actionType": "isolate",
      "status": "completed",
      "resultMessage": "Action completed successfully",
      "initiatedAt": "2024-01-01T10:00:00Z",
      "completedAt": "2024-01-01T10:01:00Z",
      "createdAt": "2024-01-01T10:00:00Z"
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

**Error Responses**:
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Tenant validation failed
- `500 Internal Server Error`: Failed to retrieve actions

**Filtering Examples**:

Get all actions for a specific device:
```
GET /api/edr/actions?deviceId=123e4567-e89b-12d3-a456-426614174000
```

Get actions by a specific user:
```
GET /api/edr/actions?userId=123e4567-e89b-12d3-a456-426614174001
```

Get actions within a date range:
```
GET /api/edr/actions?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
```

Get actions with pagination:
```
GET /api/edr/actions?page=2&limit=25
```

## Action Workflow

1. **Validation**: Verify device exists and belongs to user's tenant
2. **Logging**: Create action record with status "pending"
3. **Execution**: Call Microsoft Graph API to execute action
4. **Update**: Update action record with result (completed/failed)
5. **Response**: Return action record to client

## Audit Trail

All remote actions are logged with:
- User ID and tenant ID
- Device ID
- Action type
- Timestamp (initiated and completed)
- Status (pending, in_progress, completed, failed)
- Result message

This provides a complete audit trail for compliance and security investigations.

## Error Handling

- **Graph API Failures**: Action status set to "failed" with error message
- **Cross-Tenant Access**: Returns 403 Forbidden
- **Invalid Input**: Returns 400 Bad Request with validation details
- **Authentication Failures**: Returns 401 Unauthorized

## Testing

Run tests:
```bash
npm test src/app/api/edr/actions/__tests__/route.test.ts
```

Tests cover:
- Action execution (isolate, unisolate, scan)
- User permission validation
- Cross-tenant access rejection
- Input validation
- Action logging
- Audit log filtering
- Date range filtering
- Pagination
- Error handling

## Future Enhancements

- Implement `resolve_alert` action type
- Add action status polling endpoint
- Support bulk actions
- Add action scheduling
- Implement action approval workflow
