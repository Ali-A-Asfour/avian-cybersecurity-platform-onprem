# Alerts & Security Incidents Module

This module implements the complete AVIAN Alerts & Security Incidents system, providing comprehensive alert and incident lifecycle management with tenant isolation, deduplication intelligence, SLA tracking, and workflow enforcement.

## Services

### AlertManager
Manages the complete alert lifecycle from ingestion to resolution with tenant-scoped operations, Redis-based deduplication, and assignment workflow enforcement.

### IncidentManager
Manages security incidents escalated from alerts with ownership preservation, SLA timer calculation, deterministic tracking, and resolution outcome validation.

### PlaybookManager
Manages investigation playbooks with role-based access control, classification linking, automatic attachment, version control, and status management. Ensures exactly one active primary playbook per classification constraint.

### DefenderIntegrationService
Provides read-only context retrieval from Microsoft Defender for Endpoint and generates deep-links for external navigation. Enriches AVIAN alerts with Defender metadata without embedding external UIs, handling API failures gracefully with connection status indicators.

## Features

### Alert Ingestion and Normalization
- **Multi-source ingestion**: EDR (Microsoft Defender), Firewall, and Email alerts
- **Normalization**: Converts alerts from different sources into a common format
- **Classification**: Automatic alert classification based on source characteristics
- **Severity mapping**: Standardizes severity levels across different sources

### Deduplication with Intelligence Preservation
- **Redis-based deduplication**: Fast duplicate detection with 5-minute window
- **seenCount intelligence**: Preserves reporting data by tracking duplicate occurrences
- **Fallback mechanism**: Database-based deduplication when Redis is unavailable
- **Tenant isolation**: Deduplication scoped to individual tenants

### Assignment and Ownership Management
- **Single ownership**: Prevents duplicate work through ownership locking
- **Status transitions**: Enforced workflow from open → assigned → investigating → resolved
- **Tenant-scoped operations**: All operations isolated by tenant context
- **Audit trail**: Complete tracking of ownership changes and status transitions

### Alert Querying
- **Triage queue**: Unassigned alerts ordered by severity and creation time
- **Investigation queue**: Assigned alerts for individual analysts
- **Flexible filtering**: Support for status, severity, date range, and other filters
- **Pagination**: Efficient handling of large alert volumes

### SLA Tracking and Management
- **Severity-based SLA timers**: Automatic calculation based on incident severity
- **Deterministic tracking**: "Start Work" button for precise SLA measurement
- **Breach detection**: Automated monitoring of SLA violations
- **Warning system**: Proactive alerts for approaching deadlines

### Incident Resolution
- **Outcome validation**: Enforced resolution requirements (summary vs justification)
- **Ownership preservation**: Maintains analyst ownership throughout lifecycle
- **Status management**: Controlled transitions from open → in_progress → resolved/dismissed
- **Audit compliance**: Complete tracking of resolution decisions

### Playbook Management
- **Role-based access control**: Super Admin CRUD operations, Security Analyst read-only access
- **Classification linking**: Multiple classifications per playbook with primary/secondary relationships
- **Automatic attachment**: Playbooks automatically attached to alerts based on classification
- **Version control**: Multiple versions of playbooks with status management (Active, Draft, Deprecated)
- **Constraint enforcement**: Exactly one active primary playbook per classification
- **Status synchronization**: Denormalized status fields for database constraint enforcement

## API Reference

### Alert Ingestion

```typescript
// Ingest EDR alert
const alertId = await AlertManager.ingestEDRAlert(tenantId, {
    incidentId: 'incident-123',
    alertId: 'alert-456',
    severity: 'High',
    title: 'Malware Detected',
    description: 'Suspicious file detected on endpoint',
    threatName: 'Trojan:Win32/Malware',
    affectedDevice: 'DESKTOP-ABC123',
    affectedUser: 'john.doe@company.com',
    detectedAt: new Date(),
    metadata: { source: 'defender' },
});

// Ingest Firewall alert
const alertId = await AlertManager.ingestFirewallAlert(tenantId, {
    deviceId: 'firewall-123',
    alertType: 'ips_block',
    severity: 'medium',
    message: 'IPS blocked suspicious traffic',
    metadata: { sourceIp: '192.168.1.100' },
    detectedAt: new Date(),
});

// Ingest Email alert
const alertId = await AlertManager.ingestEmailAlert(tenantId, {
    subject: 'Security Alert: Critical System Event',
    body: 'A critical security event has been detected',
    sender: 'security@company.com',
    receivedAt: new Date(),
    deviceIdentifier: 'server-001',
});
```

### Assignment and Workflow

```typescript
// Assign alert to analyst
await AlertManager.assignAlert({
    alertId: 'alert-123',
    assignedTo: 'analyst-456',
    tenantId: 'tenant-789',
});

// Start investigation
await AlertManager.startInvestigation(alertId, tenantId, userId);

// Resolve alert
await AlertManager.resolveAlert({
    alertId: 'alert-123',
    tenantId: 'tenant-789',
    outcome: 'benign', // or 'false_positive'
    notes: 'False positive - legitimate software',
});
```

