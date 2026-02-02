# Microsoft Graph API Client

## Overview

The Microsoft Graph API Client provides a comprehensive interface for interacting with Microsoft Defender for Endpoint and Microsoft Intune through the Microsoft Graph API. It handles authentication, data retrieval, remote actions, rate limiting, and error handling.

## Features

- **OAuth 2.0 Authentication**: Client credentials flow with automatic token caching and refresh
- **Device Management**: Retrieve devices from both Defender and Intune
- **Alert Retrieval**: Get security alerts from Microsoft Defender
- **Vulnerability Management**: Retrieve CVE data and affected devices
- **Compliance Monitoring**: Get device compliance status from Intune
- **Remote Actions**: Execute security actions (isolate, unisolate, scan)
- **Rate Limiting**: Automatic handling with exponential backoff (max 5 minutes)
- **Error Handling**: Comprehensive error handling for 401, 403, 404, 429, 500 responses
- **Token Caching**: In-memory token cache for performance

## Usage

### Creating a Client

```typescript
import { createMicrosoftGraphClient } from '@/lib/microsoft-graph-client';

const credentials = {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tenantId: 'your-tenant-id',
};

const client = createMicrosoftGraphClient(credentials);
```

### Authentication

```typescript
// Authenticate and get access token (automatically cached)
const accessToken = await client.authenticate(tenantId);

// Refresh token (clears cache and gets new token)
const newToken = await client.refreshToken(tenantId);
```

### Retrieving Devices

```typescript
// Get devices from Microsoft Defender
const defenderDevices = await client.getDefenderDevices(tenantId);

// Get devices from Microsoft Intune
const intuneDevices = await client.getIntuneDevices(tenantId);
```

### Retrieving Alerts

```typescript
// Get all alerts
const alerts = await client.getDefenderAlerts(tenantId);

// Get alerts since a specific date
const recentAlerts = await client.getDefenderAlerts(
  tenantId,
  new Date('2024-01-01')
);
```

### Retrieving Vulnerabilities

```typescript
// Get all vulnerabilities
const vulnerabilities = await client.getVulnerabilities(tenantId);

// Get vulnerabilities for a specific device
const deviceVulns = await client.getDeviceVulnerabilities(tenantId, deviceId);
```

### Retrieving Compliance

```typescript
// Get compliance status for all devices
const compliance = await client.getDeviceCompliance(tenantId);
```

### Remote Actions

```typescript
// Isolate a device
const isolateResult = await client.isolateDevice(tenantId, deviceId);

// Unisolate a device
const unisolateResult = await client.unisolateDevice(tenantId, deviceId);

// Run antivirus scan
const scanResult = await client.runAntivirusScan(tenantId, deviceId);
```

## Rate Limiting

The client automatically handles rate limiting (HTTP 429 responses):

1. **Retry-After Header**: Parses and respects the `Retry-After` header from Microsoft
2. **Exponential Backoff**: If no header is present, uses exponential backoff starting at 1 second
3. **Maximum Delay**: Caps retry delay at 5 minutes
4. **Maximum Retries**: Attempts up to 3 retries before failing

## Error Handling

The client handles various error scenarios:

- **401 Unauthorized**: Automatically refreshes token and retries (up to 3 times)
- **403 Forbidden**: Logs error and throws with detailed message
- **404 Not Found**: Logs warning and throws
- **429 Rate Limit**: Implements retry logic with exponential backoff
- **500 Server Error**: Retries with exponential backoff (up to 3 times)

## Token Caching

Tokens are cached in memory with the following behavior:

- **Cache Key**: Tenant ID
- **Expiration**: Tokens are considered valid if they expire in more than 1 minute
- **Refresh**: Automatically refreshes when token is expired or about to expire
- **Clearing**: Use `client.clearTokenCache()` to manually clear the cache

## Important Notes

### API Endpoint Placeholders

Some API endpoints in this implementation are conceptual placeholders and need to be confirmed with official Microsoft documentation:

- **Defender Devices**: The actual endpoint path for retrieving Defender devices
- **Remote Actions**: The exact paths for isolate, unisolate, and scan actions
- **Vulnerabilities**: The correct endpoint structure for vulnerability data

**Before production use**, verify all endpoint paths against the official Microsoft Graph API documentation:
- [Microsoft Graph API Reference](https://learn.microsoft.com/en-us/graph/api/overview)
- [Microsoft Defender for Endpoint API](https://learn.microsoft.com/en-us/microsoft-365/security/defender-endpoint/api-overview)
- [Microsoft Intune API](https://learn.microsoft.com/en-us/graph/api/resources/intune-graph-overview)

### MVP Scope

This implementation uses **standard Microsoft Graph REST endpoints only**. It does NOT include:

- Advanced Hunting queries
- KQL (Kusto Query Language) execution
- Threat Analytics ingestion
- Custom detection rules
- Raw log ingestion

## Security Considerations

- **Credentials**: Never log or expose client secrets
- **Token Storage**: Tokens are stored in memory only, not persisted
- **HTTPS Only**: All API calls use HTTPS
- **Least Privilege**: Use minimum required API permissions

## Required Microsoft API Permissions

The client requires the following Microsoft Graph API permissions:

### Defender for Endpoint
- `SecurityEvents.Read.All`
- `Machine.Read.All`
- `Alert.Read.All`
- `Vulnerability.Read.All`
- `Machine.Isolate` (for remote actions)
- `Machine.Scan` (for antivirus scans)

### Intune
- `DeviceManagementManagedDevices.Read.All`
- `DeviceManagementConfiguration.Read.All`

## Testing

See the test file at `src/lib/__tests__/microsoft-graph-client.test.ts` for comprehensive unit tests covering:

- Authentication and token caching
- Device retrieval
- Alert retrieval
- Vulnerability retrieval
- Compliance retrieval
- Remote actions
- Rate limiting behavior
- Error handling

## Logging

The client uses the application logger (`@/lib/logger`) and logs:

- **Info**: Successful operations, token refresh, data retrieval counts
- **Warn**: Rate limiting events, 404 errors, authentication retries
- **Error**: Authentication failures, API errors, server errors
- **Debug**: Token cache hits

## Future Enhancements

- Support for pagination of large result sets
- Batch operations for multiple devices
- WebSocket support for real-time updates
- Advanced filtering and querying
- Automatic credential rotation
- Circuit breaker pattern for failing endpoints
