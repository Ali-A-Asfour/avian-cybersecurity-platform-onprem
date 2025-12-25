# Microsoft Defender Integration Service

The DefenderIntegrationService provides read-only context retrieval from Microsoft Defender for Endpoint and generates deep-links for external navigation. This service enriches AVIAN alerts with Defender metadata without embedding external UIs.

## Features

- **Read-only Context Retrieval**: Fetches Microsoft Defender incident and alert metadata
- **Deep-link Generation**: Creates links for external navigation (new tab, no embedding)
- **Graceful Error Handling**: Handles API failures with connection status indicators
- **Alert Enrichment**: Adds Defender context to AVIAN alerts
- **Batch Processing**: Efficiently processes multiple alerts
- **Connection Monitoring**: Tracks Microsoft Defender API connectivity

## Requirements Addressed

- **4.3**: Display Microsoft Defender Incident ID, Alert ID, severity, threat name, and affected device and user
- **4.4**: Provide "View in Microsoft Defender" link that opens in a new browser tab
- **4.5**: No embedding or iframing of Microsoft Defender content
- **12.2**: Treat Microsoft Defender incidents as metadata-only context for AVIAN alerts
- **12.4**: Maintain Microsoft Defender state as read-only context information

## Usage

### Basic Setup

```typescript
import { DefenderIntegrationService, createDefenderIntegrationService } from './DefenderIntegrationService';

const config = {
    tenantId: 'your-tenant-id',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    authority: 'https://login.microsoftonline.com/your-tenant-id',
    scope: ['https://graph.microsoft.com/.default'],
};

const defenderService = createDefenderIntegrationService(config);
```

### Enrich Single Alert

```typescript
// Enrich an EDR alert with Defender context
const alert: SecurityAlert = {
    // ... alert data with defenderIncidentId and defenderAlertId
};

const context = await defenderService.enrichAlertWithDefenderContext(alert);

if (context) {
    console.log('Defender Incident ID:', context.incidentId);
    console.log('Deep Link:', context.deepLink);
    console.log('Connection Status:', context.connectionStatus.isConnected);
    
    if (context.deviceInfo) {
        console.log('Device Health:', context.deviceInfo.healthStatus);
        console.log('Risk Score:', context.deviceInfo.riskScore);
    }
}
```

### Batch Processing

```typescript
// Process multiple alerts efficiently
const alerts: SecurityAlert[] = [/* array of alerts */];
const contextMap = await defenderService.enrichAlertsWithDefenderContext(alerts);

alerts.forEach(alert => {
    const context = contextMap.get(alert.id);
    if (context) {
        // Use enriched context
    }
});
```

### Generate Deep Links

```typescript
// Generate link to specific alert
const alertLink = defenderService.generateDeepLink('incident-123', 'alert-456');
// Result: https://security.microsoft.com/alerts/alert-456?tid=tenant-id

// Generate link to incident overview
const incidentLink = defenderService.generateDeepLink('incident-123');
// Result: https://security.microsoft.com/incidents/incident-123?tid=tenant-id

// Generate link to device page
const deviceLink = defenderService.generateDeviceDeepLink('device-123');
// Result: https://security.microsoft.com/machines/device-123?tid=tenant-id
```

### Monitor Connection Status

```typescript
// Check current connection status
const status = defenderService.getConnectionStatus();
console.log('Connected:', status.isConnected);
console.log('Last Checked:', status.lastChecked);
console.log('Latency:', status.latencyMs);

if (!status.isConnected) {
    console.log('Error:', status.error);
}

// Perform new connection check
const newStatus = await defenderService.checkConnectionStatus();
```

## Data Structures

### DefenderAlertContext

```typescript
interface DefenderAlertContext {
    // Core Defender metadata
    incidentId: string;
    alertId: string;
    severity: string;
    threatName: string;
    affectedDevice: string;
    affectedUser: string;
    
    // Deep-link for external navigation
    deepLink: string;
    
    // Additional context (read-only)
    status?: string;
    classification?: string;
    determination?: string;
    investigationState?: string;
    assignedTo?: string;
    
    // Device context
    deviceInfo?: {
        computerDnsName: string;
        osPlatform: string;
        osVersion: string;
        healthStatus: string;
        riskScore: number;
        exposureLevel: string;
    };
    
    // Connection status
    connectionStatus: DefenderConnectionStatus;
}
```

