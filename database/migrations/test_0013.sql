-- Test script for Migration 0013: Firewall Health Snapshots Table
-- This script validates the firewall_health_snapshots table structure and constraints

-- Test 1: Verify table exists
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'firewall_health_snapshots';

-- Expected: 1 row with table_name = 'firewall_health_snapshots'

-- Test 2: Verify all columns exist with correct types
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'firewall_health_snapshots'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NOT NULL, gen_random_uuid())
-- device_id (uuid, NOT NULL)
-- cpu_percent (double precision, NOT NULL)
-- ram_percent (double precision, NOT NULL)
-- uptime_seconds (bigint, NOT NULL)
-- wan_status (character varying, NOT NULL)
-- vpn_status (character varying, NOT NULL)
-- interface_status (jsonb, NOT NULL)
-- wifi_status (character varying, NULL)
-- ha_status (character varying, NULL)
-- timestamp (timestamp with time zone, NOW())

-- Test 3: Verify indexes exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'firewall_health_snapshots'
ORDER BY indexname;

-- Expected indexes:
-- firewall_health_snapshots_pkey (PRIMARY KEY on id)
-- idx_health_snapshots_device (device_id, timestamp DESC)
-- idx_health_snapshots_timestamp (timestamp DESC)

-- Test 4: Verify foreign key constraint
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
  AND tc.table_name = 'firewall_health_snapshots';

-- Expected: 1 row with device_id -> firewall_devices(id), delete_rule = CASCADE

-- Test 5: Verify check constraints
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'firewall_health_snapshots'
  AND con.contype = 'c'
ORDER BY con.conname;

-- Expected check constraints:
-- check_wan_status: wan_status IN ('up', 'down')
-- check_vpn_status: vpn_status IN ('up', 'down')
-- check_wifi_status: wifi_status IS NULL OR wifi_status IN ('on', 'off')
-- check_ha_status: ha_status IS NULL OR ha_status IN ('active', 'standby', 'failover', 'standalone')
-- check_cpu_percent_range: cpu_percent >= 0 AND cpu_percent <= 100
-- check_ram_percent_range: ram_percent >= 0 AND ram_percent <= 100
-- check_uptime_positive: uptime_seconds >= 0

-- Test 6: Insert valid test data (requires existing firewall_devices record)
-- Note: This test assumes a test device exists. Adjust device_id as needed.
DO $$
DECLARE
    test_device_id uuid;
BEGIN
    -- Get or create a test device
    SELECT id INTO test_device_id
    FROM firewall_devices
    LIMIT 1;
    
    IF test_device_id IS NOT NULL THEN
        -- Insert a valid health snapshot
        INSERT INTO firewall_health_snapshots (
            device_id,
            cpu_percent,
            ram_percent,
            uptime_seconds,
            wan_status,
            vpn_status,
            interface_status,
            wifi_status,
            ha_status
        ) VALUES (
            test_device_id,
            45.2,
            67.8,
            864000,
            'up',
            'up',
            '{"X0": "up", "X1": "up", "X2": "down"}'::jsonb,
            'on',
            'active'
        );
        
        RAISE NOTICE 'Test snapshot inserted successfully';
    ELSE
        RAISE NOTICE 'No test device found - skipping insert test';
    END IF;
END $$;

-- Test 7: Verify constraint violations are caught

-- Test 7a: Invalid WAN status (should fail)
DO $$
DECLARE
    test_device_id uuid;
BEGIN
    SELECT id INTO test_device_id FROM firewall_devices LIMIT 1;
    
    IF test_device_id IS NOT NULL THEN
        BEGIN
            INSERT INTO firewall_health_snapshots (
                device_id, cpu_percent, ram_percent, uptime_seconds,
                wan_status, vpn_status, interface_status
            ) VALUES (
                test_device_id, 50, 60, 1000,
                'invalid', 'up', '{}'::jsonb
            );
            RAISE EXCEPTION 'Should have failed with invalid wan_status';
        EXCEPTION
            WHEN check_violation THEN
                RAISE NOTICE 'Test 7a PASSED: Invalid wan_status rejected';
        END;
    END IF;
END $$;

-- Test 7b: CPU percent out of range (should fail)
DO $$
DECLARE
    test_device_id uuid;
BEGIN
    SELECT id INTO test_device_id FROM firewall_devices LIMIT 1;
    
    IF test_device_id IS NOT NULL THEN
        BEGIN
            INSERT INTO firewall_health_snapshots (
                device_id, cpu_percent, ram_percent, uptime_seconds,
                wan_status, vpn_status, interface_status
            ) VALUES (
                test_device_id, 150, 60, 1000,
                'up', 'up', '{}'::jsonb
            );
            RAISE EXCEPTION 'Should have failed with cpu_percent > 100';
        EXCEPTION
            WHEN check_violation THEN
                RAISE NOTICE 'Test 7b PASSED: Invalid cpu_percent rejected';
        END;
    END IF;
END $$;

