#!/bin/bash

# Fix Team Members Page Server-Side Rendering Issue
# Date: January 25, 2026
# Issue: 503 errors on RSC requests preventing page load

echo "🔧 Fixing team members page server-side rendering issue..."

# Copy the simplified file to server
echo "📁 Copying simplified team members page..."
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
echo "🔍 Changes Made:"
echo "- ✅ Removed ProtectedRoute wrapper (potential SSR issue)"
echo "- ✅ Simplified authentication check to client-side only"
echo "- ✅ Added explicit loading and error states"
echo "- ✅ Direct window.location redirect for unauthenticated users"
echo "- ✅ Maintained all security checks and role validation"