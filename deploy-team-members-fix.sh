#!/bin/bash

# Deploy Team Members Page Fix
# Date: January 25, 2026

echo "🔧 Deploying team members page fix..."

# Copy the fixed file to server
echo "📁 Copying fixed team members page..."
scp -o StrictHostKeyChecking=no src/app/admin/users/page.tsx avian@192.168.1.115:/home/avian/avian-cybersecurity-platform-onprem/src/app/admin/users/page.tsx

echo "✅ File copied successfully!"
echo ""
echo "🚀 Next steps (run on server):"
echo "ssh avian@192.168.1.115"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml down"
echo "sudo docker-compose -f docker-compose.prod.yml build --no-cache app"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "🧪 Then test at: https://192.168.1.115"