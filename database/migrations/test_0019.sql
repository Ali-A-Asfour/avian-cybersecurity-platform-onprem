-- Test script for Migration 0019: Firewall Retention Policies
-- This script tests the retention cleanup functions

-- ============================================================================
-- TEST SETUP
-- ============================================================================

-- Create a test tenant if it doesn't exist
DO $$
DECLARE
    test_tenant_id uuid;
    test_device_id uuid;
BEGIN
    -- Create or get test tenant
    INSERT INTO tenants (id, name, slug, status)
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Test Tenant for Retention',
        'test-retention',
        'active'
    )
    ON CONFLICT (id) DO NOTHING;
    
    test_tenant_id := '00000000-0000-0000-0000-000000000001';
    
    -- Create test firewall device
    INSERT INTO firewall_devices (
        id,
        tenant_id,
        model,
        firmware_version,
        serial_number,
        management_ip,
        status
    )
    VALUES (
        '00000000-0000-0000-0000-000000000002',
        test_tenant_id,
        'TZ-400',
        '7.0.1-5050',
        'TEST-RETENTION-001',
        '192.168.1.1',
        'active'
    )
    ON CONFLICT (id) DO NOTHING;
    
    test_device_id := '00000000-0000-0000-0000-000000000002';
    
    RAISE NOTICE 'Test tenant and device created';
END $$;

-- ============================================================================
-- TEST 1: Health Snapshots Retention (90 days)
-- ============================================================================

RAISE NOTICE '=== TEST 1: Health Snapshots Retention (90 days) ===';

-- Insert test snapshots with various ages
INSERT INTO firewall_health_snapshots (
    device_id,
    cpu_percent,
    ram_percent,
    uptime_seconds,
    wan_status,
    vpn_status,
    interface_status,
    wifi_status,
    ha_status,
    timestamp
)
SELECT
    '00000000-0000-0000-0000-000000000002',
    50.0,
    60.0,
    86400,
    'up',
    'up',
    '{"X0": "up", "X1": "up"}'::jsonb,
    'on',
    'standalone',
    NOW() - (days || ' days')::interval
FROM generate_series(1, 150) AS days;

-- Count snapshots before cleanup
DO $$
DECLARE
    total_count integer;
    old_count integer;
    recent_count integer;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM firewall_health_snapshots
    WHERE device_id = '00000000-0000-0000-0000-000000000002';
    
    SELECT COUNT(*) INTO old_count
    FROM firewall_health_snapshots
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND timestamp < NOW() - INTERVAL '90 days';
    
    SELECT COUNT(*) INTO recent_count
    FROM firewall_health_snapshots
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND timestamp >= NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Before cleanup: Total=%, Old (>90d)=%, Recent (<=90d)=%', 
        total_count, old_count, recent_count;
    
    -- Expected: 150 total, 60 old, 90 recent
    IF old_count != 60 THEN
        RAISE WARNING 'Expected 60 old snapshots, found %', old_count;
    END IF;
    
    IF recent_count != 90 THEN
        RAISE WARNING 'Expected 90 recent snapshots, found %', recent_count;
    END IF;
END $$;

-- Run cleanup
SELECT cleanup_firewall_health_snapshots();

-- Count snapshots after cleanup
DO $$
DECLARE
    total_count integer;
    old_count integer;
    recent_count integer;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM firewall_health_snapshots
    WHERE device_id = '00000000-0000-0000-0000-000000000002';
    
    SELECT COUNT(*) INTO old_count
    FROM firewall_health_snapshots
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND timestamp < NOW() - INTERVAL '90 days';
    
    SELECT COUNT(*) INTO recent_count
    FROM firewall_health_snapshots
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND timestamp >= NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'After cleanup: Total=%, Old (>90d)=%, Recent (<=90d)=%', 
        total_count, old_count, recent_count;
    
    -- Expected: 90 total, 0 old, 90 recent
    IF old_count != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected 0 old snapshots after cleanup, found %', old_count;
    END IF;
    
    IF recent_count != 90 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected 90 recent snapshots after cleanup, found %', recent_count;
    END IF;
    
    RAISE NOTICE '✓ TEST 1 PASSED: Health snapshots retention working correctly';
END $$;

-- ============================================================================
-- TEST 2: Metrics Rollup Retention (365 days)
-- ============================================================================

RAISE NOTICE '=== TEST 2: Metrics Rollup Retention (365 days) ===';

