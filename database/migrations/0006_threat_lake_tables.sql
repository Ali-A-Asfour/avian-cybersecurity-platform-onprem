-- Migration: Add AVIAN Threat Lake tables
-- Description: Creates tables for threat lake data storage, correlation, and analytics

-- Threat lake events table (centralized storage for all security events)
CREATE TABLE IF NOT EXISTS threat_lake_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    asset_id UUID,
    event_category VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    threat_indicators JSONB NOT NULL DEFAULT '[]',
    correlation_id UUID,
    related_events JSONB NOT NULL DEFAULT '[]',
    enrichment_data JSONB NOT NULL DEFAULT '{}',
    raw_event_data JSONB NOT NULL DEFAULT '{}',
    normalized_data JSONB NOT NULL DEFAULT '{}',
    source_system VARCHAR(100) NOT NULL,
    source_event_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT fk_threat_lake_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Correlation rules table
CREATE TABLE IF NOT EXISTS correlation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    rule_logic JSONB NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    time_window_minutes INTEGER NOT NULL DEFAULT 60,
    threshold_count INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_triggered TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    
    CONSTRAINT fk_correlation_rules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_correlation_rules_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Threat intelligence feeds table
CREATE TABLE IF NOT EXISTS threat_intelligence_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    feed_type VARCHAR(50) NOT NULL CHECK (feed_type IN ('ioc', 'yara', 'sigma', 'mitre_attack', 'custom')),
    source_url VARCHAR(500),
    api_key_encrypted TEXT,
    update_frequency_hours INTEGER NOT NULL DEFAULT 24,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20) DEFAULT 'pending' CHECK (last_sync_status IN ('success', 'failed', 'pending', 'syncing')),
    indicators_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_threat_intel_feeds_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Threat indicators table
CREATE TABLE IF NOT EXISTS threat_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    indicator_type VARCHAR(50) NOT NULL CHECK (indicator_type IN ('ip', 'domain', 'url', 'hash_md5', 'hash_sha1', 'hash_sha256', 'email', 'file_path', 'registry_key', 'mutex', 'user_agent')),
    indicator_value VARCHAR(1000) NOT NULL,
    threat_type VARCHAR(100),
    malware_family VARCHAR(100),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    tags JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    CONSTRAINT fk_threat_indicators_feed FOREIGN KEY (feed_id) REFERENCES threat_intelligence_feeds(id) ON DELETE CASCADE,
    CONSTRAINT fk_threat_indicators_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Event correlations table (stores correlation results)
CREATE TABLE IF NOT EXISTS event_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    correlation_rule_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    event_ids JSONB NOT NULL DEFAULT '[]',
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    threat_summary TEXT,
    recommended_actions JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'confirmed', 'false_positive', 'resolved')),
    assigned_to UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_event_correlations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_correlations_rule FOREIGN KEY (correlation_rule_id) REFERENCES correlation_rules(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_correlations_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_name VARCHAR(200) NOT NULL,
    event_category VARCHAR(50),
    severity VARCHAR(20),
    retention_days INTEGER NOT NULL,
    archive_after_days INTEGER,
    delete_after_days INTEGER NOT NULL,
    compression_enabled BOOLEAN NOT NULL DEFAULT true,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_retention_policies_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT check_retention_days_positive CHECK (retention_days > 0),
    CONSTRAINT check_delete_after_retention CHECK (delete_after_days >= retention_days)
);

