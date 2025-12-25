# EDR Polling Worker Service

## Overview

The EDR Polling Worker is a scheduled background service that retrieves endpoint security data from Microsoft Defender for Endpoint and Microsoft Intune via Microsoft Graph API. It processes data for all active tenants, normalizes it, stores it in the database, and calculates security posture scores.

## Features

- **Multi-Tenant Support**: Processes all active tenants in a single execution
- **Error Isolation**: Failures in one tenant don't affect others
- **Secure Credential Management**: Retrieves credentials from AWS Secrets Manager
- **Retry Logic**: Exponential backoff for transient failures
- **Comprehensive Logging**: Detailed execution metrics and error tracking
- **Posture Calculation**: Automatic security score calculation after data sync

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EDR Polling Worker                        │
│                                                              │
│  1. Get Active Tenants                                       │
│     └─> Query database for tenants with is_active = true    │
│                                                              │
│  2. For Each Tenant (with error isolation):                  │
│     ├─> Retrieve credentials from AWS Secrets Manager       │
│     ├─> Create Microsoft Graph API client                   │
│     ├─> Fetch data (parallel):                              │
│     │   ├─> Defender devices                                │
│     │   ├─> Intune devices                                  │
│     │   ├─> Alerts                                          │
│     │   ├─> Vulnerabilities                                 │
│     │   └─> Compliance                                      │
│     ├─> Normalize and merge data                            │
│     ├─> Store in database (upsert)                          │
│     └─> Calculate posture score                             │
│                                                              │
│  3. Log execution metrics                                    │
│     └─> Success/failure counts, record counts, duration     │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Credential Retrieval**: Fetches Microsoft API credentials from AWS Secrets Manager
   - Secret format: `edr/tenant/{tenantId}/microsoft-credentials`
   - Credentials cached in memory for polling cycle only

2. **Data Fetching**: Retrieves data from Microsoft Graph API
   - Defender devices: `/security/machines`
   - Intune devices: `/deviceManagement/managedDevices`
   - Alerts: `/security/alerts_v2` (last 7 days)
   - Vulnerabilities: `/security/vulnerabilities`
   - Compliance: `/deviceManagement/managedDevices` (with compliance data)

3. **Normalization**: Transforms Microsoft data into AVIAN format
   - Merges Defender and Intune device data
   - Maps risk scores and severity levels
   - Handles missing/null fields

4. **Storage**: Upserts data into PostgreSQL
   - Devices: Upsert by `microsoft_device_id`
   - Alerts: Upsert by `microsoft_alert_id`
   - Vulnerabilities: Upsert by `cve_id`
   - Compliance: Upsert by `device_id`
   - Device-Vulnerability links: Many-to-many relationships

5. **Posture Calculation**: Calculates security score
   - Device risk: 30% weight
   - Active alerts: 25% weight
   - Vulnerabilities: 25% weight
   - Compliance: 20% weight

## Usage

### Programmatic Execution

```typescript
import { runPollingWorker } from './services/edr-polling-worker';

// Execute polling for all tenants
const result = await runPollingWorker();

console.log(`Processed ${result.successCount} tenants successfully`);
console.log(`Total devices: ${result.totalDevices}`);
console.log(`Total alerts: ${result.totalAlerts}`);
```

### AWS Lambda Deployment

The worker includes a Lambda handler for AWS execution:

```typescript
// Lambda will invoke the handler function
export async function handler() {
  // Executes polling and returns result
}
```

### Custom Retry Configuration

```typescript
import { EDRPollingWorker } from './services/edr-polling-worker';

const worker = new EDRPollingWorker({
  maxRetries: 5,
  initialDelay: 2000, // 2 seconds
  maxDelay: 120000, // 2 minutes
  backoffMultiplier: 2,
});

const result = await worker.execute();
```

## Configuration

### Environment Variables

- `AWS_REGION`: AWS region for Secrets Manager (default: `us-east-1`)
- `DATABASE_URL`: PostgreSQL connection string
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARN, ERROR)
- `NODE_ENV`: Environment (development, staging, production)

### AWS Secrets Manager

Credentials must be stored in Secrets Manager with the following format:

**Secret Name**: `edr/tenant/{tenantId}/microsoft-credentials`

**Secret Value** (JSON):
```json
{
  "clientId": "your-azure-app-client-id",
  "clientSecret": "your-azure-app-client-secret",
  "tenantId": "your-microsoft-tenant-id"
}
```

### IAM Permissions

The Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:edr/tenant/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## Scheduling

### CloudWatch Events (EventBridge)

Create a rule to trigger the Lambda on a schedule:

```bash
aws events put-rule \
  --name edr-polling-schedule \
  --schedule-expression "rate(15 minutes)"

aws events put-targets \
  --rule edr-polling-schedule \
  --targets "Id"="1","Arn"="arn:aws:lambda:region:account:function:edr-polling-worker"
```

### Cron Expression Examples

- Every 15 minutes: `rate(15 minutes)`
- Every hour: `rate(1 hour)`
- Every day at 2 AM UTC: `cron(0 2 * * ? *)`
- Every 30 minutes: `rate(30 minutes)`

## Error Handling

### Tenant-Level Isolation

