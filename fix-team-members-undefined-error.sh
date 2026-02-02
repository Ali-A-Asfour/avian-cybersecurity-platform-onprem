#!/bin/bash

# Fix Team Members Page Undefined Error
# Date: January 25, 2026
# Issue: "Cannot read properties of undefined (reading 'charAt')" error

echo "🔧 Fixing team members page undefined error..."

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
echo ""
echo "🔍 Fixed Issues:"
echo "- ✅ Cannot read properties of undefined (reading 'charAt')"
echo "- ✅ API response mapping (snake_case to camelCase)"
echo "- ✅ Null/undefined firstName/lastName handling"
echo "- ✅ Search filter null safety"
echo "- ✅ Delete confirmation null safety"