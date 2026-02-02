#!/bin/bash

# Check Application Logs
echo "📋 Checking application logs..."

echo "=== Docker Container Status ==="
sudo docker-compose -f docker-compose.prod.yml ps

echo ""
echo "=== Application Logs (last 50 lines) ==="
sudo docker logs avian-app-prod --tail 50

echo ""
echo "=== Nginx Logs (last 20 lines) ==="
sudo docker logs avian-nginx-prod --tail 20