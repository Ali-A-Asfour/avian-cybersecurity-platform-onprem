#!/bin/bash

# Replicate Server Environment Locally
# This script creates an exact copy of the server database locally

set -e

echo "🔄 Replicating server environment locally..."

# Database connection details
DB_NAME="avian"
DB_USER="avian"
DB_PASSWORD="avian_dev_password"
DB_HOST="localhost"
DB_PORT="5432"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo_error "PostgreSQL is not running or not accessible"
    echo "Please start PostgreSQL and ensure the database '$DB_NAME' exists with user '$DB_USER'"
    exit 1
fi

echo_info "PostgreSQL is running and accessible"

# Check if database exists
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' > /dev/null 2>&1; then
    echo_error "Database '$DB_NAME' does not exist or is not accessible"
    echo "Please create the database first:"
    echo "  createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME"
    exit 1
fi

echo_info "Database '$DB_NAME' exists and is accessible"

# Step 1: Drop existing schema and recreate from server schema
echo_info "Step 1: Applying server database schema..."

# First, drop all existing tables, views, functions, etc.
echo_info "Dropping existing schema objects..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Drop all views first (they depend on tables)
DROP VIEW IF EXISTS failed_login_attempts CASCADE;
DROP VIEW IF EXISTS general_tickets CASCADE;
DROP VIEW IF EXISTS it_support_tickets CASCADE;
DROP VIEW IF EXISTS locked_accounts CASCADE;
DROP VIEW IF EXISTS password_history_stats CASCADE;
DROP VIEW IF EXISTS security_events CASCADE;
DROP VIEW IF EXISTS security_tickets CASCADE;

