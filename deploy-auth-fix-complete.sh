#!/bin/bash

# Complete Authentication Fix Deployment
# Fixes both login and /api/auth/me endpoints

echo "=== COMPLETE AUTHENTICATION FIX DEPLOYMENT ==="
echo "Timestamp: $(date)"
echo "Target: Fix login and /api/auth/me account active checks"
echo

# Files already copied, now rebuild on server
echo "🔧 Rebuilding Docker container on server..."

# SSH into server and rebuild container
ssh avian@192.168.1.116 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "Rebuilding application with no cache..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

echo "Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "Waiting for containers to be ready..."
sleep 30

echo "Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo "Testing login API..."
curl -k -X POST "https://192.168.1.116/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@avian.local","password":"admin123"}' \
  -c /tmp/test_cookies.txt \
  -s | head -c 100

echo ""
echo "Testing /api/auth/me API..."
curl -k "https://192.168.1.116/api/auth/me" \
  -b /tmp/test_cookies.txt \
  -s | head -c 100

echo ""
echo "Cleanup test cookies..."
rm -f /tmp/test_cookies.txt
EOF

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully"
else
    echo "❌ Deployment failed"
    exit 1
fi

echo
echo "🧪 Ready for testing!"
echo "Try logging in at: https://192.168.1.116/login"
echo "Expected results:"
echo "  - Login succeeds without 'Account is inactive' error"
echo "  - No 403 errors on /api/auth/me"
echo "  - Successful redirect to dashboard"
echo
echo "=== AUTHENTICATION FIX DEPLOYMENT COMPLETE ==="