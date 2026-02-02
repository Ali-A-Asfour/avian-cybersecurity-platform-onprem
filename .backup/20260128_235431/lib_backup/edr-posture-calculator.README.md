# EDR Posture Score Calculator

## Overview

The EDR Posture Score Calculator provides a comprehensive security posture assessment for each tenant by analyzing device risk, active alerts, vulnerabilities, and compliance status. The calculator produces a single score from 0-100, where higher scores indicate better security posture.

## Calculation Algorithm

### Weight Distribution

The posture score is calculated using weighted components:

- **Device Risk Scores**: 30%
- **Active Alerts**: 25%
- **Vulnerabilities**: 25%
- **Compliance**: 20%

### Component Calculations

#### 1. Device Risk Score (30%)

Calculates the average risk score across all devices and inverts it to produce a posture score.

- **Input**: Device risk scores (0-100, where higher = more risky)
- **Output**: Component score (0-100, where higher = better)
- **Formula**: `100 - averageRiskScore`
- **High Risk Threshold**: Devices with risk score >= 70

**Example**:
- 10 devices with average risk score of 30
- Component score = 100 - 30 = 70
- Weighted contribution = 70 * 0.30 = 21 points

#### 2. Active Alerts Score (25%)

Evaluates the impact of active security alerts, weighted by severity.

- **Input**: Active alerts by severity (high, medium, low)
- **Output**: Component score (0-100, where higher = better)
- **Severity Weights**:
  - High: 1.0
  - Medium: 0.5
  - Low: 0.2
- **Formula**: `100 * exp(-weightedAlertCount / 10)`

**Example**:
- 2 high alerts, 3 medium alerts, 5 low alerts
- Weighted count = (2 * 1.0) + (3 * 0.5) + (5 * 0.2) = 4.5
- Component score = 100 * exp(-4.5 / 10) ≈ 64
- Weighted contribution = 64 * 0.25 = 16 points

#### 3. Vulnerabilities Score (25%)

Focuses on critical vulnerabilities (CVSS >= 7.0).

- **Input**: Vulnerability CVSS scores
- **Output**: Component score (0-100, where higher = better)
- **Critical Threshold**: CVSS >= 7.0
- **Formula**: `100 * exp(-criticalVulnCount / 20)`

**Example**:
- 5 critical vulnerabilities (CVSS >= 7.0)
- Component score = 100 * exp(-5 / 20) ≈ 78
- Weighted contribution = 78 * 0.25 = 19.5 points

#### 4. Compliance Score (20%)

Measures the percentage of devices meeting compliance policies.

- **Input**: Device compliance states
- **Output**: Component score (0-100, where higher = better)
- **Formula**: `(compliantDevices / totalDevices) * 100`

**Example**:
- 8 compliant devices out of 10 total
- Component score = (8 / 10) * 100 = 80
- Weighted contribution = 80 * 0.20 = 16 points

### Final Score Calculation

The final posture score is the sum of all weighted components, rounded to the nearest integer.

**Complete Example**:
```
Device Risk:      21.0 points (70 * 0.30)
Active Alerts:    16.0 points (64 * 0.25)
Vulnerabilities:  19.5 points (78 * 0.25)
Compliance:       16.0 points (80 * 0.20)
─────────────────────────────────
Total Score:      72.5 → 73 (rounded)
```

## Usage

### Calculate Posture Score

```typescript
import { calculatePostureScore } from '@/lib/edr-posture-calculator';

// Calculate score without storing
const result = await calculatePostureScore(tenantId);

console.log(`Posture Score: ${result.score}`);
console.log(`Device Count: ${result.deviceCount}`);
console.log(`High Risk Devices: ${result.highRiskDeviceCount}`);
console.log(`Active Alerts: ${result.activeAlertCount}`);
console.log(`Critical Vulnerabilities: ${result.criticalVulnerabilityCount}`);
console.log(`Non-Compliant Devices: ${result.nonCompliantDeviceCount}`);

// Access detailed factors
console.log(`Average Device Risk: ${result.factors.deviceRiskAverage}`);
console.log(`Alert Distribution:`, result.factors.alertSeverityDistribution);
console.log(`Vulnerability Exposure: ${result.factors.vulnerabilityExposure}`);
console.log(`Compliance Percentage: ${result.factors.compliancePercentage}%`);
```

