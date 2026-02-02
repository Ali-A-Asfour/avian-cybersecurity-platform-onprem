#!/bin/bash

# Fix Server Database Schema - Handle Column Name Issues
# This script will fix the database schema issues on the server

echo "🔧 Fixing server database schema..."

# First, let's see what columns actually exist
echo "📋 Current columns in users table:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY column_name;"

echo ""
echo "🔧 Checking for problematic columns..."

# Check if ma_secret exists (typo column)
MA_SECRET_EXISTS=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'ma_secret';" | tr -d ' ')

# Check if ma_setup_completed exists (typo column)  
MA_SETUP_EXISTS=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'ma_setup_completed';" | tr -d ' ')

echo "ma_secret exists: $MA_SECRET_EXISTS"
echo "ma_setup_completed exists: $MA_SETUP_EXISTS"

# Fix ma_secret if it exists
if [ "$MA_SECRET_EXISTS" = "1" ]; then
    echo "🔧 Renaming ma_secret to mfa_secret..."
    sudo docker exec avian-postgres-prod psql -U avian -d avian -c "ALTER TABLE users RENAME COLUMN ma_secret TO mfa_secret;"
else
    echo "✅ ma_secret column doesn't exist (good)"
fi

# Fix ma_setup_completed if it exists
if [ "$MA_SETUP_EXISTS" = "1" ]; then
    echo "🔧 Renaming ma_setup_completed to mfa_setup_completed..."
    sudo docker exec avian-postgres-prod psql -U avian -d avian -c "ALTER TABLE users RENAME COLUMN ma_setup_completed TO mfa_setup_completed;"
else
    echo "✅ ma_setup_completed column doesn't exist (good)"
fi

# Verify the fix
echo ""
echo "📋 MFA-related columns after fix:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%mfa%' ORDER BY column_name;"

echo ""
echo "✅ Database schema fix complete!"