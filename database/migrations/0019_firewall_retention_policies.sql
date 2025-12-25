-- Migration 0019: Add retention policies for firewall tables
-- This migration creates automated cleanup functions and scheduled jobs
-- to enforce data retention policies for firewall monitoring data

-- ============================================================================
-- RETENTION POLICY FUNCTIONS
-- ============================================================================

-- Function to clean up old firewall health snapshots (90 days retention)
CREATE OR REPLACE FUNCTION cleanup_firewall_health_snapshots()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM firewall_health_snapshots
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % old firewall health snapshot records (older than 90 days)', deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_firewall_health_snapshots() IS 'Deletes firewall health snapshots older than 90 days. Should be run daily.';

-- Function to clean up old firewall metrics rollup records (365 days retention)
CREATE OR REPLACE FUNCTION cleanup_firewall_metrics_rollup()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM firewall_metrics_rollup
    WHERE date < CURRENT_DATE - INTERVAL '365 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % old firewall metrics rollup records (older than 365 days)', deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_firewall_metrics_rollup() IS 'Deletes firewall metrics rollup records older than 365 days. Should be run daily.';

-- Function to clean up old firewall alerts (90 days retention)
CREATE OR REPLACE FUNCTION cleanup_firewall_alerts()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM firewall_alerts
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % old firewall alert records (older than 90 days)', deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_firewall_alerts() IS 'Deletes firewall alerts older than 90 days. Should be run daily.';

-- Combined function to run all firewall retention cleanup tasks
CREATE OR REPLACE FUNCTION cleanup_firewall_retention_all()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'Starting firewall data retention cleanup...';
    
    PERFORM cleanup_firewall_health_snapshots();
    PERFORM cleanup_firewall_metrics_rollup();
    PERFORM cleanup_firewall_alerts();
    
    RAISE NOTICE 'Firewall data retention cleanup completed';
END;
$$;

COMMENT ON FUNCTION cleanup_firewall_retention_all() IS 'Runs all firewall retention cleanup functions. Should be scheduled to run daily via cron or pg_cron.';

-- ============================================================================
-- OPTIONAL: pg_cron SCHEDULING (if pg_cron extension is available)
-- ============================================================================

-- Check if pg_cron extension exists and create schedule
DO $$
BEGIN
    -- Check if pg_cron extension is available
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        -- Create extension if not already created
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        
        -- Schedule daily cleanup at 2:00 AM UTC
        -- Note: This will fail silently if pg_cron is not available
        PERFORM cron.schedule(
            'firewall-retention-cleanup',
            '0 2 * * *',  -- Every day at 2:00 AM UTC
            'SELECT cleanup_firewall_retention_all();'
        );
        
        RAISE NOTICE 'pg_cron schedule created: firewall retention cleanup will run daily at 2:00 AM UTC';
    ELSE
        RAISE NOTICE 'pg_cron extension not available. Please schedule cleanup_firewall_retention_all() manually via application cron or external scheduler.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create pg_cron schedule. Please schedule cleanup_firewall_retention_all() manually. Error: %', SQLERRM;
END $$;

-- ============================================================================
-- MANUAL EXECUTION INSTRUCTIONS
-- ============================================================================

-- To manually run retention cleanup:
-- SELECT cleanup_firewall_retention_all();

-- To run individual cleanup functions:
-- SELECT cleanup_firewall_health_snapshots();
-- SELECT cleanup_firewall_metrics_rollup();
-- SELECT cleanup_firewall_alerts();

-- To check pg_cron schedules (if pg_cron is installed):
-- SELECT * FROM cron.job WHERE jobname = 'firewall-retention-cleanup';

-- To remove the pg_cron schedule (if needed):
-- SELECT cron.unschedule('firewall-retention-cleanup');
