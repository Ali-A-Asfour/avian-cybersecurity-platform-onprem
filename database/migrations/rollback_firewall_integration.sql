-- Rollback Migration: Firewall Integration
-- This migration rolls back all firewall-related migrations (0012-0019)
-- Execute this to completely remove the firewall integration schema

-- ============================================================================
-- ROLLBACK ORDER (reverse of creation):
-- 1. Migration 0019: Retention policies (functions and pg_cron schedules)
-- 2. Migration 0018: firewall_alerts table
-- 3. Migration 0017: firewall_metrics_rollup table
-- 4. Migration 0016: firewall_config_risks table
-- 5. Migration 0015: firewall_licenses table
-- 6. Migration 0014: firewall_security_posture table
-- 7. Migration 0013: firewall_health_snapshots table
-- 8. Migration 0012: firewall_devices table
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Remove pg_cron schedule (Migration 0019)
-- ============================================================================

DO $
BEGIN
    -- Check if pg_cron extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove the scheduled job if it exists
        PERFORM cron.unschedule('firewall-retention-cleanup');
        RAISE NOTICE 'Removed pg_cron schedule: firewall-retention-cleanup';
    ELSE
        RAISE NOTICE 'pg_cron extension not installed, skipping schedule removal';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not remove pg_cron schedule (may not exist): %', SQLERRM;
END $;

-- ============================================================================
-- STEP 2: Drop retention cleanup functions (Migration 0019)
-- ============================================================================

DROP FUNCTION IF EXISTS cleanup_firewall_retention_all() CASCADE;
DROP FUNCTION IF EXISTS cleanup_firewall_alerts() CASCADE;
DROP FUNCTION IF EXISTS cleanup_firewall_metrics_rollup() CASCADE;
DROP FUNCTION IF EXISTS cleanup_firewall_health_snapshots() CASCADE;

RAISE NOTICE 'Dropped firewall retention cleanup functions';

-- ============================================================================
-- STEP 3: Drop firewall_alerts table (Migration 0018)
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS "idx_alerts_created_at";
DROP INDEX IF EXISTS "idx_alerts_source";
DROP INDEX IF EXISTS "idx_alerts_alert_type";
DROP INDEX IF EXISTS "idx_alerts_acknowledged";
DROP INDEX IF EXISTS "idx_alerts_severity";
DROP INDEX IF EXISTS "idx_alerts_device";
DROP INDEX IF EXISTS "idx_alerts_tenant";

-- Drop constraints
ALTER TABLE IF EXISTS "firewall_alerts" DROP CONSTRAINT IF EXISTS "check_acknowledged_consistency";
ALTER TABLE IF EXISTS "firewall_alerts" DROP CONSTRAINT IF EXISTS "check_source_valid";
ALTER TABLE IF EXISTS "firewall_alerts" DROP CONSTRAINT IF EXISTS "check_severity_valid";
ALTER TABLE IF EXISTS "firewall_alerts" DROP CONSTRAINT IF EXISTS "firewall_alerts_acknowledged_by_users_id_fk";
ALTER TABLE IF EXISTS "firewall_alerts" DROP CONSTRAINT IF EXISTS "firewall_alerts_device_id_firewall_devices_id_fk";
ALTER TABLE IF EXISTS "firewall_alerts" DROP CONSTRAINT IF EXISTS "firewall_alerts_tenant_id_tenants_id_fk";

-- Drop table
DROP TABLE IF EXISTS "firewall_alerts" CASCADE;

RAISE NOTICE 'Dropped firewall_alerts table and related objects';

-- ============================================================================
-- STEP 4: Drop firewall_metrics_rollup table (Migration 0017)
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS "idx_metrics_rollup_created_at";
DROP INDEX IF EXISTS "idx_metrics_rollup_date";
DROP INDEX IF EXISTS "idx_metrics_rollup_device";

-- Drop constraints
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "check_active_sessions_count_non_negative";
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "check_bandwidth_total_mb_non_negative";
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "check_web_filter_hits_non_negative";
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "check_blocked_connections_non_negative";
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "check_ips_blocked_non_negative";
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "check_malware_blocked_non_negative";
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "check_threats_blocked_non_negative";
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "firewall_metrics_rollup_device_date_unique";
ALTER TABLE IF EXISTS "firewall_metrics_rollup" DROP CONSTRAINT IF EXISTS "firewall_metrics_rollup_device_id_firewall_devices_id_fk";

-- Drop table
DROP TABLE IF EXISTS "firewall_metrics_rollup" CASCADE;

RAISE NOTICE 'Dropped firewall_metrics_rollup table and related objects';

-- ============================================================================
-- STEP 5: Drop firewall_config_risks table (Migration 0016)
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS "idx_config_risks_snapshot";
DROP INDEX IF EXISTS "idx_config_risks_detected_at";
DROP INDEX IF EXISTS "idx_config_risks_type";
DROP INDEX IF EXISTS "idx_config_risks_category";
DROP INDEX IF EXISTS "idx_config_risks_severity";
DROP INDEX IF EXISTS "idx_config_risks_device";

