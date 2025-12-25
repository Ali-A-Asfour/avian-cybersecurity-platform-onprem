-- Test script for migration 0012: firewall_devices table
-- This script verifies the migration was applied correctly

-- Test 1: Verify table exists
SELECT 
    'Test 1: Table exists' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'firewall_devices'
        ) THEN 'PASS ✓'
        ELSE 'FAIL ✗'
    END as result;

-- Test 2: Verify all columns exist with correct types
SELECT 
    'Test 2: Column structure' as test_name,
    CASE 
        WHEN COUNT(*) = 12 THEN 'PASS ✓'
        ELSE 'FAIL ✗ (Expected 12 columns, found ' || COUNT(*) || ')'
    END as result
FROM information_schema.columns 
WHERE table_name = 'firewall_devices';

-- Test 3: Verify indexes exist
SELECT 
    'Test 3: Indexes' as test_name,
    CASE 
        WHEN COUNT(*) >= 4 THEN 'PASS ✓'
        ELSE 'FAIL ✗ (Expected at least 4 indexes, found ' || COUNT(*) || ')'
    END as result
FROM pg_indexes 
WHERE tablename = 'firewall_devices'
AND indexname IN (
    'idx_firewall_devices_tenant',
    'idx_firewall_devices_status',
    'idx_firewall_devices_serial',
    'idx_firewall_devices_last_seen'
);

-- Test 4: Verify foreign key constraint exists
SELECT 
    'Test 4: Foreign key constraint' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'firewall_devices_tenant_id_tenants_id_fk'
            AND conrelid = 'firewall_devices'::regclass
        ) THEN 'PASS ✓'
        ELSE 'FAIL ✗'
    END as result;

-- Test 5: Verify serial_number has unique constraint
SELECT 
    'Test 5: Unique constraint on serial_number' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'firewall_devices'::regclass
            AND contype = 'u'
            AND conkey::text LIKE '%serial_number%'
        ) THEN 'PASS ✓'
        ELSE 'FAIL ✗'
    END as result;

-- Test 6: Verify default values
SELECT 
    'Test 6: Default values' as test_name,
    CASE 
        WHEN (
            SELECT column_default 
            FROM information_schema.columns 
            WHERE table_name = 'firewall_devices' 
            AND column_name = 'status'
        ) = '''active''::character varying' THEN 'PASS ✓'
        ELSE 'FAIL ✗'
    END as result;

-- Display detailed column information
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'firewall_devices'
ORDER BY ordinal_position;

-- Display all indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'firewall_devices'
ORDER BY indexname;

-- Display foreign key constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    confdeltype as on_delete_action
FROM pg_constraint
WHERE conrelid = 'firewall_devices'::regclass;
