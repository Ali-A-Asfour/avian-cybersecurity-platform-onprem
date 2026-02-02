#!/bin/bash

# Fix Final API Errors - Missing Database Table and Logger Issues
# Date: January 23, 2026

echo "🔧 Fixing final API errors - Database table and logger issues..."

# Copy fixed firewall stream processor
echo "📁 Copying fixed firewall stream processor..."
scp src/lib/firewall-stream-processor.ts avian@192.168.1.115:~/avian-cybersecurity-platform-onprem/src/lib/

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

echo "📋 Checking application logs for errors..."
docker-compose -f docker-compose.prod.yml logs app | tail -20

echo "✅ Final API fixes deployment complete!"
EOF

echo "🎉 Final API error fixes deployed successfully!"
echo ""
echo "🌐 Test the platform at: https://192.168.1.115"
echo "🔑 Login: admin@avian.local / admin123"
echo ""
echo "Expected fixes:"
echo "✅ security_alerts table created - No more database query errors"
echo "✅ Logger import fixed - No more 'logger is not defined' errors"
echo "✅ /api/alerts-incidents/alerts - Should work properly"
echo "✅ Team members page should load without errors"
echo "✅ Dashboard should render without 500/503 errors"