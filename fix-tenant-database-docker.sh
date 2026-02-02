#!/bin/bash

# Fix tenant database schema inside Docker container
echo "🔧 Fixing tenant database schema inside Docker container..."

# Run the database fix inside the PostgreSQL container
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U avian -d avian << 'EOF'
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