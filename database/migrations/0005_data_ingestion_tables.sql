-- Migration: Add data ingestion tables
-- Description: Creates tables for data sources and security events

-- Data sources table (tenant-specific)
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'edr_avast', 'edr_crowdstrike', 'edr_sentinelone', 'edr_generic',
        'firewall_pfsense', 'firewall_fortinet', 'firewall_cisco',
        'siem_splunk', 'siem_qradar', 'syslog'
    )),
    connection_config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'connecting')),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    events_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_data_source_name UNIQUE (tenant_id, name)
);

-- Security events table (tenant-specific)
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    asset_id UUID,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_data JSONB NOT NULL DEFAULT '{}',
    normalized_data JSONB NOT NULL DEFAULT '{}',
    tags JSONB NOT NULL DEFAULT '[]',
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_sources_tenant_id ON data_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);

CREATE INDEX IF NOT EXISTS idx_security_events_tenant_id ON security_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_source_type ON security_events(source_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_asset_id ON security_events(asset_id) WHERE asset_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_events_tenant_timestamp ON security_events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant_severity ON security_events(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant_source_type ON security_events(tenant_id, source_type);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_security_events_raw_data_gin ON security_events USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_security_events_normalized_data_gin ON security_events USING GIN (normalized_data);
CREATE INDEX IF NOT EXISTS idx_security_events_tags_gin ON security_events USING GIN (tags);

-- Update trigger for data_sources
CREATE OR REPLACE FUNCTION update_data_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_data_sources_updated_at
    BEFORE UPDATE ON data_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_data_sources_updated_at();

-- Partitioning for security_events by month (for better performance with large datasets)
-- This is optional and can be implemented later if needed

-- Comments for documentation
COMMENT ON TABLE data_sources IS 'Configuration and status of external data sources for security event ingestion';
COMMENT ON TABLE security_events IS 'Normalized security events from various data sources';

COMMENT ON COLUMN data_sources.type IS 'Type of data source (EDR, firewall, SIEM, etc.)';
COMMENT ON COLUMN data_sources.connection_config IS 'JSON configuration for connecting to the data source';
COMMENT ON COLUMN data_sources.status IS 'Current operational status of the data source';
COMMENT ON COLUMN data_sources.events_processed IS 'Total number of events processed from this source';

COMMENT ON COLUMN security_events.source_type IS 'Type of the originating data source';
COMMENT ON COLUMN security_events.raw_data IS 'Original event data as received from the source';
COMMENT ON COLUMN security_events.normalized_data IS 'Standardized event data structure';
COMMENT ON COLUMN security_events.tags IS 'Array of tags for categorization and filtering';