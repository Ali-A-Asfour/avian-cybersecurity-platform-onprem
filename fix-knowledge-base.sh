#!/bin/bash

# Fix Knowledge Base "Cannot read properties of undefined" Error
# This script fixes the API response handling and adds test data

echo "🚀 Deploying Knowledge Base fix to server..."

SERVER_IP="192.168.1.116"
SERVER_USER="avian"
SERVER_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "📋 Files to deploy:"
echo "  - Fixed KnowledgeBaseSearch component (API response handling)"
echo "  - Test knowledge base articles data"

# Copy fixed KnowledgeBaseSearch component
echo "📚 Copying fixed KnowledgeBaseSearch component..."
scp src/components/help-desk/KnowledgeBaseSearch.tsx ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/components/help-desk/KnowledgeBaseSearch.tsx

# Copy test knowledge base data
echo "📊 Copying test knowledge base data..."
scp .knowledge-base-store.json ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/.knowledge-base-store.json

echo "🔧 Connecting to server to rebuild Docker container..."

ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "🔨 Rebuilding application container..."
sudo docker-compose -f docker-compose.prod.yml build app

echo "🚀 Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for containers to be ready..."
sleep 15

echo "🔍 Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo "✅ Deployment complete!"
echo ""
echo "🧪 Test the fix:"
echo "1. Login to https://192.168.1.116 with h@tcc.com / 12345678"
echo "2. Go to Help Desk → Knowledge Base tab"
echo "3. ✅ Should load without 'Cannot read properties of undefined' error"
echo "4. ✅ Should show 5 knowledge base articles"
echo "5. ✅ Should be able to search articles"
echo ""
echo "📚 Available articles:"
echo "  - Email Configuration Issues in Outlook"
echo "  - How to Reset Domain Account Passwords"
echo "  - Troubleshooting Network Printer Connection Problems"
echo "  - VPN Setup Guide for Remote Workers"
echo "  - Standard Software Installation Procedures"

EOF

echo "🎉 Deployment completed successfully!"
echo ""
echo "🔍 Changes made:"
echo "✅ Fixed API response handling in KnowledgeBaseSearch component"
echo "✅ Added proper error handling for undefined data"
echo "✅ Created 5 test knowledge base articles"
echo "✅ Articles include realistic IT support content"
echo "✅ Proper data structure matching API expectations"