### Calculate and Store Posture Score

```typescript
import { calculateAndStorePostureScore } from '@/lib/edr-posture-calculator';

// Calculate and store in database
const postureScore = await calculateAndStorePostureScore(tenantId);

console.log(`Stored Posture Score: ${postureScore.score}`);
console.log(`Score ID: ${postureScore.id}`);
console.log(`Calculated At: ${postureScore.calculatedAt}`);
```

### Integration with Polling Worker

```typescript
import { calculateAndStorePostureScore } from '@/lib/edr-posture-calculator';

async function pollTenant(tenantId: string) {
    // ... fetch and store devices, alerts, vulnerabilities, compliance ...
    
    // Calculate and store posture score after data sync
    const postureScore = await calculateAndStorePostureScore(tenantId);
    
    console.log(`Tenant ${tenantId} posture score: ${postureScore.score}`);
}
```

## Edge Cases

### No Data Available

When a tenant has no devices, alerts, vulnerabilities, or compliance data:

- **Device Risk**: Score = 100 (no devices = no risk)
- **Active Alerts**: Score = 100 (no alerts = perfect)
- **Vulnerabilities**: Score = 100 (no vulnerabilities = perfect)
- **Compliance**: Score = 100 (no devices = perfect compliance)
- **Final Score**: 100

### Partial Data

The calculator handles partial data gracefully:

- Missing devices: Device risk component = 100
- Missing alerts: Alert component = 100
- Missing vulnerabilities: Vulnerability component = 100
- Missing compliance: Compliance component = 100

### Extreme Values

The calculator uses exponential decay to handle extreme values:

- **Many alerts**: Score approaches 0 asymptotically
- **Many vulnerabilities**: Score approaches 0 asymptotically
- **High device risk**: Score is capped at 0 (worst case)
- **Perfect security**: Score is capped at 100 (best case)

## Score Interpretation

| Score Range | Interpretation | Recommended Action |
|-------------|----------------|-------------------|
| 90-100 | Excellent | Maintain current security posture |
| 75-89 | Good | Monitor for emerging threats |
| 60-74 | Fair | Address high-priority issues |
| 40-59 | Poor | Immediate remediation required |
| 0-39 | Critical | Emergency response needed |

## Contributing Factors

The `PostureFactors` object provides detailed insights:

```typescript
interface PostureFactors {
    deviceRiskAverage: number;              // Average risk score (0-100)
    alertSeverityDistribution: {            // Count by severity
        low: number;
        medium: number;
        high: number;
    };
    vulnerabilityExposure: number;          // Count of critical vulnerabilities
    compliancePercentage: number;           // Percentage of compliant devices
}
```

## Performance Considerations

- **Database Queries**: The calculator executes 4 separate queries (devices, alerts, vulnerabilities, compliance)
- **Optimization**: Queries are filtered by tenant ID and use indexed columns
- **Caching**: Consider caching posture scores for 5-15 minutes in production
- **Batch Processing**: When calculating for multiple tenants, process sequentially to avoid database overload

## Testing

See `src/lib/__tests__/edr-posture-calculator.test.ts` for comprehensive unit tests covering:

- Component score calculations
- Weight distribution
- Edge cases (no data, extreme values)
- Final score calculation
- Database storage

## Requirements Validation

This implementation satisfies:

- **Requirement 6.1**: Posture score calculation based on device risk, alerts, vulnerabilities, and compliance
- **Requirement 6.2**: Score storage with timestamp for historical tracking
- **Task 5**: Weight factors (30%, 25%, 25%, 20%), calculation algorithm, and storage

## Future Enhancements

- **Machine Learning**: Use ML to adjust weights based on tenant-specific risk profiles
- **Trend Analysis**: Calculate score velocity (rate of change)
- **Predictive Scoring**: Forecast future posture based on historical trends
- **Custom Weights**: Allow tenants to customize component weights
- **Benchmark Comparison**: Compare tenant scores against industry averages
