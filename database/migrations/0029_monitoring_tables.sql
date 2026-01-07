-- Migration: Add monitoring and metrics tables
-- Created: 2026-01-06
-- Description: Creates tables for metrics collection and error tracking

-- Metrics table for storing application metrics
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('counter', 'gauge', 'histogram', 'timer')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('http', 'database', 'redis', 'auth', 'email', 'business')),
    value NUMERIC NOT NULL,
    tags JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Error tracking table for storing application errors
CREATE TABLE IF NOT EXISTS error_tracking (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    context JSONB DEFAULT '{}',
    user_id UUID,
    tenant_id UUID,
    request_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for metrics table
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
CREATE INDEX IF NOT EXISTS idx_metrics_category ON metrics(category);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name_category ON metrics(name, category);
CREATE INDEX IF NOT EXISTS idx_metrics_tags ON metrics USING GIN(tags);

-- Indexes for error_tracking table
CREATE INDEX IF NOT EXISTS idx_error_tracking_error_type ON error_tracking(error_type);
CREATE INDEX IF NOT EXISTS idx_error_tracking_user_id ON error_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_error_tracking_tenant_id ON error_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_tracking_created_at ON error_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_tracking_request_id ON error_tracking(request_id);

-- Create view for recent metrics (last 24 hours)
CREATE OR REPLACE VIEW recent_metrics AS
SELECT 
    name,
    type,
    category,
    COUNT(*) as count,
    AVG(value) as avg_value,
    MIN(value) as min_value,
    MAX(value) as max_value,
    MAX(created_at) as last_recorded
FROM metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY name, type, category
ORDER BY last_recorded DESC;

-- Create view for recent errors (last 24 hours)
CREATE OR REPLACE VIEW recent_errors AS
SELECT 
    error_type,
    COUNT(*) as count,
    MAX(created_at) as last_occurred,
    array_agg(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as affected_users,
    array_agg(DISTINCT tenant_id) FILTER (WHERE tenant_id IS NOT NULL) as affected_tenants
FROM error_tracking
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY count DESC;

-- Create view for error details (last 100 errors)
CREATE OR REPLACE VIEW error_details AS
SELECT 
    et.id,
    et.error_type,
    et.error_message,
    et.error_stack,
    et.context,
    et.request_id,
    et.created_at,
    u.email as user_email,
    t.name as tenant_name
FROM error_tracking et
LEFT JOIN users u ON et.user_id = u.id
LEFT JOIN tenants t ON et.tenant_id = t.id
ORDER BY et.created_at DESC
LIMIT 100;

-- Create function to clean old metrics (keep last 30 days)
CREATE OR REPLACE FUNCTION clean_old_metrics()
RETURNS void AS $$
BEGIN
    DELETE FROM metrics
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to clean old errors (keep last 90 days)
CREATE OR REPLACE FUNCTION clean_old_errors()
RETURNS void AS $$
BEGIN
    DELETE FROM error_tracking
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE metrics IS 'Stores application metrics for monitoring and analysis';
COMMENT ON TABLE error_tracking IS 'Stores application errors for debugging and analysis';
COMMENT ON VIEW recent_metrics IS 'Aggregated metrics from the last 24 hours';
COMMENT ON VIEW recent_errors IS 'Error summary from the last 24 hours';
COMMENT ON VIEW error_details IS 'Detailed view of the last 100 errors with user and tenant information';
COMMENT ON FUNCTION clean_old_metrics() IS 'Removes metrics older than 30 days';
COMMENT ON FUNCTION clean_old_errors() IS 'Removes errors older than 90 days';
