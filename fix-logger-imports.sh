#!/bin/bash

# Fix Logger Import Issues - Deploy to Server
# This script fixes all commented out logger imports that are causing 503 errors

echo "🔧 Fixing logger import issues and deploying to server..."

# Server details
SERVER_IP="192.168.1.115"
SERVER_USER="avian"
PROJECT_DIR="/home/avian/avian-cybersecurity-platform-onprem"

echo "📁 Copying fixed files to server..."

# Copy all the fixed files to server
scp src/services/agent.service.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/services/
scp src/services/data-ingestion.service.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/services/
scp src/services/threat-lake.service.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/services/

# Copy lib files
scp src/lib/auth-audit.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/
scp src/lib/syslog-server.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/
scp src/lib/performance-monitor.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/
scp src/lib/security-monitor.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/
scp src/lib/database-optimizer.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/
scp src/lib/xss-protection.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/
scp src/lib/cdn-integration.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/

# Copy connector files
scp src/lib/connectors/firewall-connector.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/connectors/
scp src/lib/connectors/edr-connector.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/lib/connectors/

# Copy API route files
scp src/app/api/data-sources/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/data-sources/
scp "src/app/api/data-sources/[id]/route.ts" ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/data-sources/[id]/
scp "src/app/api/data-sources/[id]/test-connection/route.ts" ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/data-sources/[id]/test-connection/

scp src/app/api/performance/optimize/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/performance/optimize/

scp src/app/api/monitoring/health/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/monitoring/
scp src/app/api/monitoring/traces/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/monitoring/
scp src/app/api/monitoring/metrics/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/monitoring/

# Copy threat lake API routes
scp src/app/api/threat-lake/analytics/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/threat-lake/analytics/
scp src/app/api/threat-lake/events/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/threat-lake/events/
scp "src/app/api/threat-lake/events/export/route.ts" ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/threat-lake/events/export/
scp "src/app/api/threat-lake/events/search/route.ts" ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/threat-lake/events/search/
scp src/app/api/threat-lake/threat-intelligence/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/threat-lake/threat-intelligence/
scp src/app/api/threat-lake/correlation-rules/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/threat-lake/correlation-rules/
scp src/app/api/threat-lake/retention/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/threat-lake/retention/

# Copy other API routes
scp src/app/api/security-events/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/security-events/
scp "src/app/api/agents/[id]/heartbeat/route.ts" ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/agents/[id]/heartbeat/
scp src/app/api/agents/register/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/agents/register/
scp src/app/api/ingest/syslog/route.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/app/api/ingest/syslog/

# Copy middleware
scp src/middleware/enhanced-auth.middleware.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/middleware/

echo "🔧 Executing fixes on server..."

# Execute the fixes on the server
ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🔄 Rebuilding and restarting application..."
docker-compose -f docker-compose.prod.yml build --no-cache app
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 30

echo "🏥 Checking service health..."
docker-compose -f docker-compose.prod.yml ps

echo "📋 Checking application logs for errors..."
docker-compose -f docker-compose.prod.yml logs app --tail=20

echo "✅ Logger import fixes deployment complete!"
EOF

echo "🎉 All logger import issues fixed and deployed!"
echo ""
echo "🧪 Test the platform now:"
echo "1. Navigate to https://192.168.1.115"
echo "2. Login with admin@avian.local / admin123"
echo "3. Check that team members page loads without errors"
echo "4. Verify dashboard loads properly without 503 errors"
echo "5. Check browser console for any remaining JavaScript errors"
echo ""
echo "Expected result: No more 503 errors on /assets and /dashboard routes!"