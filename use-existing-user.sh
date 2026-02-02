#!/bin/bash

# Use Existing User for Testing
echo "👤 Checking existing users..."

# Show existing users
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT email, role FROM users LIMIT 5;"

echo ""
echo "🔑 Let's use an existing user. What users do you have?"

# Try common existing users
echo "Testing admin@example.com..."
curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  -k

echo ""
echo "Testing admin@admin.com..."
curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@admin.com","password":"admin123"}' \
  -k

echo ""
echo "Testing h@tcc.com with 12345678..."
curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k