### Querying Alerts

```typescript
// Get triage queue (unassigned alerts)
const triageAlerts = await AlertManager.getTriageQueue(tenantId, 50, 0);

// Get investigation queue (assigned to analyst)
const myAlerts = await AlertManager.getInvestigationQueue(
    tenantId, 
    analystId, 
    50, 
    0
);

// Advanced filtering
const alerts = await AlertManager.getAlerts({
    tenantId: 'tenant-123',
    status: ['assigned', 'investigating'],
    severity: 'critical',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    limit: 100,
    offset: 0,
});
```

### Incident Management

```typescript
// Escalate alert to security incident
const incidentId = await IncidentManager.escalateAlert({
    alertId: 'alert-123',
    tenantId: 'tenant-789',
    incidentTitle: 'Critical Security Breach',
    incidentDescription: 'Multiple malware detections on critical systems',
});

// Start work on incident (SLA tracking)
await IncidentManager.startWork({
    incidentId: 'incident-456',
    tenantId: 'tenant-789',
    ownerId: 'analyst-123',
});

// Resolve incident with summary
await IncidentManager.resolveIncident({
    incidentId: 'incident-456',
    tenantId: 'tenant-789',
    ownerId: 'analyst-123',
    outcome: 'resolved',
    summary: 'Malware removed, systems cleaned, security patches applied',
});

// Dismiss incident with justification
await IncidentManager.resolveIncident({
    incidentId: 'incident-456',
    tenantId: 'tenant-789',
    ownerId: 'analyst-123',
    outcome: 'dismissed',
    justification: 'False positive - legitimate software flagged by AV',
});
```

### Incident Querying

```typescript
// Get my incidents (owned by analyst)
const myIncidents = await IncidentManager.getMyIncidents(tenantId, analystId);

// Get all incidents (read-only visibility)
const allIncidents = await IncidentManager.getAllIncidents(tenantId);

// Get incident with linked alerts
const incidentDetails = await IncidentManager.getIncidentWithAlerts(
    incidentId,
    tenantId,
    ownerId // Optional for read-only access
);

// Check SLA breaches
const breaches = await IncidentManager.checkSLABreaches(tenantId);
console.log('Acknowledge breaches:', breaches.acknowledgeBreaches);
console.log('Investigate breaches:', breaches.investigateBreaches);
console.log('Resolve breaches:', breaches.resolveBreaches);

// Get incidents approaching SLA deadlines
const warnings = await IncidentManager.getIncidentsApproachingSLA(tenantId, 30);
```

### Playbook Management

```typescript
// Create new playbook (Super Admin only)
const playbookId = await PlaybookManager.createPlaybook(
    {
        name: 'Malware Investigation',
        version: '1.0',
        status: 'draft',
        purpose: 'Guide for investigating malware alerts',
        initialValidationSteps: ['Check alert details', 'Verify threat indicators'],
        sourceInvestigationSteps: ['Analyze file hash', 'Check network connections'],
        containmentChecks: ['Isolate affected device', 'Block malicious IPs'],
        decisionGuidance: {
            escalateToIncident: 'If malware is confirmed and spreading',
            resolveBenign: 'If file is confirmed safe',
            resolveFalsePositive: 'If alert is triggered by legitimate software',
        },
        createdBy: 'admin-123',
    },
    [
        { classification: 'malware', isPrimary: true },
        { classification: 'suspicious_activity', isPrimary: false },
    ],
    'super_admin'
);

// Update playbook (Super Admin only)
await PlaybookManager.updatePlaybook(
    playbookId,
    {
        status: 'active',
        purpose: 'Updated guide for investigating malware alerts',
    },
    [
        { classification: 'malware', isPrimary: true },
        { classification: 'phishing', isPrimary: false },
    ],
    'super_admin'
);

// Get playbooks (all users)
const playbooks = await PlaybookManager.getPlaybooks({
    status: 'active',
    classification: 'malware',
    limit: 10,
});

// Get playbook by ID with classifications
const playbookDetails = await PlaybookManager.getPlaybookById(playbookId);

// Get playbooks for specific classification
const { primary, secondary } = await PlaybookManager.getPlaybooksForClassification('malware');

// Attach playbooks to alert automatically
const alertWithPlaybooks = await PlaybookManager.attachPlaybooksToAlert(alert);

// Activate playbook (Super Admin only)
await PlaybookManager.activatePlaybook(playbookId, 'super_admin');

// Deprecate playbook (Super Admin only)
await PlaybookManager.deprecatePlaybook(playbookId, 'super_admin');

// Get all versions of a playbook
const versions = await PlaybookManager.getPlaybookVersions('Malware Investigation');
```

### SLA Configuration

