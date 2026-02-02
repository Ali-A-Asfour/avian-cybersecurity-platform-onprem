#!/bin/bash

# Fix Server 503 RSC Errors and API 500 Errors
# Date: January 25, 2026
# Issue: Systemic 503 errors on all RSC requests and 500 errors on API endpoints

echo "🔧 Fixing server 503 RSC errors and API 500 errors..."

# First, let's check if the server rebuild completed properly
echo "📋 Checking server status..."
ssh -o StrictHostKeyChecking=no avian@192.168.1.115 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🔍 Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🔍 Checking recent application logs..."
sudo docker-compose -f docker-compose.prod.yml logs --tail=20 app

echo ""
echo "🔍 Checking database connection..."
sudo docker-compose -f docker-compose.prod.yml logs --tail=10 postgres

echo ""
echo "🔧 Attempting to restart services..."
sudo docker-compose -f docker-compose.prod.yml down
sleep 5

echo "🚀 Starting services with fresh containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 30

echo ""
echo "✅ Services restarted. Checking status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🧪 Testing basic connectivity..."
curl -k -s https://localhost/api/auth/me -H "Authorization: Bearer test" -w "Status: %{http_code}\n" | tail -1

EOF

echo ""
echo "✅ Server restart completed!"
echo ""
echo "🧪 Testing from local machine..."
echo "Testing authentication endpoint..."
curl -k -s "https://192.168.1.115/api/auth/me" -H "Authorization: Bearer $TOKEN" -w "HTTP Status: %{http_code}\n" | tail -1

echo ""
echo "Testing dashboard widgets endpoint..."
curl -k -s "https://192.168.1.115/api/dashboard/widgets" -H "Authorization: Bearer $TOKEN" -w "HTTP Status: %{http_code}\n" | tail -1

echo ""
echo "Testing users endpoint..."
curl -k -s "https://192.168.1.115/api/users" -H "Authorization: Bearer $TOKEN" -w "HTTP Status: %{http_code}\n" | tail -1

echo ""
echo "🎯 Next steps:"
echo "1. Navigate to: https://192.168.1.115"
echo "2. Login with: admin@avian.local / admin123 (or tadmin@test.com / admin123)"
echo "3. Try accessing different pages to verify RSC requests work"
echo "4. Check browser console for any remaining 503 errors"