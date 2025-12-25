-- Test Migration 0022: Reports Module Schema
-- Tests for report snapshots, access logs, and generation queue tables

-- ============================================================================
-- Test Data Setup
-- ============================================================================

-- Insert test tenant and user (assuming they exist from previous migrations)
-- These should already exist from earlier migrations, but we'll reference them

-- ============================================================================
-- Test Report Snapshots Table
-- ============================================================================

-- Test 1: Insert valid report snapshot
INSERT INTO report_snapshots (
    tenant_id,
    report_id,
    report_type,
    start_date,
    end_date,
    timezone,
    generated_at,
    generated_by,
    slide_data,
    template_version,
    data_schema_version
) VALUES (
    (SELECT id FROM tenants LIMIT 1),
    gen_random_uuid(),
    'weekly',
    '2024-01-01 00:00:00',
    '2024-01-07 23:59:59',
    'America/Toronto',
    NOW(),
    (SELECT id FROM users WHERE role IN ('super_admin', 'security_analyst') LIMIT 1),
    '{"slides": [{"id": "1", "type": "executive-overview", "data": {"totalAlerts": 42}}]}',
    'v1.0.0',
    'v1.0.0'
);

-- Test 2: Verify report type constraint
DO $$
BEGIN
    BEGIN
        INSERT INTO report_snapshots (
            tenant_id,
            report_id,
            report_type,
            start_date,
            end_date,
            timezone,
            generated_at,
            generated_by,
            slide_data,
            template_version,
            data_schema_version
        ) VALUES (
            (SELECT id FROM tenants LIMIT 1),
            gen_random_uuid(),
            'invalid_type',
            '2024-01-01 00:00:00',
            '2024-01-07 23:59:59',
            'America/Toronto',
            NOW(),
            (SELECT id FROM users WHERE role IN ('super_admin', 'security_analyst') LIMIT 1),
            '{}',
            'v1.0.0',
            'v1.0.0'
        );
        RAISE EXCEPTION 'Should have failed on invalid report_type';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Report type constraint working correctly';
    END;
END $$;

-- Test 3: Verify date range constraint
DO $$
BEGIN
    BEGIN
        INSERT INTO report_snapshots (
            tenant_id,
            report_id,
            report_type,
            start_date,
            end_date,
            timezone,
            generated_at,
            generated_by,
            slide_data,
            template_version,
            data_schema_version
        ) VALUES (
            (SELECT id FROM tenants LIMIT 1),
            gen_random_uuid(),
            'weekly',
            '2024-01-07 00:00:00',
            '2024-01-01 23:59:59', -- End before start
            'America/Toronto',
            NOW(),
            (SELECT id FROM users WHERE role IN ('super_admin', 'security_analyst') LIMIT 1),
            '{}',
            'v1.0.0',
            'v1.0.0'
        );
        RAISE EXCEPTION 'Should have failed on invalid date range';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Date range constraint working correctly';
    END;
END $$;

-- Test 4: Test archive functionality
UPDATE report_snapshots 
SET is_archived = true, archived_at = NOW(), archived_by = generated_by
WHERE report_type = 'weekly';

-- ============================================================================
-- Test Report Access Logs Table
-- ============================================================================

-- Test 5: Insert valid access log
INSERT INTO report_access_logs (
    snapshot_id,
    tenant_id,
    user_id,
    access_type,
    user_role,
    access_granted
) VALUES (
    (SELECT id FROM report_snapshots LIMIT 1),
    (SELECT tenant_id FROM report_snapshots LIMIT 1),
    (SELECT generated_by FROM report_snapshots LIMIT 1),
    'view',
    'security_analyst',
    true
);

-- Test 6: Verify access type constraint
DO $$
BEGIN
    BEGIN
        INSERT INTO report_access_logs (
            snapshot_id,
            tenant_id,
            user_id,
            access_type,
            user_role,
            access_granted
        ) VALUES (
            (SELECT id FROM report_snapshots LIMIT 1),
            (SELECT tenant_id FROM report_snapshots LIMIT 1),
            (SELECT generated_by FROM report_snapshots LIMIT 1),
            'invalid_access',
            'security_analyst',
            true
        );
        RAISE EXCEPTION 'Should have failed on invalid access_type';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Access type constraint working correctly';
    END;
END $$;

