-- Migration 0022: Reports Module Schema
-- Creates tables for report snapshots, access logs, and generation queue
-- Requirements: 9.2, audit compliance

-- ============================================================================
-- Report Snapshots Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_id UUID NOT NULL, -- Reference to the original report generation
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'quarterly')),

    -- Date range information
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    timezone VARCHAR(50) NOT NULL, -- IANA timezone

    -- Generation metadata
    generated_at TIMESTAMP NOT NULL,
    generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Preserve audit trail

    -- Snapshot data
    slide_data JSONB NOT NULL, -- JSON payload of computed metrics
    template_version VARCHAR(50) NOT NULL,
    data_schema_version VARCHAR(50) NOT NULL,

    -- PDF storage information
    pdf_storage_key VARCHAR(500), -- S3 key or file path
    pdf_size INTEGER CHECK (pdf_size IS NULL OR pdf_size > 0),
    pdf_checksum VARCHAR(64), -- SHA-256 checksum for integrity

    -- Archive status
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMP,
    archived_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Check constraints
    CONSTRAINT check_date_range_valid CHECK (start_date <= end_date),
    CONSTRAINT check_archive_consistency CHECK (
        (is_archived = false AND archived_at IS NULL AND archived_by IS NULL) OR 
        (is_archived = true AND archived_at IS NOT NULL)
    )
);

-- ============================================================================
-- Report Access Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID REFERENCES report_snapshots(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Preserve audit trail

    -- Access details
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('view', 'download', 'export', 'list')),
    user_role VARCHAR(50) NOT NULL, -- Role at time of access
    ip_address VARCHAR(45), -- IPv6 support
    user_agent TEXT,

    -- Result
    access_granted BOOLEAN NOT NULL,
    denial_reason VARCHAR(100), -- If access denied

    -- Timestamps
    accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Check constraints
    CONSTRAINT check_denial_reason_consistency CHECK (
        (access_granted = true AND denial_reason IS NULL) OR 
        (access_granted = false AND denial_reason IS NOT NULL)
    )
);

-- ============================================================================
-- Report Generation Queue Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_generation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Request details
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'quarterly')),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    timezone VARCHAR(50) NOT NULL,

    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1-10, lower is higher priority

    -- Results
    snapshot_id UUID REFERENCES report_snapshots(id) ON DELETE SET NULL,
    error_message TEXT,
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Check constraints
    CONSTRAINT check_queue_date_range_valid CHECK (start_date <= end_date),
    CONSTRAINT check_completion_consistency CHECK (
        (status = 'completed' AND snapshot_id IS NOT NULL AND processing_completed_at IS NOT NULL) OR 
        (status != 'completed')
    ),
    CONSTRAINT check_error_consistency CHECK (
        (status = 'failed' AND error_message IS NOT NULL) OR 
        (status != 'failed')
    )
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Report Snapshots Indexes
CREATE INDEX IF NOT EXISTS idx_report_snapshots_tenant ON report_snapshots(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_type ON report_snapshots(report_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_generated_by ON report_snapshots(generated_by);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_date_range ON report_snapshots(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_archived ON report_snapshots(is_archived, archived_at);

-- Report Access Logs Indexes
CREATE INDEX IF NOT EXISTS idx_report_access_snapshot ON report_access_logs(snapshot_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_access_tenant ON report_access_logs(tenant_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_access_user ON report_access_logs(user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_access_type ON report_access_logs(access_type);
CREATE INDEX IF NOT EXISTS idx_report_access_accessed_at ON report_access_logs(accessed_at DESC);

-- Report Generation Queue Indexes
CREATE INDEX IF NOT EXISTS idx_report_queue_status ON report_generation_queue(status, priority, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_report_queue_tenant ON report_generation_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_queue_requested_by ON report_generation_queue(requested_by);

-- ============================================================================
-- Update Triggers
-- ============================================================================

-- Update timestamp trigger for report_snapshots
CREATE OR REPLACE FUNCTION update_report_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_report_snapshots_updated_at
    BEFORE UPDATE ON report_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_report_snapshots_updated_at();

-- Update timestamp trigger for report_generation_queue
CREATE OR REPLACE FUNCTION update_report_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_report_queue_updated_at
    BEFORE UPDATE ON report_generation_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_report_queue_updated_at();

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE report_snapshots IS 'Immutable snapshots of generated reports for audit trails and re-delivery';
COMMENT ON TABLE report_access_logs IS 'Audit log of all access to report snapshots for compliance';
COMMENT ON TABLE report_generation_queue IS 'Queue for async report generation with status tracking';

COMMENT ON COLUMN report_snapshots.slide_data IS 'JSON payload of computed metrics for reproducible report generation';
COMMENT ON COLUMN report_snapshots.template_version IS 'Version of report template used for generation';
COMMENT ON COLUMN report_snapshots.data_schema_version IS 'Version of data schema for compatibility';
COMMENT ON COLUMN report_snapshots.pdf_storage_key IS 'S3 key or file path for stored PDF';
COMMENT ON COLUMN report_snapshots.pdf_checksum IS 'SHA-256 checksum for PDF integrity verification';

COMMENT ON COLUMN report_access_logs.access_type IS 'Type of access: view, download, export, list';
COMMENT ON COLUMN report_access_logs.user_role IS 'User role at time of access for audit trail';
COMMENT ON COLUMN report_access_logs.denial_reason IS 'Reason for access denial if applicable';

COMMENT ON COLUMN report_generation_queue.priority IS 'Processing priority 1-10, lower numbers processed first';
COMMENT ON COLUMN report_generation_queue.status IS 'Queue status: pending, processing, completed, failed, cancelled';