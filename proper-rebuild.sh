#!/bin/bash

echo "🔧 Proper Container Rebuild"
echo "==========================="
echo ""
echo "The files are updated but the container is still running old code."
echo "We need to rebuild the container to pick up the changes."
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

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
send "echo 'Stopping app container...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml stop app\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Rebuilding app container with updated code...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml build --no-cache app\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Starting app container...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml up -d app\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Rebuild complete!'\r"

expect "$ "
send "exit\r"
expect eof
EOF

chmod +x /tmp/rebuild.exp

echo "🔄 Rebuilding container (this will take 2-3 minutes)..."
/tmp/rebuild.exp

rm -f /tmp/rebuild.exp

echo ""
echo "⏳ Waiting for app to start..."
sleep 30

echo "🧪 Testing the fix..."
curl -k -s -o /dev/null -w "Main page status: %{http_code}\n" "https://192.168.1.115/"

echo ""
echo "✅ Rebuild complete!"
echo ""
echo "Now the container should have the updated code."
echo "Try refreshing your incognito tab - the toFixed() error should be gone!"