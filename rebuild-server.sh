#!/bin/bash

# Manual Docker Rebuild Script
# Run this on the server to rebuild the container with the latest changes

echo "🔄 Rebuilding Docker container with latest changes..."

# Stop containers
echo "⏹️ Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

# Rebuild with no cache to ensure changes are applied
echo "🔨 Rebuilding app container (this may take a few minutes)..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

# Start containers
echo "▶️ Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

# Check container status
echo "📊 Container status:"
sudo docker-compose -f docker-compose.prod.yml ps

echo ""
echo "✅ Rebuild complete!"
echo ""
echo "🔗 Test the changes:"
echo "  1. Open https://192.168.1.116 in browser"
echo "  2. Login as helpdesk analyst: helpdesk.analyst@company.com / admin123"
echo "  3. Use tenant selector in header - should not refresh page"
echo "  4. Switch between tenants and check ticket visibility"