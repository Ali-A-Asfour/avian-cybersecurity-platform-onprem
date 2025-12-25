-- Test script for Migration 0017: firewall_metrics_rollup table
-- This script tests the firewall_metrics_rollup table creation and constraints

-- Start transaction for testing
BEGIN;

-- Test 1: Verify table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'firewall_metrics_rollup'
    ) THEN
        RAISE EXCEPTION 'Test 1 FAILED: firewall_metrics_rollup table does not exist';
    END IF;
    RAISE NOTICE 'Test 1 PASSED: firewall_metrics_rollup table exists';
END $$;

-- Test 2: Verify all required columns exist
DO $$
DECLARE
    missing_columns text[];
BEGIN
    SELECT ARRAY_AGG(column_name)
    INTO missing_columns
    FROM (
        SELECT unnest(ARRAY[
            'id', 'device_id', 'date', 'threats_blocked', 'malware_blocked',
            'ips_blocked', 'blocked_connections', 'web_filter_hits',
            'bandwidth_total_mb', 'active_sessions_count', 'created_at'
        ]) AS column_name
    ) expected
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'firewall_metrics_rollup'
        AND information_schema.columns.column_name = expected.column_name
    );

    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Test 2 FAILED: Missing columns: %', array_to_string(missing_columns, ', ');
    END IF;
    RAISE NOTICE 'Test 2 PASSED: All required columns exist';
END $$;

-- Test 3: Verify primary key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'firewall_metrics_rollup'
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name LIKE '%pkey%'
    ) THEN
        RAISE EXCEPTION 'Test 3 FAILED: Primary key constraint not found';
    END IF;
    RAISE NOTICE 'Test 3 PASSED: Primary key constraint exists';
END $$;

-- Test 4: Verify foreign key constraint to firewall_devices
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'firewall_metrics_rollup'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'firewall_metrics_rollup_device_id_firewall_devices_id_fk'
    ) THEN
        RAISE EXCEPTION 'Test 4 FAILED: Foreign key constraint to firewall_devices not found';
    END IF;
    RAISE NOTICE 'Test 4 PASSED: Foreign key constraint to firewall_devices exists';
END $$;

-- Test 5: Verify unique constraint on (device_id, date)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'firewall_metrics_rollup'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'firewall_metrics_rollup_device_date_unique'
    ) THEN
        RAISE EXCEPTION 'Test 5 FAILED: Unique constraint on (device_id, date) not found';
    END IF;
    RAISE NOTICE 'Test 5 PASSED: Unique constraint on (device_id, date) exists';
END $$;

-- Test 6: Verify required indexes exist
DO $$
DECLARE
    missing_indexes text[];
BEGIN
    SELECT ARRAY_AGG(index_name)
    INTO missing_indexes
    FROM (
        SELECT unnest(ARRAY[
            'idx_metrics_rollup_device',
            'idx_metrics_rollup_date',
            'idx_metrics_rollup_created_at'
        ]) AS index_name
    ) expected
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'firewall_metrics_rollup'
        AND indexname = expected.index_name
    );

    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE EXCEPTION 'Test 6 FAILED: Missing indexes: %', array_to_string(missing_indexes, ', ');
    END IF;
    RAISE NOTICE 'Test 6 PASSED: All required indexes exist';
END $$;

-- Test 7: Verify check constraints for non-negative values
DO $$
DECLARE
    missing_constraints text[];
BEGIN
    SELECT ARRAY_AGG(constraint_name)
    INTO missing_constraints
    FROM (
        SELECT unnest(ARRAY[
            'check_threats_blocked_non_negative',
            'check_malware_blocked_non_negative',
            'check_ips_blocked_non_negative',
            'check_blocked_connections_non_negative',
            'check_web_filter_hits_non_negative',
            'check_bandwidth_total_mb_non_negative',
            'check_active_sessions_count_non_negative'
        ]) AS constraint_name
    ) expected
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'firewall_metrics_rollup'
        AND constraint_type = 'CHECK'
        AND information_schema.table_constraints.constraint_name = expected.constraint_name
    );

    IF array_length(missing_constraints, 1) > 0 THEN
        RAISE EXCEPTION 'Test 7 FAILED: Missing check constraints: %', array_to_string(missing_constraints, ', ');
    END IF;
    RAISE NOTICE 'Test 7 PASSED: All check constraints exist';
END $$;

-- Test 8: Insert test data and verify constraints work
DO $$
DECLARE
    test_tenant_id uuid;
    test_device_id uuid;
    test_rollup_id uuid;
