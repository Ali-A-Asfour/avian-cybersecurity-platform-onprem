#!/bin/bash

# Fix User Roles Enum - Add missing enum values for cross-tenant roles
# This script adds security_analyst and it_helpdesk_analyst to the user_role enum

echo "🔧 Adding missing user role enum values..."

# Add security_analyst to user_role enum
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'security_analyst';" 2>/dev/null || echo "security_analyst already exists or error occurred"

# Add it_helpdesk_analyst to user_role enum  
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'it_helpdesk_analyst';" 2>/dev/null || echo "it_helpdesk_analyst already exists or error occurred"

# Verify enum values
echo "📋 Current user_role enum values:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT unnest(enum_range(NULL::user_role));"

echo "✅ User role enum update complete!"