-- Test 7: Test denial reason constraint
INSERT INTO report_access_logs (
    snapshot_id,
    tenant_id,
    user_id,
    access_type,
    user_role,
    access_granted,
    denial_reason
) VALUES (
    (SELECT id FROM report_snapshots LIMIT 1),
    (SELECT tenant_id FROM report_snapshots LIMIT 1),
    (SELECT generated_by FROM report_snapshots LIMIT 1),
    'download',
    'regular_user',
    false,
    'Insufficient permissions'
);

-- ============================================================================
-- Test Report Generation Queue Table
-- ============================================================================

-- Test 8: Insert valid queue entry
INSERT INTO report_generation_queue (
    tenant_id,
    requested_by,
    report_type,
    start_date,
    end_date,
    timezone,
    priority
) VALUES (
    (SELECT id FROM tenants LIMIT 1),
    (SELECT id FROM users WHERE role IN ('super_admin', 'security_analyst') LIMIT 1),
    'monthly',
    '2024-01-01 00:00:00',
    '2024-01-31 23:59:59',
    'America/Toronto',
    3
);

-- Test 9: Test status update to completed
UPDATE report_generation_queue 
SET 
    status = 'completed',
    snapshot_id = (SELECT id FROM report_snapshots LIMIT 1),
    processing_started_at = NOW() - INTERVAL '5 minutes',
    processing_completed_at = NOW()
WHERE status = 'pending';

-- Test 10: Test status update to failed
INSERT INTO report_generation_queue (
    tenant_id,
    requested_by,
    report_type,
    start_date,
    end_date,
    timezone,
    status,
    error_message
) VALUES (
    (SELECT id FROM tenants LIMIT 1),
    (SELECT id FROM users WHERE role IN ('super_admin', 'security_analyst') LIMIT 1),
    'quarterly',
    '2024-01-01 00:00:00',
    '2024-03-31 23:59:59',
    'America/Toronto',
    'failed',
    'Insufficient data for report generation'
);

-- ============================================================================
-- Test Indexes and Performance
-- ============================================================================

-- Test 11: Verify indexes exist
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('report_snapshots', 'report_access_logs', 'report_generation_queue')
ORDER BY tablename, indexname;

-- Test 12: Test query performance with indexes
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM report_snapshots 
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
ORDER BY generated_at DESC
LIMIT 10;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM report_access_logs
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
AND accessed_at >= NOW() - INTERVAL '30 days'
ORDER BY accessed_at DESC;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM report_generation_queue
WHERE status = 'pending'
ORDER BY priority ASC, created_at ASC;

-- ============================================================================
-- Test Triggers
-- ============================================================================

-- Test 13: Test updated_at trigger for report_snapshots
SELECT updated_at FROM report_snapshots WHERE report_type = 'weekly' LIMIT 1;

UPDATE report_snapshots 
SET template_version = 'v1.0.1' 
WHERE report_type = 'weekly';

-- Verify updated_at changed
SELECT updated_at FROM report_snapshots WHERE report_type = 'weekly' LIMIT 1;

-- Test 14: Test updated_at trigger for report_generation_queue
SELECT updated_at FROM report_generation_queue WHERE status = 'completed' LIMIT 1;

UPDATE report_generation_queue 
SET priority = 1 
WHERE status = 'completed';

-- Verify updated_at changed
SELECT updated_at FROM report_generation_queue WHERE status = 'completed' LIMIT 1;

-- ============================================================================
-- Cleanup Test Data
-- ============================================================================

-- Clean up test data (optional - comment out if you want to keep test data)
-- DELETE FROM report_access_logs WHERE access_type IN ('view', 'download');
-- DELETE FROM report_generation_queue WHERE report_type IN ('monthly', 'quarterly');
-- DELETE FROM report_snapshots WHERE report_type = 'weekly';

-- ============================================================================
-- Final Verification
-- ============================================================================

-- Test 15: Verify all tables exist and have correct structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('report_snapshots', 'report_access_logs', 'report_generation_queue')
ORDER BY table_name, ordinal_position;

-- Test 16: Verify foreign key constraints
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
    AND tc.table_name IN ('report_snapshots', 'report_access_logs', 'report_generation_queue');

-- Test 17: Verify check constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
    AND tc.table_name IN ('report_snapshots', 'report_access_logs', 'report_generation_queue')
ORDER BY tc.table_name, tc.constraint_name;

RAISE NOTICE 'Migration 0022 tests completed successfully';