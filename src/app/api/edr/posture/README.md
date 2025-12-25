# EDR Posture Score API Endpoints

## Overview

The posture score endpoints provide access to the overall security posture score for a tenant. The posture score is calculated based on device risk scores, active alerts, vulnerabilities, and compliance status.

## Endpoints

### GET /api/edr/posture

Retrieve the current posture score for the authenticated tenant.

**Requirements:** 6.3, 9.4, 17.2, 17.3, 17.4

**Authentication:** Required (JWT)

**Authorization:** Tenant-scoped

**Query Parameters:** None

**Response:**

```json
{
  "success": true,
  "data": {
    "score": 75,
    "trend": "up",
    "factors": {
      "deviceRiskAverage": 35,
      "alertSeverityDistribution": {
        "low": 2,
        "medium": 2,
        "high": 1
      },
      "vulnerabilityExposure": 3,
      "compliancePercentage": 90
    },
    "deviceCount": 10,
    "highRiskDeviceCount": 2,
    "activeAlertCount": 5,
    "criticalVulnerabilityCount": 3,
    "nonCompliantDeviceCount": 1,
    "calculatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Insufficient Data Response:**

```json
{
  "success": true,
  "data": null,
  "message": "Insufficient data for posture score calculation"
}
```

**Trend Calculation:**
- `up`: Current score is higher than previous score
- `down`: Current score is lower than previous score
- `stable`: Current score equals previous score OR only one score exists

**Contributing Factors:**
- `deviceRiskAverage`: Average risk score across all devices (0-100)
- `alertSeverityDistribution`: Count of active alerts by severity
- `vulnerabilityExposure`: Count of critical vulnerabilities (CVSS >= 7.0)
- `compliancePercentage`: Percentage of compliant devices (0-100)

**Error Responses:**

- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Tenant validation failed
- `500 Internal Server Error`: Failed to retrieve posture score
- `503 Service Unavailable`: Database connection not available

### GET /api/edr/posture/history

Retrieve historical posture scores for the authenticated tenant.

**Requirements:** 17.4

**Authentication:** Required (JWT)

**Authorization:** Tenant-scoped

**Query Parameters:**

- `startDate` (optional): ISO 8601 date string - Filter scores calculated on or after this date
- `endDate` (optional): ISO 8601 date string - Filter scores calculated on or before this date

**Example Request:**

```
GET /api/edr/posture/history?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "3",
      "score": 80,
      "deviceCount": 10,
      "highRiskDeviceCount": 1,
      "activeAlertCount": 3,
      "criticalVulnerabilityCount": 2,
      "nonCompliantDeviceCount": 1,
      "calculatedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "2",
      "score": 75,
      "deviceCount": 10,
      "highRiskDeviceCount": 2,
      "activeAlertCount": 5,
      "criticalVulnerabilityCount": 3,
      "nonCompliantDeviceCount": 1,
      "calculatedAt": "2024-01-14T10:00:00.000Z"
    },
    {
      "id": "1",
      "score": 70,
      "deviceCount": 10,
      "highRiskDeviceCount": 3,
      "activeAlertCount": 7,
      "criticalVulnerabilityCount": 4,
      "nonCompliantDeviceCount": 2,
      "calculatedAt": "2024-01-13T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 3,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.000Z"
  }
}
```

**Empty Response:**

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0,
    "startDate": null,
    "endDate": null
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid date format or startDate after endDate
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Tenant validation failed
- `500 Internal Server Error`: Failed to retrieve posture score history
- `503 Service Unavailable`: Database connection not available

## Posture Score Calculation

The posture score is calculated using the following formula:

```
Total Score = (Device Risk Score × 30%) + 
              (Active Alerts Score × 25%) + 
              (Vulnerabilities Score × 25%) + 
              (Compliance Score × 20%)
```

### Component Scores

**Device Risk Score (30% weight):**
- Inverts average device risk: `100 - averageRiskScore`
- Lower device risk = higher score

**Active Alerts Score (25% weight):**
- Weighted by severity: High (1.0), Medium (0.5), Low (0.2)
- Uses exponential decay: `100 × e^(-weightedAlerts / 10)`
- Fewer alerts = higher score

**Vulnerabilities Score (25% weight):**
- Counts critical vulnerabilities (CVSS >= 7.0)
- Uses exponential decay: `100 × e^(-criticalVulns / 20)`
- Fewer critical vulnerabilities = higher score

**Compliance Score (20% weight):**
- Direct percentage: `(compliantDevices / totalDevices) × 100`
- Higher compliance = higher score

## Tenant Isolation

All endpoints enforce strict tenant isolation:

1. JWT token is validated and user is extracted
2. Tenant ID is extracted from user claims
3. All database queries filter by tenant ID
4. Cross-tenant access attempts return 403 Forbidden

## Usage Examples

### Get Current Posture Score

```bash
curl -X GET \
  'https://api.example.com/api/edr/posture' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Get Historical Scores for Last 30 Days

```bash
curl -X GET \
  'https://api.example.com/api/edr/posture/history?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Get All Historical Scores

```bash
curl -X GET \
  'https://api.example.com/api/edr/posture/history' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

## Frontend Integration

### Auto-Refresh Pattern

```typescript
useEffect(() => {
  const fetchPosture = async () => {
    const response = await fetch('/api/edr/posture', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    setPostureData(data.data);
  };

  // Initial fetch
  fetchPosture();

  // Auto-refresh every 30 seconds
  const interval = setInterval(fetchPosture, 30000);

  // Cleanup on unmount
  return () => clearInterval(interval);
}, [token]);
```

### Trend Display

```typescript
const TrendIndicator = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
  if (trend === 'up') {
    return <span className="text-green-500">↑ Improving</span>;
  } else if (trend === 'down') {
    return <span className="text-red-500">↓ Declining</span>;
  } else {
    return <span className="text-gray-500">→ Stable</span>;
  }
};
```

### Historical Chart

```typescript
const PostureHistoryChart = ({ history }: { history: PostureScore[] }) => {
  const chartData = history.map(score => ({
    date: new Date(score.calculatedAt).toLocaleDateString(),
    score: score.score
  }));

  return (
    <LineChart data={chartData}>
      <XAxis dataKey="date" />
      <YAxis domain={[0, 100]} />
      <Line type="monotone" dataKey="score" stroke="#8884d8" />
    </LineChart>
  );
};
```

## Testing

Run the test suite:

```bash
npm test src/app/api/edr/posture/__tests__/route.test.ts
npm test src/app/api/edr/posture/history/__tests__/route.test.ts
```

## Related Documentation

- [EDR Posture Calculator](../../../../lib/edr-posture-calculator.README.md)
- [EDR Database Operations](../../../../lib/edr-database-operations.README.md)
- [EDR Design Document](../../../../../.kiro/specs/edr-defender-intune/design.md)
