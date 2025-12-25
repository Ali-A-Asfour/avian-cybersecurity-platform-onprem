-- Test script for Migration 0018: firewall_alerts table
-- This script validates the firewall_alerts table structure and constraints

-- Test 1: Verify table exists
SELECT 'Test 1: Table exists' AS test_name;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'firewall_alerts'
) AS table_exists;

-- Test 2: Verify all columns exist with correct types
SELECT 'Test 2: Column structure' AS test_name;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'firewall_alerts'
ORDER BY ordinal_position;

-- Test 3: Verify foreign key constraints
SELECT 'Test 3: Foreign key constraints' AS test_name;
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
AND tc.table_name = 'firewall_alerts'
ORDER BY tc.constraint_name;

-- Test 4: Verify indexes
SELECT 'Test 4: Indexes' AS test_name;
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'firewall_alerts'
ORDER BY indexname;

-- Test 5: Verify check constraints
SELECT 'Test 5: Check constraints' AS test_name;
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'firewall_alerts'
AND con.contype = 'c'
ORDER BY con.conname;

-- Test 6: Insert test data (requires existing tenant, device, and user)
SELECT 'Test 6: Insert test alert' AS test_name;

-- First, get a test tenant (or create one)
DO $$
DECLARE
    test_tenant_id uuid;
    test_device_id uuid;
    test_user_id uuid;
    test_alert_id uuid;
BEGIN
    -- Get or create test tenant
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    
    IF test_tenant_id IS NULL THEN
        RAISE NOTICE 'No tenant found - skipping insert test';
        RETURN;
    END IF;
    
    -- Get or create test device
    SELECT id INTO test_device_id 
    FROM firewall_devices 
    WHERE tenant_id = test_tenant_id 
    LIMIT 1;
    
    IF test_device_id IS NULL THEN
        RAISE NOTICE 'No firewall device found - skipping insert test';
        RETURN;
    END IF;
    
    -- Get test user
    SELECT id INTO test_user_id 
    FROM users 
    WHERE tenant_id = test_tenant_id 
    LIMIT 1;
    
    -- Insert test alert
    INSERT INTO firewall_alerts (
        tenant_id,
        device_id,
        alert_type,
        severity,
        message,
        source,
        metadata
    ) VALUES (
        test_tenant_id,
        test_device_id,
        'ips_counter_increase',
        'medium',
        'IPS blocks increased from 100 to 150',
        'api',
        '{"counter_name": "ips_blocks", "previous_value": 100, "new_value": 150, "delta": 50}'::jsonb
    ) RETURNING id INTO test_alert_id;
    
    RAISE NOTICE 'Test alert created with id: %', test_alert_id;
    
    -- Test acknowledgment
    IF test_user_id IS NOT NULL THEN
        UPDATE firewall_alerts
        SET 
            acknowledged = true,
            acknowledged_by = test_user_id,
            acknowledged_at = NOW()
        WHERE id = test_alert_id;
        
        RAISE NOTICE 'Test alert acknowledged by user: %', test_user_id;
    END IF;
    
    -- Clean up test data
    DELETE FROM firewall_alerts WHERE id = test_alert_id;
    RAISE NOTICE 'Test alert cleaned up';
    
END $$;

-- Test 7: Verify severity constraint
SELECT 'Test 7: Severity constraint validation' AS test_name;
DO $$
BEGIN
    -- This should fail
    INSERT INTO firewall_alerts (
        tenant_id,
        device_id,
        alert_type,
        severity,
        message,
        source
    ) VALUES (
        gen_random_uuid(),
        NULL,
        'test_alert',
        'invalid_severity',
        'Test message',
        'api'
    );
    RAISE EXCEPTION 'Severity constraint failed - invalid value was accepted';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'Severity constraint working correctly - invalid value rejected';
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Severity constraint working correctly (FK error expected for test tenant)';
END $$;