-- Insert test metrics with various ages
INSERT INTO firewall_metrics_rollup (
    device_id,
    date,
    threats_blocked,
    malware_blocked,
    ips_blocked,
    blocked_connections,
    web_filter_hits,
    bandwidth_total_mb,
    active_sessions_count
)
SELECT
    '00000000-0000-0000-0000-000000000002',
    CURRENT_DATE - days,
    100,
    50,
    30,
    200,
    10,
    1000,
    50
FROM generate_series(1, 400) AS days
ON CONFLICT (device_id, date) DO NOTHING;

-- Count metrics before cleanup
DO $$
DECLARE
    total_count integer;
    old_count integer;
    recent_count integer;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM firewall_metrics_rollup
    WHERE device_id = '00000000-0000-0000-0000-000000000002';
    
    SELECT COUNT(*) INTO old_count
    FROM firewall_metrics_rollup
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND date < CURRENT_DATE - INTERVAL '365 days';
    
    SELECT COUNT(*) INTO recent_count
    FROM firewall_metrics_rollup
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND date >= CURRENT_DATE - INTERVAL '365 days';
    
    RAISE NOTICE 'Before cleanup: Total=%, Old (>365d)=%, Recent (<=365d)=%', 
        total_count, old_count, recent_count;
    
    -- Expected: 400 total, 35 old, 365 recent
    IF old_count < 30 OR old_count > 40 THEN
        RAISE WARNING 'Expected ~35 old metrics, found %', old_count;
    END IF;
END $$;

-- Run cleanup
SELECT cleanup_firewall_metrics_rollup();

-- Count metrics after cleanup
DO $$
DECLARE
    total_count integer;
    old_count integer;
    recent_count integer;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM firewall_metrics_rollup
    WHERE device_id = '00000000-0000-0000-0000-000000000002';
    
    SELECT COUNT(*) INTO old_count
    FROM firewall_metrics_rollup
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND date < CURRENT_DATE - INTERVAL '365 days';
    
    SELECT COUNT(*) INTO recent_count
    FROM firewall_metrics_rollup
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND date >= CURRENT_DATE - INTERVAL '365 days';
    
    RAISE NOTICE 'After cleanup: Total=%, Old (>365d)=%, Recent (<=365d)=%', 
        total_count, old_count, recent_count;
    
    -- Expected: 365 total, 0 old, 365 recent
    IF old_count != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected 0 old metrics after cleanup, found %', old_count;
    END IF;
    
    IF recent_count < 360 OR recent_count > 370 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected ~365 recent metrics after cleanup, found %', recent_count;
    END IF;
    
    RAISE NOTICE '✓ TEST 2 PASSED: Metrics rollup retention working correctly';
END $$;

-- ============================================================================
-- TEST 3: Alerts Retention (90 days)
-- ============================================================================

RAISE NOTICE '=== TEST 3: Alerts Retention (90 days) ===';

-- Insert test alerts with various ages
INSERT INTO firewall_alerts (
    tenant_id,
    device_id,
    alert_type,
    severity,
    message,
    source,
    metadata,
    acknowledged,
    created_at
)
SELECT
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'test_alert',
    'info',
    'Test alert for retention policy',
    'api',
    '{}'::jsonb,
    false,
    NOW() - (days || ' days')::interval
FROM generate_series(1, 150) AS days;

-- Count alerts before cleanup
DO $$
DECLARE
    total_count integer;
    old_count integer;
    recent_count integer;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM firewall_alerts
    WHERE device_id = '00000000-0000-0000-0000-000000000002';
    
    SELECT COUNT(*) INTO old_count
    FROM firewall_alerts
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND created_at < NOW() - INTERVAL '90 days';
    
    SELECT COUNT(*) INTO recent_count
    FROM firewall_alerts
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND created_at >= NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Before cleanup: Total=%, Old (>90d)=%, Recent (<=90d)=%', 
        total_count, old_count, recent_count;
    
    -- Expected: 150 total, 60 old, 90 recent
    IF old_count != 60 THEN
        RAISE WARNING 'Expected 60 old alerts, found %', old_count;
    END IF;
    
    IF recent_count != 90 THEN
        RAISE WARNING 'Expected 90 recent alerts, found %', recent_count;
    END IF;
END $$;

-- Run cleanup
SELECT cleanup_firewall_alerts();