BEGIN
    -- Create test tenant
    INSERT INTO tenants (name, slug, status)
    VALUES ('Test Tenant Metrics', 'test-tenant-metrics', 'active')
    RETURNING id INTO test_tenant_id;

    -- Create test device
    INSERT INTO firewall_devices (tenant_id, model, firmware_version, serial_number, management_ip, status)
    VALUES (test_tenant_id, 'TZ-400', '7.0.1-5050', 'TEST-METRICS-001', '192.168.1.1', 'active')
    RETURNING id INTO test_device_id;

    -- Insert valid metrics rollup
    INSERT INTO firewall_metrics_rollup (
        device_id, date, threats_blocked, malware_blocked, ips_blocked,
        blocked_connections, web_filter_hits, bandwidth_total_mb, active_sessions_count
    )
    VALUES (
        test_device_id, '2024-01-15', 150, 50, 75, 200, 25, 1024, 100
    )
    RETURNING id INTO test_rollup_id;

    IF test_rollup_id IS NULL THEN
        RAISE EXCEPTION 'Test 8 FAILED: Could not insert valid metrics rollup';
    END IF;

    -- Test unique constraint (should fail)
    BEGIN
        INSERT INTO firewall_metrics_rollup (device_id, date, threats_blocked)
        VALUES (test_device_id, '2024-01-15', 100);
        RAISE EXCEPTION 'Test 8 FAILED: Unique constraint not enforced';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'Test 8a PASSED: Unique constraint on (device_id, date) enforced';
    END;

    -- Test check constraint for negative values (should fail)
    BEGIN
        INSERT INTO firewall_metrics_rollup (device_id, date, threats_blocked)
        VALUES (test_device_id, '2024-01-16', -10);
        RAISE EXCEPTION 'Test 8 FAILED: Check constraint for non-negative threats_blocked not enforced';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Test 8b PASSED: Check constraint for non-negative values enforced';
    END;

    -- Test cascade delete
    DELETE FROM firewall_devices WHERE id = test_device_id;
    
    IF EXISTS (SELECT 1 FROM firewall_metrics_rollup WHERE device_id = test_device_id) THEN
        RAISE EXCEPTION 'Test 8 FAILED: Cascade delete not working';
    END IF;

    -- Cleanup
    DELETE FROM tenants WHERE id = test_tenant_id;

    RAISE NOTICE 'Test 8 PASSED: Insert, constraints, and cascade delete work correctly';
END $$;

-- Test 9: Verify column data types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'firewall_metrics_rollup'
        AND column_name = 'id'
        AND data_type = 'uuid'
    ) THEN
        RAISE EXCEPTION 'Test 9 FAILED: id column is not uuid type';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'firewall_metrics_rollup'
        AND column_name = 'date'
        AND data_type = 'date'
    ) THEN
        RAISE EXCEPTION 'Test 9 FAILED: date column is not date type';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'firewall_metrics_rollup'
        AND column_name = 'bandwidth_total_mb'
        AND data_type = 'bigint'
    ) THEN
        RAISE EXCEPTION 'Test 9 FAILED: bandwidth_total_mb column is not bigint type';
    END IF;

    RAISE NOTICE 'Test 9 PASSED: Column data types are correct';
END $$;

-- Test 10: Verify default values
DO $$
DECLARE
    test_tenant_id uuid;
    test_device_id uuid;
    test_rollup record;
BEGIN
    -- Create test tenant
    INSERT INTO tenants (name, slug, status)
    VALUES ('Test Tenant Defaults', 'test-tenant-defaults', 'active')
    RETURNING id INTO test_tenant_id;

    -- Create test device
    INSERT INTO firewall_devices (tenant_id, model, firmware_version, serial_number, management_ip, status)
    VALUES (test_tenant_id, 'TZ-500', '7.0.1-5050', 'TEST-DEFAULTS-001', '192.168.1.2', 'active')
    RETURNING id INTO test_device_id;

    -- Insert minimal rollup to test defaults
    INSERT INTO firewall_metrics_rollup (device_id, date)
    VALUES (test_device_id, '2024-01-20')
    RETURNING * INTO test_rollup;

    IF test_rollup.threats_blocked != 0 OR
       test_rollup.malware_blocked != 0 OR
       test_rollup.ips_blocked != 0 OR
       test_rollup.blocked_connections != 0 OR
       test_rollup.web_filter_hits != 0 OR
       test_rollup.bandwidth_total_mb != 0 OR
       test_rollup.active_sessions_count != 0 THEN
        RAISE EXCEPTION 'Test 10 FAILED: Default values not set correctly';
    END IF;

    IF test_rollup.created_at IS NULL THEN
        RAISE EXCEPTION 'Test 10 FAILED: created_at default not set';
    END IF;

    -- Cleanup
    DELETE FROM tenants WHERE id = test_tenant_id;

    RAISE NOTICE 'Test 10 PASSED: Default values work correctly';
END $$;

-- Rollback transaction (cleanup)
ROLLBACK;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'All tests completed successfully!';
    RAISE NOTICE 'Migration 0017 (firewall_metrics_rollup) is working correctly';
    RAISE NOTICE '===========================================';
END $$;
