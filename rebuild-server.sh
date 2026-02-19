#!/bin/bash
# Run this script ON THE SERVER after files are copied

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
sudo docker-compose -f docker-compose.prod.yml logs --tail=30 app
