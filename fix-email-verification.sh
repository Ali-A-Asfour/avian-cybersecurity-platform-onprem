#!/bin/bash

# Fix email verification for on-premises deployment
# This script disables email verification requirements since we don't have email services

echo "🔧 Fixing email verification for on-premises deployment..."

# Update all existing users to have email_verified = true
echo "📊 Setting all existing users as email verified..."

# Run the database update inside the PostgreSQL container
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U avian -d avian << 'EOF'
-- Set all existing users as email verified (since we don't have email services)
UPDATE users SET email_verified = true WHERE email_verified = false;

-- Show updated users
SELECT id, email, email_verified, is_active FROM users;
EOF

if [ $? -eq 0 ]; then
    echo "✅ All users set as email verified successfully"
else
    echo "❌ Failed to update user email verification status"
    exit 1
fi

echo "🔧 Email verification fix completed!"
echo "📋 Users can now login without email verification."