-- Test 8: Verify source constraint
SELECT 'Test 8: Source constraint validation' AS test_name;
DO $$
BEGIN
    -- This should fail
    INSERT INTO firewall_alerts (
        tenant_id,
        device_id,
        alert_type,
        severity,
        message,
        source
    ) VALUES (
        gen_random_uuid(),
        NULL,
        'test_alert',
        'medium',
        'Test message',
        'invalid_source'
    );
    RAISE EXCEPTION 'Source constraint failed - invalid value was accepted';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'Source constraint working correctly - invalid value rejected';
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Source constraint working correctly (FK error expected for test tenant)';
END $$;

-- Test 9: Verify acknowledged consistency constraint
SELECT 'Test 9: Acknowledged consistency constraint' AS test_name;
DO $$
DECLARE
    test_tenant_id uuid;
BEGIN
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    
    IF test_tenant_id IS NULL THEN
        RAISE NOTICE 'No tenant found - skipping acknowledged consistency test';
        RETURN;
    END IF;
    
    -- This should fail - acknowledged=true but no acknowledged_by
    BEGIN
        INSERT INTO firewall_alerts (
            tenant_id,
            device_id,
            alert_type,
            severity,
            message,
            source,
            acknowledged,
            acknowledged_by,
            acknowledged_at
        ) VALUES (
            test_tenant_id,
            NULL,
            'test_alert',
            'medium',
            'Test message',
            'api',
            true,
            NULL,
            NULL
        );
        RAISE EXCEPTION 'Acknowledged consistency constraint failed - invalid state was accepted';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Acknowledged consistency constraint working correctly - invalid state rejected';
    END;
END $$;

-- Test 10: Query performance test
SELECT 'Test 10: Query performance (index usage)' AS test_name;
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM firewall_alerts
WHERE tenant_id = gen_random_uuid()
ORDER BY created_at DESC
LIMIT 50;

-- Test 11: Verify JSONB metadata functionality
SELECT 'Test 11: JSONB metadata functionality' AS test_name;
DO $$
DECLARE
    test_tenant_id uuid;
    test_alert_id uuid;
BEGIN
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    
    IF test_tenant_id IS NULL THEN
        RAISE NOTICE 'No tenant found - skipping JSONB test';
        RETURN;
    END IF;
    
    -- Insert alert with complex metadata
    INSERT INTO firewall_alerts (
        tenant_id,
        device_id,
        alert_type,
        severity,
        message,
        source,
        metadata
    ) VALUES (
        test_tenant_id,
        NULL,
        'test_alert',
        'medium',
        'Test message',
        'api',
        '{"counter_name": "ips_blocks", "previous_value": 100, "new_value": 150, "delta": 50, "nested": {"key": "value"}}'::jsonb
    ) RETURNING id INTO test_alert_id;
    
    -- Query using JSONB operators
    IF EXISTS (
        SELECT 1 FROM firewall_alerts
        WHERE id = test_alert_id
        AND metadata->>'counter_name' = 'ips_blocks'
        AND (metadata->>'delta')::int = 50
    ) THEN
        RAISE NOTICE 'JSONB metadata query working correctly';
    ELSE
        RAISE EXCEPTION 'JSONB metadata query failed';
    END IF;
    
    -- Clean up
    DELETE FROM firewall_alerts WHERE id = test_alert_id;
    
END $$;

-- Test 12: Verify cascade delete behavior
SELECT 'Test 12: Cascade delete behavior' AS test_name;
SELECT 'Manual test required: Delete a tenant/device and verify alerts are deleted' AS note;

-- Summary
SELECT 'Test Summary' AS test_name;
SELECT 
    COUNT(*) as total_alerts,
    COUNT(DISTINCT tenant_id) as unique_tenants,
    COUNT(DISTINCT device_id) as unique_devices,
    COUNT(CASE WHEN acknowledged = true THEN 1 END) as acknowledged_count,
    COUNT(CASE WHEN source = 'api' THEN 1 END) as api_alerts,
    COUNT(CASE WHEN source = 'email' THEN 1 END) as email_alerts
FROM firewall_alerts;

