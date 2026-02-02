#!/bin/bash

# Direct Server Fix - Create users directly in database
# This bypasses all application code issues

echo "🔧 Direct database user creation fix..."

# Function to create user directly in database
create_user_direct() {
    local email=$1
    local first_name=$2
    local last_name=$3
    local role=$4
    local tenant_id=$5
    local password_hash=$6
    
    echo "Creating user: $email ($role)"
    
    sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
        INSERT INTO users (
            tenant_id,
            email,
            first_name,
            last_name,
            role,
            password_hash,
            email_verified,
            is_active,
            mfa_enabled,
            account_locked,
            failed_login_attempts
        ) VALUES (
            '$tenant_id',
            '$email',
            '$first_name',
            '$last_name',
            '$role',
            '$password_hash',
            true,
            true,
            false,
            false,
            0
        );
    "
}

# Get tenant ID (use the first available tenant)
TENANT_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tenants WHERE is_active = true LIMIT 1;" | tr -d ' ')

echo "Using tenant ID: $TENANT_ID"

# Generate password hash for 'admin123'
# This is the bcrypt hash for 'admin123' with 12 rounds
PASSWORD_HASH='$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy'

echo "Creating Security Analyst user..."
create_user_direct "security.analyst@company.com" "Security" "Analyst" "security_analyst" "$TENANT_ID" "$PASSWORD_HASH"

echo "Creating IT Helpdesk Analyst user..."
create_user_direct "helpdesk.analyst@company.com" "Helpdesk" "Analyst" "it_helpdesk_analyst" "$TENANT_ID" "$PASSWORD_HASH"

echo ""
echo "✅ Users created directly in database!"
echo ""
echo "🧪 Test login credentials:"
echo "  Security Analyst: security.analyst@company.com / admin123"
echo "  Helpdesk Analyst: helpdesk.analyst@company.com / admin123"
echo ""
echo "📋 Verify users were created:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT email, first_name, last_name, role FROM users WHERE role IN ('security_analyst', 'it_helpdesk_analyst');"