-- Count alerts after cleanup
DO $$
DECLARE
    total_count integer;
    old_count integer;
    recent_count integer;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM firewall_alerts
    WHERE device_id = '00000000-0000-0000-0000-000000000002';
    
    SELECT COUNT(*) INTO old_count
    FROM firewall_alerts
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND created_at < NOW() - INTERVAL '90 days';
    
    SELECT COUNT(*) INTO recent_count
    FROM firewall_alerts
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND created_at >= NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'After cleanup: Total=%, Old (>90d)=%, Recent (<=90d)=%', 
        total_count, old_count, recent_count;
    
    -- Expected: 90 total, 0 old, 90 recent
    IF old_count != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected 0 old alerts after cleanup, found %', old_count;
    END IF;
    
    IF recent_count != 90 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected 90 recent alerts after cleanup, found %', recent_count;
    END IF;
    
    RAISE NOTICE '✓ TEST 3 PASSED: Alerts retention working correctly';
END $$;

-- ============================================================================
-- TEST 4: Combined Cleanup Function
-- ============================================================================

RAISE NOTICE '=== TEST 4: Combined Cleanup Function ===';

-- Insert more old data
INSERT INTO firewall_health_snapshots (
    device_id, cpu_percent, ram_percent, uptime_seconds,
    wan_status, vpn_status, interface_status, timestamp
)
SELECT
    '00000000-0000-0000-0000-000000000002',
    50.0, 60.0, 86400, 'up', 'up', '{}'::jsonb,
    NOW() - INTERVAL '100 days'
FROM generate_series(1, 10);

INSERT INTO firewall_metrics_rollup (
    device_id, date, threats_blocked, malware_blocked, ips_blocked
)
SELECT
    '00000000-0000-0000-0000-000000000002',
    CURRENT_DATE - INTERVAL '400 days',
    100, 50, 30
FROM generate_series(1, 10)
ON CONFLICT (device_id, date) DO NOTHING;

INSERT INTO firewall_alerts (
    tenant_id, device_id, alert_type, severity, message, source, created_at
)
SELECT
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'test_alert', 'info', 'Test', 'api',
    NOW() - INTERVAL '100 days'
FROM generate_series(1, 10);

-- Run combined cleanup
SELECT cleanup_firewall_retention_all();

-- Verify all old data is gone
DO $$
DECLARE
    old_snapshots integer;
    old_metrics integer;
    old_alerts integer;
BEGIN
    SELECT COUNT(*) INTO old_snapshots
    FROM firewall_health_snapshots
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND timestamp < NOW() - INTERVAL '90 days';
    
    SELECT COUNT(*) INTO old_metrics
    FROM firewall_metrics_rollup
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND date < CURRENT_DATE - INTERVAL '365 days';
    
    SELECT COUNT(*) INTO old_alerts
    FROM firewall_alerts
    WHERE device_id = '00000000-0000-0000-0000-000000000002'
    AND created_at < NOW() - INTERVAL '90 days';
    
    IF old_snapshots != 0 OR old_metrics != 0 OR old_alerts != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Combined cleanup left old data: snapshots=%, metrics=%, alerts=%',
            old_snapshots, old_metrics, old_alerts;
    END IF;
    
    RAISE NOTICE '✓ TEST 4 PASSED: Combined cleanup function working correctly';
END $$;

-- ============================================================================
-- CLEANUP TEST DATA
-- ============================================================================

RAISE NOTICE '=== Cleaning up test data ===';

-- Delete test data
DELETE FROM firewall_alerts 
WHERE device_id = '00000000-0000-0000-0000-000000000002';

DELETE FROM firewall_metrics_rollup 
WHERE device_id = '00000000-0000-0000-0000-000000000002';

DELETE FROM firewall_health_snapshots 
WHERE device_id = '00000000-0000-0000-0000-000000000002';

DELETE FROM firewall_devices 
WHERE id = '00000000-0000-0000-0000-000000000002';

DELETE FROM tenants 
WHERE id = '00000000-0000-0000-0000-000000000001';

RAISE NOTICE '✓ Test data cleaned up';

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE 'ALL TESTS PASSED ✓';
RAISE NOTICE '========================================';
RAISE NOTICE 'Retention policies are working correctly:';
RAISE NOTICE '  - Health snapshots: 90 days retention';
RAISE NOTICE '  - Metrics rollup: 365 days retention';
RAISE NOTICE '  - Alerts: 90 days retention';
RAISE NOTICE '========================================';
