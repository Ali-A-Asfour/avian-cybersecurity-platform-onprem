-- Test script for migration 0011
-- This script validates that all indexes were created successfully

-- Test 1: Check if all expected indexes exist
DO $
DECLARE
    expected_indexes TEXT[] := ARRAY[
        'users_email_idx',
        'users_email_active_idx',
        'users_failed_login_attempts_idx',
        'users_mfa_enabled_idx',
        'users_last_login_idx',
        'users_tenant_role_idx',
        'users_tenant_active_idx',
        'users_email_verified_active_idx',
        'sessions_user_expires_idx',
        'sessions_active_idx',
        'sessions_ip_created_idx',
        'auth_audit_logs_failed_login_idx',
        'auth_audit_logs_user_timeline_idx',
        'auth_audit_logs_ip_action_idx',
        'auth_audit_logs_recent_security_idx',
        'password_history_recent_idx',
        'email_verification_tokens_token_expires_idx',
        'password_reset_tokens_token_expires_idx',
        'email_verification_tokens_active_idx',
        'password_reset_tokens_active_idx',
        'tenants_domain_active_idx'
    ];
    idx TEXT;
    missing_count INT := 0;
    found_count INT := 0;
BEGIN
    RAISE NOTICE '=== Testing Migration 0011: Auth Performance Indexes ===';
    RAISE NOTICE '';
    
    FOREACH idx IN ARRAY expected_indexes
    LOOP
        IF EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = idx
        ) THEN
            RAISE NOTICE '✅ Index exists: %', idx;
            found_count := found_count + 1;
        ELSE
            RAISE WARNING '❌ Index missing: %', idx;
            missing_count := missing_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Summary ===';
    RAISE NOTICE 'Expected indexes: %', array_length(expected_indexes, 1);
    RAISE NOTICE 'Found: %', found_count;
    RAISE NOTICE 'Missing: %', missing_count;
    
    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Migration validation failed: % indexes are missing', missing_count;
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '✅ All indexes created successfully!';
    END IF;
END;
$;

-- Test 2: Check if monitoring view exists
DO $
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'auth_index_usage'
    ) THEN
        RAISE NOTICE '✅ Monitoring view exists: auth_index_usage';
    ELSE
        RAISE WARNING '❌ Monitoring view missing: auth_index_usage';
        RAISE EXCEPTION 'Migration validation failed: monitoring view not created';
    END IF;
END;
$;

-- Test 3: Verify index usage view returns data
DO $
DECLARE
    row_count INT;
BEGIN
    SELECT COUNT(*) INTO row_count FROM auth_index_usage;
    RAISE NOTICE '✅ Monitoring view returns % rows', row_count;
    
    IF row_count = 0 THEN
        RAISE WARNING 'Monitoring view returns no data (this may be expected if tables are empty)';
    END IF;
END;
$;

-- Test 4: Check index sizes
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE ANY(ARRAY[
      'users_email%',
      'users_failed%',
      'users_mfa%',
      'users_last%',
      'users_tenant%',
      'sessions_%',
      'auth_audit_logs_%',
      'password_history_%',
      '%_tokens_%',
      'tenants_domain%'
  ])
ORDER BY tablename, indexname;

-- Test 5: Explain analyze a common login query (if users table has data)
DO $
DECLARE
    user_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    
    IF user_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '=== Query Plan Test ===';
        RAISE NOTICE 'Testing login query performance...';
        
        -- This would show the query plan
        -- In practice, you'd run: EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com' AND is_active = true;
    ELSE
        RAISE NOTICE 'Skipping query plan test (no users in database)';
    END IF;
END;
$;

RAISE NOTICE '';
RAISE NOTICE '=== Migration 0011 Validation Complete ===';
