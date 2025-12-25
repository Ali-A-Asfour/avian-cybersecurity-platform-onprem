# Migration 0023: Alerts & Security Incidents Module

## Overview

This migration creates the database schema for the AVIAN Alerts & Security Incidents Module, implementing a comprehensive SOC workflow system for security analysts to triage, investigate, and resolve security alerts from various sources.

## Requirements Addressed

- **0.1**: Tenant isolation for all alerts, incidents, queues, and reports
- **0.2**: Complete data isolation between tenants at API, data, and UI layers  
- **0.3**: Tenant-scoped "All Alerts" and "All Security Incidents" functionality

## Tables Created

### Core Tables

#### `security_alerts`
- Stores all security alerts from EDR, Firewall, and Email sources
- Implements tenant isolation and deduplication intelligence
- Tracks workflow state (open → assigned → investigating → escalated/resolved)
- Preserves Microsoft Defender context for EDR alerts
- **Key Features**:
  - Deduplication with `seen_count`, `first_seen_at`, `last_seen_at`
  - Assignment tracking with ownership locks
  - Tenant-scoped unique constraints on `(tenant_id, source_system, source_id)`

#### `security_incidents`
- Stores security incidents escalated from alerts
- Implements SLA tracking with severity-based deadlines
- Preserves ownership from originating alert
- **Key Features**:
  - SLA deadlines: `sla_acknowledge_by`, `sla_investigate_by`, `sla_resolve_by`
  - Workflow timestamps: `acknowledged_at`, `investigation_started_at`, `resolved_at`
  - Resolution validation: requires summary for resolved, justification for dismissed

#### `investigation_playbooks`
- Stores investigation playbooks with version control
- Supports role-based access (Super Admin CRUD, Analyst read-only)
- **Key Features**:
  - JSON content fields for steps and guidance
  - Version control with `name` + `version` uniqueness
  - Status management: active, draft, deprecated

### Junction Tables

#### `incident_alert_links`
- Links incidents to their originating alerts
- Supports multiple alerts per incident with primary alert designation
- **Constraints**: Exactly one primary alert per incident

#### `playbook_classification_links`
- Links playbooks to alert classifications
- Supports primary/secondary playbook relationships
- **Key Features**:
  - Denormalized `playbook_status` for constraint enforcement
  - Automatic synchronization via triggers
  - **Constraints**: Exactly one active primary playbook per classification

## Enums Created

- `alert_status`: open, assigned, investigating, escalated, closed_benign, closed_false_positive
- `alert_severity`: critical, high, medium, low
- `alert_source_system`: edr, firewall, email
- `incident_status`: open, in_progress, resolved, dismissed
- `playbook_status`: active, draft, deprecated

## Indexes for Performance

### Tenant Isolation Indexes
- `security_alerts_tenant_idx`: Primary tenant filtering
- `security_alerts_tenant_status_idx`: Tenant + status filtering
- `security_alerts_tenant_assigned_idx`: Tenant + assignment filtering
- `security_incidents_tenant_idx`: Primary tenant filtering
- `security_incidents_tenant_owner_idx`: Tenant + owner filtering

### Workflow Indexes
- `security_alerts_severity_created_idx`: Triage queue ordering (severity → created_at)
- `security_alerts_assigned_at_idx`: My Alerts ordering (assigned_at DESC)
- `security_incidents_sla_*_idx`: SLA deadline monitoring

### Performance Indexes
- Classification lookup for playbook attachment
- Source system filtering
- Status and severity filtering

## Constraints and Data Integrity

### Business Logic Constraints
1. **Assignment Consistency**: Alerts must have `assigned_to` and `assigned_at` when not in 'open' status
2. **Resolution Consistency**: Incidents require appropriate resolution fields based on status
3. **SLA Order**: SLA deadlines must be in logical order (acknowledge ≤ investigate ≤ resolve)
4. **Workflow Timestamps**: All workflow timestamps must be after creation time

