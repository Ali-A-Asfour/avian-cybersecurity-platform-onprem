#!/bin/bash

# Fix Account Inactive Issue
# Updates user accounts to be active in the database

echo "=== FIXING ACCOUNT INACTIVE ISSUE ==="
echo "Timestamp: $(date)"
echo "Target: Set user accounts to active in database"
echo

# SSH into server and fix database
ssh avian@192.168.1.116 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "Connecting to PostgreSQL database..."

# Connect to database and update user accounts
sudo docker exec -i avian-postgres-prod psql -U avian -d avian << 'SQL'
-- Check current user status
SELECT email, is_active, account_locked, failed_login_attempts FROM users;

-- Update all users to be active
UPDATE users SET 
    is_active = true,
    account_locked = false,
    failed_login_attempts = 0,
    locked_until = NULL,
    last_failed_login = NULL
WHERE email IN ('admin@avian.local', 'tadmin@test.com');

-- Verify the update
SELECT email, is_active, account_locked, failed_login_attempts FROM users;
SQL

echo "Database update completed!"
EOF

if [ $? -eq 0 ]; then
    echo "✅ Account status fixed successfully"
else
    echo "❌ Failed to fix account status"
    exit 1
fi

echo
echo "🧪 Testing login..."
echo "Try logging in with:"
echo "  - admin@avian.local / admin123"
echo "  - tadmin@test.com / admin123"
echo
echo "=== ACCOUNT FIX COMPLETE ==="