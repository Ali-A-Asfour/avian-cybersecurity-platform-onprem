#!/bin/bash

# Fix tenant database schema and service on server
# This script adds missing columns to tenants table and fixes TenantService

echo "🔧 Fixing tenant database schema and service..."

# Database connection details
DB_HOST="localhost"
DB_USER="avian"
DB_NAME="avian"

echo "📊 Adding missing columns to tenants table..."

# Add missing columns to tenants table
PGPASSWORD="avian_password" psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'
-- Add missing columns to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS theme_color VARCHAR(7),
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}' NOT NULL;

-- Verify the table structure
\d tenants;

-- Show current tenants
SELECT id, name, domain, is_active FROM tenants;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database schema updated successfully"
else
    echo "❌ Failed to update database schema"
    exit 1
fi

echo "🔧 Database fixes completed!"