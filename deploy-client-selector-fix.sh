#!/bin/bash

echo "=== Deploying Client Selector Fix to Server ==="

SERVER="avian@209.227.150.115"
REMOTE_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo ""
echo "📦 Copying modified files to server..."

# Copy the 3 modified files
scp src/app/api/alerts-incidents/demo/alerts/route.ts ${SERVER}:${REMOTE_PATH}/src/app/api/alerts-incidents/demo/alerts/
scp src/contexts/DemoContext.tsx ${SERVER}:${REMOTE_PATH}/src/contexts/
scp src/lib/api-client.ts ${SERVER}:${REMOTE_PATH}/src/lib/

echo ""
echo "✅ Files copied successfully!"
echo ""
echo "🔨 Now rebuilding Docker container on server..."
echo ""

# SSH to server and rebuild
ssh ${SERVER} << 'ENDSSH'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo ""
echo "Rebuilding app container..."
sudo docker-compose -f docker-compose.prod.yml build app

echo ""
echo "Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "Waiting for containers to start..."
sleep 5

echo ""
echo "Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Recent app logs:"
sudo docker-compose -f docker-compose.prod.yml logs --tail=20 app
ENDSSH

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "🧪 To test:"
echo "1. Open https://localhost:8443 (with SSH tunnel)"
echo "2. Login as analyst@avian.local / analyst123"
echo "3. Go to Alerts & Incidents"
echo "4. Click 🏢 icon to switch tenants"
echo "5. Verify alerts change:"
echo "   - ACME Corp: 6 alerts"
echo "   - TechStart Inc: 3 alerts"
echo "   - Global Finance Ltd: 3 alerts"
echo ""
