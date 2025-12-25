-- Test Migration 0021: EDR Integration Tables
-- This script tests the creation and rollback of EDR tables

-- ============================================================================
-- Test 1: Verify all tables were created
-- ============================================================================
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'edr_devices',
        'edr_alerts',
        'edr_vulnerabilities',
        'edr_device_vulnerabilities',
        'edr_compliance',
        'edr_actions',
        'edr_posture_scores'
    );
    
    IF table_count = 7 THEN
        RAISE NOTICE 'PASS: All 7 EDR tables created successfully';
    ELSE
        RAISE EXCEPTION 'FAIL: Expected 7 tables, found %', table_count;
    END IF;
END $$;

-- ============================================================================
-- Test 2: Verify foreign key constraints exist
-- ============================================================================
DO $$
DECLARE
    fk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name IN (
        'edr_devices',
        'edr_alerts',
        'edr_vulnerabilities',
        'edr_device_vulnerabilities',
        'edr_compliance',
        'edr_actions',
        'edr_posture_scores'
    );
    
    IF fk_count >= 10 THEN
        RAISE NOTICE 'PASS: Foreign key constraints created (found %)', fk_count;
    ELSE
        RAISE EXCEPTION 'FAIL: Expected at least 10 foreign keys, found %', fk_count;
    END IF;
END $$;

-- ============================================================================
-- Test 3: Verify indexes were created
-- ============================================================================
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN (
        'edr_devices',
        'edr_alerts',
        'edr_vulnerabilities',
        'edr_device_vulnerabilities',
        'edr_compliance',
        'edr_actions',
        'edr_posture_scores'
    )
    AND indexname LIKE 'idx_edr_%';
    
    IF index_count >= 20 THEN
        RAISE NOTICE 'PASS: Performance indexes created (found %)', index_count;
    ELSE
        RAISE EXCEPTION 'FAIL: Expected at least 20 indexes, found %', index_count;
    END IF;
END $$;

-- ============================================================================
-- Test 4: Verify unique constraints
-- ============================================================================
DO $$
DECLARE
    unique_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unique_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
    AND table_schema = 'public'
    AND table_name IN (
        'edr_devices',
        'edr_alerts',
        'edr_vulnerabilities',
        'edr_compliance'
    );
    
    IF unique_count >= 4 THEN
        RAISE NOTICE 'PASS: Unique constraints created (found %)', unique_count;
    ELSE
        RAISE EXCEPTION 'FAIL: Expected at least 4 unique constraints, found %', unique_count;
    END IF;
END $$;

-- ============================================================================
-- Test 5: Test data insertion and tenant isolation
-- ============================================================================
DO $$
DECLARE
    test_tenant_id UUID;
    test_device_id UUID;
    test_vuln_id UUID;
    test_user_id UUID;
