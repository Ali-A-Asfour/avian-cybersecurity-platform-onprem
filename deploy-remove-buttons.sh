#!/bin/bash

# Deploy fix to remove My Tickets and Create Ticket buttons from dashboard
# This removes the buttons from the top right corner as requested

echo "🚀 Deploying button removal fix to production server..."

# Copy the fixed dashboard page
echo "📁 Copying updated dashboard page to server..."
scp src/app/dashboard/page.tsx avian@192.168.1.116:/tmp/dashboard-page.tsx

if [ $? -eq 0 ]; then
    echo "✅ File copied successfully to /tmp/"
else
    echo "❌ Failed to copy file"
    exit 1
fi

echo ""
echo "🔧 Now moving file and rebuilding Docker container on server..."
echo "Please run these commands on the server (SSH into 192.168.1.116):"
echo ""
echo "# Move file to correct location"
echo "sudo cp /tmp/dashboard-page.tsx /home/avian/avian-cybersecurity-platform-onprem/src/app/dashboard/page.tsx"
echo ""
echo "# Rebuild container"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml down"
echo "sudo docker-compose -f docker-compose.prod.yml build --no-cache app"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "🎯 Expected Results After Deployment:"
echo "- ✅ NO MORE 'My Tickets' button in top right corner"
echo "- ✅ NO MORE 'Create Ticket' button in top right corner"
echo "- ✅ Clean dashboard header with only role-specific actions for other roles"
echo "- ✅ Tickets still work - users can create tickets from 'My Open Tickets' section"
echo ""
echo "🧪 Test Steps:"
echo "1. Login as u@esr.com / admin123"
echo "2. Go to dashboard"
echo "3. Verify NO buttons in top right corner"
echo "4. Verify 'My Open Tickets' section still shows created tickets"
echo "5. Verify users can still create tickets from the main 'Create New Ticket' button"
echo ""
echo "🔧 Technical Change Made:"
echo "- Modified getRoleSpecificActions() for UserRole.USER to return null"
echo "- Removed both 'My Tickets' and 'Create Ticket' buttons from dashboard header"
echo "- Users can still access ticket functionality through other UI elements"