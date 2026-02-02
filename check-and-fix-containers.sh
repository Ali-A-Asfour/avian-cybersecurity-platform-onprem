#!/bin/bash

echo "🔍 Checking Container Status"
echo "============================"
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

# Create expect script to check and fix containers
cat > /tmp/check_containers.exp << EOF
#!/usr/bin/expect -f

set timeout 60
set server_password "$PASSWORD"

spawn ssh avian@192.168.1.115

expect "password:"
send "\$server_password\r"

expect "$ "
send "cd /home/avian/avian-cybersecurity-platform-onprem\r"

expect "$ "
send "echo 'Checking container status...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml ps\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Checking if app container is stuck...'\r"

expect "$ "
send "sudo docker logs avian-app-prod --tail 20\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Force stopping and restarting if needed...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml stop app\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml up -d app\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Waiting for app to start...'\r"

expect "$ "
send "sleep 15\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml ps app\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "exit\r"
expect eof
EOF

chmod +x /tmp/check_containers.exp

echo "🔧 Checking and fixing containers..."
/tmp/check_containers.exp

rm -f /tmp/check_containers.exp

echo ""
echo "🧪 Testing if the site is working..."
sleep 5

MAIN_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://192.168.1.115/")
echo "Main page status: $MAIN_STATUS"

if [ "$MAIN_STATUS" = "200" ]; then
    echo "✅ Site is working!"
    echo ""
    echo "Now try:"
    echo "1. Refresh your browser page"
    echo "2. The 401 errors should be gone"
    echo "3. Dashboard should load without 'Application error'"
else
    echo "❌ Site still not responding properly"
fi