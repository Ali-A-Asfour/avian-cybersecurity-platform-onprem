#!/bin/bash

echo "🔧 Force Rebuilding Container with TenantSelector Fix"
echo "=================================================="
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

# Create expect script for full rebuild
cat > /tmp/rebuild.exp << EOF
#!/usr/bin/expect -f

set timeout 300
set server_password "$PASSWORD"

spawn ssh avian@192.168.1.115

expect "password:"
send "\$server_password\r"

expect "$ "
send "cd /home/avian/avian-cybersecurity-platform-onprem\r"

expect "$ "
send "echo 'Stopping containers...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml down\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Rebuilding app container...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml build --no-cache app\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Starting containers...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml up -d\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "exit\r"
expect eof
EOF

chmod +x /tmp/rebuild.exp

echo "🔄 Running full rebuild..."
/tmp/rebuild.exp

rm -f /tmp/rebuild.exp

echo ""
echo "⏳ Waiting for services to start..."
sleep 30

echo "🧪 Testing the fix..."
curl -k -s -o /dev/null -w "Main page status: %{http_code}\n" "https://192.168.1.115/"

echo ""
echo "✅ Rebuild complete!"
echo ""
echo "Now try:"
echo "1. Go to https://192.168.1.115/login"
echo "2. Login with admin@avian.local / admin123"
echo "3. Look for [TenantSelector] debug logs in console"
echo "4. You should see your test companies!"