Failures in one tenant don't affect others:

```typescript
// Tenant A fails due to invalid credentials
// Tenant B, C, D continue processing normally
```

### Retry Logic

Transient failures are retried with exponential backoff:

1. Initial attempt fails
2. Wait 1 second, retry
3. Wait 2 seconds, retry
4. Wait 4 seconds, retry
5. If still failing, log error and continue to next tenant

### Error Types

- **Authentication Errors**: Invalid credentials, expired tokens
- **Rate Limiting**: 429 responses from Microsoft API
- **Network Errors**: Timeouts, connection failures
- **Data Validation Errors**: Missing required fields, invalid formats
- **Database Errors**: Connection failures, constraint violations

## Monitoring

### Execution Metrics

Each execution logs:

- Execution ID (unique identifier)
- Start/end time and duration
- Tenant count and results
- Success/failure counts
- Total records processed (devices, alerts, vulnerabilities)

### Per-Tenant Metrics

For each tenant:

- Tenant ID and name
- Success/failure status
- Duration
- Record counts by type
- Posture score
- Error message (if failed)

### CloudWatch Logs

Logs are structured JSON for easy querying:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "Tenant polling succeeded",
  "context": {
    "executionId": "poll-1705318200-abc123",
    "tenantId": "tenant-uuid",
    "tenantName": "Acme Corp",
    "duration": 12500,
    "deviceCount": 150,
    "alertCount": 23
  }
}
```

### CloudWatch Metrics (Custom)

Recommended custom metrics:

- `EDRPolling/SuccessCount`: Number of successful tenant polls
- `EDRPolling/FailureCount`: Number of failed tenant polls
- `EDRPolling/Duration`: Total execution duration
- `EDRPolling/DeviceCount`: Total devices processed
- `EDRPolling/AlertCount`: Total alerts processed

## Troubleshooting

### Common Issues

**Issue**: "Failed to retrieve credentials from Secrets Manager"
- **Cause**: Secret doesn't exist or IAM permissions missing
- **Solution**: Verify secret exists and Lambda role has `secretsmanager:GetSecretValue` permission

**Issue**: "Authentication failed: invalid_client"
- **Cause**: Invalid client ID or secret in Secrets Manager
- **Solution**: Verify credentials in Azure AD and update secret

**Issue**: "Rate limit encountered"
- **Cause**: Too many API requests to Microsoft Graph
- **Solution**: Increase polling interval or implement request throttling

**Issue**: "Device has no associated device ID"
- **Cause**: Alert from Microsoft doesn't include device reference
- **Solution**: This is expected for some alert types; alert is skipped

**Issue**: "Could not find stored device for compliance"
- **Cause**: Compliance record references device not in Defender/Intune
- **Solution**: This is expected for recently removed devices; record is skipped

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=DEBUG
```

This will log:
- Credential retrieval attempts
- API request/response details
- Data normalization steps
- Database operations

## Performance

### Typical Execution Times

- Small tenant (10-50 devices): 5-15 seconds
- Medium tenant (50-200 devices): 15-45 seconds
- Large tenant (200-1000 devices): 45-120 seconds

### Optimization Tips

1. **Parallel Fetching**: Data types are fetched in parallel
2. **Batch Operations**: Database operations use batch upserts
3. **Connection Pooling**: Reuse database connections
4. **Credential Caching**: Cache tokens for polling cycle

### Scaling Considerations

- **Horizontal**: Deploy multiple workers with tenant sharding
- **Vertical**: Increase Lambda memory for faster execution
- **Database**: Add read replicas for query load distribution

## Security

### Credential Management

- Credentials stored in AWS Secrets Manager with encryption at rest
- Retrieved using IAM role-based authentication
- Cached in memory only for polling cycle duration
- Never logged or exposed in API responses

### Tenant Isolation

- Each tenant's data is completely isolated
- Tenant ID included in all database records
- Failures in one tenant don't affect others
- Separate credential retrieval per tenant

### Audit Logging

All operations are logged with:
- Execution ID for traceability
- Tenant ID for accountability
- Timestamps for audit trails
- Success/failure status for compliance

## Requirements Validation

This implementation satisfies the following requirements:

- **7.2**: Scheduled execution with configurable interval
- **7.3**: Multi-tenant support with error isolation
- **7.4**: Credential retrieval from AWS Secrets Manager
- **7.5**: Comprehensive logging of execution metrics
- **7.6**: Retry logic with exponential backoff
- **8.2**: Secure credential storage and retrieval
- **8.3**: Credentials cached in memory for polling cycle only

## Related Components

- **Microsoft Graph Client**: `src/lib/microsoft-graph-client.ts`
- **Normalization Layer**: `src/lib/edr-normalizer.ts`
- **Database Operations**: `src/lib/edr-database-operations.ts`
- **Posture Calculator**: `src/lib/edr-posture-calculator.ts`

## Future Enhancements

- **Incremental Sync**: Only fetch changed data since last poll
- **Webhook Support**: Real-time updates instead of polling
- **Tenant Sharding**: Distribute tenants across multiple workers
- **Caching Layer**: Redis cache for frequently accessed data
- **Dead Letter Queue**: Retry failed tenants in separate queue
