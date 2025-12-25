# Alert API Endpoints

This module provides API endpoints for managing security alerts in the AVIAN Alerts & Security Incidents system.

## Endpoints

### GET /api/alerts-incidents/alerts

List alerts with tenant-scoped filtering for All Alerts and My Alerts queues.

**Query Parameters:**
- `queue` (string): Filter by queue type
  - `all` - All unassigned alerts (triage queue)
  - `my` - Alerts assigned to current user (investigation queue)
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Number of alerts per page (default: 50)
- `status[]` (string[]): Filter by alert status
- `severity[]` (string[]): Filter by severity levels
- `classification` (string): Filter by alert classification
- `sourceSystem` (string): Filter by source system (edr, firewall, email)
- `startDate` (string): Filter alerts created after this date
- `endDate` (string): Filter alerts created before this date

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25
    },
    "metadata": {
      "unassignedCount": 15,
      "assignedCount": 10,
      "queue": "all"
    }
  }
}
```

**Requirements:** 1.1

### POST /api/alerts-incidents/alerts

Create a new alert (for testing/manual creation).

**Request Body:**
```json
{
  "sourceSystem": "edr|firewall|email",
  "sourceId": "external-alert-id",
  "alertType": "malware_detection",
  "classification": "malware",
  "severity": "critical|high|medium|low",
  "title": "Alert Title",
  "description": "Alert Description",
  "metadata": {},
  "detectedAt": "2024-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alertId": "uuid",
    "message": "Alert created successfully"
  }
}
```

**Requirements:** 12.1, 12.2

### POST /api/alerts-incidents/alerts/{id}/assign

Assign an alert to the current analyst.

**Path Parameters:**
- `id` (string): Alert UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Alert assigned successfully",
    "alertId": "uuid",
    "assignedTo": "user-id"
  }
}
```

**Requirements:** 1.4, 2.1, 2.2, 2.3

### POST /api/alerts-incidents/alerts/{id}/investigate

Start investigation on an assigned alert (status transition).

**Path Parameters:**
- `id` (string): Alert UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Investigation started successfully",
    "alertId": "uuid",
    "status": "investigating"
  }
}
```

**Requirements:** 4.2

### POST /api/alerts-incidents/alerts/{id}/resolve

Resolve an alert with outcome validation.

**Path Parameters:**
- `id` (string): Alert UUID

**Request Body:**
```json
{
  "outcome": "benign|false_positive",
  "notes": "Mandatory analyst notes explaining the resolution"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Alert resolved successfully",
    "alertId": "uuid",
    "outcome": "benign",
    "status": "closed_benign"
  }
}
```

**Requirements:** 6.1, 6.4, 6.5

### POST /api/alerts-incidents/alerts/{id}/escalate

Escalate an alert to a security incident.

**Path Parameters:**
- `id` (string): Alert UUID

**Request Body:**
```json
{
  "incidentTitle": "Optional custom incident title",
  "incidentDescription": "Optional custom incident description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Alert escalated to security incident successfully",
    "alertId": "uuid",
    "incidentId": "uuid",
    "alertStatus": "escalated"
  }
}
```

**Requirements:** 6.2, 6.3

## Authentication & Authorization

All endpoints require:
- Valid JWT token in `Authorization: Bearer <token>` header
- User must belong to a valid tenant
- Appropriate role permissions (Security Analyst or higher)

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Detailed validation error message"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "TENANT_ERROR",
    "message": "Tenant validation failed"
  }
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "code": "ASSIGNMENT_FAILED|INVESTIGATION_FAILED|RESOLUTION_FAILED|ESCALATION_FAILED",
    "message": "Specific business logic error message"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

## Usage Examples

### Get All Unassigned Alerts (Triage Queue)
```bash
curl -X GET "http://localhost:3000/api/alerts-incidents/alerts?queue=all&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

### Get My Assigned Alerts (Investigation Queue)
```bash
curl -X GET "http://localhost:3000/api/alerts-incidents/alerts?queue=my&severity=critical&severity=high" \
  -H "Authorization: Bearer <token>"
```

### Assign Alert to Current User
```bash
curl -X POST "http://localhost:3000/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/assign" \
  -H "Authorization: Bearer <token>"
```

### Start Investigation
```bash
curl -X POST "http://localhost:3000/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/investigate" \
  -H "Authorization: Bearer <token>"
```

### Resolve Alert as Benign
```bash
curl -X POST "http://localhost:3000/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/resolve" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "outcome": "benign",
    "notes": "False positive - legitimate software behavior confirmed"
  }'
```

### Escalate Alert to Incident
```bash
curl -X POST "http://localhost:3000/api/alerts-incidents/alerts/550e8400-e29b-41d4-a716-446655440000/escalate" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "incidentTitle": "Critical Security Incident",
    "incidentDescription": "Requires immediate investigation and response"
  }'
```

## Workflow

1. **Triage**: Analysts view unassigned alerts in the "All Alerts" queue
2. **Assignment**: Analyst assigns alert to themselves using `/assign` endpoint
3. **Investigation**: Analyst starts investigation using `/investigate` endpoint
4. **Resolution**: Analyst either:
   - Resolves the alert using `/resolve` endpoint with appropriate outcome
   - Escalates to incident using `/escalate` endpoint

## Integration with AlertManager and IncidentManager

The API endpoints integrate with the underlying service layer:
- `AlertManager` handles alert lifecycle, deduplication, and assignment
- `IncidentManager` handles alert escalation to security incidents
- Both services enforce tenant isolation and business rules
- All operations are logged for audit purposes

## Testing

Run the test suite:
```bash
npm test src/app/api/alerts-incidents/alerts/__tests__/
```

The tests cover:
- Authentication and authorization flows
- Input validation and error handling
- Business logic validation
- Integration with service layer
- Proper HTTP status codes and response formats