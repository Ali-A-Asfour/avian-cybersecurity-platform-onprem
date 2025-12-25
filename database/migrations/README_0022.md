# Migration 0022: Reports Module Schema

## Overview

This migration creates the database schema for the AVIAN Reports Module, implementing report snapshots with audit trails and role-based access control as specified in the design document.

## Requirements

- **9.2**: Audit compliance and reproducibility
- **Role-based access control**: Super Admin and Security Analyst only
- **Template and data schema versioning**: For reproducible report generation

## Tables Created

### 1. report_snapshots

Stores immutable snapshots of generated reports for audit trails and re-delivery capability.

**Key Features:**
- Immutable report data with computed metrics
- Template and data schema versioning
- PDF storage integration with checksums
- Archive functionality for lifecycle management
- Comprehensive audit trail

**Columns:**
- `id`: Primary key (UUID)
- `tenant_id`: Foreign key to tenants table
- `report_id`: Reference to original report generation
- `report_type`: weekly, monthly, quarterly
- `start_date`, `end_date`: Report date range
- `timezone`: IANA timezone for date calculations
- `generated_at`, `generated_by`: Generation metadata
- `slide_data`: JSON payload of computed metrics
- `template_version`, `data_schema_version`: Versioning for reproducibility
- `pdf_storage_key`, `pdf_size`, `pdf_checksum`: PDF storage metadata
- `is_archived`, `archived_at`, `archived_by`: Archive management

### 2. report_access_logs

Tracks all access to report snapshots for audit compliance.

**Key Features:**
- Complete audit trail of all access attempts
- Role-based access validation logging
- IP address and user agent tracking
- Success/failure tracking with denial reasons

**Columns:**
- `id`: Primary key (UUID)
- `snapshot_id`: Foreign key to report_snapshots
- `tenant_id`, `user_id`: Access context
- `access_type`: view, download, export, list
- `user_role`: Role at time of access
- `ip_address`, `user_agent`: Client information
- `access_granted`: Success/failure flag
- `denial_reason`: Reason if access denied
- `accessed_at`: Timestamp of access attempt

### 3. report_generation_queue

Manages asynchronous report generation with status tracking.

**Key Features:**
- Priority-based queue processing
- Status tracking through generation lifecycle
- Error handling and retry support
- Integration with snapshot creation

**Columns:**
- `id`: Primary key (UUID)
- `tenant_id`, `requested_by`: Request context
- `report_type`, date range, `timezone`: Report parameters
- `status`: pending, processing, completed, failed, cancelled
- `priority`: 1-10 priority level (lower = higher priority)
- `snapshot_id`: Link to created snapshot
- `error_message`: Error details if failed
- Processing timestamps for monitoring

## Indexes

Performance indexes are created for:
- Tenant-scoped queries with date ordering
- Report type and user filtering
- Access log audit queries
- Queue processing optimization

## Constraints

### Check Constraints
- Valid report types (weekly, monthly, quarterly)
- Valid access types (view, download, export, list)
- Valid queue status values
- Date range validation (start <= end)
- Priority range validation (1-10)
- Archive consistency validation
- Completion status consistency

### Foreign Key Constraints
- Tenant isolation enforcement
- User reference preservation for audit trails
- Cascade deletion for tenant cleanup
- Restrict deletion for audit preservation

## Triggers

- `updated_at` timestamp triggers for both snapshots and queue tables
- Automatic timestamp maintenance on updates

## Security Features

### Role-Based Access Control
- Only Super Admin and Security Analyst roles can access reports
- Role validation enforced at service layer
- Role recorded in access logs for audit

### Audit Compliance
- Complete access logging for all operations
- Immutable snapshot data for reproducibility
- User and timestamp tracking for all changes
- IP address and user agent logging

### Data Integrity
- PDF checksums for file integrity verification
- Template and schema versioning for compatibility
- Foreign key constraints for referential integrity
- Check constraints for data validation

## Usage Examples

### Creating a Snapshot
```sql
INSERT INTO report_snapshots (
    tenant_id, report_id, report_type,
    start_date, end_date, timezone,
    generated_at, generated_by,
    slide_data, template_version, data_schema_version
) VALUES (
    'tenant-uuid', 'report-uuid', 'weekly',
    '2024-01-01', '2024-01-07', 'America/Toronto',
    NOW(), 'user-uuid',
    '{"slides": [...]}', 'v1.0.0', 'v1.0.0'
);
```

### Logging Access
```sql
INSERT INTO report_access_logs (
    snapshot_id, tenant_id, user_id,
    access_type, user_role, access_granted
) VALUES (
    'snapshot-uuid', 'tenant-uuid', 'user-uuid',
    'download', 'security_analyst', true
);
```

### Queue Management
```sql
-- Add to queue
INSERT INTO report_generation_queue (
    tenant_id, requested_by, report_type,
    start_date, end_date, timezone, priority
) VALUES (
    'tenant-uuid', 'user-uuid', 'monthly',
    '2024-01-01', '2024-01-31', 'America/Toronto', 5
);

-- Update status
UPDATE report_generation_queue 
SET status = 'completed', 
    snapshot_id = 'snapshot-uuid',
    processing_completed_at = NOW()
WHERE id = 'queue-uuid';
```

## Testing

Run the test file to verify:
```bash
psql -d your_database -f database/migrations/test_0022.sql
```

The test file validates:
- Table creation and structure
- Constraint enforcement
- Index performance
- Trigger functionality
- Foreign key relationships
- Data integrity rules

## Rollback

To rollback this migration:
```sql
DROP TABLE IF EXISTS report_generation_queue CASCADE;
DROP TABLE IF EXISTS report_access_logs CASCADE;
DROP TABLE IF EXISTS report_snapshots CASCADE;
DROP FUNCTION IF EXISTS update_report_snapshots_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_report_queue_updated_at() CASCADE;
```

## Integration

This schema integrates with:
- **ReportSnapshotService**: Service layer implementation
- **User authentication**: Role-based access control
- **Tenant isolation**: Multi-tenant data separation
- **PDF generation**: File storage and integrity verification
- **Audit systems**: Comprehensive access logging

## Performance Considerations

- Indexes optimized for common query patterns
- Partitioning may be needed for high-volume tenants
- Archive functionality to manage storage growth
- Queue processing optimized with priority and status indexes

## Compliance Notes

This schema supports:
- **SOX compliance**: Immutable audit trails
- **GDPR compliance**: Tenant data isolation
- **Security audits**: Complete access logging
- **Data retention**: Archive and cleanup capabilities