```typescript
import { SLA_TIMERS } from '../types/alerts-incidents';

// SLA timers by severity
console.log('Critical SLA:', SLA_TIMERS.critical);
// { acknowledgeMinutes: 15, investigateMinutes: 60, resolveMinutes: 240 }

console.log('High SLA:', SLA_TIMERS.high);
// { acknowledgeMinutes: 30, investigateMinutes: 120, resolveMinutes: 480 }

console.log('Medium SLA:', SLA_TIMERS.medium);
// { acknowledgeMinutes: 60, investigateMinutes: 240, resolveMinutes: 1440 }

console.log('Low SLA:', SLA_TIMERS.low);
// { acknowledgeMinutes: 240, investigateMinutes: 480, resolveMinutes: 4320 }
```

## Database Schema

The service uses the following database tables:

- **security_alerts**: Main alerts table with tenant isolation and deduplication fields
- **security_incidents**: Escalated incidents with SLA tracking and ownership preservation
- **incident_alert_links**: Junction table for incident-alert relationships with primary alert constraints
- **investigation_playbooks**: Guided investigation procedures with version control and status management
- **playbook_classification_links**: Junction table for playbook-classification mapping with denormalized status enforcement

## Requirements Compliance

This implementation satisfies the following requirements:

### AlertManager Requirements
- **1.1**: Tenant-scoped alert querying and filtering
- **1.4**: Alert assignment with ownership locking
- **2.1**: Status transitions from open to assigned
- **2.2**: Assignment status management
- **2.3**: Investigation workflow enforcement
- **12.1**: Multi-source alert ingestion
- **12.2**: Deduplication with intelligence preservation

### IncidentManager Requirements
- **6.2**: Incident creation from alert escalation with ownership preservation
- **6.3**: Multiple alert support for incidents
- **7.1**: Incident querying with tenant isolation
- **7.2**: Ownership preservation throughout incident lifecycle
- **7.4**: Resolution outcome validation (summary for resolved)
- **7.5**: Dismissal outcome validation (justification for dismissed)
- **10.1**: SLA timer calculation based on severity levels
- **10.2**: Critical incident SLA timers (15m/1h/4h)
- **10.3**: High incident SLA timers (30m/2h/8h)
- **10.4**: Medium incident SLA timers (1h/4h/24h)
- **10.5**: Low incident SLA timers (4h/8h/72h)

### PlaybookManager Requirements
- **5.1**: Automatic playbook attachment based on alert classification
- **5.2**: Primary and secondary playbook relationships
- **5.3**: Read-only access for Security Analysts
- **9.1**: Super Admin CRUD operations for playbooks
- **9.2**: Multiple classification linking with primary/secondary designation
- **9.3**: Version control and status management (Active, Draft, Deprecated)
- **9.4**: Role-based access control enforcement
- **9.5**: Exactly one active primary playbook per classification constraint

## Testing

The services include comprehensive unit tests covering:

### AlertManager Tests
- Alert ingestion from all sources
- Deduplication logic and seenCount updates
- Assignment and ownership management
- Status transitions and workflow enforcement
- Error handling and graceful degradation

### IncidentManager Tests
- Incident creation from alert escalation
- SLA timer calculation for all severity levels
- "Start Work" functionality and SLA tracking
- Resolution outcome validation
- Tenant-scoped querying and ownership enforcement
- SLA breach detection and monitoring

### PlaybookManager Tests
- Role-based access control enforcement
- Playbook CRUD operations with validation
- Classification linking with primary/secondary relationships
- Automatic playbook attachment to alerts
- Version control and status management
- Constraint enforcement (one active primary per classification)
- Error handling and graceful degradation

### DefenderIntegrationService Tests
- Alert enrichment with full and partial Defender context
- Batch processing functionality for multiple alerts
- Deep-link generation for incidents, alerts, and devices
- Connection status management and monitoring
- Graceful error handling for API failures
- Helper function behavior and edge cases

Run tests with:
```bash
npm test src/services/alerts-incidents/__tests__/AlertManager.test.ts
npm test src/services/alerts-incidents/__tests__/IncidentManager.test.ts
npm test src/services/alerts-incidents/__tests__/PlaybookManager.test.ts
npm test src/services/alerts-incidents/__tests__/DefenderIntegrationService.test.ts
```

## Dependencies

- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis for deduplication and performance
- **Logging**: Structured logging with context
- **Types**: TypeScript for type safety

## Error Handling

The service implements robust error handling:

- **Database failures**: Graceful error reporting with context
- **Redis unavailable**: Fallback to database-only operation
- **Validation errors**: Clear error messages for invalid inputs
- **Concurrency**: Proper handling of concurrent assignment attempts

## Performance Considerations

- **Redis caching**: Fast deduplication checks
- **Database indexes**: Optimized queries for tenant-scoped operations
- **Pagination**: Efficient handling of large result sets
- **Connection pooling**: Managed database connections

## Security

- **Tenant isolation**: Complete data separation between tenants
- **Input validation**: Sanitized inputs to prevent injection attacks
- **Audit logging**: Complete audit trail for security monitoring
- **Access control**: Role-based access enforcement (future implementation)