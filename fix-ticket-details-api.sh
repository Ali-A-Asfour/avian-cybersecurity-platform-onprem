#!/bin/bash

echo "🔧 Fixing ticket details API to use file-based store..."

# Copy the fixed ticket details API to server
echo "📁 Copying fixed ticket details API..."
scp "src/app/api/tickets/[id]/route.ts" "avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/tickets/[id]/"

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

echo "✅ Ticket details API fix deployment complete!"
echo ""
echo "🧪 Test the ticket details functionality:"
echo "1. Navigate to https://192.168.1.116"
echo "2. Login with h@tcc.com / admin123"
echo "3. Go to Help Desk → Unassigned Tickets"
echo "4. Click 'View Details' on any ticket"
echo "5. Should load ticket details without 'Failed to fetch ticket' error"