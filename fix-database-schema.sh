#!/bin/bash

# Fix Database Schema - Column Name Typos
# This script fixes the mfa column name typos in the database

echo "🔧 Checking and fixing database schema..."

# Check current column names
echo "📋 Current mfa-related columns in users table:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%mfa%' OR column_name LIKE '%ma_%';"

echo ""
echo "🔧 Attempting to fix column name typos..."

# Fix mfa_secret if it's named ma_secret
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "ALTER TABLE users RENAME COLUMN ma_secret TO mfa_secret;" 2>/dev/null || echo "ma_secret column doesn't exist or already correct"

# Fix mfa_setup_completed if it's named ma_setup_completed  
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "ALTER TABLE users RENAME COLUMN ma_setup_completed TO mfa_setup_completed;" 2>/dev/null || echo "ma_setup_completed column doesn't exist or already correct"

echo ""
echo "📋 Updated mfa-related columns:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%mfa%';"

echo ""
echo "✅ Database schema fix complete!"