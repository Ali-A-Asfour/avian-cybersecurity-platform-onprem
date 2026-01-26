#!/bin/bash

# Complete Server Fix - Add enum values and create users
# This fixes the enum and creates users in one script

echo "🔧 Complete server fix - enum + users..."

echo "📋 Current user_role enum values:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT unnest(enum_range(NULL::user_role));"

echo ""
echo "🔧 Adding missing enum values..."

# Add security_analyst to enum if it doesn't exist
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
DO \$\$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'security_analyst' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'security_analyst';
        RAISE NOTICE 'Added security_analyst to user_role enum';
    ELSE
        RAISE NOTICE 'security_analyst already exists in user_role enum';
    END IF;
END
\$\$;
"

# Add it_helpdesk_analyst to enum if it doesn't exist
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
DO \$\$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'it_helpdesk_analyst' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'it_helpdesk_analyst';
        RAISE NOTICE 'Added it_helpdesk_analyst to user_role enum';
    ELSE
        RAISE NOTICE 'it_helpdesk_analyst already exists in user_role enum';
    END IF;
END
\$\$;
"

echo ""
echo "📋 Updated user_role enum values:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT unnest(enum_range(NULL::user_role));"

echo ""
echo "🔧 Creating users..."

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
echo "✅ Users created successfully!"
echo ""
echo "🧪 Test login credentials:"
echo "  Security Analyst: security.analyst@company.com / admin123"
echo "  Helpdesk Analyst: helpdesk.analyst@company.com / admin123"
echo ""
echo "📋 Verify users were created:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT email, first_name, last_name, role FROM users WHERE role IN ('security_analyst', 'it_helpdesk_analyst');"