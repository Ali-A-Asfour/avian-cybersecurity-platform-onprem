-- Test Migration 0016: Firewall Config Risks Table
-- This file contains test queries to validate the firewall_config_risks table

-- Test 1: Verify table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'firewall_config_risks'
) AS table_exists;

-- Test 2: Verify all columns exist with correct data types
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_config_risks'
ORDER BY ordinal_position;

-- Test 3: Verify foreign key constraint exists
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'firewall_config_risks';

-- Test 4: Verify indexes exist
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'firewall_config_risks'
ORDER BY indexname;

-- Test 5: Verify table comments
SELECT 
    obj_description('public.firewall_config_risks'::regclass) AS table_comment;

-- Test 6: Verify column comments
SELECT 
    cols.column_name,
    pg_catalog.col_description(c.oid, cols.ordinal_position::int) AS column_comment
FROM information_schema.columns cols
JOIN pg_catalog.pg_class c ON c.relname = cols.table_name
WHERE cols.table_schema = 'public'
AND cols.table_name = 'firewall_config_risks'
ORDER BY cols.ordinal_position;

-- Test 7: Insert sample risk records (requires existing device)
-- Note: This test assumes a device exists. In production, create test device first.
DO $$
DECLARE
    test_device_id uuid;
    test_snapshot_id uuid := gen_random_uuid();
BEGIN
    -- Try to get an existing device, or skip if none exists
    SELECT id INTO test_device_id FROM firewall_devices LIMIT 1;
    
    IF test_device_id IS NOT NULL THEN
        -- Insert critical risk
        INSERT INTO firewall_config_risks (
            device_id,
            snapshot_id,
            risk_category,
            risk_type,
            severity,
            description,
            remediation
        ) VALUES (
            test_device_id,
            test_snapshot_id,
            'exposure_risk',
            'WAN_MANAGEMENT_ENABLED',
            'critical',
            'WAN management access enabled - exposes admin interface to internet',
            'Disable WAN management access. Access firewall admin interface only from trusted internal networks or VPN.'
        );

        -- Insert high risk
        INSERT INTO firewall_config_risks (
            device_id,
            snapshot_id,
            risk_category,
            risk_type,
            severity,
            description,
            remediation
        ) VALUES (
            test_device_id,
            test_snapshot_id,
            'network_misconfiguration',
            'ANY_ANY_RULE',
            'high',
            'Overly permissive any-to-any rule detected',
            'Replace any-to-any rules with specific source/destination rules. Follow principle of least privilege.'
        );

        -- Insert medium risk
        INSERT INTO firewall_config_risks (
            device_id,
            snapshot_id,
            risk_category,
            risk_type,
            severity,
            description,
            remediation
        ) VALUES (
            test_device_id,
            test_snapshot_id,
            'security_feature_disabled',
            'DPI_SSL_DISABLED',
            'medium',
            'DPI-SSL is disabled - encrypted traffic not inspected',
            'Enable DPI-SSL to inspect encrypted traffic for threats. Install DPI-SSL certificate on client devices.'
        );

        -- Insert low risk
        INSERT INTO firewall_config_risks (
            device_id,
            snapshot_id,
            risk_category,
            risk_type,
            severity,
            description,
            remediation
        ) VALUES (
            test_device_id,
            test_snapshot_id,
            'best_practice_violation',
            'RULE_NO_DESCRIPTION',
            'low',
            'Firewall rule missing description',
            'Add descriptive comments to all firewall rules to document their purpose and business justification.'
        );

        RAISE NOTICE 'Test data inserted successfully for device_id: %', test_device_id;
    ELSE
        RAISE NOTICE 'No devices found. Skipping test data insertion.';
    END IF;
END $$;

-- Test 8: Query risks by severity
SELECT 
    severity,
    COUNT(*) as risk_count
FROM firewall_config_risks
GROUP BY severity
ORDER BY 
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;

-- Test 9: Query risks by category
SELECT 
    risk_category,
    COUNT(*) as risk_count
FROM firewall_config_risks
GROUP BY risk_category
ORDER BY risk_count DESC;

-- Test 10: Query risks with device information
SELECT 
    d.model,
    d.serial_number,
    r.risk_type,
    r.severity,
    r.description,
    r.detected_at
FROM firewall_config_risks r
JOIN firewall_devices d ON r.device_id = d.id
ORDER BY 
    CASE r.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    r.detected_at DESC
LIMIT 10;

-- Test 11: Calculate risk score for devices
SELECT 
    d.model,
    d.serial_number,
    COUNT(r.id) as total_risks,
    GREATEST(0, LEAST(100, 100 - COALESCE(SUM(
        CASE r.severity
            WHEN 'critical' THEN 25
            WHEN 'high' THEN 15
            WHEN 'medium' THEN 5
            WHEN 'low' THEN 1
            ELSE 0
        END
    ), 0))) as risk_score
FROM firewall_devices d
LEFT JOIN firewall_config_risks r ON d.id = r.device_id
GROUP BY d.id, d.model, d.serial_number
ORDER BY risk_score ASC;

-- Test 12: Query risks by snapshot
SELECT 
    snapshot_id,
    COUNT(*) as risk_count,
    array_agg(DISTINCT severity) as severities
FROM firewall_config_risks
WHERE snapshot_id IS NOT NULL
GROUP BY snapshot_id;

-- Test 13: Test cascade delete (verify foreign key behavior)
-- Note: This is a read-only test to verify the constraint exists
SELECT 
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'firewall_config_risks'
AND tc.constraint_type = 'FOREIGN KEY'
AND rc.delete_rule = 'CASCADE';

-- Test 14: Verify default values
SELECT 
    column_name,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_config_risks'
AND column_default IS NOT NULL;

-- Test 15: Test risk filtering by multiple criteria
SELECT 
    risk_type,
    severity,
    risk_category,
    description
FROM firewall_config_risks
WHERE severity IN ('critical', 'high')
AND risk_category = 'exposure_risk'
ORDER BY detected_at DESC;

-- Test 16: Verify varchar length constraints
SELECT 
    column_name,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_config_risks'
AND data_type = 'character varying';

-- Test 17: Test JSONB operations (if snapshot_id stored as JSONB in future)
-- Currently snapshot_id is UUID, but this tests the table structure
SELECT 
    COUNT(*) as total_risks,
    COUNT(snapshot_id) as risks_with_snapshot,
    COUNT(*) - COUNT(snapshot_id) as risks_without_snapshot
FROM firewall_config_risks;

-- Test 18: Verify index usage for common queries
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM firewall_config_risks 
WHERE device_id = (SELECT id FROM firewall_devices LIMIT 1)
AND severity = 'critical';

-- Test 19: Test timestamp functionality
SELECT 
    MIN(detected_at) as earliest_detection,
    MAX(detected_at) as latest_detection,
    COUNT(*) as total_risks
FROM firewall_config_risks;

-- Test 20: Cleanup test data
-- Note: Uncomment to clean up test data after validation
-- DELETE FROM firewall_config_risks WHERE description LIKE '%test%' OR description LIKE '%Test%';

-- Summary: Display test results
SELECT 
    'firewall_config_risks table tests completed' AS status,
    (SELECT COUNT(*) FROM firewall_config_risks) AS total_risks_in_table,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'firewall_config_risks') AS total_indexes;