-- Machine learning models table
CREATE TABLE IF NOT EXISTS ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    model_name VARCHAR(200) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('anomaly_detection', 'threat_classification', 'behavioral_analysis', 'correlation_scoring')),
    model_version VARCHAR(50) NOT NULL,
    model_data BYTEA,
    model_metadata JSONB NOT NULL DEFAULT '{}',
    training_data_period_days INTEGER NOT NULL DEFAULT 30,
    accuracy_score DECIMAL(5,4),
    last_trained TIMESTAMP WITH TIME ZONE,
    last_prediction TIMESTAMP WITH TIME ZONE,
    prediction_count INTEGER DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_ml_models_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for threat_lake_events
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_tenant_id ON threat_lake_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_timestamp ON threat_lake_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_severity ON threat_lake_events(severity);
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_event_type ON threat_lake_events(event_type);
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_correlation_id ON threat_lake_events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_asset_id ON threat_lake_events(asset_id) WHERE asset_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_tenant_timestamp ON threat_lake_events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_tenant_severity ON threat_lake_events(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_tenant_category ON threat_lake_events(tenant_id, event_category);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_threat_indicators_gin ON threat_lake_events USING GIN (threat_indicators);
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_enrichment_data_gin ON threat_lake_events USING GIN (enrichment_data);
CREATE INDEX IF NOT EXISTS idx_threat_lake_events_normalized_data_gin ON threat_lake_events USING GIN (normalized_data);

-- Indexes for correlation_rules
CREATE INDEX IF NOT EXISTS idx_correlation_rules_tenant_id ON correlation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_correlation_rules_enabled ON correlation_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_correlation_rules_severity ON correlation_rules(severity);

-- Indexes for threat_intelligence_feeds
CREATE INDEX IF NOT EXISTS idx_threat_intel_feeds_tenant_id ON threat_intelligence_feeds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_threat_intel_feeds_enabled ON threat_intelligence_feeds(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_threat_intel_feeds_type ON threat_intelligence_feeds(feed_type);

-- Indexes for threat_indicators
CREATE INDEX IF NOT EXISTS idx_threat_indicators_tenant_id ON threat_indicators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_type ON threat_indicators(indicator_type);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_value ON threat_indicators(indicator_value);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_active ON threat_indicators(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_threat_indicators_expiry ON threat_indicators(expiry_date) WHERE expiry_date IS NOT NULL;

-- Composite indexes for threat indicators
CREATE INDEX IF NOT EXISTS idx_threat_indicators_tenant_type ON threat_indicators(tenant_id, indicator_type);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_tenant_active ON threat_indicators(tenant_id, is_active) WHERE is_active = true;

-- Indexes for event_correlations
CREATE INDEX IF NOT EXISTS idx_event_correlations_tenant_id ON event_correlations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_correlations_status ON event_correlations(status);
CREATE INDEX IF NOT EXISTS idx_event_correlations_severity ON event_correlations(severity);
CREATE INDEX IF NOT EXISTS idx_event_correlations_assigned_to ON event_correlations(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_correlations_created_at ON event_correlations(created_at DESC);

-- Indexes for data_retention_policies
CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant_id ON data_retention_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_retention_policies_enabled ON data_retention_policies(enabled) WHERE enabled = true;

-- Indexes for ml_models
CREATE INDEX IF NOT EXISTS idx_ml_models_tenant_id ON ml_models(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ml_models_type ON ml_models(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_models_enabled ON ml_models(enabled) WHERE enabled = true;

-- Update triggers
CREATE OR REPLACE FUNCTION update_threat_lake_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_correlation_rules_updated_at
    BEFORE UPDATE ON correlation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_threat_lake_updated_at();

CREATE TRIGGER trigger_update_threat_intel_feeds_updated_at
    BEFORE UPDATE ON threat_intelligence_feeds
    FOR EACH ROW
    EXECUTE FUNCTION update_threat_lake_updated_at();

CREATE TRIGGER trigger_update_event_correlations_updated_at
    BEFORE UPDATE ON event_correlations
    FOR EACH ROW
    EXECUTE FUNCTION update_threat_lake_updated_at();

CREATE TRIGGER trigger_update_retention_policies_updated_at
    BEFORE UPDATE ON data_retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_threat_lake_updated_at();

CREATE TRIGGER trigger_update_ml_models_updated_at
    BEFORE UPDATE ON ml_models
    FOR EACH ROW
    EXECUTE FUNCTION update_threat_lake_updated_at();

-- Partitioning setup for threat_lake_events (by month for better performance)
-- This can be implemented later if needed for very large datasets

-- Comments for documentation
COMMENT ON TABLE threat_lake_events IS 'Centralized storage for all security events with enrichment and correlation data';
COMMENT ON TABLE correlation_rules IS 'Configurable rules for correlating security events and detecting patterns';
COMMENT ON TABLE threat_intelligence_feeds IS 'Configuration for external threat intelligence data sources';
COMMENT ON TABLE threat_indicators IS 'Threat indicators from intelligence feeds for event enrichment';
COMMENT ON TABLE event_correlations IS 'Results of event correlation analysis and threat detection';
COMMENT ON TABLE data_retention_policies IS 'Policies for data retention, archival, and deletion';
COMMENT ON TABLE ml_models IS 'Machine learning models for threat detection and analysis';

COMMENT ON COLUMN threat_lake_events.confidence_score IS 'Confidence score for the threat assessment (0.0 to 1.0)';
COMMENT ON COLUMN threat_lake_events.threat_indicators IS 'Array of threat indicators found in the event';
COMMENT ON COLUMN threat_lake_events.enrichment_data IS 'Additional data from threat intelligence and context enrichment';
COMMENT ON COLUMN correlation_rules.rule_logic IS 'JSON configuration defining the correlation logic and conditions';
COMMENT ON COLUMN threat_indicators.confidence_score IS 'Confidence score for the threat indicator (0.0 to 1.0)';
COMMENT ON COLUMN event_correlations.recommended_actions IS 'Array of recommended response actions';