### Uniqueness Constraints
1. **Alert Deduplication**: `(tenant_id, source_system, source_id)` unique per tenant
2. **Primary Alert**: Only one primary alert per incident
3. **Primary Playbook**: Only one active primary playbook per classification
4. **Playbook Versioning**: `(name, version)` unique across all playbooks

## Triggers

### Update Timestamp Triggers
- Automatically updates `updated_at` on record changes
- Applied to: `security_alerts`, `security_incidents`, `investigation_playbooks`

### Status Synchronization Trigger
- `sync_playbook_classification_status()`: Synchronizes `playbook_status` in junction table when playbook status changes
- Ensures constraint enforcement remains valid after playbook status updates

## Testing

Run the test file to verify:
```sql
\i database/migrations/test_0023.sql
```

### Test Coverage
- Basic CRUD operations on all tables
- Constraint validation (uniqueness, business logic)
- Index performance verification
- Trigger functionality
- Tenant isolation verification
- Junction table relationships

## Migration Dependencies

**Requires**:
- Migration 0001: `tenants` table
- Migration 0008: `users` table with proper roles

**Provides**:
- Complete schema for Alerts & Security Incidents Module
- Foundation for SOC workflow implementation

## Rollback

To rollback this migration:
```sql
-- Drop tables in dependency order
DROP TABLE IF EXISTS playbook_classification_links;
DROP TABLE IF EXISTS incident_alert_links;
DROP TABLE IF EXISTS investigation_playbooks;
DROP TABLE IF EXISTS security_incidents;
DROP TABLE IF EXISTS security_alerts;

-- Drop enums
DROP TYPE IF EXISTS playbook_status;
DROP TYPE IF EXISTS incident_status;
DROP TYPE IF EXISTS alert_source_system;
DROP TYPE IF EXISTS alert_severity;
DROP TYPE IF EXISTS alert_status;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trigger_sync_playbook_classification_status ON investigation_playbooks;
DROP TRIGGER IF EXISTS trigger_update_investigation_playbooks_updated_at ON investigation_playbooks;
DROP TRIGGER IF EXISTS trigger_update_security_incidents_updated_at ON security_incidents;
DROP TRIGGER IF EXISTS trigger_update_security_alerts_updated_at ON security_alerts;

DROP FUNCTION IF EXISTS sync_playbook_classification_status();
DROP FUNCTION IF EXISTS update_investigation_playbooks_updated_at();
DROP FUNCTION IF EXISTS update_security_incidents_updated_at();
DROP FUNCTION IF EXISTS update_security_alerts_updated_at();
```

## Performance Considerations

### Query Patterns Optimized
1. **Triage Queue**: `WHERE tenant_id = ? AND status = 'open' ORDER BY severity, created_at`
2. **My Alerts**: `WHERE tenant_id = ? AND assigned_to = ? ORDER BY assigned_at DESC`
3. **My Incidents**: `WHERE tenant_id = ? AND owner_id = ?`
4. **All Incidents**: `WHERE tenant_id = ?` (read-only)
5. **Playbook Lookup**: `WHERE classification = ? AND is_primary = true AND playbook_status = 'active'`

### Scalability Notes
- All queries are tenant-scoped for horizontal scaling
- Indexes support both filtering and ordering requirements
- Deduplication reduces alert volume while preserving intelligence
- Junction tables use composite primary keys for efficiency

## Security Considerations

### Tenant Isolation
- All tables include `tenant_id` with CASCADE DELETE
- All indexes include tenant filtering
- No cross-tenant visibility in any query pattern

### Data Retention
- Alerts and incidents preserved for reporting after resolution
- Audit trail maintained through workflow timestamps
- Playbook version history preserved for compliance

### Access Control
- User references use RESTRICT to preserve audit trails
- Role-based access enforced at application layer
- Ownership preservation prevents unauthorized reassignment