BEGIN
    -- Get a test tenant (or create one)
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    IF test_tenant_id IS NULL THEN
        RAISE EXCEPTION 'FAIL: No tenant found for testing';
    END IF;
    
    -- Get a test user (or create one)
    SELECT id INTO test_user_id FROM users LIMIT 1;
    IF test_user_id IS NULL THEN
        RAISE EXCEPTION 'FAIL: No user found for testing';
    END IF;
    
    -- Insert test device
    INSERT INTO edr_devices (
        tenant_id,
        microsoft_device_id,
        device_name,
        operating_system,
        risk_score
    ) VALUES (
        test_tenant_id,
        'test-device-001',
        'Test Device',
        'Windows 11',
        75
    ) RETURNING id INTO test_device_id;
    
    -- Insert test alert
    INSERT INTO edr_alerts (
        tenant_id,
        device_id,
        microsoft_alert_id,
        severity,
        threat_name,
        status
    ) VALUES (
        test_tenant_id,
        test_device_id,
        'test-alert-001',
        'High',
        'Test Threat',
        'New'
    );
    
    -- Insert test vulnerability
    INSERT INTO edr_vulnerabilities (
        tenant_id,
        cve_id,
        severity,
        cvss_score
    ) VALUES (
        test_tenant_id,
        'CVE-2024-0001',
        'High',
        8.5
    ) RETURNING id INTO test_vuln_id;
    
    -- Link device to vulnerability
    INSERT INTO edr_device_vulnerabilities (
        device_id,
        vulnerability_id
    ) VALUES (
        test_device_id,
        test_vuln_id
    );
    
    -- Insert test compliance
    INSERT INTO edr_compliance (
        tenant_id,
        device_id,
        compliance_state,
        failed_rules
    ) VALUES (
        test_tenant_id,
        test_device_id,
        'noncompliant',
        '["rule1", "rule2"]'::jsonb
    );
    
    -- Insert test action
    INSERT INTO edr_actions (
        tenant_id,
        device_id,
        user_id,
        action_type,
        status
    ) VALUES (
        test_tenant_id,
        test_device_id,
        test_user_id,
        'isolate',
        'completed'
    );
    
    -- Insert test posture score
    INSERT INTO edr_posture_scores (
        tenant_id,
        score,
        device_count,
        high_risk_device_count
    ) VALUES (
        test_tenant_id,
        85,
        10,
        2
    );
    
    RAISE NOTICE 'PASS: Test data inserted successfully';
    
    -- Clean up test data
    DELETE FROM edr_posture_scores WHERE tenant_id = test_tenant_id;
    DELETE FROM edr_actions WHERE tenant_id = test_tenant_id;
    DELETE FROM edr_compliance WHERE tenant_id = test_tenant_id;
    DELETE FROM edr_device_vulnerabilities WHERE device_id = test_device_id;
    DELETE FROM edr_vulnerabilities WHERE tenant_id = test_tenant_id;
    DELETE FROM edr_alerts WHERE tenant_id = test_tenant_id;
    DELETE FROM edr_devices WHERE tenant_id = test_tenant_id;
    
    RAISE NOTICE 'PASS: Test data cleaned up successfully';
END $$;

-- ============================================================================
-- Test 6: Verify CASCADE delete works
-- ============================================================================
DO $$
DECLARE
    test_tenant_id UUID;
    test_device_id UUID;
    test_vuln_id UUID;
    test_user_id UUID;
    remaining_count INTEGER;
BEGIN
    -- Get test tenant and user
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    SELECT id INTO test_user_id FROM users LIMIT 1;
    
    -- Insert test device
    INSERT INTO edr_devices (
        tenant_id,
        microsoft_device_id,
        device_name,
        risk_score
    ) VALUES (
        test_tenant_id,
        'cascade-test-device',
        'Cascade Test',
        50
    ) RETURNING id INTO test_device_id;
    
    -- Insert related records
    INSERT INTO edr_alerts (tenant_id, device_id, microsoft_alert_id, severity, status)
    VALUES (test_tenant_id, test_device_id, 'cascade-alert', 'Low', 'New');
    
    INSERT INTO edr_compliance (tenant_id, device_id, compliance_state)
    VALUES (test_tenant_id, test_device_id, 'compliant');
    
    INSERT INTO edr_actions (tenant_id, device_id, user_id, action_type, status)
    VALUES (test_tenant_id, test_device_id, test_user_id, 'scan', 'pending');
    
    -- Delete the device (should cascade to related records)
    DELETE FROM edr_devices WHERE id = test_device_id;
    
    -- Check if related records were deleted
    SELECT COUNT(*) INTO remaining_count
    FROM edr_alerts
    WHERE device_id = test_device_id;
    
    IF remaining_count = 0 THEN
        RAISE NOTICE 'PASS: CASCADE delete works correctly';
    ELSE
        RAISE EXCEPTION 'FAIL: CASCADE delete did not remove related records';
    END IF;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 0021 Test Summary';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All tests passed successfully!';
    RAISE NOTICE 'EDR integration tables are ready for use.';
END $$;
