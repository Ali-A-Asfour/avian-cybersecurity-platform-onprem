-- Fix Security Alerts Table Creation
-- Date: January 23, 2026

-- First, add missing enum values to alert_status
ALTER TYPE alert_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE alert_status ADD VALUE IF NOT EXISTS 'escalated';
ALTER TYPE alert_status ADD VALUE IF NOT EXISTS 'closed_benign';
ALTER TYPE alert_status ADD VALUE IF NOT EXISTS 'closed_false_positive';

-- Create security_alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Source system information
    source_system alert_source_system NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    classification VARCHAR(100) NOT NULL,
    
    -- Alert content
    severity alert_severity NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}' NOT NULL,
    
    -- Deduplication intelligence
    seen_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Microsoft Defender context (optional)
    defender_incident_id VARCHAR(255),
    defender_alert_id VARCHAR(255),
    defender_severity VARCHAR(50),
    threat_name VARCHAR(255),
    affected_device VARCHAR(255),
    affected_user VARCHAR(255),
    
    -- Workflow state
    status alert_status NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP,
    
    -- Timestamps
    detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
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

-- Create indexes for performance
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

-- Create update timestamp trigger
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

-- Add table comment
COMMENT ON TABLE security_alerts IS 'Security alerts from various sources (EDR, Firewall, Email) with tenant isolation and deduplication intelligence';
COMMENT ON COLUMN security_alerts.seen_count IS 'Number of times this alert pattern was detected (deduplication intelligence)';
COMMENT ON COLUMN security_alerts.first_seen_at IS 'When this alert pattern was first detected';
COMMENT ON COLUMN security_alerts.last_seen_at IS 'When this alert pattern was most recently detected';
COMMENT ON COLUMN security_alerts.metadata IS 'JSON metadata from source system';