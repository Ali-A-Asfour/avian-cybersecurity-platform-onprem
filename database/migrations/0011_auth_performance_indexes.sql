-- Authentication Performance Indexes Migration
-- Adds additional indexes to optimize authentication-related queries
-- Part of production authentication system implementation (Task 1.1)

-- ============================================================================
-- USERS TABLE INDEXES
-- ============================================================================

-- Index for email lookups (login, registration checks)
-- Email is already indexed in 0001, but we ensure it's optimized for auth queries
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");

-- Composite index for email + is_active (common login query pattern)
CREATE INDEX IF NOT EXISTS "users_email_active_idx" ON "users" USING btree ("email", "is_active")
WHERE is_active = true;

-- Index for failed login attempts tracking
CREATE INDEX IF NOT EXISTS "users_failed_login_attempts_idx" ON "users" USING btree ("failed_login_attempts")
WHERE failed_login_attempts > 0;

-- Index for MFA-enabled users
CREATE INDEX IF NOT EXISTS "users_mfa_enabled_idx" ON "users" USING btree ("mfa_enabled")
WHERE mfa_enabled = true;

-- Index for last_login timestamp (for session management and analytics)
CREATE INDEX IF NOT EXISTS "users_last_login_idx" ON "users" USING btree ("last_login" DESC NULLS LAST);

-- Composite index for tenant + role queries (common authorization pattern)
CREATE INDEX IF NOT EXISTS "users_tenant_role_idx" ON "users" USING btree ("tenant_id", "role");

-- Composite index for tenant + is_active (listing active users per tenant)
CREATE INDEX IF NOT EXISTS "users_tenant_active_idx" ON "users" USING btree ("tenant_id", "is_active");

-- Index for email verification status
CREATE INDEX IF NOT EXISTS "users_email_verified_active_idx" ON "users" USING btree ("email_verified", "is_active");

-- ============================================================================
-- SESSIONS TABLE INDEXES (already created in 0007, but ensuring completeness)
-- ============================================================================

-- Composite index for user + expires_at (finding active sessions for a user)
CREATE INDEX IF NOT EXISTS "sessions_user_expires_idx" ON "sessions" USING btree ("user_id", "expires_at" DESC);

-- Partial index for active (non-expired) sessions
CREATE INDEX IF NOT EXISTS "sessions_active_idx" ON "sessions" USING btree ("expires_at")
WHERE expires_at > NOW();

-- Composite index for IP address + created_at (security monitoring)
CREATE INDEX IF NOT EXISTS "sessions_ip_created_idx" ON "sessions" USING btree ("ip_address", "created_at" DESC);

-- ============================================================================
-- AUTH_AUDIT_LOGS TABLE INDEXES (additional to those in 0009)
-- ============================================================================

-- Composite index for failed login monitoring (email + action + result + time)
CREATE INDEX IF NOT EXISTS "auth_audit_logs_failed_login_idx" ON "auth_audit_logs" 
USING btree ("email", "action", "result", "created_at" DESC)
WHERE action = 'login' AND result IN ('failure', 'blocked');

-- Composite index for user activity timeline
CREATE INDEX IF NOT EXISTS "auth_audit_logs_user_timeline_idx" ON "auth_audit_logs"
USING btree ("user_id", "created_at" DESC)
WHERE user_id IS NOT NULL;

-- Composite index for IP-based security monitoring
CREATE INDEX IF NOT EXISTS "auth_audit_logs_ip_action_idx" ON "auth_audit_logs"
USING btree ("ip_address", "action", "created_at" DESC)
WHERE ip_address IS NOT NULL;

-- Partial index for recent security events (last 30 days)
CREATE INDEX IF NOT EXISTS "auth_audit_logs_recent_security_idx" ON "auth_audit_logs"
USING btree ("action", "result", "created_at" DESC)
WHERE created_at > NOW() - INTERVAL '30 days' 
  AND result IN ('failure', 'blocked', 'error');

-- ============================================================================
-- PASSWORD_HISTORY TABLE INDEXES (additional to those in 0010)
-- ============================================================================

-- Partial index for recent password history (last 5 passwords per user)
-- This optimizes the common query pattern for password reuse checking
CREATE INDEX IF NOT EXISTS "password_history_recent_idx" ON "password_history"
USING btree ("user_id", "created_at" DESC);

-- ============================================================================
-- TOKEN TABLES INDEXES (email_verification_tokens, password_reset_tokens)
-- ============================================================================

-- Composite index for token lookup + expiration check
CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_expires_idx" 
ON "email_verification_tokens" USING btree ("token", "expires_at");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_expires_idx"
ON "password_reset_tokens" USING btree ("token", "expires_at");

-- Partial index for active (non-expired) tokens
CREATE INDEX IF NOT EXISTS "email_verification_tokens_active_idx"
ON "email_verification_tokens" USING btree ("user_id", "expires_at")
WHERE expires_at > NOW();

CREATE INDEX IF NOT EXISTS "password_reset_tokens_active_idx"
ON "password_reset_tokens" USING btree ("user_id", "expires_at")
WHERE expires_at > NOW();

-- ============================================================================
-- TENANTS TABLE INDEXES (additional for auth queries)
-- ============================================================================

-- Composite index for active tenant lookups
CREATE INDEX IF NOT EXISTS "tenants_domain_active_idx" ON "tenants" 
USING btree ("domain", "is_active")
WHERE is_active = true;

-- ============================================================================
-- PERFORMANCE STATISTICS AND COMMENTS
-- ============================================================================

-- Add comments documenting the purpose of key indexes
COMMENT ON INDEX users_email_active_idx IS 'Optimizes login queries that check email + active status';
COMMENT ON INDEX users_failed_login_attempts_idx IS 'Optimizes queries for locked/suspicious accounts';
COMMENT ON INDEX users_tenant_role_idx IS 'Optimizes authorization queries checking user role within tenant';
COMMENT ON INDEX sessions_user_expires_idx IS 'Optimizes queries for active user sessions';
COMMENT ON INDEX sessions_active_idx IS 'Optimizes cleanup of expired sessions';
COMMENT ON INDEX auth_audit_logs_failed_login_idx IS 'Optimizes security monitoring for failed login attempts';
COMMENT ON INDEX auth_audit_logs_recent_security_idx IS 'Optimizes dashboard queries for recent security events';
COMMENT ON INDEX password_history_recent_idx IS 'Optimizes password reuse checking (last N passwords)';

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

-- Update statistics for the query planner to use new indexes effectively
ANALYZE users;
ANALYZE sessions;
ANALYZE auth_audit_logs;
ANALYZE password_history;
ANALYZE email_verification_tokens;
ANALYZE password_reset_tokens;
ANALYZE tenants;

-- ============================================================================
-- INDEX USAGE MONITORING VIEW
-- ============================================================================

-- Create a view to monitor index usage (helpful for future optimization)
CREATE OR REPLACE VIEW auth_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND (
    tablename IN ('users', 'sessions', 'auth_audit_logs', 'password_history', 
                  'email_verification_tokens', 'password_reset_tokens')
    OR indexname LIKE '%auth%'
    OR indexname LIKE '%session%'
    OR indexname LIKE '%password%'
  )
ORDER BY tablename, indexname;

COMMENT ON VIEW auth_index_usage IS 'Monitor usage statistics for authentication-related indexes';

-- Grant SELECT on the monitoring view
GRANT SELECT ON auth_index_usage TO PUBLIC;
