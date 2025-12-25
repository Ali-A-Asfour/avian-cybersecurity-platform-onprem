-- Test script for Migration 0014: firewall_security_posture table
-- This script validates the table structure, constraints, and indexes

-- Test 1: Verify table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'firewall_security_posture'
        ) 
        THEN '✓ PASS: firewall_security_posture table exists'
        ELSE '✗ FAIL: firewall_security_posture table does not exist'
    END AS test_result;

-- Test 2: Verify all required columns exist
SELECT 
    CASE 
        WHEN COUNT(*) = 22 
        THEN '✓ PASS: All 22 columns exist'
        ELSE '✗ FAIL: Expected 22 columns, found ' || COUNT(*)
    END AS test_result
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_security_posture'
AND column_name IN (
    'id', 'device_id', 
    'ips_enabled', 'ips_license_status', 'ips_daily_blocks',
    'gav_enabled', 'gav_license_status', 'gav_daily_blocks',
    'dpi_ssl_enabled', 'dpi_ssl_certificate_status', 'dpi_ssl_daily_blocks',
    'atp_enabled', 'atp_license_status', 'atp_daily_verdicts',
    'botnet_filter_enabled', 'botnet_daily_blocks',
    'app_control_enabled', 'app_control_license_status', 'app_control_daily_blocks',
    'content_filter_enabled', 'content_filter_license_status', 'content_filter_daily_blocks',
    'timestamp'
);

-- Test 3: Verify foreign key constraint exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_type = 'FOREIGN KEY'
            AND table_name = 'firewall_security_posture'
            AND constraint_name = 'firewall_security_posture_device_id_firewall_devices_id_fk'
        ) 
        THEN '✓ PASS: Foreign key constraint exists'
        ELSE '✗ FAIL: Foreign key constraint missing'
    END AS test_result;

-- Test 4: Verify indexes exist
SELECT 
    CASE 
        WHEN COUNT(*) >= 2 
        THEN '✓ PASS: Required indexes exist'
        ELSE '✗ FAIL: Missing indexes'
    END AS test_result
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'firewall_security_posture'
AND indexname IN ('idx_security_posture_device', 'idx_security_posture_timestamp');

-- Test 5: Verify check constraints for license status
SELECT 
    CASE 
        WHEN COUNT(*) >= 5 
        THEN '✓ PASS: License status check constraints exist'
        ELSE '✗ FAIL: Missing license status check constraints'
    END AS test_result
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
AND constraint_name IN (
    'check_ips_license_status',
    'check_gav_license_status',
    'check_atp_license_status',
    'check_app_control_license_status',
    'check_content_filter_license_status'
);

-- Test 6: Verify check constraints for certificate status
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.check_constraints
            WHERE constraint_schema = 'public'
            AND constraint_name = 'check_dpi_ssl_certificate_status'
        ) 
        THEN '✓ PASS: Certificate status check constraint exists'
        ELSE '✗ FAIL: Certificate status check constraint missing'
    END AS test_result;

-- Test 7: Verify check constraints for positive counters
SELECT 
    CASE 
        WHEN COUNT(*) >= 7 
        THEN '✓ PASS: Counter positive check constraints exist'
        ELSE '✗ FAIL: Missing counter positive check constraints'
    END AS test_result
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
AND constraint_name IN (
    'check_ips_daily_blocks_positive',
    'check_gav_daily_blocks_positive',
    'check_dpi_ssl_daily_blocks_positive',
    'check_atp_daily_verdicts_positive',
    'check_botnet_daily_blocks_positive',
    'check_app_control_daily_blocks_positive',
    'check_content_filter_daily_blocks_positive'
);

