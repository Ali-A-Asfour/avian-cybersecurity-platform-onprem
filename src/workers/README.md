# Background Workers

This directory contains the entry point for background workers that run as scheduled ECS tasks.

## Overview

The AVIAN platform uses background workers for periodic tasks that don't need to run continuously:

1. **EDR Polling Worker** - Polls Microsoft Graph API for EDR data every 15 minutes
2. **Metrics Aggregation Worker** - Creates daily metrics rollup records at midnight UTC
3. **Email Alert Processing Worker** - Processes SonicWall alert emails every 5 minutes

## Architecture

### Entry Point

The `index.ts` file is the main entry point for all workers. It:
- Reads the `WORKER_TYPE` environment variable
- Routes execution to the appropriate worker
- Handles errors and logging
- Exits cleanly after completion

### Worker Types

#### EDR Polling (`edr-polling`)
- **Schedule:** Every 15 minutes
- **Implementation:** `src/services/edr-polling-worker.ts`
- **Purpose:** Poll Microsoft Graph API for EDR data across all active tenants
- **Data Collected:**
  - Defender devices
  - Intune devices
  - Security alerts
  - Vulnerabilities
  - Compliance records
  - Posture scores

#### Metrics Aggregation (`metrics-aggregation`)
- **Schedule:** Daily at midnight UTC
- **Implementation:** `src/lib/metrics-aggregator.ts`
- **Purpose:** Create daily rollup records for firewall metrics
- **Metrics Collected:**
  - Threats blocked
  - Malware blocked
  - IPS blocks
  - Blocked connections
  - Web filter hits
  - Bandwidth usage
  - Active sessions

#### Email Alert Processing (`email-alerts`)
- **Schedule:** Every 5 minutes
- **Implementation:** `src/lib/email-alert-listener.ts`
- **Purpose:** Process SonicWall alert emails from IMAP inbox
- **Actions:**
  - Fetch unread emails
  - Parse alert information
  - Match to devices
  - Create alert records
  - Mark emails as processed

## Usage

### Local Development

Run a worker locally:

```bash
# EDR polling
WORKER_TYPE=edr-polling npm run dev

# Metrics aggregation
WORKER_TYPE=metrics-aggregation npm run dev

# Email alert processing
WORKER_TYPE=email-alerts npm run dev
```

### Docker

Build and run with Docker:

```bash
# Build image
docker build -t avian-platform:latest .

# Run EDR polling worker
docker run -e WORKER_TYPE=edr-polling avian-platform:latest

# Run metrics aggregation worker
docker run -e WORKER_TYPE=metrics-aggregation avian-platform:latest

# Run email alert processing worker
docker run -e WORKER_TYPE=email-alerts avian-platform:latest
```

### AWS ECS

Workers are deployed as scheduled ECS tasks using EventBridge rules:

```json
{
  "Targets": [
    {
      "Arn": "arn:aws:ecs:REGION:ACCOUNT:cluster/avian-platform-cluster-production",
      "RoleArn": "arn:aws:iam::ACCOUNT:role/avian-eventbridge-ecs-role-production",
      "EcsParameters": {
        "TaskDefinitionArn": "arn:aws:ecs:REGION:ACCOUNT:task-definition/avian-platform:1",
        "TaskCount": 1,
        "LaunchType": "FARGATE",
        "NetworkConfiguration": {
          "awsvpcConfiguration": {
            "Subnets": ["subnet-xxx", "subnet-yyy"],
            "SecurityGroups": ["sg-xxx"],
            "AssignPublicIp": "DISABLED"
          }
        },
        "Overrides": {
          "ContainerOverrides": [
            {
              "Name": "avian-app",
              "Environment": [
                {
                  "Name": "WORKER_TYPE",
                  "Value": "edr-polling"
                }
              ]
            }
          ]
        }
      }
    }
  ]
}
```

## Environment Variables

### Required for All Workers
- `WORKER_TYPE` - Type of worker to run (edr-polling, metrics-aggregation, email-alerts)
- `NODE_ENV` - Environment (production, staging, development)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

### EDR Polling Worker
- `AWS_REGION` - AWS region for Secrets Manager (default: ca-central-1)
- Tenant credentials stored in AWS Secrets Manager at `edr/tenant/{tenant_id}`

