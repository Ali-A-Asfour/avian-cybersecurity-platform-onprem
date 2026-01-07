# AVIAN Platform Monitoring Guide

## Overview

The AVIAN platform includes comprehensive monitoring capabilities for metrics collection, error tracking, and performance monitoring. This guide explains how to use and extend the monitoring system.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Metrics Collection](#metrics-collection)
3. [Error Tracking](#error-tracking)
4. [Performance Monitoring](#performance-monitoring)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Integration Guide](#integration-guide)
8. [Best Practices](#best-practices)
9. [Production Deployment](#production-deployment)

---

## Architecture

### Components

1. **MonitoringService** (`src/lib/monitoring.ts`)
   - Singleton service for collecting metrics
   - Batches metrics for efficient storage
   - Provides convenience methods for different metric types

2. **Database Storage**
   - `metrics` table: Stores all application metrics
   - `error_tracking` table: Stores error events with context
   - Views for aggregated data and recent events

3. **API Endpoints**
   - `/api/metrics`: Metrics summary (super admin only)
   - `/api/errors`: Error tracking with filtering (super admin only)

4. **Middleware**
   - `withMonitoring()`: Wraps route handlers with automatic tracking
   - Tracks HTTP requests, errors, and performance

---

## Metrics Collection

### Metric Types

The system supports four metric types:

1. **Counter**: Incremental values (e.g., request count, error count)
2. **Gauge**: Current values (e.g., active users, memory usage)
3. **Histogram**: Value distributions (e.g., response sizes)
4. **Timer**: Duration measurements (e.g., request duration, query time)

### Metric Categories

Metrics are organized into categories:

- `http`: HTTP requests and responses
- `database`: Database queries and connections
- `redis`: Redis operations
- `auth`: Authentication events
- `email`: Email sending
- `business`: Business logic metrics

### Usage Examples

```typescript
import { monitoring, MetricCategory } from '@/lib/monitoring';

// Record a counter (increments by 1)
monitoring.counter('user.registrations', MetricCategory.BUSINESS);

// Record a counter with custom value
monitoring.counter('items.processed', MetricCategory.BUSINESS, 10);

// Record a gauge (current value)
monitoring.gauge('active.users', MetricCategory.BUSINESS, 42);

// Record a histogram
monitoring.histogram('response.size', MetricCategory.HTTP, 1024);

// Record a timer (duration in milliseconds)
monitoring.timer('operation.duration', MetricCategory.BUSINESS, 150);

// Use startTimer for automatic duration tracking
const endTimer = monitoring.startTimer('database.query', MetricCategory.DATABASE);
// ... perform operation ...
endTimer(); // Automatically records duration
```

### Tags

Add tags to metrics for filtering and grouping:

```typescript
monitoring.counter('api.requests', MetricCategory.HTTP, 1, {
  endpoint: '/api/users',
  method: 'GET',
  status: '200',
});
```

---

## Error Tracking

### Tracking Errors

```typescript
import { trackError } from '@/lib/monitoring';

try {
  // ... code that might throw ...
} catch (error) {
  await trackError({
    error: error as Error,
    context: {
      operation: 'user_registration',
      input: { email: 'user@example.com' },
    },
    userId: user.id.toString(),
    tenantId: tenant.id.toString(),
    requestId: request.headers.get('x-request-id') || undefined,
  });
  
  // Handle error...
}
```

### Error Context

Include relevant context to help with debugging:

- **operation**: What was being attempted
- **input**: Relevant input data (sanitized)
- **state**: Application state at time of error
- **userId**: User who encountered the error
- **tenantId**: Tenant context
- **requestId**: Request identifier for tracing

### Viewing Errors

Errors are stored in the database and can be queried via:

1. **API Endpoint**: `/api/errors?error_type=ValidationError&limit=50`
2. **Database Views**: `recent_errors`, `error_details`
3. **Direct Query**: `SELECT * FROM error_tracking ORDER BY created_at DESC`

---

## Performance Monitoring

### Automatic Tracking

Use the monitoring middleware to automatically track all HTTP requests:

```typescript
import { monitoredRoute } from '@/middleware/monitoring.middleware';

export const GET = monitoredRoute(async (request: NextRequest) => {
  // Your handler code...
  return NextResponse.json({ success: true });
});
```

This automatically tracks:
- Request method and path
- Response status code
- Request duration
- Error rates

### Manual Performance Tracking

```typescript
import { trackPerformance, MetricCategory } from '@/lib/monitoring';

const start = Date.now();
// ... perform operation ...
const duration = Date.now() - start;

trackPerformance({
  operation: 'complex_calculation',
  duration,
  category: MetricCategory.BUSINESS,
  metadata: {
    input_size: '1000',
    algorithm: 'quicksort',
  },
});
```

### Slow Operation Detection

The system automatically detects and logs slow operations based on category thresholds:

| Category | Threshold |
|----------|-----------|
| HTTP | 1000ms |
| Database | 500ms |
| Redis | 100ms |
| Auth | 2000ms |
| Email | 5000ms |
| Business | 1000ms |

Slow operations are logged and counted in the `performance.slow_operations` metric.

### Convenience Methods

```typescript
// Database query tracking
monitoring.recordDatabaseQuery('SELECT * FROM users', 45, true);

// Redis operation tracking
monitoring.recordRedisOperation('GET', 5, true);

// Authentication event tracking
monitoring.recordAuthEvent('login', true, userId);

// Email tracking
monitoring.recordEmailSent('verification', true);
```

---

## API Endpoints

### GET /api/metrics

Returns metrics summary for the last minute.

**Authentication**: Super admin required

**Response**:
```json
{
  "success": true,
  "data": {
    "total_metrics": 1523,
    "recent_metrics": 42,
    "by_category": {
      "http": 25,
      "database": 10,
      "redis": 7
    },
    "by_type": {
      "counter": 30,
      "timer": 12
    },
    "errors_last_hour": 3
  }
}
```

### GET /api/errors

Returns recent errors with filtering and pagination.

**Authentication**: Super admin required

**Query Parameters**:
- `error_type`: Filter by error type (e.g., "ValidationError")
- `user_id`: Filter by user ID
- `tenant_id`: Filter by tenant ID
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "id": 123,
        "error_type": "ValidationError",
        "error_message": "Invalid email format",
        "error_stack": "...",
        "context": { "email": "invalid" },
        "request_id": "req-abc123",
        "created_at": "2026-01-06T10:30:00Z",
        "user_email": "user@example.com",
        "tenant_name": "Acme Corp"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

## Database Schema

### metrics Table

```sql
CREATE TABLE metrics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    value NUMERIC NOT NULL,
    tags JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes**:
- `idx_metrics_name`: Fast lookup by metric name
- `idx_metrics_category`: Filter by category
- `idx_metrics_created_at`: Time-based queries
- `idx_metrics_name_category`: Combined lookup
- `idx_metrics_tags`: JSONB tag queries

### error_tracking Table

```sql
CREATE TABLE error_tracking (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    context JSONB DEFAULT '{}',
    user_id INTEGER REFERENCES users(id),
    tenant_id INTEGER REFERENCES tenants(id),
    request_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes**:
- `idx_error_tracking_error_type`: Filter by error type
- `idx_error_tracking_user_id`: User-specific errors
- `idx_error_tracking_tenant_id`: Tenant-specific errors
- `idx_error_tracking_created_at`: Time-based queries
- `idx_error_tracking_request_id`: Request tracing

### Views

**recent_metrics**: Aggregated metrics from last 24 hours
```sql
SELECT name, type, category, COUNT(*), AVG(value), MIN(value), MAX(value)
FROM metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY name, type, category;
```

**recent_errors**: Error summary from last 24 hours
```sql
SELECT error_type, COUNT(*), MAX(created_at), 
       array_agg(DISTINCT user_id), array_agg(DISTINCT tenant_id)
FROM error_tracking
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type;
```

**error_details**: Last 100 errors with user/tenant info
```sql
SELECT et.*, u.email, t.name
FROM error_tracking et
LEFT JOIN users u ON et.user_id = u.id
LEFT JOIN tenants t ON et.tenant_id = t.id
ORDER BY et.created_at DESC
LIMIT 100;
```

---

## Integration Guide

### Step 1: Run Database Migration

```bash
# Apply monitoring tables migration
psql $DATABASE_URL -f database/migrations/0029_monitoring_tables.sql
```

### Step 2: Add Monitoring to API Routes

```typescript
import { monitoredRoute } from '@/middleware/monitoring.middleware';
import { NextRequest, NextResponse } from 'next/server';

export const GET = monitoredRoute(async (request: NextRequest) => {
  // Your handler code
  return NextResponse.json({ success: true });
});

export const POST = monitoredRoute(async (request: NextRequest) => {
  // Your handler code
  return NextResponse.json({ success: true });
});
```

### Step 3: Add Custom Metrics

```typescript
import { monitoring, MetricCategory } from '@/lib/monitoring';

export async function processOrder(order: Order) {
  // Track business metric
  monitoring.counter('orders.processed', MetricCategory.BUSINESS);
  
  // Track with tags
  monitoring.counter('orders.processed', MetricCategory.BUSINESS, 1, {
    product_type: order.productType,
    payment_method: order.paymentMethod,
  });
  
  // Track order value
  monitoring.gauge('orders.value', MetricCategory.BUSINESS, order.total);
}
```

### Step 4: Add Error Tracking

```typescript
import { trackError } from '@/lib/monitoring';

try {
  await processPayment(order);
} catch (error) {
  await trackError({
    error: error as Error,
    context: {
      operation: 'payment_processing',
      order_id: order.id,
      amount: order.total,
    },
    userId: order.userId.toString(),
    tenantId: order.tenantId.toString(),
  });
  
  throw error; // Re-throw after tracking
}
```

### Step 5: Add Performance Tracking

```typescript
import { startTimer, MetricCategory } from '@/lib/monitoring';

export async function complexCalculation(data: any[]) {
  const endTimer = startTimer('complex_calculation', MetricCategory.BUSINESS);
  
  try {
    // Perform calculation
    const result = await calculate(data);
    return result;
  } finally {
    endTimer(); // Always record duration
  }
}
```

---

## Best Practices

### 1. Metric Naming

Use consistent, hierarchical naming:

```typescript
// Good
monitoring.counter('api.requests.total', ...)
monitoring.counter('api.requests.errors', ...)
monitoring.counter('api.requests.success', ...)

// Bad
monitoring.counter('requests', ...)
monitoring.counter('api_errors', ...)
monitoring.counter('successfulRequests', ...)
```

### 2. Use Tags for Dimensions

Don't create separate metrics for each dimension:

```typescript
// Good
monitoring.counter('api.requests', MetricCategory.HTTP, 1, {
  endpoint: '/api/users',
  method: 'GET',
  status: '200',
});

// Bad
monitoring.counter('api.requests.users.get.200', ...)
```

### 3. Track Both Success and Failure

```typescript
try {
  await sendEmail(to, subject, body);
  monitoring.recordEmailSent('verification', true);
} catch (error) {
  monitoring.recordEmailSent('verification', false);
  throw error;
}
```

### 4. Include Context in Errors

```typescript
await trackError({
  error: error as Error,
  context: {
    operation: 'user_registration',
    step: 'email_verification',
    email: user.email, // Sanitized
    attempt: 3,
  },
  userId: user.id.toString(),
  tenantId: user.tenantId.toString(),
});
```

### 5. Use Timers for Performance

```typescript
// Automatic timing
const endTimer = startTimer('database.query', MetricCategory.DATABASE);
const result = await db.query(...);
endTimer();

// Manual timing (when needed)
const start = Date.now();
const result = await complexOperation();
monitoring.timer('operation', MetricCategory.BUSINESS, Date.now() - start);
```

### 6. Don't Over-Instrument

Focus on:
- Critical business operations
- External service calls
- Slow operations
- Error-prone code paths

Avoid:
- Every function call
- Trivial operations
- Internal helper functions

---

## Production Deployment

### 1. Data Retention

The system includes automatic cleanup functions:

```sql
-- Clean metrics older than 30 days
SELECT clean_old_metrics();

-- Clean errors older than 90 days
SELECT clean_old_errors();
```

Set up a cron job to run these regularly:

```bash
# Add to crontab
0 2 * * * psql $DATABASE_URL -c "SELECT clean_old_metrics();"
0 3 * * * psql $DATABASE_URL -c "SELECT clean_old_errors();"
```

### 2. Metric Flushing

Metrics are automatically flushed to the database:
- Every 60 seconds (periodic flush)
- When batch size reaches 100 metrics

Configure in `src/lib/monitoring.ts`:

```typescript
private readonly BATCH_SIZE = 100;
private readonly FLUSH_INTERVAL = 60000; // 1 minute
```

### 3. Integration with External Services

For production, consider integrating with:

**Prometheus**:
```typescript
// Export metrics in Prometheus format
export async function GET(request: NextRequest) {
  const metrics = monitoring.getMetrics();
  const prometheus = convertToPrometheusFormat(metrics);
  return new Response(prometheus, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

**Sentry** (Error Tracking):
```typescript
import * as Sentry from '@sentry/nextjs';

await trackError({
  error: error as Error,
  context: { ... },
});

// Also send to Sentry
Sentry.captureException(error, {
  contexts: { ... },
});
```

**Grafana** (Visualization):
- Connect Grafana to PostgreSQL
- Create dashboards from `metrics` and `error_tracking` tables
- Use `recent_metrics` and `recent_errors` views

### 4. Performance Considerations

**Database Indexes**: Ensure all indexes are created (migration handles this)

**Connection Pooling**: Monitoring uses the shared database connection pool

**Batch Size**: Adjust `BATCH_SIZE` based on traffic:
- Low traffic: 50-100
- Medium traffic: 100-500
- High traffic: 500-1000

**Flush Interval**: Adjust based on requirements:
- Real-time: 10-30 seconds
- Standard: 60 seconds
- Low priority: 5 minutes

### 5. Monitoring the Monitoring

Add health checks for the monitoring system:

```typescript
export async function GET(request: NextRequest) {
  const summary = await monitoring.getMetricsSummary();
  
  // Check if metrics are being collected
  if (summary.recent_metrics === 0) {
    return NextResponse.json(
      { status: 'unhealthy', reason: 'No recent metrics' },
      { status: 503 }
    );
  }
  
  return NextResponse.json({ status: 'healthy', summary });
}
```

---

## Troubleshooting

### Metrics Not Being Recorded

1. **Check database connection**:
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM metrics;"
   ```

2. **Check for errors in logs**:
   ```bash
   docker logs avian-app | grep -i "monitoring\|metrics"
   ```

3. **Verify migration was applied**:
   ```sql
   SELECT * FROM information_schema.tables WHERE table_name = 'metrics';
   ```

### High Database Load

1. **Increase batch size**:
   ```typescript
   private readonly BATCH_SIZE = 500; // Increase from 100
   ```

2. **Increase flush interval**:
   ```typescript
   private readonly FLUSH_INTERVAL = 300000; // 5 minutes
   ```

3. **Add database indexes** (if custom queries are slow)

### Metrics Table Growing Too Large

1. **Run cleanup function**:
   ```sql
   SELECT clean_old_metrics();
   ```

2. **Adjust retention period**:
   ```sql
   -- Keep only 7 days instead of 30
   DELETE FROM metrics WHERE created_at < NOW() - INTERVAL '7 days';
   ```

3. **Archive old metrics**:
   ```sql
   -- Export to archive table
   INSERT INTO metrics_archive SELECT * FROM metrics WHERE created_at < NOW() - INTERVAL '30 days';
   DELETE FROM metrics WHERE created_at < NOW() - INTERVAL '30 days';
   ```

---

## Future Enhancements

Potential improvements for the monitoring system:

1. **Real-time Dashboards**: WebSocket-based live metrics
2. **Alerting**: Automatic alerts for error spikes or slow operations
3. **Distributed Tracing**: Request tracing across services
4. **Custom Dashboards**: User-configurable metric dashboards
5. **Anomaly Detection**: ML-based anomaly detection
6. **SLA Monitoring**: Track and report on SLA compliance

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Maintained By:** AVIAN Platform Team