-- Test 8: Verify boolean columns are NOT NULL
SELECT 
    CASE 
        WHEN COUNT(*) = 7 
        THEN '✓ PASS: All enabled status columns are NOT NULL'
        ELSE '✗ FAIL: Some enabled status columns allow NULL'
    END AS test_result
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_security_posture'
AND column_name IN (
    'ips_enabled', 'gav_enabled', 'dpi_ssl_enabled', 'atp_enabled',
    'botnet_filter_enabled', 'app_control_enabled', 'content_filter_enabled'
)
AND is_nullable = 'NO';

-- Test 9: Verify default values for counter columns
SELECT 
    CASE 
        WHEN COUNT(*) = 7 
        THEN '✓ PASS: All counter columns have DEFAULT 0'
        ELSE '✗ FAIL: Some counter columns missing DEFAULT 0'
    END AS test_result
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_security_posture'
AND column_name IN (
    'ips_daily_blocks', 'gav_daily_blocks', 'dpi_ssl_daily_blocks',
    'atp_daily_verdicts', 'botnet_daily_blocks', 'app_control_daily_blocks',
    'content_filter_daily_blocks'
)
AND column_default = '0';

-- Test 10: Insert test data (will be rolled back)
BEGIN;

-- Insert a test posture record
INSERT INTO firewall_security_posture (
    device_id,
    ips_enabled, ips_license_status, ips_daily_blocks,
    gav_enabled, gav_license_status, gav_daily_blocks,
    dpi_ssl_enabled, dpi_ssl_certificate_status, dpi_ssl_daily_blocks,
    atp_enabled, atp_license_status, atp_daily_verdicts,
    botnet_filter_enabled, botnet_daily_blocks,
    app_control_enabled, app_control_license_status, app_control_daily_blocks,
    content_filter_enabled, content_filter_license_status, content_filter_daily_blocks
) VALUES (
    (SELECT id FROM firewall_devices LIMIT 1), -- Use existing device
    true, 'active', 150,
    true, 'active', 45,
    true, 'valid', 12,
    true, 'expiring', 8,
    true, 25,
    true, 'active', 33,
    false, 'expired', 0
);

SELECT 
    CASE 
        WHEN COUNT(*) = 1 
        THEN '✓ PASS: Test data inserted successfully'
        ELSE '✗ FAIL: Test data insertion failed'
    END AS test_result
FROM firewall_security_posture;

-- Test 11: Verify constraint validation (should fail)
DO $
BEGIN
    -- Try to insert invalid license status
    BEGIN
        INSERT INTO firewall_security_posture (
            device_id, ips_enabled, ips_license_status,
            gav_enabled, dpi_ssl_enabled, atp_enabled,
            botnet_filter_enabled, app_control_enabled, content_filter_enabled
        ) VALUES (
            (SELECT id FROM firewall_devices LIMIT 1),
            true, 'invalid_status',
            true, true, true, true, true, true
        );
        RAISE EXCEPTION 'Should have failed constraint check';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE '✓ PASS: License status constraint validation works';
    END;

    -- Try to insert negative counter
    BEGIN
        INSERT INTO firewall_security_posture (
            device_id, ips_enabled, ips_daily_blocks,
            gav_enabled, dpi_ssl_enabled, atp_enabled,
            botnet_filter_enabled, app_control_enabled, content_filter_enabled
        ) VALUES (
            (SELECT id FROM firewall_devices LIMIT 1),
            true, -10,
            true, true, true, true, true, true
        );
        RAISE EXCEPTION 'Should have failed constraint check';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE '✓ PASS: Counter positive constraint validation works';
    END;
END $;

ROLLBACK;

-- Test 12: Verify table comments exist
SELECT 
    CASE 
        WHEN obj_description('firewall_security_posture'::regclass) IS NOT NULL
        THEN '✓ PASS: Table comment exists'
        ELSE '✗ FAIL: Table comment missing'
    END AS test_result;

-- Summary
SELECT '========================================' AS summary;
SELECT 'Migration 0014 Test Summary' AS summary;
SELECT '========================================' AS summary;
SELECT 'All tests completed. Review results above.' AS summary;