-- Drop all tables (CASCADE will handle foreign keys)
DROP TABLE IF EXISTS ticket_comments CASCADE;
DROP TABLE IF EXISTS ticket_attachments CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS security_incidents CASCADE;
DROP TABLE IF EXISTS security_alerts CASCADE;
DROP TABLE IF EXISTS playbook_classification_links CASCADE;
DROP TABLE IF EXISTS password_history CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS investigation_playbooks CASCADE;
DROP TABLE IF EXISTS compliance_evidence CASCADE;
DROP TABLE IF EXISTS compliance_controls CASCADE;
DROP TABLE IF EXISTS compliance_frameworks CASCADE;
DROP TABLE IF EXISTS auth_audit_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS add_password_to_history(uuid, character varying) CASCADE;
DROP FUNCTION IF EXISTS check_failed_login_attempts() CASCADE;
DROP FUNCTION IF EXISTS cleanup_all_password_history(integer) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_audit_logs(integer) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_password_history(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS enforce_password_history_policy(uuid, character varying, integer) CASCADE;
DROP FUNCTION IF EXISTS get_user_password_history(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS is_password_recently_used(uuid, character varying, integer) CASCADE;
DROP FUNCTION IF EXISTS sync_playbook_classification_status() CASCADE;
DROP FUNCTION IF EXISTS trigger_add_password_to_history() CASCADE;
DROP FUNCTION IF EXISTS update_investigation_playbooks_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_security_alerts_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_security_incidents_updated_at() CASCADE;

-- Drop all types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS ticket_severity CASCADE;
DROP TYPE IF EXISTS ticket_priority CASCADE;
DROP TYPE IF EXISTS ticket_category CASCADE;
DROP TYPE IF EXISTS playbook_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS incident_status CASCADE;
DROP TYPE IF EXISTS compliance_status CASCADE;
DROP TYPE IF EXISTS alert_status CASCADE;
DROP TYPE IF EXISTS alert_source_system CASCADE;
DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS alert_category CASCADE;

EOF

echo_info "Existing schema dropped successfully"

# Apply the complete server schema
echo_info "Applying complete server schema..."
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f server_schema.sql > /dev/null 2>&1; then
    echo_error "Failed to apply server schema"
    exit 1
fi

echo_info "Server schema applied successfully"

# Step 2: Insert server tenants data
echo_info "Step 2: Inserting server tenants data..."

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Insert exact server tenants
INSERT INTO tenants (id, name, domain, logo_url, theme_color, settings, is_active, created_at, updated_at) VALUES
('577e0ffa-b27e-468f-9846-1146c7820659', 'test', 'test.com', NULL, '#00D4FF', '{"branding": {"logo_url": "", "favicon_url": "", "primary_color": "#00D4FF", "secondary_color": "#0A1628"}, "max_users": 100, "sla_settings": {"escalation_enabled": true, "response_time_hours": 4, "escalation_time_hours": 8, "resolution_time_hours": 24}, "features_enabled": ["tickets", "alerts", "compliance", "reports"], "notification_settings": {"sms_enabled": false, "push_enabled": true, "email_enabled": true, "digest_frequency": "daily"}}', true, '2026-01-24 00:55:45.125868', '2026-01-24 00:55:45.125868'),
('9dc43b18-c537-4539-b55e-8ef682fa4b15', 'Default Organization', 'avian.local', NULL, NULL, '{}', false, '2026-01-21 23:03:03.280604', '2026-01-26 17:33:26.919'),
('6eb55261-e4f4-4577-8a18-28de67cc658b', 'Test Company', 'test-company.com', NULL, '#00D4FF', '{"branding": {"primary_color": "#00D4FF", "secondary_color": "#0A1628"}, "max_users": 100, "sla_settings": {"escalation_enabled": true, "response_time_hours": 4, "escalation_time_hours": 8, "resolution_time_hours": 24}, "features_enabled": ["tickets", "alerts", "compliance", "reports"], "notification_settings": {"sms_enabled": false, "push_enabled": true, "email_enabled": true, "digest_frequency": "daily"}}', false, '2026-01-24 00:54:33.417034', '2026-01-26 18:37:05.484'),
('85cfd918-8558-4baa-9534-25454aea76a8', 'esr', 'esr.com', NULL, '#00D4FF', '{"branding": {"logo_url": "", "favicon_url": "", "primary_color": "#00D4FF", "secondary_color": "#0A1628"}, "max_users": 10, "sla_settings": {"escalation_enabled": true, "response_time_hours": 4, "escalation_time_hours": 8, "resolution_time_hours": 24}, "features_enabled": ["tickets", "alerts", "compliance", "reports"], "notification_settings": {"sms_enabled": false, "push_enabled": true, "email_enabled": true, "digest_frequency": "daily"}}', true, '2026-01-26 18:37:51.142696', '2026-01-26 18:37:51.142696');
EOF

echo_info "Server tenants inserted successfully"

# Step 3: Insert server users data
echo_info "Step 3: Inserting server users data..."

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Insert exact server users
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, mfa_enabled, mfa_secret, password_hash, last_login, is_active, created_at, updated_at, mfa_backup_codes, mfa_setup_completed, account_locked, failed_login_attempts, last_failed_login, locked_until, email_verified, password_changed_at, password_expires_at) VALUES
('5afd4e13-e1b1-452a-91a3-eeab678d97f7', '577e0ffa-b27e-468f-9846-1146c7820659', 'help@avain.local', 'help', 'desk1', 'user', false, NULL, '$2b$12$rPfIThOT1UVs/Hket5VYM.WvyKT.T.hMhzmaxm8WGTc4AtJ7LuPkW', '2026-01-27 18:21:21.493', true, '2026-01-26 18:40:42.949176', '2026-01-26 18:40:42.949176', '[]', false, false, 0, NULL, NULL, true, '2026-01-26 18:40:42.949176', NULL),
('8108833b-5dde-495f-a4fc-5a4f954956b5', '577e0ffa-b27e-468f-9846-1146c7820659', 'u@test.com', 'test', 'user', 'user', false, NULL, '$2b$12$akBhAax//vJ96QzH6HGusOM4nitGHQ/XxTE2hiY3oosDaqpIYHXBW', '2026-01-27 20:28:44.694', true, '2026-01-27 20:28:28.971217', '2026-01-27 20:28:28.971217', '[]', false, false, 0, NULL, NULL, true, '2026-01-27 20:28:28.971217', NULL),
('0a24b509-6e8f-4162-8687-f9a8ed71f9cc', '85cfd918-8558-4baa-9534-25454aea76a8', 'h@tcc.com', 'helpdesk', 'one', 'it_helpdesk_analyst', false, NULL, '$2b$12$F4ycqfwjYPUgqugZMOeybeLnlXzso50lYtcoqsLndBNBgtIahmTpm', '2026-01-29 01:28:11.653', true, '2026-01-26 19:48:10.787461', '2026-01-26 19:48:10.787461', '[]', false, false, 0, NULL, NULL, true, '2026-01-26 19:48:10.787461', NULL),
('2c3e18b7-fac8-4f66-b2d5-5255e2f49d6a', '577e0ffa-b27e-468f-9846-1146c7820659', 'security.analyst@company.com', 'Security', 'Analyst', 'security_analyst', false, NULL, '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy', '2026-01-27 01:51:51.795', true, '2026-01-26 19:47:02.117062', '2026-01-26 19:47:02.117062', '[]', false, false, 0, NULL, NULL, true, '2026-01-26 19:47:02.117062', NULL),
('0f1735e6-28b1-4972-83bf-0c7986487aca', '577e0ffa-b27e-468f-9846-1146c7820659', 'tadmin@test.com', 'test', 'admin', 'tenant_admin', false, NULL, '$2b$12$sTa4xZnkfunc16GczInQruKUCZGtnHWyX7.9S1LSStCbkCkXaNmDe', '2026-01-26 00:10:50.99', true, '2026-01-24 00:58:03.384251', '2026-01-25 23:55:44.478', '[]', false, false, 1, '2026-01-27 01:53:12.791337', NULL, true, '2026-01-24 00:58:03.384251', NULL),
('115f1dc8-755d-48d5-a1e6-52440f02f5d4', '85cfd918-8558-4baa-9534-25454aea76a8', 'u@esr.com', 'john', 'user', 'user', false, NULL, '$2b$12$N.rSqUJwQFrgnkYWaGpr8eN.gLZlhoJaNEPz3pzkBX6VQ8r5knJem', '2026-01-28 16:47:02.125', true, '2026-01-26 18:39:08.988028', '2026-01-26 18:39:08.988028', '[]', false, false, 0, NULL, NULL, true, '2026-01-26 18:39:08.988028', NULL),
('3c5e088c-4efa-4915-bcfd-a88e3c88fe2e', '9dc43b18-c537-4539-b55e-8ef682fa4b15', 'admin@avian.local', 'Admin', 'User', 'super_admin', false, NULL, '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy', '2026-01-27 18:57:39.018', false, '2026-01-21 23:04:07.007284', '2026-01-26 17:33:26.925', '[]', false, false, 0, NULL, NULL, true, '2026-01-22 19:05:14.15849', NULL),
('40c747b5-c1ab-458f-a5e1-12c972b29f3a', '577e0ffa-b27e-468f-9846-1146c7820659', 'helpdesk.analyst@company.com', 'Helpdesk', 'Analyst', 'it_helpdesk_analyst', false, NULL, '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy', '2026-01-27 19:57:18.355', true, '2026-01-26 19:47:02.211073', '2026-01-26 19:47:02.211073', '[]', false, false, 0, NULL, NULL, true, '2026-01-26 19:47:02.211073', NULL),
('098637cf-5e07-4b06-8f2f-550a23e7fad8', '577e0ffa-b27e-468f-9846-1146c7820659', 'lin@test.com', 'mr', 'linux', 'user', false, NULL, '$2b$12$kzQYL683kHajfwa5trV8semp5xBFnbUbYtwhZoAT1RxrUVZLWf.sG', NULL, true, '2026-01-26 00:11:37.216169', '2026-01-26 00:11:37.216169', '[]', false, false, 0, NULL, NULL, true, '2026-01-26 00:11:37.216169', NULL),
('2e6ff17b-a69d-4e6c-bf25-7d541cb9f300', '577e0ffa-b27e-468f-9846-1146c7820659', 'test@test.com', 'Test', 'User', 'it_helpdesk_analyst', false, NULL, '$2b$12$LQv3c1yqBwlVHpPx7fgHNO7eGJqxgJVeQstSX.fQ2NFFz6h4GhVqW', NULL, true, '2026-01-28 17:30:54.200593', '2026-01-28 17:30:54.200593', '[]', false, false, 1, '2026-01-28 17:30:54.632856', NULL, true, '2026-01-28 17:30:54.200593', NULL),
('679f8c1c-9493-4ba2-8314-7262f06243c5', '577e0ffa-b27e-468f-9846-1146c7820659', 'h@tcc.com', 'Helpdesk', 'Analyst', 'it_helpdesk_analyst', false, NULL, '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy', NULL, true, '2026-01-28 17:13:17.077205', '2026-01-28 17:13:17.077205', '[]', false, true, 5, '2026-01-29 01:26:52.007297', '2026-01-29 01:41:52.005', true, '2026-01-28 17:13:17.077205', NULL);
EOF

echo_info "Server users inserted successfully"

# Step 4: Insert server tickets data
echo_info "Step 4: Inserting server tickets data..."

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Insert exact server tickets
INSERT INTO tickets (id, tenant_id, requester, assignee, title, description, severity, priority, status, tags, sla_deadline, created_at, updated_at, category) VALUES
('30e1d6d5-2aa6-47f1-b82f-2c2d77d2deff', '85cfd918-8558-4baa-9534-25454aea76a8', 'test@example.com', NULL, 'Clean Test Ticket', 'Testing assignment with clean UUID', 'medium', 'medium', 'new', '[]', NULL, '2026-01-28 17:35:58.649316', '2026-01-28 17:35:58.649316', 'it_support'),
('5c62a714-20bb-4f20-913f-3417f4b22101', '85cfd918-8558-4baa-9534-25454aea76a8', 'test@example.com', NULL, 'Database Test Ticket', 'Testing assignment with database ticket', 'medium', 'medium', 'new', '[]', NULL, '2026-01-28 17:35:15.529236', '2026-01-28 17:35:15.529236', 'it_support'),
('7733777b-b91f-4fa0-ac5e-ae7cfee8681a', '577e0ffa-b27e-468f-9846-1146c7820659', 'test@example.com', NULL, 'Test Assignment Ticket', 'This ticket is for testing the assignment functionality', 'medium', 'medium', 'new', '[]', NULL, '2026-01-28 17:28:50.435662', '2026-01-28 17:28:50.435662', 'it_support'),
('21ca7233-5cf3-49d8-9013-6dc444d8a6f4', '577e0ffa-b27e-468f-9846-1146c7820659', 'test@example.com', NULL, 'Test Ticket Assignment', 'Testing the assign to me functionality', 'medium', 'medium', 'new', '[]', NULL, '2026-01-28 17:16:47.006417', '2026-01-28 17:16:47.006417', 'it_support');
EOF

echo_info "Server tickets inserted successfully"

# Step 5: Verify the replication
echo_info "Step 5: Verifying replication..."

# Check tenants count
TENANT_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM tenants;")
echo_info "Tenants replicated: $TENANT_COUNT (expected: 4)"

# Check users count
USER_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;")
echo_info "Users replicated: $USER_COUNT (expected: 11)"

# Check tickets count
TICKET_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM tickets;")
echo_info "Tickets replicated: $TICKET_COUNT (expected: 4)"

# Check key user exists
KEY_USER_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users WHERE email = 'h@tcc.com' AND role = 'it_helpdesk_analyst';")
if [ "$KEY_USER_EXISTS" -eq "2" ]; then
    echo_info "✅ Key user h@tcc.com with role it_helpdesk_analyst exists (2 entries as expected)"
else
    echo_warning "⚠️  Key user check: found $KEY_USER_EXISTS entries (expected: 2)"
fi

# Check database schema objects
TABLES_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo_info "Database tables: $TABLES_COUNT"

VIEWS_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public';")
echo_info "Database views: $VIEWS_COUNT"

FUNCTIONS_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';")
echo_info "Database functions: $FUNCTIONS_COUNT"

echo_info "✅ Server environment replicated successfully!"
echo_info ""
echo_info "🔑 Key credentials for testing:"
echo_info "   Email: h@tcc.com"
echo_info "   Password: 12345678"
echo_info "   Role: it_helpdesk_analyst"
echo_info "   Tenant: esr (85cfd918-8558-4baa-9534-25454aea76a8)"
echo_info ""
echo_info "🎯 You can now test the platform locally with exact server data!"
echo_info "   - Login with h@tcc.com / 12345678"
echo_info "   - View and assign tickets from the help desk queue"
echo_info "   - All APIs should work with the exact server database structure"