-- Test 7c: Negative uptime (should fail)
DO $$
DECLARE
    test_device_id uuid;
BEGIN
    SELECT id INTO test_device_id FROM firewall_devices LIMIT 1;
    
    IF test_device_id IS NOT NULL THEN
        BEGIN
            INSERT INTO firewall_health_snapshots (
                device_id, cpu_percent, ram_percent, uptime_seconds,
                wan_status, vpn_status, interface_status
            ) VALUES (
                test_device_id, 50, 60, -1000,
                'up', 'up', '{}'::jsonb
            );
            RAISE EXCEPTION 'Should have failed with negative uptime';
        EXCEPTION
            WHEN check_violation THEN
                RAISE NOTICE 'Test 7c PASSED: Negative uptime rejected';
        END;
    END IF;
END $$;

-- Test 8: Query performance test (index usage)
EXPLAIN ANALYZE
SELECT *
FROM firewall_health_snapshots
WHERE device_id = (SELECT id FROM firewall_devices LIMIT 1)
  AND timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC
LIMIT 10;

-- Expected: Should use idx_health_snapshots_device index

-- Test 9: Verify cascade delete
DO $$
DECLARE
    test_device_id uuid;
    snapshot_count int;
BEGIN
    -- Create a temporary test device
    INSERT INTO firewall_devices (
        tenant_id,
        model,
        firmware_version,
        serial_number,
        management_ip,
        status
    ) VALUES (
        (SELECT id FROM tenants LIMIT 1),
        'TEST-MODEL',
        '1.0.0',
        'TEST-SERIAL-' || gen_random_uuid()::text,
        '192.168.1.1'::inet,
        'active'
    ) RETURNING id INTO test_device_id;
    
    -- Insert a snapshot for this device
    INSERT INTO firewall_health_snapshots (
        device_id, cpu_percent, ram_percent, uptime_seconds,
        wan_status, vpn_status, interface_status
    ) VALUES (
        test_device_id, 50, 60, 1000,
        'up', 'up', '{}'::jsonb
    );
    
    -- Verify snapshot exists
    SELECT COUNT(*) INTO snapshot_count
    FROM firewall_health_snapshots
    WHERE device_id = test_device_id;
    
    IF snapshot_count = 1 THEN
        RAISE NOTICE 'Test snapshot created';
    ELSE
        RAISE EXCEPTION 'Failed to create test snapshot';
    END IF;
    
    -- Delete the device
    DELETE FROM firewall_devices WHERE id = test_device_id;
    
    -- Verify snapshot was cascade deleted
    SELECT COUNT(*) INTO snapshot_count
    FROM firewall_health_snapshots
    WHERE device_id = test_device_id;
    
    IF snapshot_count = 0 THEN
        RAISE NOTICE 'Test 9 PASSED: Cascade delete working correctly';
    ELSE
        RAISE EXCEPTION 'Test 9 FAILED: Snapshot not cascade deleted';
    END IF;
END $$;

-- Test 10: Verify JSONB interface_status functionality
DO $$
DECLARE
    test_device_id uuid;
    test_snapshot_id uuid;
    interface_count int;
BEGIN
    SELECT id INTO test_device_id FROM firewall_devices LIMIT 1;
    
    IF test_device_id IS NOT NULL THEN
        -- Insert snapshot with complex interface status
        INSERT INTO firewall_health_snapshots (
            device_id, cpu_percent, ram_percent, uptime_seconds,
            wan_status, vpn_status, interface_status
        ) VALUES (
            test_device_id, 50, 60, 1000,
            'up', 'up',
            '{"X0": "up", "X1": "up", "X2": "down", "X3": "up", "X4": "down"}'::jsonb
        ) RETURNING id INTO test_snapshot_id;
        
        -- Query interfaces with status 'up'
        SELECT COUNT(*)
        INTO interface_count
        FROM firewall_health_snapshots,
             jsonb_each_text(interface_status) AS iface(name, status)
        WHERE id = test_snapshot_id
          AND status = 'up';
        
        IF interface_count = 3 THEN
            RAISE NOTICE 'Test 10 PASSED: JSONB query working correctly (3 interfaces up)';
        ELSE
            RAISE EXCEPTION 'Test 10 FAILED: Expected 3 interfaces up, got %', interface_count;
        END IF;
        
        -- Cleanup
        DELETE FROM firewall_health_snapshots WHERE id = test_snapshot_id;
    END IF;
END $$;

-- Cleanup test data
DELETE FROM firewall_health_snapshots
WHERE device_id IN (
    SELECT id FROM firewall_devices
    WHERE model = 'TEST-MODEL'
);

-- Summary
SELECT 
    'firewall_health_snapshots' AS table_name,
    COUNT(*) AS total_snapshots,
    COUNT(DISTINCT device_id) AS unique_devices,
    MIN(timestamp) AS oldest_snapshot,
    MAX(timestamp) AS newest_snapshot
FROM firewall_health_snapshots;