### Metrics Aggregation Worker
- No additional environment variables required

### Email Alert Processing Worker
- `IMAP_HOST` - IMAP server hostname
- `IMAP_PORT` - IMAP server port (default: 993)
- `IMAP_USER` - IMAP username
- `IMAP_PASSWORD` - IMAP password
- `IMAP_TLS` - Use TLS (default: true)

## Logging

All workers use the centralized logger (`src/lib/logger.ts`) which:
- Logs to stdout in JSON format
- Includes structured metadata
- Integrates with CloudWatch Logs in AWS

Example log output:

```json
{
  "level": "info",
  "message": "Starting worker: edr-polling",
  "workerType": "edr-polling",
  "nodeEnv": "production",
  "timestamp": "2024-12-09T10:00:00.000Z"
}
```

## Error Handling

Workers follow these error handling principles:

1. **Graceful Degradation** - One tenant failure doesn't stop other tenants
2. **Retry Logic** - Transient errors are retried with exponential backoff
3. **Exit Codes** - Exit 0 on success, exit 1 on failure
4. **Comprehensive Logging** - All errors are logged with context

## Monitoring

### CloudWatch Logs

All worker executions log to CloudWatch Logs:
- Log Group: `/ecs/avian-platform`
- Log Stream: `workers/{worker-type}/{task-id}`

### CloudWatch Metrics

Key metrics to monitor:
- Execution duration
- Success/failure rate
- Number of items processed
- Error count

### CloudWatch Alarms

Recommended alarms:
- Worker execution failures
- Long execution duration
- No executions in expected timeframe

## Testing

### Unit Tests

Test individual worker functions:

```bash
npm test src/services/edr-polling-worker.test.ts
npm test src/lib/metrics-aggregator.test.ts
npm test src/lib/email-alert-listener.test.ts
```

### Integration Tests

Test worker entry point:

```bash
# Set test environment variables
export WORKER_TYPE=edr-polling
export NODE_ENV=test
export DATABASE_URL=postgresql://test:test@localhost:5432/test
export REDIS_URL=redis://localhost:6379

# Run worker
npm run build
node .next/standalone/start.js
```

### Manual Testing

Trigger a worker manually in AWS:

```bash
# Run EDR polling task
aws ecs run-task \
  --cluster avian-platform-cluster-production \
  --task-definition avian-platform:1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"avian-app","environment":[{"name":"WORKER_TYPE","value":"edr-polling"}]}]}'
```

## Troubleshooting

### Worker Not Starting

**Symptoms:** Worker exits immediately with error

**Possible Causes:**
- `WORKER_TYPE` not set or invalid
- Missing environment variables
- Database connection failure
- Redis connection failure

**Solution:**
1. Check CloudWatch Logs for error messages
2. Verify environment variables are set correctly
3. Test database and Redis connectivity

### Worker Timing Out

**Symptoms:** Worker runs for a long time and times out

**Possible Causes:**
- Large number of tenants/devices
- Slow API responses
- Network issues

**Solution:**
1. Increase ECS task timeout
2. Optimize worker logic
3. Add pagination or batching

### Worker Failing Silently

**Symptoms:** Worker exits with code 0 but doesn't process data

**Possible Causes:**
- No active tenants
- No data to process
- Logic error

**Solution:**
1. Check CloudWatch Logs for warnings
2. Verify data exists to process
3. Add more detailed logging

## Development

### Adding a New Worker

1. Create worker implementation in `src/lib/` or `src/services/`
2. Add worker type to `src/workers/index.ts`
3. Add environment variables to documentation
4. Create EventBridge rule for scheduling
5. Add tests
6. Update this README

### Modifying Existing Worker

1. Update worker implementation
2. Update tests
3. Deploy new task definition
4. Monitor CloudWatch Logs for issues

## References

- [EDR Polling Worker](../services/edr-polling-worker.ts)
- [Metrics Aggregator](../lib/metrics-aggregator.ts)
- [Email Alert Listener](../lib/email-alert-listener.ts)
- [AWS ECS Scheduled Tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/scheduled_tasks.html)
- [EventBridge Rules](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)