### DefenderConnectionStatus

```typescript
interface DefenderConnectionStatus {
    isConnected: boolean;
    lastChecked: Date;
    error?: string;
    latencyMs?: number;
}
```

## Helper Functions

### hasDefenderContext

Checks if an alert has Microsoft Defender context:

```typescript
import { hasDefenderContext } from './DefenderIntegrationService';

if (hasDefenderContext(alert)) {
    // Alert has Defender context and can be enriched
}
```

### extractDefenderContextFromAlert

Extracts basic Defender context from alert metadata:

```typescript
import { extractDefenderContextFromAlert } from './DefenderIntegrationService';

const basicContext = extractDefenderContextFromAlert(alert);
if (basicContext) {
    // Use basic context without API call
}
```

## Error Handling

The service handles various error scenarios gracefully:

### API Unavailable
When Microsoft Defender API is unavailable, the service returns basic context with connection status:

```typescript
const context = await defenderService.enrichAlertWithDefenderContext(alert);
if (context && !context.connectionStatus.isConnected) {
    // Show connection error to user
    console.log('Defender API unavailable:', context.connectionStatus.error);
    // Still provide basic context and deep links
}
```

### Authentication Failures
Authentication errors are caught and reported in connection status:

```typescript
const status = await defenderService.checkConnectionStatus();
if (!status.isConnected && status.error?.includes('Authentication')) {
    // Handle authentication error (e.g., refresh credentials)
}
```

### Missing Data
The service handles missing Defender alerts or device information gracefully:

```typescript
const context = await defenderService.enrichAlertWithDefenderContext(alert);
if (context) {
    // Basic context is always available
    console.log('Deep Link:', context.deepLink);
    
    // Additional context may be missing
    if (context.deviceInfo) {
        console.log('Device available');
    } else {
        console.log('Device info not available');
    }
}
```

## Performance Considerations

### Batch Processing
The service processes alerts in batches of 5 to avoid overwhelming the Microsoft Graph API:

```typescript
// Automatically batched - no configuration needed
const contextMap = await defenderService.enrichAlertsWithDefenderContext(largeAlertArray);
```

### Connection Caching
Connection status is cached to avoid repeated authentication checks:

```typescript
// First call performs authentication
const status1 = await defenderService.checkConnectionStatus();

// Subsequent calls return cached status
const status2 = defenderService.getConnectionStatus();
```

### Rate Limiting
The underlying MicrosoftGraphClient handles rate limiting automatically with exponential backoff.

## Integration with Alert Manager

The DefenderIntegrationService integrates seamlessly with the AlertManager:

```typescript
// In AlertManager or API endpoints
const defenderService = createDefenderIntegrationService(config);

// Enrich alerts before returning to UI
const alerts = await AlertManager.getAlerts(filters);
const enrichedAlerts = await Promise.all(
    alerts.map(async (alert) => {
        const defenderContext = await defenderService.enrichAlertWithDefenderContext(alert);
        return {
            ...alert,
            defenderContext,
        };
    })
);
```

## Security Considerations

- **Read-only Access**: Service only reads data from Microsoft Defender
- **No Embedding**: External content is never embedded or iframed
- **Credential Management**: Uses secure OAuth2 client credentials flow
- **Tenant Isolation**: All operations are scoped to the configured tenant
- **Error Disclosure**: Sensitive error details are logged but not exposed to users

## Testing

The service includes comprehensive unit tests covering:

- Alert enrichment with full and partial context
- Batch processing functionality
- Deep-link generation
- Connection status management
- Error handling scenarios
- Helper function behavior

Run tests with:

```bash
npm test src/services/alerts-incidents/__tests__/DefenderIntegrationService.test.ts
```

## Dependencies

- **MicrosoftGraphClient**: For Microsoft Graph API communication
- **Logger**: For structured logging
- **EDR Types**: For Microsoft Defender data structures
- **Alerts-Incidents Types**: For AVIAN alert and incident types