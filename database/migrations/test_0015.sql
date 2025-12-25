-- Test script for Migration 0015: firewall_licenses table
-- This script validates the table structure, constraints, and indexes

-- Test 1: Verify table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'firewall_licenses'
        ) 
        THEN '✓ PASS: firewall_licenses table exists'
        ELSE '✗ FAIL: firewall_licenses table does not exist'
    END AS test_result;

-- Test 2: Verify all required columns exist
SELECT 
    CASE 
        WHEN COUNT(*) = 10 
        THEN '✓ PASS: All 10 columns exist'
        ELSE '✗ FAIL: Expected 10 columns, found ' || COUNT(*)
    END AS test_result
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_licenses'
AND column_name IN (
    'id', 'device_id', 
    'ips_expiry', 'gav_expiry', 'atp_expiry',
    'app_control_expiry', 'content_filter_expiry', 'support_expiry',
    'license_warnings', 'timestamp'
);

-- Test 3: Verify foreign key constraint exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_type = 'FOREIGN KEY'
            AND table_name = 'firewall_licenses'
            AND constraint_name = 'firewall_licenses_device_id_firewall_devices_id_fk'
        ) 
        THEN '✓ PASS: Foreign key constraint exists'
        ELSE '✗ FAIL: Foreign key constraint missing'
    END AS test_result;

-- Test 4: Verify primary indexes exist
SELECT 
    CASE 
        WHEN COUNT(*) >= 2 
        THEN '✓ PASS: Required primary indexes exist'
        ELSE '✗ FAIL: Missing primary indexes'
    END AS test_result
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'firewall_licenses'
AND indexname IN ('idx_licenses_device', 'idx_licenses_timestamp');

-- Test 5: Verify expiry date indexes exist
SELECT 
    CASE 
        WHEN COUNT(*) >= 6 
        THEN '✓ PASS: Expiry date indexes exist'
        ELSE '✗ FAIL: Missing expiry date indexes (found ' || COUNT(*) || ')'
    END AS test_result
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'firewall_licenses'
AND indexname IN (
    'idx_licenses_ips_expiry',
    'idx_licenses_gav_expiry',
    'idx_licenses_atp_expiry',
    'idx_licenses_app_control_expiry',
    'idx_licenses_content_filter_expiry',
    'idx_licenses_support_expiry'
);

-- Test 6: Verify date column types
SELECT 
    CASE 
        WHEN COUNT(*) = 6 
        THEN '✓ PASS: All expiry columns are DATE type'
        ELSE '✗ FAIL: Some expiry columns have incorrect type'
    END AS test_result
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_licenses'
AND column_name IN (
    'ips_expiry', 'gav_expiry', 'atp_expiry',
    'app_control_expiry', 'content_filter_expiry', 'support_expiry'
)
AND data_type = 'date';

-- Test 7: Verify license_warnings is JSONB with default
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'firewall_licenses'
            AND column_name = 'license_warnings'
            AND data_type = 'jsonb'
            AND column_default = '''[]''::jsonb'
        ) 
        THEN '✓ PASS: license_warnings is JSONB with default []'
        ELSE '✗ FAIL: license_warnings type or default incorrect'
    END AS test_result;

-- Test 8: Verify timestamp has default NOW()
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'firewall_licenses'
            AND column_name = 'timestamp'
            AND column_default LIKE '%now()%'
        ) 
        THEN '✓ PASS: timestamp has DEFAULT NOW()'
        ELSE '✗ FAIL: timestamp default missing or incorrect'
    END AS test_result;

-- Test 9: Verify device_id is NOT NULL
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'firewall_licenses'
            AND column_name = 'device_id'
            AND is_nullable = 'NO'
        ) 
        THEN '✓ PASS: device_id is NOT NULL'
        ELSE '✗ FAIL: device_id allows NULL'
    END AS test_result;

-- Test 10: Insert test data (will be rolled back)
BEGIN;

-- Insert a test license record
INSERT INTO firewall_licenses (
    device_id,
    ips_expiry,
    gav_expiry,
    atp_expiry,
    app_control_expiry,
    content_filter_expiry,
    support_expiry,
    license_warnings
) VALUES (
    (SELECT id FROM firewall_devices LIMIT 1), -- Use existing device
    CURRENT_DATE + INTERVAL '90 days',
    CURRENT_DATE + INTERVAL '25 days',
    CURRENT_DATE + INTERVAL '180 days',
    CURRENT_DATE + INTERVAL '15 days',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '365 days',
    '["GAV expiring in 25 days", "Content Filter expired"]'::jsonb
);

SELECT 
    CASE 
        WHEN COUNT(*) = 1 
        THEN '✓ PASS: Test data inserted successfully'
        ELSE '✗ FAIL: Test data insertion failed'
    END AS test_result
FROM firewall_licenses;

-- Test 11: Verify JSONB operations work
SELECT 
    CASE 
        WHEN jsonb_array_length(license_warnings) = 2
        THEN '✓ PASS: JSONB operations work correctly'
        ELSE '✗ FAIL: JSONB operations failed'
    END AS test_result
FROM firewall_licenses
WHERE device_id = (SELECT id FROM firewall_devices LIMIT 1);

-- Test 12: Verify foreign key cascade delete
DO $$
DECLARE
    test_device_id uuid;
BEGIN
    -- Create a temporary test device
    INSERT INTO firewall_devices (
        tenant_id, model, firmware_version, serial_number, management_ip
    ) VALUES (
        (SELECT id FROM tenants LIMIT 1),
        'TZ400', '7.0.1-5050', 'TEST-LICENSE-CASCADE', '192.168.1.100'
    ) RETURNING id INTO test_device_id;

    -- Insert license record for test device
    INSERT INTO firewall_licenses (device_id, ips_expiry)
    VALUES (test_device_id, CURRENT_DATE + INTERVAL '30 days');

    -- Verify license was created
    IF EXISTS (SELECT 1 FROM firewall_licenses WHERE device_id = test_device_id) THEN
        -- Delete the device (should cascade to licenses)
        DELETE FROM firewall_devices WHERE id = test_device_id;
        
        -- Verify license was deleted
        IF NOT EXISTS (SELECT 1 FROM firewall_licenses WHERE device_id = test_device_id) THEN
            RAISE NOTICE '✓ PASS: Foreign key CASCADE DELETE works';
        ELSE
            RAISE NOTICE '✗ FAIL: License not deleted on device deletion';
        END IF;
    ELSE
        RAISE NOTICE '✗ FAIL: Test license not created';
    END IF;
END $$;

ROLLBACK;

-- Test 13: Verify table comments exist
SELECT 
    CASE 
        WHEN obj_description('firewall_licenses'::regclass) IS NOT NULL
        THEN '✓ PASS: Table comment exists'
        ELSE '✗ FAIL: Table comment missing'
    END AS test_result;

-- Test 14: Verify column comments exist
SELECT 
    CASE 
        WHEN COUNT(*) >= 8 
        THEN '✓ PASS: Column comments exist'
        ELSE '✗ FAIL: Some column comments missing (found ' || COUNT(*) || ')'
    END AS test_result
FROM pg_description
WHERE objoid = 'firewall_licenses'::regclass
AND objsubid > 0;

-- Summary
SELECT '========================================' AS summary;
SELECT 'Migration 0015 Test Summary' AS summary;
SELECT '========================================' AS summary;
SELECT 'All tests completed. Review results above.' AS summary;
