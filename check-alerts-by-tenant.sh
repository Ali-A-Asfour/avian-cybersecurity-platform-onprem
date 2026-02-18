#!/bin/bash

# Check alerts distribution by tenant
echo "=== Checking Alerts by Tenant ==="
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U avian -d avian << 'EOF'
-- Check if security_alerts table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'security_alerts'
);

-- Count alerts by tenant
SELECT tenant_id, COUNT(*) as alert_count, 
       COUNT(DISTINCT severity) as severity_types,
       COUNT(DISTINCT status) as status_types
FROM security_alerts 
GROUP BY tenant_id;

-- Show sample alerts from each tenant
SELECT tenant_id, id, title, severity, status, assigned_to
FROM security_alerts 
ORDER BY tenant_id, created_at DESC
LIMIT 20;

-- Check tenants table
SELECT id, name, status FROM tenants ORDER BY name;
EOF
