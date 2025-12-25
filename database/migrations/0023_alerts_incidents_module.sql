-- Migration 0023: Alerts & Security Incidents Module Schema
-- Creates tables for security alerts, incidents, playbooks, and their relationships
-- Requirements: 0.1, 0.2, 0.3 (tenant isolation and core data models)

-- ============================================================================
-- Enums for Alerts & Security Incidents Module
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE alert_status AS ENUM (
        'open',
        'assigned',
        'investigating',
        'escalated',
        'closed_benign',
        'closed_false_positive'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_severity AS ENUM (
        'critical',
        'high',
        'medium',
        'low'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_source_system AS ENUM (
        'edr',
        'firewall',
        'email'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM (
        'open',
        'in_progress',
        'resolved',
        'dismissed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE playbook_status AS ENUM (
        'active',
        'draft',
        'deprecated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Security Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_system alert_source_system NOT NULL,
    source_id VARCHAR(255) NOT NULL, -- External system ID

    -- Classification
    alert_type VARCHAR(100) NOT NULL,
    classification VARCHAR(100) NOT NULL,
    severity alert_severity NOT NULL,

    -- Content
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Deduplication Intelligence (preserves reporting data)
    seen_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Microsoft Defender Context (if applicable)
    defender_incident_id VARCHAR(255),
    defender_alert_id VARCHAR(255),
    defender_severity VARCHAR(50),
    threat_name VARCHAR(255),
    affected_device VARCHAR(255),
    affected_user VARCHAR(255),

    -- Workflow State
    status alert_status NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP,

    -- Timestamps
    detected_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT security_alerts_seen_count_positive CHECK (seen_count >= 1),
    CONSTRAINT security_alerts_assignment_consistency CHECK (
        (status = 'open' AND assigned_to IS NULL AND assigned_at IS NULL) OR 
        (status IN ('assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive') AND assigned_to IS NOT NULL AND assigned_at IS NOT NULL)
    ),
    CONSTRAINT security_alerts_tenant_source_unique UNIQUE (tenant_id, source_system, source_id)
);

-- ============================================================================
-- Security Incidents Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Ownership (preserved from primary alert)
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Content
    title TEXT NOT NULL,
    description TEXT,
    severity alert_severity NOT NULL,

    -- Workflow State
    status incident_status NOT NULL DEFAULT 'open',

    -- Resolution
    resolution_summary TEXT,
    dismissal_justification TEXT,

    -- SLA Tracking
    sla_acknowledge_by TIMESTAMP NOT NULL,
    sla_investigate_by TIMESTAMP NOT NULL,
    sla_resolve_by TIMESTAMP NOT NULL,
    acknowledged_at TIMESTAMP, -- Set when analyst clicks "Start Work" (first time only)
    investigation_started_at TIMESTAMP, -- Set when analyst clicks "Start Work" (first time only)
    resolved_at TIMESTAMP, -- Set when status changes to 'resolved' or 'dismissed'

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT security_incidents_resolution_consistency CHECK (
        (status = 'resolved' AND resolution_summary IS NOT NULL AND dismissal_justification IS NULL) OR 
        (status = 'dismissed' AND dismissal_justification IS NOT NULL AND resolution_summary IS NULL) OR 
        (status IN ('open', 'in_progress') AND resolution_summary IS NULL AND dismissal_justification IS NULL)
    ),
    CONSTRAINT security_incidents_sla_order CHECK (
        sla_acknowledge_by <= sla_investigate_by AND sla_investigate_by <= sla_resolve_by
    ),
    CONSTRAINT security_incidents_workflow_timestamps CHECK (
        (acknowledged_at IS NULL OR acknowledged_at >= created_at) AND 
        (investigation_started_at IS NULL OR investigation_started_at >= created_at) AND 
        (resolved_at IS NULL OR resolved_at >= created_at)
    )
);

-- ============================================================================
-- Investigation Playbooks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS investigation_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    status playbook_status NOT NULL DEFAULT 'draft',

    -- Content
    purpose TEXT NOT NULL,
    initial_validation_steps JSONB NOT NULL DEFAULT '[]',
    source_investigation_steps JSONB NOT NULL DEFAULT '[]',
    containment_checks JSONB NOT NULL DEFAULT '[]',
    decision_guidance JSONB NOT NULL,

    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT investigation_playbooks_name_version_unique UNIQUE (name, version)
);

-- ============================================================================
-- Junction Tables
-- ============================================================================

-- Incident Alert Links Table
CREATE TABLE IF NOT EXISTS incident_alert_links (
    incident_id UUID NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES security_alerts(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (incident_id, alert_id)
);

-- Ensure only one primary alert per incident
CREATE UNIQUE INDEX IF NOT EXISTS incident_alert_links_one_primary_per_incident 
ON incident_alert_links (incident_id) 
WHERE is_primary = true;

-- Playbook Classification Links Table
CREATE TABLE IF NOT EXISTS playbook_classification_links (
    playbook_id UUID NOT NULL REFERENCES investigation_playbooks(id) ON DELETE CASCADE,
    classification VARCHAR(100) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    playbook_status playbook_status NOT NULL, -- Denormalized from investigation_playbooks.status
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (playbook_id, classification)
);

-- Ensure exactly one active primary playbook per classification
CREATE UNIQUE INDEX IF NOT EXISTS playbook_classification_links_one_active_primary_per_classification 
ON playbook_classification_links (classification) 
WHERE is_primary = true AND playbook_status = 'active';

-- ============================================================================
-- Indexes for Performance and Tenant Isolation
-- ============================================================================

-- Security Alerts Indexes
CREATE INDEX IF NOT EXISTS security_alerts_tenant_idx ON security_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS security_alerts_tenant_status_idx ON security_alerts(tenant_id, status);
CREATE INDEX IF NOT EXISTS security_alerts_tenant_assigned_idx ON security_alerts(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS security_alerts_status_idx ON security_alerts(status);
CREATE INDEX IF NOT EXISTS security_alerts_assigned_to_idx ON security_alerts(assigned_to);
CREATE INDEX IF NOT EXISTS security_alerts_severity_idx ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS security_alerts_severity_created_idx ON security_alerts(severity, created_at ASC);
CREATE INDEX IF NOT EXISTS security_alerts_assigned_at_idx ON security_alerts(assigned_at DESC);
CREATE INDEX IF NOT EXISTS security_alerts_source_system_idx ON security_alerts(source_system);
CREATE INDEX IF NOT EXISTS security_alerts_classification_idx ON security_alerts(classification);
CREATE INDEX IF NOT EXISTS security_alerts_detected_at_idx ON security_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS security_alerts_created_at_idx ON security_alerts(created_at DESC);

-- Security Incidents Indexes
CREATE INDEX IF NOT EXISTS security_incidents_tenant_idx ON security_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS security_incidents_tenant_owner_idx ON security_incidents(tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS security_incidents_tenant_status_idx ON security_incidents(tenant_id, status);
CREATE INDEX IF NOT EXISTS security_incidents_owner_idx ON security_incidents(owner_id);
CREATE INDEX IF NOT EXISTS security_incidents_status_idx ON security_incidents(status);
CREATE INDEX IF NOT EXISTS security_incidents_severity_idx ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS security_incidents_sla_acknowledge_idx ON security_incidents(sla_acknowledge_by);
CREATE INDEX IF NOT EXISTS security_incidents_sla_investigate_idx ON security_incidents(sla_investigate_by);
CREATE INDEX IF NOT EXISTS security_incidents_sla_resolve_idx ON security_incidents(sla_resolve_by);
CREATE INDEX IF NOT EXISTS security_incidents_created_at_idx ON security_incidents(created_at DESC);

-- Investigation Playbooks Indexes
CREATE INDEX IF NOT EXISTS investigation_playbooks_status_idx ON investigation_playbooks(status);
CREATE INDEX IF NOT EXISTS investigation_playbooks_name_idx ON investigation_playbooks(name);
CREATE INDEX IF NOT EXISTS investigation_playbooks_created_by_idx ON investigation_playbooks(created_by);
CREATE INDEX IF NOT EXISTS investigation_playbooks_created_at_idx ON investigation_playbooks(created_at DESC);

-- Junction Table Indexes
CREATE INDEX IF NOT EXISTS incident_alert_links_incident_idx ON incident_alert_links(incident_id);
CREATE INDEX IF NOT EXISTS incident_alert_links_alert_idx ON incident_alert_links(alert_id);
CREATE INDEX IF NOT EXISTS incident_alert_links_primary_idx ON incident_alert_links(is_primary);

CREATE INDEX IF NOT EXISTS playbook_classification_links_playbook_idx ON playbook_classification_links(playbook_id);
CREATE INDEX IF NOT EXISTS playbook_classification_links_classification_idx ON playbook_classification_links(classification);
CREATE INDEX IF NOT EXISTS playbook_classification_links_primary_idx ON playbook_classification_links(is_primary);
CREATE INDEX IF NOT EXISTS playbook_classification_links_status_idx ON playbook_classification_links(playbook_status);

-- ============================================================================
-- Update Triggers
-- ============================================================================

-- Update timestamp trigger for security_alerts
CREATE OR REPLACE FUNCTION update_security_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_security_alerts_updated_at
    BEFORE UPDATE ON security_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_security_alerts_updated_at();

-- Update timestamp trigger for security_incidents
CREATE OR REPLACE FUNCTION update_security_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_security_incidents_updated_at
    BEFORE UPDATE ON security_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_security_incidents_updated_at();

-- Update timestamp trigger for investigation_playbooks
CREATE OR REPLACE FUNCTION update_investigation_playbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_investigation_playbooks_updated_at
    BEFORE UPDATE ON investigation_playbooks
    FOR EACH ROW
    EXECUTE FUNCTION update_investigation_playbooks_updated_at();

-- Trigger to synchronize playbook_status in playbook_classification_links
CREATE OR REPLACE FUNCTION sync_playbook_classification_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all classification links when playbook status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE playbook_classification_links 
        SET playbook_status = NEW.status 
        WHERE playbook_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_playbook_classification_status
    AFTER UPDATE ON investigation_playbooks
    FOR EACH ROW
    EXECUTE FUNCTION sync_playbook_classification_status();

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE security_alerts IS 'Security alerts from various sources (EDR, Firewall, Email) with tenant isolation and deduplication intelligence';
COMMENT ON TABLE security_incidents IS 'Security incidents escalated from alerts with SLA tracking and ownership preservation';
COMMENT ON TABLE investigation_playbooks IS 'Investigation playbooks with version control and role-based access';
COMMENT ON TABLE incident_alert_links IS 'Junction table linking incidents to their originating alerts with primary alert designation';
COMMENT ON TABLE playbook_classification_links IS 'Junction table linking playbooks to alert classifications with primary/secondary relationships';

COMMENT ON COLUMN security_alerts.seen_count IS 'Number of times this alert pattern was detected (deduplication intelligence)';
COMMENT ON COLUMN security_alerts.first_seen_at IS 'When this alert pattern was first detected';
COMMENT ON COLUMN security_alerts.last_seen_at IS 'When this alert pattern was most recently detected';
COMMENT ON COLUMN security_alerts.metadata IS 'JSON metadata from source system';

COMMENT ON COLUMN security_incidents.sla_acknowledge_by IS 'SLA deadline for acknowledging the incident';
COMMENT ON COLUMN security_incidents.sla_investigate_by IS 'SLA deadline for starting investigation';
COMMENT ON COLUMN security_incidents.sla_resolve_by IS 'SLA deadline for resolving the incident';
COMMENT ON COLUMN security_incidents.acknowledged_at IS 'When analyst clicked "Start Work" (first time only)';
COMMENT ON COLUMN security_incidents.investigation_started_at IS 'When investigation actually started (first time only)';

COMMENT ON COLUMN investigation_playbooks.decision_guidance IS 'JSON guidance for escalation vs resolution decisions';
COMMENT ON COLUMN playbook_classification_links.playbook_status IS 'Denormalized status from investigation_playbooks for constraint enforcement';
COMMENT ON COLUMN incident_alert_links.is_primary IS 'Designates the primary alert that triggered incident creation';