-- Test Script for Migration 0020: Firewall Drizzle Schema Synchronization
-- This script verifies that the firewall tables exist and match the expected schema

\echo '=== Testing Migration 0020: Firewall Drizzle Schema Synchronization ==='

-- Test 1: Verify all firewall tables exist
\echo '\n--- Test 1: Verify all firewall tables exist ---'
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'firewall_devices',
            'firewall_health_snapshots',
            'firewall_security_posture',
            'firewall_licenses',
            'firewall_config_risks',
            'firewall_metrics_rollup',
            'firewall_alerts'
        ) THEN '✓ EXISTS'
        ELSE '✗ UNEXPECTED'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'firewall_%'
ORDER BY table_name;

-- Test 2: Verify firewall_devices table structure
\echo '\n--- Test 2: Verify firewall_devices table structure ---'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'firewall_devices'
ORDER BY ordinal_position;

-- Test 3: Verify foreign key relationships
\echo '\n--- Test 3: Verify foreign key relationships ---'
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name LIKE 'firewall_%'
ORDER BY tc.table_name, kcu.column_name;

-- Test 4: Verify indexes exist
\echo '\n--- Test 4: Verify indexes exist ---'
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'firewall_%'
ORDER BY tablename, indexname;

-- Test 5: Verify check constraints
\echo '\n--- Test 5: Verify check constraints ---'
SELECT 
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
AND tc.table_name LIKE 'firewall_%'
AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- Test 6: Verify unique constraints
\echo '\n--- Test 6: Verify unique constraints ---'
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
AND tc.table_name LIKE 'firewall_%'
AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, tc.constraint_name;

-- Test 7: Count tables
\echo '\n--- Test 7: Summary ---'
SELECT 
    COUNT(*) as total_firewall_tables,
    CASE 
        WHEN COUNT(*) = 7 THEN '✓ PASS: All 7 firewall tables exist'
        ELSE '✗ FAIL: Expected 7 tables, found ' || COUNT(*)
    END as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'firewall_%';

\echo '\n=== Migration 0020 Test Complete ==='
