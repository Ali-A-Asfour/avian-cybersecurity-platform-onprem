#!/bin/bash

# Fix API 500/503 Errors - Database Connection Issues
# Date: January 23, 2026

echo "🔧 Fixing API 500/503 errors - Database connection issues..."

# Copy fixed files to server
echo "📁 Copying fixed AlertManager service..."
scp src/services/alerts-incidents/AlertManager.ts avian@192.168.1.115:~/avian-cybersecurity-platform-onprem/src/services/alerts-incidents/

echo "📁 Copying fixed AssetService..."
scp src/services/asset.service.ts avian@192.168.1.115:~/avian-cybersecurity-platform-onprem/src/services/

echo "📁 Copying fixed DashboardService..."
scp src/services/dashboard.service.ts avian@192.168.1.115:~/avian-cybersecurity-platform-onprem/src/services/

# Execute fixes on server
echo "🔧 Executing fixes on server..."
ssh avian@192.168.1.115 << 'EOF'
cd ~/avian-cybersecurity-platform-onprem

echo "🔄 Rebuilding and restarting application..."
docker-compose -f docker-compose.prod.yml build --no-cache app
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 30

echo "🏥 Checking service health..."
docker-compose -f docker-compose.prod.yml ps

echo "📋 Checking application logs..."
docker-compose -f docker-compose.prod.yml logs app | tail -10

echo "✅ API fixes deployment complete!"
EOF

echo "🎉 API error fixes deployed successfully!"
echo ""
echo "🌐 Test the platform at: https://192.168.1.115"
echo "🔑 Login: admin@avian.local / admin123"
echo ""
echo "Expected fixes:"
echo "✅ /api/alerts-incidents/alerts - No more 500 errors"
echo "✅ /api/assets - No more 503 errors"  
echo "✅ /api/dashboard - No more 503 errors"
echo "✅ Team members page should load without errors"
echo "✅ Dashboard charts should render properly"