-- Drop constraints
ALTER TABLE IF EXISTS "firewall_config_risks" DROP CONSTRAINT IF EXISTS "check_risk_category_valid";
ALTER TABLE IF EXISTS "firewall_config_risks" DROP CONSTRAINT IF EXISTS "check_severity_valid";
ALTER TABLE IF EXISTS "firewall_config_risks" DROP CONSTRAINT IF EXISTS "firewall_config_risks_device_id_firewall_devices_id_fk";

-- Drop table
DROP TABLE IF EXISTS "firewall_config_risks" CASCADE;

RAISE NOTICE 'Dropped firewall_config_risks table and related objects';

-- ============================================================================
-- STEP 6: Drop firewall_licenses table (Migration 0015)
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS "idx_licenses_support_expiry";
DROP INDEX IF EXISTS "idx_licenses_content_filter_expiry";
DROP INDEX IF EXISTS "idx_licenses_app_control_expiry";
DROP INDEX IF EXISTS "idx_licenses_atp_expiry";
DROP INDEX IF EXISTS "idx_licenses_gav_expiry";
DROP INDEX IF EXISTS "idx_licenses_ips_expiry";
DROP INDEX IF EXISTS "idx_licenses_timestamp";
DROP INDEX IF EXISTS "idx_licenses_device";

-- Drop constraints
ALTER TABLE IF EXISTS "firewall_licenses" DROP CONSTRAINT IF EXISTS "firewall_licenses_device_id_firewall_devices_id_fk";

-- Drop table
DROP TABLE IF EXISTS "firewall_licenses" CASCADE;

RAISE NOTICE 'Dropped firewall_licenses table and related objects';

-- ============================================================================
-- STEP 7: Drop firewall_security_posture table (Migration 0014)
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS "idx_security_posture_timestamp";
DROP INDEX IF EXISTS "idx_security_posture_device";

-- Drop constraints
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_content_filter_daily_blocks_positive";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_app_control_daily_blocks_positive";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_botnet_daily_blocks_positive";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_atp_daily_verdicts_positive";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_dpi_ssl_daily_blocks_positive";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_gav_daily_blocks_positive";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_ips_daily_blocks_positive";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_dpi_ssl_certificate_status";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_content_filter_license_status";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_app_control_license_status";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_atp_license_status";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_gav_license_status";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "check_ips_license_status";
ALTER TABLE IF EXISTS "firewall_security_posture" DROP CONSTRAINT IF EXISTS "firewall_security_posture_device_id_firewall_devices_id_fk";

-- Drop table
DROP TABLE IF EXISTS "firewall_security_posture" CASCADE;

RAISE NOTICE 'Dropped firewall_security_posture table and related objects';

-- ============================================================================
-- STEP 8: Drop firewall_health_snapshots table (Migration 0013)
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS "idx_health_snapshots_timestamp";
DROP INDEX IF EXISTS "idx_health_snapshots_device";

-- Drop constraints
ALTER TABLE IF EXISTS "firewall_health_snapshots" DROP CONSTRAINT IF EXISTS "check_uptime_positive";
ALTER TABLE IF EXISTS "firewall_health_snapshots" DROP CONSTRAINT IF EXISTS "check_ram_percent_range";
ALTER TABLE IF EXISTS "firewall_health_snapshots" DROP CONSTRAINT IF EXISTS "check_cpu_percent_range";
ALTER TABLE IF EXISTS "firewall_health_snapshots" DROP CONSTRAINT IF EXISTS "check_ha_status";
ALTER TABLE IF EXISTS "firewall_health_snapshots" DROP CONSTRAINT IF EXISTS "check_wifi_status";
ALTER TABLE IF EXISTS "firewall_health_snapshots" DROP CONSTRAINT IF EXISTS "check_vpn_status";
ALTER TABLE IF EXISTS "firewall_health_snapshots" DROP CONSTRAINT IF EXISTS "check_wan_status";
ALTER TABLE IF EXISTS "firewall_health_snapshots" DROP CONSTRAINT IF EXISTS "firewall_health_snapshots_device_id_firewall_devices_id_fk";

-- Drop table
DROP TABLE IF EXISTS "firewall_health_snapshots" CASCADE;

RAISE NOTICE 'Dropped firewall_health_snapshots table and related objects';

-- ============================================================================
-- STEP 9: Drop firewall_devices table (Migration 0012)
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS "idx_firewall_devices_last_seen";
DROP INDEX IF EXISTS "idx_firewall_devices_serial";
DROP INDEX IF EXISTS "idx_firewall_devices_status";
DROP INDEX IF EXISTS "idx_firewall_devices_tenant";

-- Drop constraints
ALTER TABLE IF EXISTS "firewall_devices" DROP CONSTRAINT IF EXISTS "firewall_devices_tenant_id_tenants_id_fk";

-- Drop table
DROP TABLE IF EXISTS "firewall_devices" CASCADE;

RAISE NOTICE 'Dropped firewall_devices table and related objects';

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

RAISE NOTICE '========================================';
RAISE NOTICE 'Firewall Integration Rollback Complete';
RAISE NOTICE '========================================';
RAISE NOTICE 'All firewall tables, indexes, constraints, and functions have been removed';
RAISE NOTICE 'Migrations 0012-0019 have been rolled back';
RAISE NOTICE '';
RAISE NOTICE 'To verify removal, run:';
RAISE NOTICE 'SELECT table_name FROM information_schema.tables WHERE table_schema = ''public'' AND table_name LIKE ''firewall_%'';';

COMMIT;
