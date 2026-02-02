#!/bin/bash

echo "🔧 Fixing Knowledge Base and adding Closed Tickets functionality..."

# Copy all the new and updated files to server
echo "📁 Copying updated help desk page..."
scp src/app/help-desk/page.tsx avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/help-desk/

echo "📁 Copying new ClosedTicketsQueue component..."
scp src/components/help-desk/ClosedTicketsQueue.tsx avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/components/help-desk/

echo "📁 Copying closed tickets API..."
scp -r src/app/api/help-desk/queue/closed-tickets/ avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/help-desk/queue/

echo "📁 Copying knowledge base store..."
scp src/lib/knowledge-base-store.ts avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/lib/

echo "📁 Copying knowledge base API..."
scp -r src/app/api/help-desk/knowledge-base/ avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/help-desk/

echo "📁 Copying updated ticket resolve API..."
scp "src/app/api/tickets/[id]/resolve/route.ts" "avian@192.168.1.116:~/avian-cybersecurity-platform-onprem/src/app/api/tickets/[id]/resolve/"

if [ $? -eq 0 ]; then
    echo "✅ All files copied successfully"
else
    echo "❌ Failed to copy files"
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

echo "✅ Knowledge Base and Closed Tickets functionality deployment complete!"
echo ""
echo "🧪 Test the new functionality:"
echo "1. Navigate to https://192.168.1.116"
echo "2. Login with h@tcc.com / admin123"
echo "3. Go to Help Desk"
echo "4. You should see a new 'Closed Tickets' tab after 'My Tickets'"
echo "5. Resolve a ticket with 'Create Knowledge Article' checked"
echo "6. Check the 'Knowledge Base' tab to see the saved article"
echo "7. Check the 'Closed Tickets' tab to see resolved tickets"