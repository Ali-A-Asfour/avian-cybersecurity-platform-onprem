#!/bin/bash

# Fix AVIAN Platform Server Database Issues
# This script adds all missing database tables and columns needed for authentication

set -e

echo "🔧 Fixing AVIAN Platform Server Database..."

# Server details
SERVER_IP="192.168.1.115"
SERVER_USER="avian"
PROJECT_DIR="/home/avian/avian-cybersecurity-platform-onprem"

echo "📋 Step 1: Adding missing database columns and tables..."

ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🗄️ Adding missing columns to users table..."
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U avian -d avian << 'EOSQL'
-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_setup_completed BOOLEAN DEFAULT false;
EOSQL

echo "🗄️ Creating auth_audit_logs table..."
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U avian -d avian << 'EOSQL'
-- Create auth_audit_logs table
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email VARCHAR(255),
    action VARCHAR(100),
    result VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT auth_audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for auth_audit_logs
CREATE INDEX IF NOT EXISTS auth_audit_logs_user_id_idx ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS auth_audit_logs_email_idx ON auth_audit_logs(email);
CREATE INDEX IF NOT EXISTS auth_audit_logs_action_idx ON auth_audit_logs(action);
CREATE INDEX IF NOT EXISTS auth_audit_logs_result_idx ON auth_audit_logs(result);
CREATE INDEX IF NOT EXISTS auth_audit_logs_created_at_idx ON auth_audit_logs(created_at DESC);
EOSQL

echo "🗄️ Creating sessions table..."
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U avian -d avian << 'EOSQL'
-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for sessions
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
EOSQL

echo "👤 Updating admin user with correct password hash..."
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U avian -d avian << 'EOSQL'
-- Update admin user with fresh password hash and reset lockout
UPDATE users SET 
  password_hash = '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy',
  failed_login_attempts = 0,
  locked_until = NULL,
  account_locked = false,
  last_failed_login = NULL,
  email_verified = true,
  is_active = true
WHERE email = 'admin@avian.local';
EOSQL

echo "🔄 Restarting application to apply changes..."
docker-compose -f docker-compose.prod.yml restart app

echo "⏳ Waiting for application to start..."
sleep 10

echo "📊 Checking application status..."
docker-compose -f docker-compose.prod.yml ps

echo "📋 Testing login API..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@avian.local", "password": "admin123"}' \
  -s | head -c 100

echo ""
echo "📋 Testing session validation API..."
curl -X GET http://localhost:3000/api/auth/me \
  -H "Cookie: auth_token=test" \
  -s | head -c 50

echo ""
echo "✅ Database fixes applied successfully!"
echo ""
echo "🌐 You can now test the login at: https://192.168.1.115"
echo "🔑 Login credentials:"
echo "   Email: admin@avian.local"
echo "   Password: admin123"
EOF

echo "🎉 Server database fix completed!"
echo ""
echo "🔍 To verify the fix:"
echo "1. Open https://192.168.1.115 in your browser"
echo "2. Try logging in with admin@avian.local / admin123"
echo "3. You should now be able to access the dashboard"