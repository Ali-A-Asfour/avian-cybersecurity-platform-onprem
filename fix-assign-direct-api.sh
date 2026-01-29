#!/bin/bash

echo "🔧 Fixing assign-direct API to use file-based store..."

# Copy the fixed assign-direct API to server
echo "📁 Copying fixed assign-direct API..."
scp src/app/api/tickets/assign-direct/route.ts avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/tickets/assign-direct/

if [ $? -eq 0 ]; then
    echo "✅ File copied successfully"
else
    echo "❌ Failed to copy file"
    exit 1
fi

# SSH to server and rebuild
echo "🔧 Executing fixes on server..."
ssh avian@192.168.1.116 << 'EOF'
    cd ~/avian-cybersecurity-platform-onprem
    
    echo "🔄 Rebuilding and restarting application..."
    sudo docker-compose -f docker-compose.prod.yml down
    sudo docker-compose -f docker-compose.prod.yml build --no-cache app
    sudo docker-compose -f docker-compose.prod.yml up -d
    
    echo "⏳ Waiting for services to start..."
    sleep 30
    
    echo "🏥 Checking service health..."
    sudo docker-compose -f docker-compose.prod.yml ps
    
    echo "📋 Checking application logs..."
    sudo docker-compose -f docker-compose.prod.yml logs --tail=10 app
EOF

echo "✅ Assign-direct API fix deployment complete!"
echo ""
echo "🧪 Test the assignment functionality:"
echo "1. Navigate to https://192.168.1.116"
echo "2. Login with h@tcc.com / admin123"
echo "3. Go to Help Desk → Unassigned Tickets"
echo "4. Click 'Assign to me' on any ticket"
echo "5. Should work without 'Internal server error'"