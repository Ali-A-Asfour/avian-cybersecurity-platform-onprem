# Incidents API

This directory contains API endpoints for incident operations in the AVIAN Alerts & Security Incidents Module.

## Endpoints

### GET /api/alerts-incidents/incidents
List incidents with tenant-scoped filtering (My Incidents and All Incidents)

**Query Parameters:**
- `queue` (string): 'my' for My Incidents, 'all' for All Incidents
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Number of incidents per page (default: 50)
- `status` (string[]): Filter by incident status (open, in_progress, resolved, dismissed)
- `severity` (string[]): Filter by severity (critical, high, medium, low)
- `startDate` (string): Filter incidents created after this date (ISO format)
- `endDate` (string): Filter incidents created before this date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "incidents": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100
    },
    "metadata": {
      "total": 100,
      "openCount": 25,
      "inProgressCount": 15,
      "queue": "my",
      "readOnly": false
    }
  }
}
```

**Requirements:** 7.1, 8.1, 8.2, 8.4

### POST /api/alerts-incidents/incidents/[id]/start-work
Start work on incident (SLA tracking)

**Path Parameters:**
- `id` (string): Incident ID

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Work started on incident successfully",
    "incidentId": "incident-uuid"
  }
}
```

**Requirements:** 7.1, 10.1, 10.2, 10.3, 10.4, 10.5

### POST /api/alerts-incidents/incidents/[id]/resolve
Resolve incident with summary

**Path Parameters:**
- `id` (string): Incident ID

**Request Body:**
```json
{
  "summary": "Incident resolved after investigation. Root cause identified and mitigated."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Incident resolved successfully",
    "incidentId": "incident-uuid",
    "outcome": "resolved"
  }
}
```

**Requirements:** 7.4, 7.5

### POST /api/alerts-incidents/incidents/[id]/dismiss
Dismiss incident with justification

**Path Parameters:**
- `id` (string): Incident ID

**Request Body:**
```json
{
  "justification": "False positive - alert triggered by legitimate administrative activity."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Incident dismissed successfully",
    "incidentId": "incident-uuid",
    "outcome": "dismissed"
  }
}
```

**Requirements:** 7.4, 7.5

## Authentication & Authorization

All endpoints require:
1. Valid JWT token in Authorization header: `Bearer <token>`
2. User must belong to a valid tenant
3. Tenant isolation is enforced - users can only access incidents within their tenant

## Queue Types

### My Incidents (`queue=my`)
- Shows incidents owned by the current user
- Full read/write access for incident management
- Supports start-work, resolve, and dismiss operations

### All Incidents (`queue=all`)
- Shows all incidents within the tenant (read-only)
- No ownership-restricted actions available
- Used for visibility and awareness purposes

## Error Responses

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

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Incident not found or not owned by user"
  }
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS",
    "message": "Incident is not in a status that allows this operation"
  }
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Summary is required when resolving an incident"
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

## SLA Tracking

The start-work endpoint implements deterministic SLA tracking:
- `acknowledgedAt`: Set when analyst clicks "Start Work" (first time only)
- `investigationStartedAt`: Set when analyst clicks "Start Work" (first time only)
- `resolvedAt`: Set when incident status changes to 'resolved' or 'dismissed'

SLA timers are calculated based on incident severity:
- **Critical**: 15min acknowledge, 1hr investigate, 4hr resolve
- **High**: 30min acknowledge, 2hr investigate, 8hr resolve
- **Medium**: 1hr acknowledge, 4hr investigate, 24hr resolve
- **Low**: 4hr acknowledge, 8hr investigate, 72hr resolve

## Tenant Isolation

All endpoints enforce strict tenant isolation:
- Users can only access incidents within their tenant
- Incident IDs from other tenants return 404 Not Found
- All database queries are scoped to the user's tenant ID