#!/bin/bash

# Check and Create User for Ticket Assignment Testing
echo "👤 Checking existing users and creating correct one..."

echo "1. Checking existing users..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT email, role, tenant_id FROM users WHERE email LIKE '%@%' LIMIT 10;"

echo ""
echo "2. Checking if h@tcc.com exists..."
USER_EXISTS=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT COUNT(*) FROM users WHERE email = 'h@tcc.com';" | tr -d ' ')

if [ "$USER_EXISTS" -gt 0 ]; then
    echo "✅ User h@tcc.com exists"
    
    echo "3. Updating password to 12345678..."
    # Generate bcrypt hash for "12345678"
    sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
    UPDATE users SET 
        password_hash = '\$2b\$12\$LQv3c1yqBwlVHpPx7fgHNO7eGJqxgJVeQstSX.fQ2NFFz6h4GhVqW'
    WHERE email = 'h@tcc.com';
    "
else
    echo "❌ User h@tcc.com does not exist"
    
    echo "3. Creating user h@tcc.com..."
    sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
    INSERT INTO users (
      id, email, password_hash, role, tenant_id, first_name, last_name,
      email_verified, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'h@tcc.com',
      '\$2b\$12\$LQv3c1yqBwlVHpPx7fgHNO7eGJqxgJVeQstSX.fQ2NFFz6h4GhVqW',
      'it_helpdesk_analyst',
      (SELECT id FROM tenants LIMIT 1),
      'Helpdesk',
      'Analyst',
      true,
      NOW(),
      NOW()
    );
    "
fi

echo ""
echo "4. Verifying user..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT email, role, first_name, last_name FROM users WHERE email = 'h@tcc.com';"

echo ""
echo "5. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k)

echo "Login response: $LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ LOGIN WORKING!"
    
    # Extract token and test assignment
    TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    TENANT_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c 'SELECT id FROM tenants LIMIT 1;' | tr -d ' ')
    
    echo "6. Testing ticket assignment..."
    TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE status = 'new' AND assignee IS NULL LIMIT 1;" | tr -d ' ')
    
    if [ -n "$TICKET_ID" ]; then
        ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
          -H 'Content-Type: application/json' \
          -H "Authorization: Bearer $TOKEN" \
          -H "x-selected-tenant-id: $TENANT_ID" \
          -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"h@tcc.com\"}" \
          -k)
        
        echo "Assignment response: $ASSIGN_RESPONSE"
        
        if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
            echo "✅ TICKET ASSIGNMENT WORKING!"
        else
            echo "❌ Assignment failed"
        fi
    else
        echo "No unassigned tickets to test"
    fi
else
    echo "❌ Login still failing"
fi

echo ""
echo "🎯 Ready to test in web interface:"
echo "   URL: https://192.168.1.116"
echo "   User: h@tcc.com"
echo "   Password: 12345678"